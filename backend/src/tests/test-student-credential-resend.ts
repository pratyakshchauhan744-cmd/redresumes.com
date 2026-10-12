import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import invitationRoutes from "../modules/auth/invitation-routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { EmailService } from "../services/email.service.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
const deliveredSetupLinks: string[] = [];
const originalSetupEmail = EmailService.sendStudentPasswordSetupEmail;
let emailMode: "success" | "throw" = "success";

EmailService.sendStudentPasswordSetupEmail = async ({ setupLink }) => {
  if (emailMode === "throw") throw new Error("forced setup email outage");
  deliveredSetupLinks.push(setupLink);
  return { success: true, simulated: true };
};

const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use("/api/auth/invitations", invitationRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(method: string, path: string, token?: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createCollege(label: string) {
  const college = await prisma.college.create({
    data: {
      name: `E12 ${label} ${suffix}`,
      code: `E12-${label}-${suffix}`,
      officialEmail: `e12.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);
  return college;
}

async function createFaculty(
  collegeId: string,
  label: string,
  permissions: string[],
  scope: { course?: string; section?: string } = {}
) {
  const user = await prisma.user.create({
    data: {
      name: `E12 ${label}`,
      email: `e12.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E12-Faculty-Password!", 4),
      role: "college_faculty",
      collegeId,
      isActive: true,
      facultyProfile: {
        create: {
          collegeId,
          permissions,
          programAccess: ["B.Tech"],
          courseAccess: [scope.course ?? "Computer Science"],
          sectionAccess: [scope.section ?? "A"],
          batchAccess: ["2026"],
          scopeUnrestricted: false,
          cohortAccess: [{
            program: "B.Tech",
            course: scope.course ?? "Computer Science",
            section: scope.section ?? "A",
            batch: "2026",
          }],
          status: "active",
        },
      },
    },
  });
  return {
    user,
    token: signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      collegeId,
      permissions,
    }),
  };
}

