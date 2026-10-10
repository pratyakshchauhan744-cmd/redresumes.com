import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
const testUrl = process.env.CREDIT_IDEMPOTENCY_TEST_DATABASE_URL;
if (!testUrl || !["localhost", "127.0.0.1"].includes(new URL(testUrl).hostname) || !new URL(testUrl).pathname.includes("idempotency_test")) {
  throw new Error("Set CREDIT_IDEMPOTENCY_TEST_DATABASE_URL to an isolated local idempotency_test database.");
}
process.env.DATABASE_URL = testUrl;
env.DATABASE_URL = testUrl;
const { errorHandler } = await import("../middleware/error-handler.js");
const { prisma } = await import("../db/prisma.js");
const { default: enterpriseRoutes } = await import("../modules/enterprise/routes.js");
const { executeIdempotentCreditOperation } = await import("../modules/enterprise/credit-idempotency.js");

import { allocateInstitutionCreditsToStudent } from "../modules/enterprise/credit-transfer.js";

import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];

const workers: ReturnType<typeof fork>[] = [];
if (process.argv.includes("--worker")) {
  const app = express();
  app.use(express.json());
  app.use("/api/enterprise", enterpriseRoutes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (address && typeof address === "object") process.send?.(address.port);
  });
  process.on("message", () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
  await new Promise(() => {});
}
async function startWorker() {
  const child = fork(fileURLToPath(import.meta.url), ["--worker"], { execArgv: ["--import", "tsx"], stdio: ["ignore", "inherit", "inherit", "ipc"] });
  workers.push(child);
  return await new Promise<string>((resolve, reject) => {
    child.once("message", port => resolve(`http://127.0.0.1:${port}/api/enterprise`));
    child.once("error", reject);
    child.once("exit", code => reject(new Error(`Worker exited: ${code}`)));
  });
}
async function stopWorker(child: ReturnType<typeof fork>) {
  if (child.exitCode !== null) return;
  await new Promise<void>(resolve => { child.once("exit", () => resolve()); child.send("stop"); });
}
let baseUrl = await startWorker();
const secondUrl = await startWorker();

