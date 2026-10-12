import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { logEnterpriseAudit } from "../services/audit.service.js";
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

async function createCollege(label: string) {
  const college = await prisma.college.create({
    data: {
      name: `E15 ${label} ${suffix}`,
      code: `E15-${label}-${suffix}`,
      officialEmail: `e15.${label}.${suffix}@example.com`,
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
  main = false
) {
  const role = main ? "college_main_faculty" : "college_faculty";
  const user = await prisma.user.create({
    data: {
      name: `E15 ${label}`,
      email: `e15.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E15-Test-Password!", 4),
      role,
      collegeId,
      isActive: true,
      facultyProfile: {
        create: { collegeId, isMainFaculty: main, permissions, status: "active" },
      },
    },
  });
  return {
    user,
    token: signAccessToken({
      sub: user.id,
      email: user.email,
      role,
      collegeId,
      permissions,
    }),
  };
}

async function request(token: string, query = "") {
  return fetch(`${baseUrl}/audit-logs${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function updateFaculty(token: string, facultyId: string, permissions: string[]) {
  return fetch(`${baseUrl}/faculty/${facultyId}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
}

try {
  const collegeA = await createCollege("college-a");
  const collegeB = await createCollege("college-b");
  const reportOnly = await createFaculty(collegeA.id, "report-only", ["REPORT_VIEW"]);
  const auditOnly = await createFaculty(collegeA.id, "audit-only", ["AUDIT_VIEW"]);
  const neither = await createFaculty(collegeA.id, "neither", []);
  const both = await createFaculty(collegeA.id, "both", ["REPORT_VIEW", "AUDIT_VIEW"]);
  const administrator = await createFaculty(collegeA.id, "administrator", [], true);
  const collegeBActor = await createFaculty(collegeB.id, "college-b-actor", ["AUDIT_VIEW"]);

  await logEnterpriseAudit({
    collegeId: collegeA.id,
    actorId: administrator.user.id,
    action: "E15_SECRET_SANITIZATION",
    entity: "SecurityTest",
    entityId: "college-a-event",
    oldValue: { password: "old-password-secret", nested: { accessToken: "old-access-secret" } },
    newValue: { passwordHash: "hash-secret", inviteToken: "invite-secret", safe: "retained" },
    metadata: {
      authorization: "Bearer authorization-secret",
      cookie: "session=cookie-secret",
      apiKey: "api-key-secret",
      nested: { resetToken: "reset-secret", safeMetadata: "retained" },
    },
    ipAddress: "192.0.2.15",
  });
  await prisma.enterpriseAuditLog.create({
    data: {
      collegeId: collegeB.id,
      actorId: collegeBActor.user.id,
      action: "E15_OTHER_TENANT_SECRET",
      entity: "SecurityTest",
      entityId: "college-b-event",
      newValue: { marker: "COLLEGE_B_PRIVATE_MARKER" },
      ipAddress: "198.51.100.27",
    },
  });

  let response = await request(reportOnly.token);
  assert.equal(response.status, 403);
  let responseText = await response.text();
  assert.doesNotMatch(responseText, /192\.0\.2\.15|old-password-secret|authorization-secret/);
  console.log("PASS REPORT_VIEW alone cannot access audit records or sensitive forensic fields");

  response = await request(neither.token);
  assert.equal(response.status, 403);
  console.log("PASS faculty with neither permission cannot access audit logs");

  response = await request(auditOnly.token);
  assert.equal(response.status, 200);
  let body = await response.json() as any;
  assert(body.logs.some((log: any) => log.entityId === "college-a-event"));
  assert.equal(body.logs.some((log: any) => log.entityId === "college-b-event"), false);
  assert.equal(body.logs.some((log: any) => log.ipAddress === "192.0.2.15"), true);
  console.log("PASS AUDIT_VIEW independently grants tenant-scoped audit access without REPORT_VIEW");

  response = await request(both.token);
  assert.equal(response.status, 200);
  console.log("PASS REPORT_VIEW plus AUDIT_VIEW grants audit access");

  response = await request(administrator.token);
  assert.equal(response.status, 200);
  console.log("PASS existing Main Faculty administrator semantics retain audit access");

  const reportOnlyProfile = await prisma.collegeFaculty.findUniqueOrThrow({
    where: { userId: reportOnly.user.id },
  });
  response = await updateFaculty(
    administrator.token,
    reportOnlyProfile.id,
    ["REPORT_VIEW", "AUDIT_VIEW"]
  );
  assert.equal(response.status, 200);
  assert.equal((await request(reportOnly.token)).status, 200);
  let permissionAudit = await prisma.enterpriseAuditLog.findFirst({
    where: { collegeId: collegeA.id, action: "FACULTY_UPDATED", entityId: reportOnlyProfile.id },
    orderBy: { createdAt: "desc" },
  });
  assert.deepEqual((permissionAudit?.newValue as any)?.permissions, ["REPORT_VIEW", "AUDIT_VIEW"]);

  response = await updateFaculty(administrator.token, reportOnlyProfile.id, ["REPORT_VIEW"]);
  assert.equal(response.status, 200);
  assert.equal((await request(reportOnly.token)).status, 403);
  const permissionAudits = await prisma.enterpriseAuditLog.findMany({
    where: { collegeId: collegeA.id, action: "FACULTY_UPDATED", entityId: reportOnlyProfile.id },
  });
  assert(permissionAudits.some((audit) =>
    JSON.stringify((audit.newValue as any)?.permissions) === JSON.stringify(["REPORT_VIEW"])
  ));
  console.log("PASS explicit AUDIT_VIEW grants and revocations take effect immediately and remain audited");

  response = await request(auditOnly.token, `?collegeId=${encodeURIComponent(collegeB.id)}&search=E15_OTHER_TENANT_SECRET`);
  assert.equal(response.status, 200);
  responseText = await response.text();
  assert.doesNotMatch(responseText, /COLLEGE_B_PRIVATE_MARKER|198\.51\.100\.27|college-b-event/);
  console.log("PASS client-supplied tenant identifiers cannot expose another college's audit trail");

  response = await request(auditOnly.token, "?search=E15_SECRET_SANITIZATION");
  assert.equal(response.status, 200);
  body = await response.json() as any;
  assert.equal(body.logs.length, 1);
  responseText = JSON.stringify(body.logs[0]);
  for (const secret of [
    "old-password-secret",
    "old-access-secret",
    "hash-secret",
    "invite-secret",
    "authorization-secret",
    "cookie-secret",
    "api-key-secret",
    "reset-secret",
  ]) {
    assert.doesNotMatch(responseText, new RegExp(secret));
  }
  assert.match(responseText, /\[REDACTED\]/);
  assert.match(responseText, /retained/);

  const stored = await prisma.enterpriseAuditLog.findFirstOrThrow({
    where: { collegeId: collegeA.id, action: "E15_SECRET_SANITIZATION" },
  });
  const storedText = JSON.stringify({ oldValue: stored.oldValue, newValue: stored.newValue, metadata: stored.metadata });
  assert.doesNotMatch(storedText, /old-password-secret|authorization-secret|reset-secret/);
  console.log("PASS sensitive audit payload keys are redacted both at write time and response time");

  console.log("E-15 audit authorization regression suite passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const collegeId of collegeIds.reverse()) {
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { collegeId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
