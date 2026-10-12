import assert from "node:assert/strict";
import express from "express";
import { prisma } from "../db/prisma.js";
import router from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

// Real HTTP middleware/routes against isolated database mocks. Two server
// instances share database state; no live database fixtures are written.
const college = { id: "revoke-a", name: "A", code: "A", status: "active" };
const users = new Map<string, any>();
function user(id: string, main = false, role = main ? "college_main_faculty" : "college_faculty") {
  return { id, name: id, email: `${id}@example.com`, role, isActive: true, collegeId: college.id,
    facultyProfile: { id: `${id}-profile`, userId: id, collegeId: college.id, status: "active", isMainFaculty: main,
      permissions: main ? ["all"] : ["STUDENT_VIEW", "INTERVIEW_CREDIT_VIEW"],
      programAccess: [], courseAccess: [], sectionAccess: [], batchAccess: [], scopeUnrestricted: true, cohortAccess: [] } };
}
const faculty: any = user("revoke-faculty");
const admin = user("revoke-admin", true);
const superadmin = { ...user("revoke-super", false, "super_admin"), facultyProfile: null };
for (const account of [faculty, admin, superadmin]) users.set(account.id, account);
const token = (account: any, collegeId = college.id) => signAccessToken({ sub: account.id, email: account.email,
  role: account.role, collegeId, isMainFaculty: account.facultyProfile?.isMainFaculty, permissions: ["all"] });
const oldToken = token(faculty);
const adminToken = token(admin);
const restorers: Array<() => void> = [];
let dataReads = 0;
let pauseBalance: (() => Promise<void>) | undefined;
let failTransaction = false;
function mock(model: any, method: string, implementation: (...args: any[]) => any) {
  const original = model[method]; model[method] = implementation;
  restorers.push(() => { model[method] = original; });
}
mock(prisma.user, "findUnique", async ({ where }) => {
  const account = users.get(where.id);
  return account ? { ...account, college: { ...college }, facultyProfile: account.facultyProfile ? { ...account.facultyProfile } : null } : null;
});
mock(prisma.college, "findUnique", async ({ where }) => where.id === college.id ? { ...college } : { ...college, id: "revoke-b" });
mock(prisma.collegeFaculty, "findFirst", async ({ where }) => {
  const profile = users.get(where.userId)?.facultyProfile;
  return profile?.collegeId === where.collegeId && (!where.status || profile.status === where.status) ? { ...profile } : null;
});
mock(prisma.collegeFaculty, "findUnique", async ({ where }) => {
  const account = [...users.values()].find((account) => account.facultyProfile?.id === where.id);
  return account ? { ...account.facultyProfile, user: { ...account } } : null;
});
mock(prisma.collegeFaculty, "update", async ({ where, data }) => {
  const account = [...users.values()].find((account) => account.facultyProfile?.id === where.id);
  Object.assign(account.facultyProfile, data); return { ...account.facultyProfile };
});
mock(prisma.user, "update", async ({ where, data }) => { Object.assign(users.get(where.id), data); return users.get(where.id); });
mock(prisma, "$transaction", async (callback) => {
  if (failTransaction) throw new Error("Simulated transaction failure");
  return callback(prisma);
});
mock(prisma.enterpriseAuditLog, "create", async () => ({}));
mock(prisma.collegeStudent, "groupBy", async ({ where, by }) => {
  dataReads++; assert([college.id, "revoke-b"].includes(where.collegeId));
  if (by[0] === "status") return [{ status: "active", _count: { _all: 2 } }];
  if (by[0] === "department") return [{ department: "CS" }];
  return [{ program: "B.Tech", course: "CS", section: "A", batch: "2026" }];
});
mock(prisma.collegeFaculty, "groupBy", async () => [{ status: "active", _count: { _all: 2 } }]);
mock(prisma.collegeCreditAccount, "findUnique", async () => {
  dataReads++;
  if (pauseBalance) await pauseBalance();
  return { balance: 123, totalAllocated: 200, totalDistributed: 77 };
});
mock(prisma.interviewSession, "count", async () => 2);
mock(prisma.interviewReport, "aggregate", async () => ({ _avg: { overallScore: 80 } }));
mock(prisma.interviewReport, "groupBy", async () => [
  { overallScore: 80, scoreScale: 100, _count: { _all: 2 } },
]);
const servers = [1, 2].map(() => {
  const app = express(); app.use(express.json()); app.use("/api/enterprise", router); app.use(errorHandler);
  return app.listen(0, "127.0.0.1");
});
await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.once("listening", resolve))));
const origins = servers.map((server) => { const address = server.address(); assert(address && typeof address === "object"); return `http://127.0.0.1:${address.port}/api/enterprise`; });
async function request(path: string, accessToken = oldToken, expected = 200, instance = 0, method = "GET") {
  const response = await fetch(`${origins[instance]}${path}`, { method,
    headers: { Authorization: `Bearer ${accessToken}`, "x-target-college-id": "revoke-b" } });
  assert.equal(response.status, expected, `${method} ${path}`);
  return await response.json() as any;
}
function restoreFaculty() { faculty.isActive = true; faculty.collegeId = college.id; faculty.role = "college_faculty";
  faculty.facultyProfile = user(faculty.id).facultyProfile; users.set(faculty.id, faculty); }
