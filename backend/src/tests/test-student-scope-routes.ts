import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { EmailService } from "../services/email.service.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
const sentEmails: string[] = [];
const originalSendWelcomeEmail = EmailService.sendStudentWelcomeEmail;
const originalSendSetupEmail = EmailService.sendStudentPasswordSetupEmail;
EmailService.sendStudentWelcomeEmail = async ({ to }) => {
  sentEmails.push(to);
  return { success: true, simulated: true };
};
EmailService.sendStudentPasswordSetupEmail = async ({ to }) => {
  sentEmails.push(to);
  return { success: true, simulated: true };
};

const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/enterprise`;

async function request(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createCollege(label: string) {
  const college = await prisma.college.create({
    data: {
      name: `E09 ${label} ${suffix}`,
      code: `E09-${label}-${suffix}`,
      officialEmail: `e09.${label}.${suffix}@example.com`,
      status: "active",
      creditAccount: { create: { totalAllocated: 100, totalDistributed: 0, balance: 100 } },
    },
  });
  collegeIds.push(college.id);
  return college;
}

async function createFaculty(
  collegeId: string,
  label: string,
  isMainFaculty: boolean
) {
  const passwordHash = await bcrypt.hash("E09-Test-Password!", 4);
  const user = await prisma.user.create({
    data: {
      name: `E09 ${label}`,
      email: `e09.${label}.${suffix}@example.com`,
      passwordHash,
      role: isMainFaculty ? "college_main_faculty" : "college_faculty",
      collegeId,
      isActive: true,
    },
  });
  const permissions = isMainFaculty
    ? ["all"]
    : ["STUDENT_VIEW", "STUDENT_CREATE", "STUDENT_EDIT", "INTERVIEW_CREDIT_ASSIGN"];
  await prisma.collegeFaculty.create({
    data: {
      userId: user.id,
      collegeId,
      isMainFaculty,
      permissions,
      programAccess: isMainFaculty ? [] : ["B.Tech"],
      courseAccess: isMainFaculty ? [] : ["Computer Science"],
      sectionAccess: isMainFaculty ? [] : ["A"],
      status: "active",
    },
  });
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    collegeId,
    isMainFaculty,
    permissions,
  });
  return { user, token };
}

async function createStudent(
  collegeId: string,
  label: string,
  course: string,
  section: string
) {
  const passwordHash = await bcrypt.hash("E09-Student-Password!", 4);
  const user = await prisma.user.create({
    data: {
      name: `E09 ${label}`,
      email: `e09.${label}.${suffix}@example.com`,
      passwordHash,
      role: "student",
      collegeId,
      isActive: true,
      credits: { create: { balance: 0 } },
    },
  });
  const student = await prisma.collegeStudent.create({
    data: {
      userId: user.id,
      collegeId,
      enrollmentNumber: `E09-${label}-${suffix}`,
      program: "B.Tech",
      course,
      section,
      batch: "2026",
      status: "active",
    },
  });
  return { user, student };
}

function newStudentBody(label: string, course = "Computer Science", section = "A") {
  return {
    name: `E09 ${label}`,
    email: `e09.${label}.${suffix}@example.com`,
    enrollmentNumber: `E09-${label}-${suffix}`,
    program: "B.Tech",
    course,
    section,
    batch: "2026",
    initialCredits: 0,
  };
}

try {
  const collegeA = await createCollege("college-a");
  const collegeB = await createCollege("college-b");
  const restricted = await createFaculty(collegeA.id, "restricted", false);
  const administrator = await createFaculty(collegeA.id, "administrator", true);
  const inScope = await createStudent(collegeA.id, "in-scope", "Computer Science", "A");
  const outOfScope = await createStudent(collegeA.id, "out-of-scope", "Mechanical", "B");
  const crossTenant = await createStudent(collegeB.id, "cross-tenant", "Computer Science", "A");

  let response = await request("PATCH", `/students/${inScope.student.id}`, restricted.token, { batch: "2027" });
  assert.equal(response.status, 200);
  response = await request("POST", `/students/${inScope.student.id}/resend-invite`, restricted.token);
  assert.equal(response.status, 200);
  console.log("PASS in-scope update and invitation resend remain authorized");

  const outBefore = await prisma.collegeStudent.findUniqueOrThrow({ where: { id: outOfScope.student.id } });
  const outUserBefore = await prisma.user.findUniqueOrThrow({ where: { id: outOfScope.user.id } });
  const invitationCountBefore = await prisma.invitation.count({ where: { email: outOfScope.user.email } });
  const emailCountBefore = sentEmails.length;

  for (const [method, path, body] of [
    ["PATCH", `/students/${outOfScope.student.id}`, { batch: "2030" }],
    ["PUT", `/students/${outOfScope.student.id}`, { batch: "2030" }],
    ["POST", `/students/${outOfScope.student.id}/resend-invite`, undefined],
    ["DELETE", `/students/${outOfScope.student.id}`, undefined],
  ] as const) {
    response = await request(method, path, restricted.token, body);
    assert.equal(response.status, 404, `${method} ${path} should conceal out-of-scope records`);
  }
  response = await request("POST", "/credits/assign-student", restricted.token, {
    studentId: outOfScope.student.id,
    amount: 1,
    reason: "E-09 out-of-scope direct credit attempt",
  });
  assert.equal(response.status, 404);
  const collegeBalanceBeforeScopedDistribution = (
    await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId: collegeA.id } })
  ).balance;
  response = await request("POST", "/credits/distribute", restricted.token, {
    studentIds: [outOfScope.student.id],
    creditsPerStudent: 1,
    reason: "E-09 out-of-scope bulk credit attempt",
  });
  assert.equal(response.status, 400);
  const outAfter = await prisma.collegeStudent.findUniqueOrThrow({ where: { id: outOfScope.student.id } });
  const outUserAfter = await prisma.user.findUniqueOrThrow({ where: { id: outOfScope.user.id } });
  assert.deepEqual(outAfter, outBefore);
  assert.equal(outUserAfter.passwordHash, outUserBefore.passwordHash);
  assert.equal(outUserAfter.isActive, true);
  assert.equal(await prisma.invitation.count({ where: { email: outOfScope.user.email } }), invitationCountBefore);
  assert.equal(sentEmails.length, emailCountBefore);
  assert.equal(
    (await prisma.userCredit.findUniqueOrThrow({ where: { userId: outOfScope.user.id } })).balance,
    0
  );
  assert.equal(
    (await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId: collegeA.id } })).balance,
    collegeBalanceBeforeScopedDistribution
  );
  console.log("PASS known-ID mutation attempts on same-tenant out-of-scope students have no side effects");

  for (const [field, value] of [
    ["program", "BBA"],
    ["course", "Mechanical"],
    ["section", "B"],
  ] as const) {
    response = await request("PATCH", `/students/${inScope.student.id}`, restricted.token, { [field]: value });
    assert.equal(response.status, 403, `scope transfer via ${field} should be forbidden`);
  }
  const inScopeAfterTransfers = await prisma.collegeStudent.findUniqueOrThrow({ where: { id: inScope.student.id } });
  assert.equal(inScopeAfterTransfers.program, "B.Tech");
  assert.equal(inScopeAfterTransfers.course, "Computer Science");
  assert.equal(inScopeAfterTransfers.section, "A");
  console.log("PASS full and partial scope-transfer attacks are rejected against effective state");

  const creationCountsBefore = {
    students: await prisma.collegeStudent.count({ where: { collegeId: collegeA.id } }),
    invitations: await prisma.invitation.count({ where: { collegeId: collegeA.id } }),
    balance: (await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId: collegeA.id } })).balance,
    emails: sentEmails.length,
  };
  response = await request(
    "POST",
    "/students",
    restricted.token,
    newStudentBody("unauthorized-create", "Mechanical", "B")
  );
  assert.equal(response.status, 403);
  assert.equal(await prisma.collegeStudent.count({ where: { collegeId: collegeA.id } }), creationCountsBefore.students);
  assert.equal(await prisma.invitation.count({ where: { collegeId: collegeA.id } }), creationCountsBefore.invitations);
  assert.equal(
    (await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId: collegeA.id } })).balance,
    creationCountsBefore.balance
  );
  assert.equal(sentEmails.length, creationCountsBefore.emails);
  console.log("PASS out-of-scope creation is rejected before database, credit, invitation, or email side effects");

  response = await request("POST", "/students/bulk-import", restricted.token, {
    atomic: false,
    students: [
      newStudentBody("partial-authorized"),
      newStudentBody("partial-unauthorized", "Mechanical", "B"),
    ],
  });
  assert.equal(response.status, 201);
  const partialResult = await response.json() as { totalCreated: number; totalFailed: number };
  assert.equal(partialResult.totalCreated, 1);
  assert.equal(partialResult.totalFailed, 1);
  assert.equal(
    await prisma.collegeStudent.count({
      where: { collegeId: collegeA.id, enrollmentNumber: `E09-partial-unauthorized-${suffix}` },
    }),
    0
  );
  console.log("PASS non-atomic mixed import creates only authorized rows");

  response = await request("POST", "/students/bulk-import", restricted.token, {
    atomic: true,
    students: [
      newStudentBody("atomic-authorized"),
      newStudentBody("atomic-unauthorized", "Mechanical", "B"),
    ],
  });
  assert.equal(response.status, 400);
  assert.equal(
    await prisma.collegeStudent.count({
      where: { enrollmentNumber: { in: [`E09-atomic-authorized-${suffix}`, `E09-atomic-unauthorized-${suffix}`] } },
    }),
    0
  );
  console.log("PASS atomic mixed import creates no rows when any row is outside scope");

  for (const [method, path, body] of [
    ["PATCH", `/students/${crossTenant.student.id}`, { batch: "2030" }],
    ["POST", `/students/${crossTenant.student.id}/resend-invite`, undefined],
    ["DELETE", `/students/${crossTenant.student.id}`, undefined],
  ] as const) {
    response = await request(method, path, restricted.token, body);
    assert.equal(response.status, 404, `${method} should conceal cross-tenant students`);
  }
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: crossTenant.user.id } })).isActive, true);
  console.log("PASS tenant isolation remains additive to faculty scope authorization");

  response = await request(
    "POST",
    "/students",
    administrator.token,
    newStudentBody("administrator-create", "Mechanical", "B")
  );
  assert.equal(response.status, 201);
  response = await request("PATCH", `/students/${outOfScope.student.id}`, administrator.token, { batch: "2028" });
  assert.equal(response.status, 200);
  console.log("PASS main faculty retains legitimate tenant-wide create and update access");

  response = await request("DELETE", `/students/${inScope.student.id}`, restricted.token);
  assert.equal(response.status, 200);
  assert.equal((await prisma.collegeStudent.findUniqueOrThrow({ where: { id: inScope.student.id } })).status, "inactive");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: inScope.user.id } })).isActive, false);
  console.log("PASS in-scope deactivation remains authorized and atomic");

  console.log("E-09 student mutation route regression suite passed.");
} finally {
  EmailService.sendStudentWelcomeEmail = originalSendWelcomeEmail;
  EmailService.sendStudentPasswordSetupEmail = originalSendSetupEmail;
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
