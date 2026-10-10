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
const originalMail = EmailService.sendStudentWelcomeEmail;
const sentEmails: string[] = [];
const originalSetup = EmailService.sendStudentPasswordSetupEmail;
let mode: "sent" | "failed" | "throw" = "sent";
const secretError = "SMTP_PASS=DO_NOT_EXPOSE https://private.provider/internal at mail.ts:12";
EmailService.sendStudentWelcomeEmail = async ({ to }) => {
  sentEmails.push(to);
  if (mode === "throw") throw new Error(secretError);
  if (mode === "failed") return { success: false, error: secretError };
  return { success: true, messageId: "test-provider-acceptance" };
};
EmailService.sendStudentPasswordSetupEmail = async () => mode === "sent" ? { success: true, messageId: "test-resend-acceptance" } : { success: false, error: secretError };
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

try {
  const fixture = await createFixture("delivery", ["STUDENT_CREATE", "STUDENT_VIEW"], 10);
  const before = await snapshot(fixture.college.id);
  for (const currentMode of ["sent", "failed", "throw"] as const) {
    mode = currentMode;
    const data = row(`email-${currentMode}`);
    const response = await post("/students", fixture.token, data);
    assert.equal(response.status, 201);
    const body = await response.json() as { success: boolean; student: { id: string; userId: string }; invitationStatus: string; emailError?: string };
    assert.equal(body.success, true);
    assert.equal(body.invitationStatus, currentMode === "sent" ? "sent" : "failed");
    assert(await prisma.collegeStudent.findUnique({ where: { id: body.student.id } }));
    assert(await prisma.user.findUnique({ where: { id: body.student.userId } }));
    assert.doesNotMatch(JSON.stringify(body), /DO_NOT_EXPOSE|SMTP_PASS|private.provider|mail.ts/);
    const list = await fetch(`${baseUrl}/students?search=${encodeURIComponent(data.email)}`, { headers: { authorization: `Bearer ${fixture.token}` } });
    assert.equal(list.status, 200);
    const listBody = await list.json() as { students: Array<{ id: string; invitationStatus: string; emailError?: string }> };
    assert.equal(listBody.students.length, 1); assert.equal(listBody.students[0].id, body.student.id);
    assert.equal(listBody.students[0].invitationStatus, body.invitationStatus);
    assert.doesNotMatch(JSON.stringify(listBody), /DO_NOT_EXPOSE|SMTP_PASS|private.provider|mail.ts/);
    if (currentMode !== "sent") {
      assert(body.emailError); const count = await prisma.collegeStudent.count({ where: { collegeId: fixture.college.id } });
      const creditBefore = await snapshot(fixture.college.id);
      let retry = await post(`/students/${body.student.id}/resend-invite`, fixture.token, {});
      assert.equal(retry.status, 502);
      assert.doesNotMatch(await retry.text(), /DO_NOT_EXPOSE|SMTP_PASS|private.provider|mail.ts/);
      mode = "sent";
      retry = await post(`/students/${body.student.id}/resend-invite`, fixture.token, {});
      assert.equal(retry.status, 200);
      assert.equal((await retry.json() as { invitationStatus: string }).invitationStatus, "sent");
      const refreshed = await fetch(`${baseUrl}/students?search=${encodeURIComponent(data.email)}`, { headers: { authorization: `Bearer ${fixture.token}` } });
      const refreshedBody = await refreshed.json() as { students: Array<{ invitationStatus: string; emailError: string | null }> };
      assert.equal(refreshedBody.students[0].invitationStatus, "sent"); assert.equal(refreshedBody.students[0].emailError, null);
      assert.equal(await prisma.collegeStudent.count({ where: { collegeId: fixture.college.id } }), count);
      assert.equal((await snapshot(fixture.college.id)).studentBalance, creditBefore.studentBalance);
      console.log(`PASS ${currentMode}: student remains created, visible with failed status; resend updates persisted status without recreation`);
    } else console.log("PASS provider acceptance reported as sent, not confirmed inbox delivery");
  }
  const after = await snapshot(fixture.college.id);
  assert.equal(after.balance, before.balance); assert.equal(after.ledger, before.ledger); assert.equal(after.students, 3);
  const viewer = await createFixture("viewer", ["STUDENT_VIEW"]);
  // same-tenant read-only faculty, not a tenant isolation substitute for resend permissions
  await prisma.user.update({ where: { id: viewer.faculty.id }, data: { collegeId: fixture.college.id } });
  await prisma.collegeFaculty.update({ where: { userId: viewer.faculty.id }, data: { collegeId: fixture.college.id } });
  const viewerToken = signAccessToken({ sub: viewer.faculty.id, role: "college_faculty", email: viewer.faculty.email, collegeId: fixture.college.id, permissions: ["all"] });
  const student = await prisma.collegeStudent.findFirstOrThrow({ where: { collegeId: fixture.college.id } });
  const invitationCount = await prisma.invitation.count({ where: { collegeId: fixture.college.id } });
  assert.equal((await post(`/students/${student.id}/resend-invite`, viewerToken, {})).status, 403);
  assert.equal(await prisma.invitation.count({ where: { collegeId: fixture.college.id } }), invitationCount);
  assert.equal((await post("/students", viewerToken, row("denied"))).status, 403);
  console.log("PASS live resend/create authorization retained despite forged JWT permission flags");
  console.log("Student onboarding email feedback backend regression suite passed.");
} finally {
  EmailService.sendStudentWelcomeEmail = originalMail;
  EmailService.sendStudentPasswordSetupEmail = originalSetup;
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  }
  await prisma.$disconnect();
}