async function createFixture(label: string, balance = 10, studentCount = 4) {
  const passwordHash = await bcrypt.hash("E07-Test-Password!", 4);
  const college = await prisma.college.create({
    data: {
      name: `E07 ${label} College ${suffix}`,
      code: `E07${label}${Date.now()}`,
      officialEmail: `e07.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);
  await prisma.collegeCreditAccount.create({
    data: { collegeId: college.id, totalAllocated: balance, totalDistributed: 0, balance },
  });

  const faculty = await prisma.user.create({
    data: {
      name: `E07 ${label} Faculty`,
      email: `e07.faculty.${label}.${suffix}@example.com`,
      passwordHash,
      role: "college_main_faculty",
      collegeId: college.id,
      isActive: true,
    },
  });
  await prisma.collegeFaculty.create({
    data: {
      userId: faculty.id,
      collegeId: college.id,
      isMainFaculty: true,
      permissions: ["all"],
      status: "active",
    },
  });

  const students = [];
  for (let index = 0; index < studentCount; index++) {
    const user = await prisma.user.create({
      data: {
        name: `E07 ${label} Student ${index}`,
        email: `e07.student.${label}.${index}.${suffix}@example.com`,
        passwordHash,
        role: "student",
        collegeId: college.id,
        isActive: true,
        credits: { create: { balance: 0 } },
      },
    });
    students.push(await prisma.collegeStudent.create({
      data: {
        userId: user.id,
        collegeId: college.id,
        enrollmentNumber: `E07-${label}-${index}-${suffix}`,
        program: "B.Tech",
        course: "Computer Science",
        section: "A",
        batch: "2026",
        status: "active",
      },
    }));
  }

  const token = signAccessToken({
    sub: faculty.id,
    email: faculty.email,
    role: faculty.role,
    collegeId: college.id,
    isMainFaculty: true,
    permissions: ["all"],
  });
  return { college, faculty, students, token, startingBalance: balance };
}

async function post(path: string, token: string, body: Record<string, unknown>, key: string | undefined = randomUUID(), url = baseUrl) {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function accountingSnapshot(collegeId: string) {
  const account = await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId } });
  const students = await prisma.collegeStudent.findMany({
    where: { collegeId },
    include: { user: { include: { credits: true } } },
  });
  const ledger = await prisma.collegeCreditTransaction.aggregate({
    where: { collegeId, amount: { gt: 0 } },
    _sum: { amount: true },
    _count: true,
  });
  return {
    account,
    studentCredits: students.reduce((sum, student) => sum + (student.user.credits?.balance ?? 0), 0),
    ledgerCredits: ledger._sum.amount ?? 0,
    ledgerCount: ledger._count,
  };
}

async function assertAccountingInvariant(collegeId: string, startingBalance: number, expectedGranted: number) {
  const snapshot = await accountingSnapshot(collegeId);
  const debited = startingBalance - snapshot.account.balance;
  assert.equal(snapshot.account.balance, startingBalance - expectedGranted);
  assert(snapshot.account.balance >= 0, "institutional balance became negative");
  assert.equal(debited, expectedGranted, "unexpected institutional debit");
  assert.equal(snapshot.account.totalDistributed, expectedGranted, "distributed total diverged from debit");
  assert.equal(snapshot.studentCredits, expectedGranted, "student balances diverged from debit");
  assert.equal(snapshot.ledgerCredits, expectedGranted, "ledger diverged from debit");
}


try {
  const fixture = await createFixture("idempotent", 100);
  const key = randomUUID();
  const payload = { creditsPerStudent: 3, studentIds: fixture.students.slice(0, 2).map(s => s.id), reason: "Persistent credit regression" };
  const call = (body = payload, k: string | undefined = key, url = baseUrl) => post("/credits/distribute", fixture.token, body, k, url);
  // Independent processes and pools, not just concurrent promises in one backend.
  const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => call(payload, key, i % 2 ? secondUrl : baseUrl)));
  assert(responses.every(r => r.status === 200));
  const bodies = await Promise.all(responses.map(r => r.json()));
  for (const body of bodies) assert.deepEqual(body, bodies[0]);
  await assertAccountingInvariant(fixture.college.id, 100, 6);
  assert.equal((await accountingSnapshot(fixture.college.id)).ledgerCount, 2);
  assert.equal(await prisma.enterpriseAuditLog.count({ where: { collegeId: fixture.college.id, action: "BULK_CREDITS_DISTRIBUTED" } }), 1);
  console.log("PASS ten requests across two backend processes: one debit, ledger set and audit");

  // Ignore the committed response to model response loss, then reconnect/restart.
  await call();
  await stopWorker(workers[0]);
  baseUrl = await startWorker();
  assert.deepEqual(await (await call()).json(), bodies[0]);
  await assertAccountingInvariant(fixture.college.id, 100, 6);
  console.log("PASS lost response and backend restart replay the persisted original response");

  assert.equal((await call({ ...payload, creditsPerStudent: 4 })).status, 409);
  assert.equal((await call({ ...payload, studentIds: [fixture.students[2].id] })).status, 409);
  const equivalent = await post("/credits/distribute", fixture.token, {
    reason: payload.reason, filters: { studentIds: [...payload.studentIds].reverse().concat(payload.studentIds[0]) }, creditsPerStudent: 3,
  }, key);
  assert.equal(equivalent.status, 200);
  assert.deepEqual(await equivalent.json(), bodies[0]);
  console.log("PASS payload conflicts and canonical flat/nested recipient sets");

  assert.equal((await call(payload, "invalid")).status, 400);
  // bypass post's default parameter to send an actually absent header
  const missing = await fetch(`${baseUrl}/credits/distribute`, { method: "POST", headers: { authorization: `Bearer ${fixture.token}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(missing.status, 400);
  assert.equal((await call(payload, randomUUID())).status, 200);
  await assertAccountingInvariant(fixture.college.id, 100, 12);
  console.log("PASS missing/malformed keys denied; distinct valid key executes independently");

  const retryKey = randomUUID();
  const expensive = { ...payload, creditsPerStudent: 50 };
  assert.equal((await call(expensive, retryKey)).status, 400);
  await assertAccountingInvariant(fixture.college.id, 100, 12);
  assert.equal(await prisma.creditIdempotencyRecord.count({ where: { key: retryKey } }), 0);
  await prisma.collegeCreditAccount.update({ where: { collegeId: fixture.college.id }, data: { balance: { increment: 100 }, totalAllocated: { increment: 100 } } });
  assert.equal((await call(expensive, retryKey)).status, 200);
  await assertAccountingInvariant(fixture.college.id, 200, 112);
  console.log("PASS insufficient balance rolls back all effects and claim; same-key retry succeeds after funding");

  const rollbackKey = randomUUID();
  const scope = { collegeId: fixture.college.id, actorId: fixture.faculty.id, operation: "ROLLBACK_TEST", key: rollbackKey };
  const before = await accountingSnapshot(fixture.college.id);
  await assert.rejects(executeIdempotentCreditOperation(prisma, scope, { amount: 1 }, async tx => {
    await allocateInstitutionCreditsToStudent({ tx, collegeId: fixture.college.id, studentId: fixture.students[0].id, userId: fixture.students[0].userId, actorId: fixture.faculty.id, amount: 1, type: "STUDENT_ASSIGNMENT", reason: "Forced rollback" });
    throw new Error("Injected failure after ledger");
  }), /Injected failure/);
  assert.deepEqual(await accountingSnapshot(fixture.college.id), before);
  assert.equal(await prisma.creditIdempotencyRecord.count({ where: { key: rollbackKey } }), 0);
  const retryReceipt = await executeIdempotentCreditOperation(prisma, scope, { amount: 1 }, async tx => {
    const result = await allocateInstitutionCreditsToStudent({ tx, collegeId: fixture.college.id, studentId: fixture.students[0].id, userId: fixture.students[0].userId, actorId: fixture.faculty.id, amount: 1, type: "STUDENT_ASSIGNMENT", reason: "Successful rollback retry" });
    return { success: true, studentBalance: result!.studentCredit.balance };
  });
  assert.deepEqual(await executeIdempotentCreditOperation(prisma, scope, { amount: 1 }, async () => { throw new Error("Replay must not execute"); }), retryReceipt);
  await assertAccountingInvariant(fixture.college.id, 200, 113);
  console.log("PASS failure after ledger rolls back credits, ledger and claim; key remains retryable");

  const other = await createFixture("tenant", 100);
  assert.equal((await post("/credits/distribute", other.token, { ...payload, collegeId: fixture.college.id, actorId: fixture.faculty.id, studentIds: [other.students[0].id] }, key)).status, 200);
  await assertAccountingInvariant(other.college.id, 100, 3);
  const singleKey = randomUUID();
  const single = { studentId: other.students[1].id, amount: 2, reason: "Single assignment alias" };
  const first = await post("/credits/student-assign", other.token, single, singleKey);
  const replay = await post("/credits/assign-student", other.token, single, singleKey);
  assert.equal(first.status, 200); assert.equal(replay.status, 200);
  assert.deepEqual(await first.json(), await replay.json());
  await assertAccountingInvariant(other.college.id, 100, 5);
  console.log("PASS tenant isolation and shared single-assignment alias scope");

  await prisma.collegeFaculty.update({ where: { userId: fixture.faculty.id }, data: { status: "inactive" } });
  assert.equal((await call()).status, 403);
  console.log("PASS deactivated faculty denied before replay");
  console.log("Credit idempotency database regression suite passed.");
} finally {
  for (const worker of workers) await stopWorker(worker);
  for (const collegeId of collegeIds.reverse()) {
    await prisma.creditIdempotencyRecord.deleteMany({ where: { collegeId } });
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  }
  await prisma.$disconnect();
}
