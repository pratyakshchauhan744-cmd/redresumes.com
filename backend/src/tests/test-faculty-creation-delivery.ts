import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { EmailService } from "../services/email.service.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const originalFacultyEmail = EmailService.sendFacultyInvitation;
const deliveredLinks: string[] = [];
let emailMode: "success" | "failure" | "throw" = "success";

EmailService.sendFacultyInvitation = async ({ activationLink }) => {
  if (emailMode === "throw") throw new Error("forced faculty email outage");
  if (emailMode === "failure") return { success: false, error: "forced provider rejection" };
  deliveredLinks.push(activationLink);
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

async function request(method: string, path: string, token: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const college = await prisma.college.create({
  data: {
    name: `E14 College ${suffix}`,
    code: `E14-${suffix}`,
    officialEmail: `e14.${suffix}@example.com`,
    status: "active",
  },
});
const administrator = await prisma.user.create({
  data: {
    name: "E14 Administrator",
    email: `e14.admin.${suffix}@example.com`,
    passwordHash: await bcrypt.hash("E14-Admin-Password!", 4),
    role: "college_main_faculty",
    collegeId: college.id,
    isActive: true,
    facultyProfile: {
      create: { collegeId: college.id, isMainFaculty: true, permissions: ["all"], status: "active" },
    },
  },
});
const token = signAccessToken({
  sub: administrator.id,
  email: administrator.email,
  role: administrator.role,
  collegeId: college.id,
  permissions: ["all"],
});

function facultyBody(label: string) {
  return {
    name: `E14 ${label}`,
    email: `e14.${label}.${suffix}@example.com`,
    employeeId: `E14-${label}-${suffix}`,
    department: "Computer Science",
    designation: "Assistant Professor",
  };
}

try {
  let response = await request("POST", "/faculty", token, facultyBody("success"));
  assert.equal(response.status, 201);
  let body = await response.json() as any;
  assert.equal(body.success, true);
  assert.equal(body.facultyCreated, true);
  assert.equal(body.invitationSent, true);
  assert.equal(await prisma.user.count({ where: { email: facultyBody("success").email } }), 1);
  assert.equal(await prisma.collegeFaculty.count({ where: { id: body.faculty.id } }), 1);
  assert.equal(await prisma.invitation.count({ where: { email: facultyBody("success").email, status: "pending" } }), 1);
  console.log("PASS normal faculty creation commits one account, profile, and pending invitation and reports delivery");

  emailMode = "throw";
  response = await request("POST", "/faculty", token, facultyBody("email-failure"));
  assert.equal(response.status, 201);
  body = await response.json() as any;
  assert.equal(body.success, true);
  assert.equal(body.facultyCreated, true);
  assert.equal(body.invitationSent, false);
  assert.match(body.warning, /created.*invitation email could not be sent/i);
  const failedUser = await prisma.user.findUniqueOrThrow({ where: { email: facultyBody("email-failure").email } });
  const failedProfile = await prisma.collegeFaculty.findUniqueOrThrow({ where: { userId: failedUser.id } });
  const failedInvitation = await prisma.invitation.findFirstOrThrow({
    where: { collegeId: college.id, email: failedUser.email, status: "pending" },
  });
  assert.equal(failedUser.isActive, false);
  assert.equal(failedProfile.status, "invited");
  assert.equal((failedInvitation.metadata as any)?.deliveryStatus, "failed");
  const failedHash = failedUser.passwordHash;
  console.log("PASS thrown email failure returns partial success and preserves valid invited database state");

  const invitationCountBeforeRetry = await prisma.invitation.count({ where: { email: failedUser.email } });
  response = await request("POST", "/faculty", token, facultyBody("email-failure"));
  assert.equal(response.status, 409);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: failedUser.id } })).passwordHash, failedHash);
  assert.equal(await prisma.invitation.count({ where: { email: failedUser.email } }), invitationCountBeforeRetry);
  console.log("PASS duplicate retry neither recreates faculty nor replaces credentials or invitation state");

  emailMode = "success";
  response = await request("POST", `/faculty/${failedProfile.id}/resend-invite`, token);
  assert.equal(response.status, 200);
  body = await response.json() as any;
  assert.equal(body.invitationSent, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: failedUser.id } })).passwordHash, failedHash);
  assert.equal(await prisma.collegeFaculty.count({ where: { userId: failedUser.id } }), 1);
  assert.equal(await prisma.invitation.count({ where: { email: failedUser.email, status: "pending" } }), 1);
  const latestLink = deliveredLinks.at(-1);
  assert(latestLink);
  assert(latestLink.includes("/login?invite="));
  const resentToken = new URL(latestLink).searchParams.get("invite");
  assert(resentToken);
  assert(await prisma.invitation.findUnique({
    where: { tokenHash: crypto.createHash("sha256").update(resentToken).digest("hex") },
  }));
  console.log("PASS explicit resend rotates the invitation without recreating the account or changing its password");

  const activeHash = administrator.passwordHash;
  const activeInvitations = await prisma.invitation.count({ where: { email: administrator.email } });
  response = await request("POST", "/faculty", token, { ...facultyBody("active-retry"), email: administrator.email });
  assert.equal(response.status, 409);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: administrator.id } })).passwordHash, activeHash);
  assert.equal(await prisma.invitation.count({ where: { email: administrator.email } }), activeInvitations);
  console.log("PASS existing active faculty retry leaves credentials and invitations unchanged");

  const originalTransaction = prisma.$transaction;
  const linksBeforeDatabaseFailure = deliveredLinks.length;
  try {
    (prisma as any).$transaction = async () => { throw new Error("forced creation transaction failure"); };
    response = await request("POST", "/faculty", token, facultyBody("db-failure"));
    assert.equal(response.status, 500);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
  assert.equal(await prisma.user.count({ where: { email: facultyBody("db-failure").email } }), 0);
  assert.equal(await prisma.invitation.count({ where: { email: facultyBody("db-failure").email } }), 0);
  assert.equal(deliveredLinks.length, linksBeforeDatabaseFailure);
  console.log("PASS pre-commit database failure leaves no account or invitation and sends no email");

  const transactionForProfileFailure = prisma.$transaction.bind(prisma) as any;
  try {
    (prisma as any).$transaction = (operation: any, options: any) => transactionForProfileFailure(
      async (tx: any) => operation(new Proxy(tx, {
        get(target, property) {
          if (property !== "collegeFaculty") return Reflect.get(target, property);
          return new Proxy(target.collegeFaculty, {
            get(profileTarget, profileProperty) {
              if (profileProperty === "create") {
                return async () => { throw new Error("forced faculty profile failure"); };
              }
              return Reflect.get(profileTarget, profileProperty);
            },
          });
        },
      })),
      options
    );
    response = await request("POST", "/faculty", token, facultyBody("profile-failure"));
    assert.equal(response.status, 500);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
  assert.equal(await prisma.user.count({ where: { email: facultyBody("profile-failure").email } }), 0);
  assert.equal(await prisma.invitation.count({ where: { email: facultyBody("profile-failure").email } }), 0);
  console.log("PASS faculty profile failure rolls back the user and invitation in the same transaction");

  const concurrentBody = facultyBody("concurrent");
  const concurrent = await Promise.all([
    request("POST", "/faculty", token, concurrentBody),
    request("POST", "/faculty", token, concurrentBody),
  ]);
  assert.deepEqual(concurrent.map((item) => item.status).sort(), [201, 409]);
  assert.equal(await prisma.user.count({ where: { email: concurrentBody.email } }), 1);
  const concurrentUser = await prisma.user.findUniqueOrThrow({ where: { email: concurrentBody.email } });
  assert.equal(await prisma.collegeFaculty.count({ where: { userId: concurrentUser.id } }), 1);
  assert.equal(await prisma.invitation.count({ where: { email: concurrentBody.email } }), 1);
  console.log("PASS concurrent duplicate requests produce exactly one faculty account, profile, and invitation");

  emailMode = "failure";
  response = await request("POST", "/faculty", token, facultyBody("returned-failure"));
  assert.equal(response.status, 201);
  assert.equal(((await response.json()) as any).invitationSent, false);
  console.log("PASS a non-throwing provider failure is also reported as partial success");

  console.log("E-14 faculty creation delivery regression suite passed.");
} finally {
  EmailService.sendFacultyInvitation = originalFacultyEmail;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.college.delete({ where: { id: college.id } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { collegeId: college.id } });
  await prisma.$disconnect();
}
