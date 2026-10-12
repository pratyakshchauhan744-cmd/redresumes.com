import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { logEnterpriseAudit } from "../services/audit.service.js";
import { signAccessToken } from "../utils/jwt.js";
import type { EnterpriseAuditLogsResponse } from "../types/enterpriseAudit.js";

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
      name: `E17 ${label} ${suffix}`,
      code: `E17-${label}-${suffix}`,
      officialEmail: `e17.${label}.${suffix}@example.com`,
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
      name: `E17 ${label}`,
      email: `e17.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E17-Test-Password!", 4),
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

async function requestAudit(token: string, query = "") {
  return fetch(`${baseUrl}/audit-logs${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

try {
  console.log("===============================================================================");
  console.log("  STARTING E-17 ENTERPRISE AUDIT LOGS CONTRACT & PAGINATION TEST SUITE");
  console.log("===============================================================================");

  const collegeA = await createCollege("college-a");
  const collegeB = await createCollege("college-b");

  const facultyAuditA = await createFaculty(collegeA.id, "audit-a", ["AUDIT_VIEW"]);
  const facultyNoAuditA = await createFaculty(collegeA.id, "no-audit-a", ["REPORT_VIEW"]);
  const facultyAuditB = await createFaculty(collegeB.id, "audit-b", ["AUDIT_VIEW"]);

  // Seed 25 audit records in College A
  for (let i = 1; i <= 25; i++) {
    await logEnterpriseAudit({
      collegeId: collegeA.id,
      actorId: facultyAuditA.user.id,
      action: i % 2 === 0 ? "STUDENT_CREATED" : "FACULTY_UPDATED",
      entity: i % 2 === 0 ? "CollegeStudent" : "CollegeFaculty",
      entityId: `entity-${i}`,
      oldValue: i % 2 === 1 ? { permission: false, testIndex: i } : null,
      newValue: { name: `Target User ${i}`, email: `target${i}@college.edu`, permission: true },
      metadata: { reason: `Batch verification #${i}`, count: i },
      ipAddress: `192.168.1.${i}`,
    });
  }

  // Seed 1 audit record in College B
  await logEnterpriseAudit({
    collegeId: collegeB.id,
    actorId: facultyAuditB.user.id,
    action: "COLLEGE_B_PRIVATE_EVENT",
    entity: "SecurityAudit",
    entityId: "college-b-secret-id",
    newValue: { secretMarker: "COLLEGE_B_DATA" },
    ipAddress: "10.0.0.1",
  });

  // -------------------------------------------------------------------------
  // TEST 1 — Canonical Contract & res.pagination.total (Not res.total)
  // -------------------------------------------------------------------------
  console.log("-> Running Contract Structure Tests...");
  let res = await requestAudit(facultyAuditA.token, "?page=1&limit=10");
  assert.equal(res.status, 200, "Expected HTTP 200");
  let body = (await res.json()) as EnterpriseAuditLogsResponse & { total?: unknown };

  assert(Array.isArray(body.logs), "Expected body.logs to be an array");
  assert(body.pagination, "Expected body.pagination to be defined");
  assert.equal(typeof body.pagination.total, "number", "Expected pagination.total to be a number");
  assert.equal(typeof body.pagination.page, "number", "Expected pagination.page to be a number");
  assert.equal(typeof body.pagination.limit, "number", "Expected pagination.limit to be a number");
  assert.equal(typeof body.pagination.totalPages, "number", "Expected pagination.totalPages to be a number");
  assert.equal(body.pagination.total, 25, "Expected pagination.total to equal 25");
  assert.equal(body.pagination.page, 1, "Expected pagination.page to equal 1");
  assert.equal(body.pagination.limit, 10, "Expected pagination.limit to equal 10");
  assert.equal(body.pagination.totalPages, 3, "Expected 25 items at limit 10 to yield 3 pages");
  assert.equal(body.logs.length, 10, "Expected first page to return 10 records");
  console.log("  [PASS] 1.1 Canonical contract returns res.pagination.total=25 and 10 logs");

  // -------------------------------------------------------------------------
  // TEST 2 — Middle Page (Page 2)
  // -------------------------------------------------------------------------
  res = await requestAudit(facultyAuditA.token, "?page=2&limit=10");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 2);
  assert.equal(body.logs.length, 10, "Expected middle page to return 10 records");
  console.log("  [PASS] 2.1 Middle page (page=2, limit=10) returns 10 records");

  // -------------------------------------------------------------------------
  // TEST 3 — Last Page (Partial, Page 3: 5 records remaining)
  // -------------------------------------------------------------------------
  res = await requestAudit(facultyAuditA.token, "?page=3&limit=10");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 3);
  assert.equal(body.logs.length, 5, "Expected last partial page to return 5 records");
  console.log("  [PASS] 3.1 Partial last page (page=3, limit=10) returns remaining 5 records");

  // -------------------------------------------------------------------------
  // TEST 4 — Input Validation Clamping (Negative / NaN / Huge limit)
  // -------------------------------------------------------------------------
  console.log("-> Running Input Validation Clamping Tests...");
  res = await requestAudit(facultyAuditA.token, "?page=-5&limit=-100");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 1, "Expected negative page to be clamped to 1");
  assert.equal(body.pagination.limit, 15, "Expected negative limit to default to 15");

  res = await requestAudit(facultyAuditA.token, "?page=not-a-number&limit=999999");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 1, "Expected NaN page to default to 1");
  assert.equal(body.pagination.limit, 100, "Expected huge limit to be clamped to max 100");
  console.log("  [PASS] 4.1 Input validation safely clamps negative/NaN/oversized pagination values");

  // -------------------------------------------------------------------------
  // TEST 5 — Row Schema Fields: entity, actor, oldValue, newValue, metadata
  // -------------------------------------------------------------------------
  console.log("-> Running Row Schema & Field Tests...");
  const firstLog = body.logs[0];
  assert(firstLog.id, "Expected log.id to exist");
  assert(firstLog.action, "Expected log.action to exist");
  assert(firstLog.entity, "Expected log.entity to exist");
  assert(firstLog.entityId, "Expected log.entityId to exist");
  assert(firstLog.actor, "Expected log.actor to exist");
  assert.equal(firstLog.actor?.email, facultyAuditA.user.email);
  assert(firstLog.createdAt, "Expected log.createdAt to exist");
  assert(new Date(firstLog.createdAt).toISOString() === firstLog.createdAt, "Expected valid ISO timestamp");
  console.log("  [PASS] 5.1 Row schema contains canonical entity, actor, and ISO createdAt fields");

  // -------------------------------------------------------------------------
  // TEST 6 — Action Filtering and Search
  // -------------------------------------------------------------------------
  console.log("-> Running Filter & Search Tests...");
  res = await requestAudit(facultyAuditA.token, "?action=STUDENT_CREATED&limit=50");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert(body.logs.length > 0, "Expected filtered results");
  assert(body.logs.every((l) => l.action === "STUDENT_CREATED"), "All returned logs must match action filter");
  assert.equal(body.pagination.total, 12, "Expected 12 STUDENT_CREATED records");

  res = await requestAudit(facultyAuditA.token, "?search=entity-5");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert(body.logs.some((l) => l.entityId === "entity-5"), "Expected search to match entityId");
  console.log("  [PASS] 6.1 Action filtering and search accurately query tenant audit ledger");

  // -------------------------------------------------------------------------
  // TEST 7 — Tenant Isolation (College A cannot see College B)
  // -------------------------------------------------------------------------
  console.log("-> Running Multi-Tenant Isolation Tests...");
  res = await requestAudit(facultyAuditA.token, "?limit=100");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  const hasCollegeBLog = body.logs.some((l) => l.entityId === "college-b-secret-id");
  assert.equal(hasCollegeBLog, false, "College A faculty must never see College B audit events");

  res = await requestAudit(facultyAuditB.token, "?limit=100");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1, "College B should only see its 1 audit event");
  assert.equal(body.logs[0].entityId, "college-b-secret-id");
  console.log("  [PASS] 7.1 Cross-tenant isolation strictly verified");

  // -------------------------------------------------------------------------
  // TEST 8 — Authorization Enforcement (E-15 AUDIT_VIEW requirement)
  // -------------------------------------------------------------------------
  console.log("-> Running Authorization Tests...");
  res = await requestAudit(facultyNoAuditA.token);
  assert.equal(res.status, 403, "Faculty lacking AUDIT_VIEW must receive HTTP 403");
  console.log("  [PASS] 8.1 Access denied for user lacking AUDIT_VIEW");

  console.log("===============================================================================");
  console.log("  ALL E-17 ENTERPRISE AUDIT LOGS TESTS PASSED SUCCESSFULLY!");
  console.log("===============================================================================");
} finally {
  server.close();
  // Cleanup test colleges
  await prisma.college.deleteMany({
    where: { id: { in: collegeIds } },
  });
}
