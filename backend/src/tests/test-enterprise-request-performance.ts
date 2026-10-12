import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import router from "../modules/enterprise/routes.js";
import { requireEnterpriseAccess, resolveEnterpriseAuthorization } from "../middleware/tenant.js";
import { assertRequestStudentCreditAuthorization } from "../modules/enterprise/student-credit-authorization.js";
import { EmailService } from "../services/email.service.js";

// Exercise the real authorization boundary and student route without a database
// or HTTP server. Separate scope/permission reads must not creep back in.
const restorers: Array<() => void> = [];
function mock(model: any, method: string, implementation: (...args: any[]) => any) {
  const original = model[method]; model[method] = implementation;
  restorers.push(() => { model[method] = original; });
}
const cohort = { program: "B.Tech", course: "CS", section: "A", batch: "2026" };
let permissions = ["STUDENT_VIEW", "STUDENT_CREATE"];
let reads = 0;
let revokeDuringRead = false;
const request = () => ({ method: "GET", collegeId: "college-a", query: {},
  headers: {}, college: { id: "college-a", name: "College A", code: "A", status: "active" },
  user: { id: "faculty-a", role: "college_faculty", email: "faculty@example.test" },
}) as unknown as Request;

mock(prisma.user, "findUnique", async (args) => {
  reads++;
  assert.equal(args.relationLoadStrategy, "join");
  return { isActive: true, role: "college_faculty", collegeId: "college-a", college: { status: "active" },
    facultyProfile: { collegeId: "college-a", status: "active", isMainFaculty: false,
      permissions: [...permissions], programAccess: [], courseAccess: [], sectionAccess: [], batchAccess: [],
      scopeUnrestricted: false, cohortAccess: [cohort] } };
});
mock(prisma.collegeFaculty, "findFirst", async () => { throw new Error("Redundant faculty scope query"); });
mock(prisma.collegeStudent, "count", async () => 2);
mock(prisma.collegeStudent, "findMany", async (args) => {
  assert.equal(args.relationLoadStrategy, "join");
  assert.equal(args.where.collegeId, "college-a");
  assert.deepEqual(args.where.AND[0], { OR: [cohort] });
  if (revokeDuringRead) permissions = [];
  return [1, 2].map(id => ({ id: `student-${id}`, userId: `user-${id}`, ...cohort,
    user: { id: `user-${id}`, name: "Student", email: `student${id}@example.test`,
      credits: { balance: 0 }, _count: { resumes: 0 } } }));
});
mock(prisma, "$queryRaw", async () => []);

async function call(method = "GET", path = "/students", body: unknown = {}) {
  const req = request();
  req.method = method; req.body = body;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const res = {
      statusCode: 200,
      send(this: Response, body: string) { resolve({ status: this.statusCode, body: JSON.parse(body) }); return this; },
      json(this: Response, body: unknown) { return this.send(JSON.stringify(body)); },
      status(this: Response, code: number) { this.statusCode = code; return this; },
      type() { return this; }, removeHeader() {},
    } as unknown as Response;
    void requireEnterpriseAccess(req, res, (error?: unknown) => {
      if (error) return reject(error);
      const route = (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method.toLowerCase()]);
      let index = 0;
      const next = (error?: unknown): void => {
        if (error) { reject(error); return; }
        const layer = route.route.stack[index++];
        if (layer) Promise.resolve(layer.handle(req, res, next)).catch(reject);
      };
      next();
    }).catch(reject);
  });
}

try {
  const result = await call();
  assert.equal(result.status, 200);
  assert.equal(result.body.students.length, 2);
  assert.equal(reads, 2, "Exactly one initial lookup and one final revocation check");
  console.log("PASS student page reuses scope/permissions and retains both live access checks");

  const req = request();
  reads = 0;
  await resolveEnterpriseAuthorization(req);
  await assertRequestStudentCreditAuthorization(req, false);
  await assert.rejects(assertRequestStudentCreditAuthorization(req, true), /INTERVIEW_CREDIT_ASSIGN/);
  assert.equal(reads, 1, "Initial credit checks must reuse the request snapshot without weakening permission checks");
  console.log("PASS onboarding reuses authorization and denies unassigned initial credits");

  reads = 0; revokeDuringRead = true;
  const revoked = await call();
  assert.equal(revoked.status, 403);
  assert.equal(revoked.body.students, undefined);
  assert.equal(reads, 2);
  const subsequent = await call();
  assert.equal(subsequent.status, 403);
  assert.equal(reads, 3, "Next request must read current permissions instead of a process cache");
  console.log("PASS in-flight and subsequent requests cannot release revoked student data");

  revokeDuringRead = false;
  permissions = ["STUDENT_CREATE", "FACULTY_CREATE"];
  let createdIdentities: any[] = [];
  let emailSucceeds = true;
  mock(prisma.college, "findUnique", async () => { throw new Error("Redundant tenant lookup during creation"); });
  mock(prisma.user, "findFirst", async () => null);
  mock(prisma.collegeStudent, "findUnique", async () => null);
  mock(prisma, "$transaction", async (run) => run({
    user: { create: async ({ data }: any) => {
      createdIdentities.push(data); return { id: "created-user", ...data };
    } },
    userCredit: { create: async ({ data }: any) => data },
    collegeStudent: { create: async ({ data }: any) => ({ id: "created-student", ...data }) },
    collegeFaculty: { create: async ({ data }: any) => ({ id: "created-faculty", ...data }) },
    invitation: { create: async ({ data }: any) => ({ id: "created-invitation", ...data }) },
  }));
  mock(prisma.invitation, "updateMany", async () => ({ count: 1 }));
  mock(prisma.enterpriseAuditLog, "create", async () => ({}));
  for (const method of ["sendStudentWelcomeEmail", "sendFacultyInvitation"]) {
    mock(EmailService, method, async () => ({ success: emailSucceeds, error: emailSucceeds ? undefined : "Email delivery timed out" }));
  }
  const studentBody = { name: "New Student", email: "new-student@example.test", enrollmentNumber: "EN-1", ...cohort, initialCredits: 0 };
  for (const delivered of [true, false]) {
    emailSucceeds = delivered; reads = 0;
    const created = await call("POST", "/students", studentBody);
    assert.equal(created.status, 201);
    assert.equal(created.body.invitationStatus, delivered ? "sent" : "failed");
    assert.equal(created.body.student.id, "created-student");
    assert.equal(reads, 1, "Student creation must not reload tenant, actor or faculty scope");
  }
  const beforeDenied = createdIdentities.length;
  const denied = await call("POST", "/students", { ...studentBody, section: "B" });
  assert.equal(denied.status, 403);
  assert.equal(createdIdentities.length, beforeDenied);
  console.log("PASS student creation uses one authorization read, retains delivery feedback and rejects out-of-scope students");

  for (const delivered of [true, false]) {
    emailSucceeds = delivered; reads = 0;
    const created = await call("POST", "/faculty", { name: "New Faculty", email: "new-faculty@example.test" });
    assert.equal(created.status, 201);
    assert.equal(created.body.facultyCreated, true);
    assert.equal(created.body.invitationStatus, delivered ? "sent" : "delivery_failed");
    assert.equal(createdIdentities.at(-1).isActive, false);
    assert.equal(created.body.faculty.status, "invited");
    assert.equal(reads, 1, "Faculty creation must reuse the live authorization and tenant lookup");
  }
  console.log("PASS faculty creation uses one authorization read and preserves inactive invitations on delivery failure");
} finally {
  for (const restore of restorers.reverse()) restore();
  await prisma.$disconnect();
}
