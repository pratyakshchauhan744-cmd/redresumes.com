import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { allocateInstitutionCreditsToStudent } from "../modules/enterprise/credit-transfer.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];

const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/enterprise`;

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

async function post(path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "Idempotency-Key": randomUUID(),
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

async function assertOneSuccessOneInsufficient(responses: Response[]) {
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
  const failed = responses.find((response) => response.status === 400);
  assert(failed);
  const body = await failed.json() as { message?: string };
  assert.match(body.message ?? "", /Insufficient college credits/);
}

try {
  {
    const fixture = await createFixture("single");
    const responses = await Promise.all([
      post("/credits/student-assign", fixture.token, {
        studentId: fixture.students[0].id,
        amount: 8,
        reason: "E-07 concurrent single allocation A",
      }),
      post("/credits/student-assign", fixture.token, {
        studentId: fixture.students[1].id,
        amount: 8,
        reason: "E-07 concurrent single allocation B",
      }),
    ]);
    await assertOneSuccessOneInsufficient(responses);
    await assertAccountingInvariant(fixture.college.id, fixture.startingBalance, 8);
    console.log("PASS concurrent single allocations allow exactly one funded transfer");
  }

  {
    const fixture = await createFixture("bulk");
    const selected = [fixture.students[0].id, fixture.students[1].id];
    const responses = await Promise.all([
      post("/credits/distribute", fixture.token, {
        creditsPerStudent: 4,
        studentIds: selected,
        reason: "E-07 concurrent bulk allocation A",
      }),
      post("/credits/distribute", fixture.token, {
        creditsPerStudent: 4,
        studentIds: selected,
        reason: "E-07 concurrent bulk allocation B",
      }),
    ]);
    await assertOneSuccessOneInsufficient(responses);
    await assertAccountingInvariant(fixture.college.id, fixture.startingBalance, 8);
    const snapshot = await accountingSnapshot(fixture.college.id);
    assert.equal(snapshot.ledgerCount, 2, "winning bulk request must write one ledger row per student");
    console.log("PASS concurrent overlapping bulk allocations allow exactly one atomic distribution");
  }

  {
    const fixture = await createFixture("mixed");
    const responses = await Promise.all([
      post("/credits/student-assign", fixture.token, {
        studentId: fixture.students[0].id,
        amount: 8,
        reason: "E-07 concurrent mixed single allocation",
      }),
      post("/credits/distribute", fixture.token, {
        creditsPerStudent: 4,
        studentIds: [fixture.students[1].id, fixture.students[2].id],
        reason: "E-07 concurrent mixed bulk allocation",
      }),
    ]);
    await assertOneSuccessOneInsufficient(responses);
    await assertAccountingInvariant(fixture.college.id, fixture.startingBalance, 8);
    console.log("PASS concurrent single and bulk requests share the same safe reservation rule");
  }

  {
    const fixture = await createFixture("rollback");
    const target = fixture.students[0];
    const before = await accountingSnapshot(fixture.college.id);

    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await allocateInstitutionCreditsToStudent({
          tx,
          collegeId: fixture.college.id,
          studentId: target.id,
          userId: target.userId,
          actorId: fixture.faculty.id,
          amount: 8,
          type: "STUDENT_ASSIGNMENT",
          reason: undefined as unknown as string,
        });
      }),
      /reason|Argument/i
    );

    const after = await accountingSnapshot(fixture.college.id);
    assert.deepEqual(after, before, "failed ledger write left partial accounting state");
    await assertAccountingInvariant(fixture.college.id, fixture.startingBalance, 0);
    console.log("PASS ledger failure rolls back institutional reservation and student credit");
  }

  console.log("E-07 credit allocation concurrency regression suite passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.creditIdempotencyRecord.deleteMany({ where: { collegeId } });
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}