try {
  const initialStats = await request("/stats");
  assert.equal(initialStats.college.id, college.id, "Faculty cannot override their tenant via the target header");
  assert.equal(initialStats.credits.balance, 123);
  assert.equal((await request("/stats")).faculty.total, 0, "JWT all must not grant current unassigned metrics");
  await request("/filter-options"); await request("/filter-options", oldToken, 200, 1);
  console.log("PASS current permissions allow active faculty; old JWT all does not elevate metrics");
  faculty.facultyProfile.permissions = [];
  await request("/stats", oldToken, 403); await request("/filter-options", oldToken, 403);
  await request("/dashboard/stats", oldToken, 403);
  faculty.facultyProfile.permissions = ["AUDIT_VIEW"];
  await request("/filter-options", oldToken, 403);
  restoreFaculty();
  console.log("PASS permission revocation and insufficient permissions reject stats, legacy alias and filter metadata");
  await request("/stats", token(faculty, "revoke-b"), 403);
  faculty.facultyProfile.collegeId = "revoke-b"; await request("/stats", oldToken, 403); restoreFaculty();
  await request("/stats", adminToken); await request("/filter-options", adminToken);
  await request("/stats", token(superadmin));
  superadmin.role = "college_faculty"; await request("/stats", token({ ...superadmin, role: "super_admin" }), 403);
  superadmin.role = "super_admin";
  console.log("PASS trusted main/platform administrators retain access; mismatched tenant or stale admin role cannot bypass checks");
  // Pause a read after authorization, then deactivate through the actual route.
  let balanceStarted!: () => void; let releaseBalance!: () => void;
  const started = new Promise<void>((resolve) => { balanceStarted = resolve; });
  const hold = new Promise<void>((resolve) => { releaseBalance = resolve; });
  pauseBalance = async () => { balanceStarted(); await hold; };
  const pendingRead = request("/stats", oldToken, 403, 1);
  await started;
  await request(`/faculty/${faculty.facultyProfile.id}`, adminToken, 200, 0, "DELETE");
  assert.equal(faculty.isActive, false); assert.equal(faculty.facultyProfile.status, "inactive");
  const before = dataReads;
  await Promise.all(Array.from({ length: 12 }, (_, i) => request(i % 2 ? "/filter-options" : "/stats", oldToken, 403, i % 2)));
  assert.equal(dataReads, before, "Revoked requests must never execute data reads");
  releaseBalance(); await pendingRead; pauseBalance = undefined;
  console.log("PASS deactivation commits before success; both instances deny old JWTs and concurrent/post-revocation reads; pending response is withheld");
  for (const path of ["/students", "/reports", "/reports/export", "/faculty", "/credits", "/credits/ledger", "/audit-logs"]) {
    await request(path, oldToken, 403);
  }
  await request("/credits/distribute", oldToken, 403, 0, "POST");
  console.log("PASS revocation protects student/report/faculty/credit/audit reads and bulk writes");
  restoreFaculty(); await request("/stats"); await request("/filter-options", oldToken, 200, 1);
  faculty.facultyProfile.status = "suspended"; await request("/stats", oldToken, 403); restoreFaculty();
  faculty.facultyProfile = null; await request("/filter-options", oldToken, 403); restoreFaculty();
  users.delete(faculty.id); await request("/stats", oldToken, 403); restoreFaculty();
  college.status = "suspended"; await request("/stats", oldToken, 403); college.status = "active";
  console.log("PASS valid reactivation restores access; missing/deleted/suspended memberships and suspended institutions fail closed");
  failTransaction = true;
  await request(`/faculty/${faculty.facultyProfile.id}`, adminToken, 500, 0, "DELETE");
  failTransaction = false;
  assert.equal(faculty.isActive, true); await request("/stats");
  console.log("PASS failed deactivation is not reported as success");
  // Scope changes are read from the database on every request, across servers.
  faculty.facultyProfile.scopeUnrestricted = false;
  faculty.facultyProfile.cohortAccess = [{ program: "B.Tech", course: "CS", section: "B", batch: "2026" }];
  const originalGroups = prisma.collegeStudent.groupBy;
  mock(prisma.collegeStudent, "groupBy", async (args) => {
    assert.deepEqual(args.where.AND[0], { OR: faculty.facultyProfile.cohortAccess });
    return originalGroups(args);
  });
  await request("/filter-options"); await request("/filter-options", oldToken, 200, 1);
  console.log("PASS cohort scope changes take effect on both instances without TTL cache invalidation");
} finally {
  pauseBalance = undefined;
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const restore of restorers.reverse()) restore(); await prisma.$disconnect();
}