async function createStudent(collegeId: string, label: string, course = "Computer Science", section = "A") {
  const password = `E12-Old-${label}-Password!`;
  const user = await prisma.user.create({
    data: {
      name: `E12 ${label}`,
      email: `e12.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      role: "student",
      collegeId,
      isActive: true,
    },
  });
  const student = await prisma.collegeStudent.create({
    data: {
      userId: user.id,
      collegeId,
      enrollmentNumber: `E12-${label}-${suffix}`,
      program: "B.Tech",
      course,
      section,
      batch: "2026",
      status: "active",
    },
  });
  return { user, student, password };
}

function tokenFromLatestLink() {
  const link = deliveredSetupLinks.at(-1);
  assert(link, "a setup link should have been delivered");
  const token = new URL(link).searchParams.get("token");
  assert(token, "setup link should contain a raw token");
  return token;
}

try {
  const collegeA = await createCollege("college-a");
  const collegeB = await createCollege("college-b");
  const authorized = await createFaculty(collegeA.id, "authorized", ["STUDENT_CREATE"]);
  const unauthorized = await createFaculty(collegeA.id, "unauthorized", ["STUDENT_VIEW"]);
  const student = await createStudent(collegeA.id, "primary");
  const emailFailureStudent = await createStudent(collegeA.id, "email-failure");
  const databaseFailureStudent = await createStudent(collegeA.id, "database-failure");
  const concurrentStudent = await createStudent(collegeA.id, "concurrent");
  const outOfScopeStudent = await createStudent(collegeA.id, "out-of-scope", "Mechanical", "B");
  const crossTenantStudent = await createStudent(collegeB.id, "cross-tenant");

  const originalHash = student.user.passwordHash;
  await prisma.refreshToken.create({
    data: {
      userId: student.user.id,
      tokenHash: crypto.createHash("sha256").update("e12-existing-refresh").digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  let response = await request(
    "POST",
    `/api/enterprise/students/${student.student.id}/resend-invite`,
    authorized.token
  );
  assert.equal(response.status, 200);
  const firstToken = tokenFromLatestLink();
  let currentUser = await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } });
  assert.equal(currentUser.passwordHash, originalHash);
  assert.equal(await bcrypt.compare(student.password, currentUser.passwordHash), true);
  assert.equal(await prisma.refreshToken.count({ where: { userId: student.user.id } }), 1);
  console.log("PASS successful resend sends a setup link without changing the existing password or sessions");

  response = await request(
    "POST",
    `/api/enterprise/students/${student.student.id}/resend-invite`,
    authorized.token
  );
  assert.equal(response.status, 200);
  const secondToken = tokenFromLatestLink();
  assert.notEqual(firstToken, secondToken);
  assert.equal((await request("GET", `/api/auth/invitations/verify/${firstToken}`)).status, 400);
  assert.equal((await request("GET", `/api/auth/invitations/verify/${secondToken}`)).status, 200);
  currentUser = await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } });
  assert.equal(currentUser.passwordHash, originalHash);
  console.log("PASS multiple resends enforce latest-token-only while preserving the current password");

  emailMode = "throw";
  const failedHash = emailFailureStudent.user.passwordHash;
  response = await request(
    "POST",
    `/api/enterprise/students/${emailFailureStudent.student.id}/resend-invite`,
    authorized.token
  );
  assert.equal(response.status, 502);
  const failureBody = await response.json() as { success: boolean; message: string };
  assert.equal(failureBody.success, false);
  assert.match(failureBody.message, /existing credentials remain unchanged/i);
  const afterFailure = await prisma.user.findUniqueOrThrow({ where: { id: emailFailureStudent.user.id } });
  assert.equal(afterFailure.passwordHash, failedHash);
  assert.equal(await bcrypt.compare(emailFailureStudent.password, afterFailure.passwordHash), true);
  assert.equal(
    await prisma.invitation.count({
      where: { collegeId: collegeA.id, email: emailFailureStudent.user.email, status: "pending" },
    }),
    0
  );
  console.log("PASS email exception reports failure without changing or locking the student's password");
  emailMode = "success";

  const databaseFailureHash = databaseFailureStudent.user.passwordHash;
  const linksBeforeDatabaseFailure = deliveredSetupLinks.length;
  const invitationsBeforeDatabaseFailure = await prisma.invitation.count({
    where: { collegeId: collegeA.id, email: databaseFailureStudent.user.email },
  });
  const originalTransaction = prisma.$transaction;
  try {
    (prisma as any).$transaction = async () => {
      throw new Error("forced invitation persistence failure");
    };
    response = await request(
      "POST",
      `/api/enterprise/students/${databaseFailureStudent.student.id}/resend-invite`,
      authorized.token
    );
    assert.equal(response.status, 500);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
  assert.equal(deliveredSetupLinks.length, linksBeforeDatabaseFailure);
  assert.equal(
    await prisma.invitation.count({ where: { collegeId: collegeA.id, email: databaseFailureStudent.user.email } }),
    invitationsBeforeDatabaseFailure
  );
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: databaseFailureStudent.user.id } })).passwordHash,
    databaseFailureHash
  );
  console.log("PASS invitation persistence failure sends no unusable link and preserves the password");

  const newPassword = "E12-New-Secure-Password!";
  response = await request("POST", "/api/auth/invitations/accept", undefined, {
    tokenHash: secondToken,
    password: newPassword,
  });
  assert.equal(response.status, 200);
  currentUser = await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } });
  assert.equal(await bcrypt.compare(newPassword, currentUser.passwordHash), true);
  assert.equal(await bcrypt.compare(student.password, currentUser.passwordHash), false);
  assert.equal(await prisma.refreshToken.count({ where: { userId: student.user.id } }), 0);
  assert.equal(
    (await request("POST", "/api/auth/invitations/accept", undefined, {
      tokenHash: secondToken,
      password: "E12-Reuse-Must-Fail!",
    })).status,
    400
  );
  console.log("PASS reset completion changes the password once, invalidates the token, and revokes refresh sessions");

  const invalidBefore = currentUser.passwordHash;
  const expiredRawToken = crypto.randomBytes(32).toString("hex");
  await prisma.invitation.create({
    data: {
      collegeId: collegeA.id,
      email: student.user.email,
      role: "student",
      tokenHash: crypto.createHash("sha256").update(expiredRawToken).digest("hex"),
      expiresAt: new Date(Date.now() - 1_000),
      status: "pending",
      invitedById: authorized.user.id,
    },
  });
  assert.equal(
    (await request("POST", "/api/auth/invitations/accept", undefined, {
      tokenHash: expiredRawToken,
      password: "E12-Expired-Must-Fail!",
    })).status,
    400
  );
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } })).passwordHash, invalidBefore);
  console.log("PASS expired token is rejected without changing the password");

  const concurrentLinkStart = deliveredSetupLinks.length;
  const concurrentResponses = await Promise.all([
    request("POST", `/api/enterprise/students/${concurrentStudent.student.id}/resend-invite`, authorized.token),
    request("POST", `/api/enterprise/students/${concurrentStudent.student.id}/resend-invite`, authorized.token),
  ]);
  assert.deepEqual(concurrentResponses.map((item) => item.status), [200, 200]);
  const concurrentTokens = deliveredSetupLinks.slice(concurrentLinkStart).map((link) => {
    const value = new URL(link).searchParams.get("token");
    assert(value);
    return value;
  });
  assert.equal(concurrentTokens.length, 2);
  const concurrentVerifyStatuses = await Promise.all(
    concurrentTokens.map(async (value) => (await request("GET", `/api/auth/invitations/verify/${value}`)).status)
  );
  assert.deepEqual([...concurrentVerifyStatuses].sort((a, b) => a - b), [200, 400]);
  assert.equal(
    await prisma.invitation.count({
      where: { collegeId: collegeA.id, email: concurrentStudent.user.email, status: "pending" },
    }),
    1
  );
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: concurrentStudent.user.id } })).passwordHash,
    concurrentStudent.user.passwordHash
  );
  console.log("PASS concurrent resends serialize to exactly one valid latest token");

  const deliveredBeforeAuthzChecks = deliveredSetupLinks.length;
  const invitationsBeforeAuthzChecks = await prisma.invitation.count();
  assert.equal(
    (await request(
      "POST",
      `/api/enterprise/students/${student.student.id}/resend-invite`,
      unauthorized.token
    )).status,
    403
  );
  assert.equal(
    (await request(
      "POST",
      `/api/enterprise/students/${outOfScopeStudent.student.id}/resend-invite`,
      authorized.token
    )).status,
    404
  );
  assert.equal(
    (await request(
      "POST",
      `/api/enterprise/students/${crossTenantStudent.student.id}/resend-invite`,
      authorized.token
    )).status,
    404
  );
  assert.equal(deliveredSetupLinks.length, deliveredBeforeAuthzChecks);
  assert.equal(await prisma.invitation.count(), invitationsBeforeAuthzChecks);
  console.log("PASS missing permission, out-of-scope, and cross-tenant resend attempts have no side effects");

  console.log("E-12 student credential resend regression suite passed.");
} finally {
  EmailService.sendStudentPasswordSetupEmail = originalSetupEmail;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}
