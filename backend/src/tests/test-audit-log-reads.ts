import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { prisma } from "../db/prisma.js";
import routes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

// Exercise the real route/middleware without writing fixtures to the configured database.
const college = { id: "audit-college", name: "Audit College", code: "AUDIT", status: "active" };
const faculty = {
  id: "audit-faculty", email: "faculty@example.test", role: "college_faculty" as const,
  isActive: true, collegeId: college.id, college,
  facultyProfile: {
    collegeId: college.id, status: "active", isMainFaculty: false, permissions: ["AUDIT_VIEW"],
    programAccess: [], courseAccess: [], sectionAccess: [], batchAccess: [],
    scopeUnrestricted: true, cohortAccess: [],
  },
};
const existingActor = { id: "existing-actor", name: "Existing Faculty", email: "actor@example.test", role: "college_faculty" };
const ledger = [
  { id: "missing-actor-log", collegeId: college.id, actorId: "removed-actor", action: "BULK_CREDITS_DISTRIBUTED" },
  { id: "existing-actor-log", collegeId: college.id, actorId: existingActor.id, action: "FACULTY_UPDATED" },
  { id: "same-actor-log", collegeId: college.id, actorId: existingActor.id, action: "FACULTY_CREATED" },
  { id: "foreign-log", collegeId: "other-college", actorId: existingActor.id, action: "FACULTY_UPDATED" },
].map((log, index) => ({
  ...log, entity: "CollegeFaculty", entityId: "target-faculty", ipAddress: null,
  oldValue: { passwordHash: "test-only-private-value" }, newValue: { status: "active" },
  metadata: { nested: { authorization: "test-only-private-value" } },
  createdAt: new Date(Date.UTC(2026, 10, 17, 0, 0, 4 - index)),
}));
const restorers: Array<() => void> = [];
function stub(delegate: any, method: string, implementation: (...args: any[]) => any) {
  const original = delegate[method];
  delegate[method] = implementation;
  restorers.push(() => { delegate[method] = original; });
}
let auditReads = 0;
let actorReads = 0;
let actorIds: string[] = [];
function matchingLogs(where: any) {
  assert.equal(where.collegeId, college.id, "Audit reads must retain the authenticated institution filter");
  return ledger.filter(log => log.collegeId === where.collegeId && (!where.action || log.action === where.action));
}
stub(prisma.user, "findUnique", async ({ where }) => where.id === faculty.id ? faculty : null);
stub(prisma.college, "findUnique", async ({ where }) => ({ ...college, id: where.id }));
stub(prisma.enterpriseAuditLog, "count", async ({ where }) => { auditReads++; return matchingLogs(where).length; });
stub(prisma.enterpriseAuditLog, "findMany", async ({ where, skip = 0, take, include }) => {
  auditReads++;
  const rows = matchingLogs(where).slice(skip, skip + take);
  // Reproduce Prisma's failure when a required actor relation references a missing user.
  if (include?.actor && rows.some(log => log.actorId === "removed-actor")) {
    throw new Error("Inconsistent query result: Field actor is required to return data, got null instead.");
  }
  return rows.map(log => ({ ...log, ...(include?.actor ? { actor: existingActor } : {}) }));
});
stub(prisma.user, "findMany", async ({ where, select }) => {
  actorReads++;
  actorIds = where.id.in;
  assert.deepEqual(select, { id: true, name: true, email: true, role: true }, "Only public actor details may be read");
  return actorIds.includes(existingActor.id) ? [existingActor] : [];
});

const token = (collegeId = college.id) => signAccessToken({
  sub: faculty.id, email: faculty.email, role: faculty.role, collegeId, permissions: ["AUDIT_VIEW"],
});
const app = express();
app.use("/api/enterprise", routes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/api/enterprise/audit-logs`;
const request = (query = "", accessToken = token()) => fetch(base + query, { headers: { authorization: `Bearer ${accessToken}` } });

try {
  await test("missing actor accounts do not hide audit entries or crash the faculty audit page", async () => {
    const before = actorReads;
    const response = await request("?page=1&limit=15");
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json() as any;
    assert.equal(body.success, true);
    assert.deepEqual(body.logs.map((log: any) => log.id), ["missing-actor-log", "existing-actor-log", "same-actor-log"]);
    assert.equal(body.logs[0].actor, null);
    assert.deepEqual(body.logs[1].actor, existingActor);
    assert.deepEqual(body.logs[2].actor, existingActor);
    assert.equal(body.logs[0].oldValue.passwordHash, "[REDACTED]");
    assert.equal(body.logs[0].metadata.nested.authorization, "[REDACTED]");
    assert(!JSON.stringify(body).includes("test-only-private-value"));
    assert.deepEqual(body.pagination, { page: 1, limit: 15, total: 3, totalPages: 1 });
    assert.equal(actorReads - before, 1, "Actor details are loaded in one batch per page");
    assert.deepEqual([...actorIds].sort(), [existingActor.id, "removed-actor"].sort());
  });

  await test("pagination and existing actor details still work", async () => {
    const response = await request("?page=2&limit=1");
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.logs.length, 1);
    assert.equal(body.logs[0].id, "existing-actor-log");
    assert.deepEqual(body.logs[0].actor, existingActor);
    assert.deepEqual(body.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
  });

  await test("action aliases still return matching logs with missing actors", async () => {
    const response = await request("?action=CREDITS_DISTRIBUTED");
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.pagination.total, 1);
    assert.equal(body.logs[0].id, "missing-actor-log");
    assert.equal(body.logs[0].actor, null);
  });

  await test("an empty audit page does not perform an actor lookup", async () => {
    const before = actorReads;
    const response = await request("?action=NO_MATCHING_ACTION");
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.deepEqual(body.logs, []);
    assert.equal(body.pagination.total, 0);
    assert.equal(actorReads, before);
  });

  await test("AUDIT_VIEW revocation still denies ledger reads", async () => {
    const before = auditReads;
    faculty.facultyProfile.permissions = [];
    try { assert.equal((await request()).status, 403); }
    finally { faculty.facultyProfile.permissions = ["AUDIT_VIEW"]; }
    assert.equal(auditReads, before);
  });

  await test("a faculty token cannot select another institution's audit ledger", async () => {
    const before = auditReads;
    assert.equal((await request("", token("other-college"))).status, 403);
    assert.equal(auditReads, before);
  });
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  while (restorers.length) restorers.pop()!();
  await prisma.$disconnect();
}
