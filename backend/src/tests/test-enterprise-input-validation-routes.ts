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

try {
  const fixture = await createFixture("validation", ["all"]);
  const data = row("trimmed"); data.name = "  Rahul Sharma  "; data.program = "  B.Tech  "; data.course = "  Computer Science  "; data.batch = " 2026 ";
  const response = await post("/students", fixture.token, data);
  assert.equal(response.status, 201);
  const created = await response.json() as { student: { id: string; program: string; batch: string; userId: string } };
  assert.equal(created.student.program, "B.Tech"); assert.equal(created.student.batch, "2026");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: created.student.userId } })).name, "Rahul Sharma");
  const originalTransaction = prisma.$transaction;
  let transactions = 0;
  prisma.$transaction = (async () => { transactions++; throw new Error("Invalid input reached transaction"); }) as typeof prisma.$transaction;
  for (const invalid of [{ name: " " }, { program: " " }, { batch: "" }, { name: 1 }, { semester: -1 }]) {
    const rejected = await post("/students", fixture.token, { ...row("bad"), ...invalid });
    assert.equal(rejected.status, 400);
    const body = await rejected.json() as { error: string; issues: object };
    assert.equal(body.error, "VALIDATION_ERROR"); assert(body.issues);
  }
  assert.equal(transactions, 0); prisma.$transaction = originalTransaction;
  console.log("PASS normalized creation and invalid creation rejected before transactions");
  for (const method of ["PUT", "PATCH"]) {
    for (const invalid of [{ program: " " }, { batch: "" }, { section: null }, { semester: -1 }, { semester: 0 }, { semester: 13 }, { semester: 2.5 }, { semester: "2" }]) {
      const rejected = await fetch(`${baseUrl}/students/${created.student.id}`, { method, headers: { authorization: `Bearer ${fixture.token}`, "content-type": "application/json" }, body: JSON.stringify(invalid) });
      assert.equal(rejected.status, 400);
    }
    const updated = await fetch(`${baseUrl}/students/${created.student.id}`, { method, headers: { authorization: `Bearer ${fixture.token}`, "content-type": "application/json" }, body: JSON.stringify({ semester: 6 }) });
    assert.equal(updated.status, 200);
    const student = await prisma.collegeStudent.findUniqueOrThrow({ where: { id: created.student.id } });
    assert.equal(student.semester, 6); assert.equal(student.program, "B.Tech"); assert.equal(student.batch, "2026");
  }
  console.log("PASS both update aliases validate required text and semesters while preserving omitted fields");
  const reportFind = prisma.interviewReport.findMany, reportGroup = prisma.interviewReport.groupBy, studentFind = prisma.collegeStudent.findMany;
  let queries = 0;
  const blocked = async () => { queries++; throw new Error("Invalid report query reached Prisma"); };
  prisma.interviewReport.findMany = blocked as typeof reportFind; prisma.interviewReport.groupBy = blocked as typeof reportGroup; prisma.collegeStudent.findMany = blocked as typeof studentFind;
  for (const path of ["/reports", "/reports/export", "/reports/summary"]) {
    for (const query of ["sortOrder=invalid", "sortDirection=invalid", "sortBy=arbitrary", "startDate=2026-02-30", "dateFrom=not-a-date", "startDate=2026-02-02&endDate=2026-02-01", "startDate=2026-01-01T12:00:00%2B05:99"]) {
      const rejected = await fetch(`${baseUrl}${path}?${query}`, { headers: { authorization: `Bearer ${fixture.token}` } });
      assert.equal(rejected.status, 400, `${path}?${query}`);
    }
  }
  assert.equal(queries, 0); prisma.interviewReport.findMany = reportFind; prisma.interviewReport.groupBy = reportGroup; prisma.collegeStudent.findMany = studentFind;
  for (const query of ["sortOrder=asc", "sortDirection=desc", "startDate=2026-01-01&endDate=2026-12-31", "startDate=2026-01-01T00:00:00%2B05:30"]) {
    assert.equal((await fetch(`${baseUrl}/reports?${query}`, { headers: { authorization: `Bearer ${fixture.token}` } })).status, 200);
  }
  console.log("PASS invalid list/export/summary queries stop before data queries; valid date and sort queries succeed");
  const other = await createFixture("other", ["all"]);
  assert.equal((await fetch(`${baseUrl}/students/${created.student.id}`, { method: "PATCH", headers: { authorization: `Bearer ${other.token}`, "content-type": "application/json" }, body: JSON.stringify({ semester: 3 }) })).status, 404);
  assert.equal((await prisma.collegeStudent.findUniqueOrThrow({ where: { id: created.student.id } })).semester, 6);
  const importResult = await executeBulkImport({ collegeId: fixture.college.id, actorId: fixture.faculty.id, rawRows: [{ ...row("import-invalid"), semester: "2abc" }], atomic: true });
  assert.equal(importResult.totalCreated, 0); assert.equal(importResult.success, false);
  const validImport = await executeBulkImport({ collegeId: fixture.college.id, actorId: fixture.faculty.id, rawRows: [{ ...row("import-valid"), name: "  Import Student  ", semester: "2" }], atomic: true });
  assert.equal(validImport.totalCreated, 1);
  console.log("PASS tenant isolation and consistent normalized import/semester validation");
  console.log("Enterprise input validation HTTP/database regression suite passed.");
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
