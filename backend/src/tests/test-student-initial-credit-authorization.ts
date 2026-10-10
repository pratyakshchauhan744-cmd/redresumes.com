import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";


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




import { signAccessToken } from "../utils/jwt.js";

const { EmailService } = await import("../services/email.service.js");
const { executeBulkImport } = await import("../modules/enterprise/routes.js");
const xlsx = await import("xlsx");
const originalMail = EmailService.sendStudentWelcomeEmail;
const sentEmails: string[] = [];
EmailService.sendStudentWelcomeEmail = async ({ to }) => { sentEmails.push(to); return { success: true, simulated: true }; };
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/enterprise`;

async function createFixture(label: string, permissions: string[], balance = 10) {
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
      role: "college_faculty",
      collegeId: college.id,
      isActive: true,
    },
  });
  await prisma.collegeFaculty.create({
    data: {
      userId: faculty.id,
      collegeId: college.id,
      isMainFaculty: false,
      permissions,
      scopeUnrestricted: true,
      status: "active",
    },
  });

  const token = signAccessToken({
    sub: faculty.id,
    email: faculty.email,
    role: faculty.role,
    collegeId: college.id,
    isMainFaculty: false,
    permissions,
  });
  return { college, faculty, token, startingBalance: balance };
}

async function post(path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
function row(label: string, initialCredits: unknown = 0) {
  return { name: `Authorization ${label}`, email: `initial.${label}.${suffix}@example.com`, enrollmentNumber: `AUTH-${label}-${suffix}`, program: "B.Tech", course: "CS", section: "A", batch: "2026", initialCredits };
}
async function snapshot(collegeId: string) {
  const account = await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId } });
  const credits = await prisma.userCredit.aggregate({ where: { user: { collegeId, role: "student" } }, _sum: { balance: true } });
  return {
    students: await prisma.collegeStudent.count({ where: { collegeId } }),
    users: await prisma.user.count({ where: { collegeId, role: "student" } }),
    invitations: await prisma.invitation.count({ where: { collegeId } }),
    ledger: await prisma.collegeCreditTransaction.count({ where: { collegeId } }),
    audits: await prisma.enterpriseAuditLog.count({ where: { collegeId, action: "STUDENT_CREDITS_ASSIGNED" } }),
    balance: account.balance, distributed: account.totalDistributed, studentBalance: credits._sum.balance ?? 0,
  };
}
async function unchanged(fixture: Awaited<ReturnType<typeof createFixture>>, action: () => Promise<Response>, status: number) {
  const before = await snapshot(fixture.college.id);
  const emailCount = sentEmails.length;
  const response = await action();
  assert.equal(response.status, status, await response.text());
  assert.deepEqual(await snapshot(fixture.college.id), before);
  assert.equal(sentEmails.length, emailCount);
}
async function upload(token: string, rows: Record<string, unknown>[], format: "csv" | "xlsx", credits = "0", atomic = "false") {
  const sheet = xlsx.utils.json_to_sheet(rows);
  const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book, sheet, "Students");
  const bytes = xlsx.write(book, { type: "buffer", bookType: format });
  const form = new FormData();
  form.set("file", new Blob([bytes]), `students.${format}`);
  form.set("initialCredits", credits); form.set("atomic", atomic);
  return fetch(`${baseUrl}/students/bulk-import-file`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
}

try {
  const createOnly = await createFixture("create", ["STUDENT_CREATE"]);
  assert.equal((await post("/students", createOnly.token, row("zero"))).status, 201);
  const noCredits = await snapshot(createOnly.college.id);
  assert.equal(noCredits.balance, 10); assert.equal(noCredits.studentBalance, 0); assert.equal(noCredits.ledger, 0); assert.equal(noCredits.audits, 0);
  await unchanged(createOnly, () => post("/students", createOnly.token, { ...row("denied", 2), permissions: ["all"], isMainFaculty: true }), 403);
  console.log("PASS STUDENT_CREATE alone permits zero credits; forged positive-credit API request denied without side effects");

  const assignOnly = await createFixture("assign", ["INTERVIEW_CREDIT_ASSIGN"]);
  await unchanged(assignOnly, () => post("/students", assignOnly.token, row("assign-only", 1)), 403);
  await assert.rejects(executeBulkImport({ collegeId: assignOnly.college.id, actorId: assignOnly.faculty.id, rawRows: [row("direct-assign", 0)] }), /STUDENT_CREATE/);
  console.log("PASS credit assignment alone cannot create students through HTTP or internal import helper");

  for (const atomic of [false, true]) {
    await unchanged(createOnly, () => post("/students/bulk-import", createOnly.token, { students: [row(`zero-${atomic}`), row(`positive-${atomic}`, 1)], atomic }), 403);
    // Authorization cannot be bypassed by placing credits on a row later discarded by validation.
    await unchanged(createOnly, () => post("/students/bulk-import", createOnly.token, { students: [row(`partial-${atomic}`), { ...row(`invalid-${atomic}`, 1), name: "" }], atomic }), 403);
    const defaultRow = row(`default-${atomic}`); delete (defaultRow as { initialCredits?: unknown }).initialCredits;
    await unchanged(createOnly, () => post("/students/bulk-import", createOnly.token, { students: [defaultRow], initialCredits: 1, atomic }), 403);
  }
  for (const format of ["csv", "xlsx"] as const) {
    await unchanged(createOnly, () => upload(createOnly.token, [row(`file-zero-${format}`), row(`file-positive-${format}`, 2)], format), 403);
    const defaultRow = row(`file-default-${format}`); delete (defaultRow as { initialCredits?: unknown }).initialCredits;
    await unchanged(createOnly, () => upload(createOnly.token, [defaultRow], format, "1", "true"), 403);
  }
  const directBefore = await snapshot(createOnly.college.id);
  await assert.rejects(executeBulkImport({ collegeId: createOnly.college.id, actorId: createOnly.faculty.id, actorIsSuperAdmin: true, rawRows: [row("direct-forged", 1)] }), /INTERVIEW_CREDIT_ASSIGN/);
  assert.deepEqual(await snapshot(createOnly.college.id), directBefore);
  console.log("PASS JSON, CSV, XLSX, defaults, invalid rows and both import modes reject unauthorized credits before all writes");

  assert.equal((await post("/students/bulk-import", createOnly.token, { students: [row("zero-bulk")], atomic: true })).status, 201);
  assert.equal((await upload(createOnly.token, [row("zero-file")], "csv")).status, 201);
  for (const invalid of [-1, 0.5, "abc", "2", true, null, {}, 2147483648]) {
    await unchanged(createOnly, () => post("/students", createOnly.token, row(`invalid-single-${String(invalid)}`, invalid)), 400);
  }
  for (const invalid of [-1, 0.5, "abc", true, {}, 2147483648]) {
    const before = await snapshot(createOnly.college.id);
    const response = await post("/students/bulk-import", createOnly.token, { students: [row("invalid-import", invalid)], atomic: true });
    assert.equal(response.status, 400);
    assert.deepEqual(await snapshot(createOnly.college.id), before);
  }
  await unchanged(createOnly, () => upload(createOnly.token, [row("invalid-default")], "csv", "abc"), 400);
  console.log("PASS zero-credit imports and malformed-credit validation without accounting effects");

  const authorized = await createFixture("both", ["STUDENT_CREATE", "INTERVIEW_CREDIT_ASSIGN"], 20);
  assert.equal((await post("/students", authorized.token, row("authorized-single", 3))).status, 201);
  assert.equal((await post("/students/bulk-import", authorized.token, { students: [row("authorized-json-a", 2), row("authorized-json-b", 2)], atomic: true })).status, 201);
  assert.equal((await upload(authorized.token, [row("authorized-file", 2)], "xlsx", "0", "true")).status, 201);
  assert.deepEqual(await snapshot(authorized.college.id), { students: 4, users: 4, invitations: 4, ledger: 4, audits: 4, balance: 11, distributed: 9, studentBalance: 9 });
  const audits = await prisma.enterpriseAuditLog.findMany({ where: { collegeId: authorized.college.id, action: "STUDENT_CREDITS_ASSIGNED" } });
  assert(audits.every(a => a.actorId === authorized.faculty.id && a.entityId && a.createdAt && (a.newValue as { amount: number }).amount > 0));
  await unchanged(authorized, () => post("/students", authorized.token, row("insufficient", 12)), 400);
  const before = await snapshot(authorized.college.id);
  const failed = await executeBulkImport({ collegeId: authorized.college.id, actorId: authorized.faculty.id, rawRows: [row("rollback-a", 2), row("rollback-b", 2)], atomic: true, testHooks: { afterRowPersisted: n => { if (n === 2) throw new Error("injected failure"); } } });
  assert.equal(failed.success, false); assert.deepEqual(await snapshot(authorized.college.id), before);
  console.log("PASS authorized single/JSON/XLSX funding, financial audits, insufficient balance and full rollback");

  const concurrent = await createFixture("concurrent", ["STUDENT_CREATE", "INTERVIEW_CREDIT_ASSIGN"], 5);
  const statuses = await Promise.all([post("/students", concurrent.token, row("concurrent-a", 4)), post("/students", concurrent.token, row("concurrent-b", 4))]);
  assert.deepEqual(statuses.map(r => r.status).sort(), [201, 400]);
  assert.deepEqual(await snapshot(concurrent.college.id), { students: 1, users: 1, invitations: 1, ledger: 1, audits: 1, balance: 1, distributed: 4, studentBalance: 4 });
  console.log("PASS concurrent authorized onboarding cannot overspend or leave partial records");

  const legacy = await createFixture("legacy", ["manageStudents", "distributeCredits"]);
  assert.equal((await post("/students", legacy.token, row("legacy", 1))).status, 201);
  // Revocation must win over still-valid JWT permissions and caller-supplied flags.
  await prisma.collegeFaculty.update({ where: { userId: authorized.faculty.id }, data: { permissions: ["STUDENT_CREATE"] } });
  await unchanged(authorized, () => post("/students", authorized.token, row("revoked", 1)), 403);
  console.log("PASS legacy permission aliases and live credit permission revocation");
  console.log("Initial student credit authorization regression suite passed.");
} finally {
  EmailService.sendStudentWelcomeEmail = originalMail;
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  }
  await prisma.$disconnect();
}
