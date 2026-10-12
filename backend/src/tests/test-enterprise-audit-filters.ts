import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { logEnterpriseAudit } from "../services/audit.service.js";
import { signAccessToken } from "../utils/jwt.js";
import {
  ENTERPRISE_AUDIT_ACTIONS,
  ENTERPRISE_AUDIT_ACTION_ALIASES,
  resolveCanonicalAuditAction,
  type EnterpriseAuditLogsResponse,
} from "../types/enterpriseAudit.js";

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
      name: `E18 ${label} ${suffix}`,
      code: `E18-${label}-${suffix}`,
      officialEmail: `e18.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);
  return college;
}

async function createFaculty(
  collegeId: string,
  label: string,
  permissions: string[]
) {
  const role = "college_faculty";
  const user = await prisma.user.create({
    data: {
      name: `E18 ${label}`,
      email: `e18.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E18-Test-Password!", 4),
      role,
      collegeId,
      isActive: true,
      facultyProfile: {
        create: { collegeId, isMainFaculty: false, permissions, status: "active" },
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
  console.log("  STARTING E-18 ENTERPRISE AUDIT FILTERS & ACTION ALIASES TEST SUITE");
  console.log("===============================================================================");

  const collegeA = await createCollege("college-a");
  const facultyAuditA = await createFaculty(collegeA.id, "audit-a", ["AUDIT_VIEW"]);
  const facultyNoAuditA = await createFaculty(collegeA.id, "no-audit-a", ["REPORT_VIEW"]);

  // Seed records for canonical actions
  await logEnterpriseAudit({
    collegeId: collegeA.id,
    actorId: facultyAuditA.user.id,
    action: ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED,
    entity: "CollegeStudent",
    entityId: "import-event-1",
    newValue: { totalCreated: 50 },
  });

  await logEnterpriseAudit({
    collegeId: collegeA.id,
    actorId: facultyAuditA.user.id,
    action: ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED,
    entity: "CollegeCreditAccount",
    entityId: "credit-dist-1",
    newValue: { totalCredits: 200 },
  });

  await logEnterpriseAudit({
    collegeId: collegeA.id,
    actorId: facultyAuditA.user.id,
    action: ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED,
    entity: "CollegeFaculty",
    entityId: "fac-created-1",
    newValue: { name: "New Faculty" },
  });

  // Seed 25 records for FACULTY_UPDATED to test filter + pagination
  for (let i = 1; i <= 25; i++) {
    await logEnterpriseAudit({
      collegeId: collegeA.id,
      actorId: facultyAuditA.user.id,
      action: ENTERPRISE_AUDIT_ACTIONS.FACULTY_UPDATED,
      entity: "CollegeFaculty",
      entityId: `fac-updated-${i}`,
      oldValue: { index: i },
      newValue: { index: i + 1 },
    });
  }

  // -------------------------------------------------------------------------
  // TEST 1 — Students Imported (Canonical STUDENTS_BULK_IMPORTED)
  // -------------------------------------------------------------------------
  console.log("-> Testing Students Imported filter...");
  let res = await requestAudit(facultyAuditA.token, `?action=${ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED}`);
  assert.equal(res.status, 200);
  let body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED);
  console.log("  [PASS] 1.1 Canonical action=STUDENTS_BULK_IMPORTED matches database records");

  // Test legacy alias STUDENTS_IMPORTED
  res = await requestAudit(facultyAuditA.token, "?action=STUDENTS_IMPORTED");
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED);
  console.log("  [PASS] 1.2 Legacy alias action=STUDENTS_IMPORTED seamlessly maps to STUDENTS_BULK_IMPORTED");

  // -------------------------------------------------------------------------
  // TEST 2 — Credits Distributed (Canonical BULK_CREDITS_DISTRIBUTED)
  // -------------------------------------------------------------------------
  console.log("-> Testing Credits Distributed filter...");
  res = await requestAudit(facultyAuditA.token, `?action=${ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED}`);
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED);
  console.log("  [PASS] 2.1 Canonical action=BULK_CREDITS_DISTRIBUTED matches database records");

  // Test legacy alias CREDITS_DISTRIBUTED
  res = await requestAudit(facultyAuditA.token, "?action=CREDITS_DISTRIBUTED");
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED);
  console.log("  [PASS] 2.2 Legacy alias action=CREDITS_DISTRIBUTED seamlessly maps to BULK_CREDITS_DISTRIBUTED");

  // -------------------------------------------------------------------------
  // TEST 3 — Faculty Creation (Canonical FACULTY_CREATED)
  // -------------------------------------------------------------------------
  console.log("-> Testing Faculty Created filter...");
  res = await requestAudit(facultyAuditA.token, `?action=${ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED}`);
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED);
  console.log("  [PASS] 3.1 Canonical action=FACULTY_CREATED matches database records");

  // Test legacy alias FACULTY_INVITED
  res = await requestAudit(facultyAuditA.token, "?action=FACULTY_INVITED");
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 1);
  assert.equal(body.logs[0].action, ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED);
  console.log("  [PASS] 3.2 Legacy alias action=FACULTY_INVITED seamlessly maps to FACULTY_CREATED");

  // -------------------------------------------------------------------------
  // TEST 4 — Every Canonical Action in ENTERPRISE_AUDIT_ACTIONS
  // -------------------------------------------------------------------------
  console.log("-> Testing Canonical Action Dictionary Integrity...");
  const allActions = Object.values(ENTERPRISE_AUDIT_ACTIONS);
  assert(allActions.length >= 12, "Expected at least 12 canonical audit actions");
  for (const act of allActions) {
    assert.equal(typeof act, "string");
    assert.equal(act, act.toUpperCase());
    assert.equal(resolveCanonicalAuditAction(act), act);
  }
  console.log(`  [PASS] 4.1 All ${allActions.length} canonical audit actions are properly defined and self-resolving`);

  // -------------------------------------------------------------------------
  // TEST 5 — Filter + Pagination (25 FACULTY_UPDATED records with limit=10)
  // -------------------------------------------------------------------------
  console.log("-> Testing Filter + Pagination...");
  res = await requestAudit(facultyAuditA.token, "?action=FACULTY_UPDATED&page=1&limit=10");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 25);
  assert.equal(body.pagination.page, 1);
  assert.equal(body.pagination.totalPages, 3);
  assert.equal(body.logs.length, 10);

  res = await requestAudit(facultyAuditA.token, "?action=FACULTY_UPDATED&page=2&limit=10");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 2);
  assert.equal(body.logs.length, 10);

  res = await requestAudit(facultyAuditA.token, "?action=FACULTY_UPDATED&page=3&limit=10");
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.page, 3);
  assert.equal(body.logs.length, 5);
  console.log("  [PASS] 5.1 Filtered audit results paginate correctly (10 + 10 + 5 = 25)");

  // -------------------------------------------------------------------------
  // TEST 6 — Legitimate Canonical Action With No Records (Clean Empty State)
  // -------------------------------------------------------------------------
  console.log("-> Testing Legitimate Action with 0 Records...");
  res = await requestAudit(facultyAuditA.token, `?action=${ENTERPRISE_AUDIT_ACTIONS.REPORTS_EXPORTED}`);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 0);
  assert.equal(body.pagination.totalPages, 0);
  assert.equal(body.logs.length, 0);
  console.log("  [PASS] 6.1 Unrecorded canonical action cleanly returns 0 total records");

  // -------------------------------------------------------------------------
  // TEST 7 — Invalid Action Query Parameter
  // -------------------------------------------------------------------------
  console.log("-> Testing Invalid Action Input...");
  res = await requestAudit(facultyAuditA.token, "?action=NOT_A_REAL_AUDIT_ACTION");
  assert.equal(res.status, 200);
  body = (await res.json()) as EnterpriseAuditLogsResponse;
  assert.equal(body.pagination.total, 0);
  assert.equal(body.logs.length, 0);
  console.log("  [PASS] 7.1 Unknown/invalid action parameter handled safely without crash");

  // -------------------------------------------------------------------------
  // TEST 8 — Authorization Enforcement
  // -------------------------------------------------------------------------
  console.log("-> Testing Authorization with Action Filter...");
  res = await requestAudit(facultyNoAuditA.token, "?action=FACULTY_UPDATED");
  assert.equal(res.status, 403, "Caller lacking AUDIT_VIEW must be denied (HTTP 403)");
  console.log("  [PASS] 8.1 Filter parameter does not bypass AUDIT_VIEW permission check");

  console.log("===============================================================================");
  console.log("  ALL E-18 AUDIT ACTION FILTERS TESTS PASSED SUCCESSFULLY!");
  console.log("===============================================================================");
} finally {
  server.close();
  await prisma.college.deleteMany({
    where: { id: { in: collegeIds } },
  });
}
