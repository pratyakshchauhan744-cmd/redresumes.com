import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "../db/prisma.js";
import authRoutes from "../modules/auth/routes.js";
import invitationRoutes from "../modules/auth/invitation-routes.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import { loadSessionContext } from "../modules/auth/session-context.js";
import { env } from "../config/env.js";

// Exercise real HTTP login/refresh, JWT verification, tenant middleware and RBAC.
// Database state is isolated in memory; no configured database is modified.
const password = "Lifecycle@123";
const passwordHash = await bcrypt.hash(password, 4);
const collegeA = { id: "refresh-college-a", name: "College A", code: "A", website: null, status: "active" };
const collegeB = { ...collegeA, id: "refresh-college-b", code: "B" };
const faculty = { collegeId: collegeA.id, status: "active", isMainFaculty: false, permissions: ["manageStudents"],
  scopeUnrestricted: true, cohortAccess: [], programAccess: [], courseAccess: [], sectionAccess: [], batchAccess: [] };
const enterprise = { id: "refresh-faculty", name: "Faculty", email: "refresh-faculty@example.com", passwordHash,
  role: "college_faculty", isActive: true, collegeId: collegeA.id, facultyProfile: faculty, studentProfile: null };
const candidate = { id: "refresh-candidate", name: "Candidate", email: "refresh-candidate@example.com", passwordHash,
  role: "candidate", isActive: true, collegeId: null, facultyProfile: null, studentProfile: null };
const users = new Map<string, any>([[enterprise.id, enterprise], [candidate.id, candidate]]);
const colleges = new Map([[collegeA.id, collegeA], [collegeB.id, collegeB]]);
const sessions: any[] = [];
const restore: Array<() => void> = [];
function mock(model: any, method: string, implementation: (...args: any[]) => any) {
  const original = model[method];
  model[method] = implementation;
  restore.push(() => { model[method] = original; });
}
mock(prisma.user, "findUnique", async ({ where }) => {
  const user = where.id ? users.get(where.id) : [...users.values()].find((user) => user.email === where.email);
  return user ? { ...user, college: colleges.get(user.collegeId) ?? null } : null;
});
mock(prisma.refreshToken, "create", async ({ data }) => { sessions.push(data); return data; });
mock(prisma.refreshToken, "findFirst", async ({ where }) => {
  const session = sessions.find((session) => session.userId === where.userId && session.tokenHash === where.tokenHash && session.expiresAt > where.expiresAt.gt);
  return session ? { ...session, user: users.get(session.userId) ?? null } : null;
});
mock(prisma.signInEvent, "create", async () => ({}));
mock(prisma.college, "findUnique", async ({ where }) => colleges.get(where.id) ?? null);
mock(prisma.collegeFaculty, "findFirst", async ({ where }) => {
  const user = users.get(where.userId);
  const profile = user?.facultyProfile;
  return profile && profile.collegeId === where.collegeId && (!where.status || profile.status === where.status) ? profile : null;
});
mock(prisma.collegeStudent, "count", async ({ where }) => { assert.equal(where.collegeId, collegeA.id); return 1; });
mock(prisma.collegeStudent, "findMany", async ({ where }) => {
  assert.equal(where.collegeId, collegeA.id, "Enterprise read must remain in College A");
  return [{ id: "student-a", userId: "student-user-a", enrollmentNumber: "A1", program: "B.Tech", course: "CS", section: "A", batch: "2026",
    user: { id: "student-user-a", name: "Student A", email: "student-a@example.com", credits: { balance: 1 }, _count: { resumes: 0 } } }];
});
mock(prisma, "$queryRaw", async () => []);
const app = express();
app.use(express.json(), cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/auth/invitations", invitationRoutes);
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
async function login(email: string) {
  const res = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  return { cookie, ...(await res.json()) as { accessToken: string } };
}
async function refresh(cookie: string, expected = 200, body?: any) {
  const res = await fetch(`${origin}/api/auth/refresh`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "x-target-college-id": collegeB.id }, body: JSON.stringify(body ?? {}) });
  assert.equal(res.status, expected);
  return await res.json() as { accessToken: string };
}
async function students(token: string, expected = 200) {
  const res = await fetch(`${origin}/api/enterprise/students`, { headers: { Authorization: `Bearer ${token}`, "x-target-college-id": collegeB.id } });
  assert.equal(res.status, expected);
  if (expected === 200) assert.equal((await res.json() as any).students[0].id, "student-a");
}
try {
  const auth = await login(enterprise.email);
  const initial = verifyToken(auth.accessToken, "access");
  assert.equal(initial.collegeId, collegeA.id);
  assert(initial.permissions?.includes("STUDENT_VIEW"));
  await students(auth.accessToken);
  for (let i = 0; i < 3; i++) {
    const next = await refresh(auth.cookie, 200, { collegeId: collegeB.id, permissions: ["all"], role: "super_admin" });
    const payload = verifyToken(next.accessToken, "access");
    assert.equal(payload.collegeId, collegeA.id);
    assert.equal(payload.role, "college_faculty");
    assert.deepEqual(payload.permissions, initial.permissions);
    await students(next.accessToken);
  }
  console.log("PASS login and successive refreshes preserve verified tenant and RBAC; College B overrides are ignored");
  const expired = jwt.sign({ sub: enterprise.id, role: enterprise.role, email: enterprise.email, collegeId: collegeA.id, type: "access" }, env.JWT_SECRET, { expiresIn: -1 });
  await students(expired, 401);
  await students((await refresh(auth.cookie)).accessToken);
  console.log("PASS expired access token plus valid refresh session restores protected dashboard access");
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => refresh(auth.cookie)));
  for (const next of concurrent) assert.equal(verifyToken(next.accessToken).collegeId, collegeA.id);
  console.log("PASS concurrent backend refreshes retain consistent tenant context");
  faculty.permissions = ["REPORT_VIEW"];
  const changed = await refresh(auth.cookie);
  assert.deepEqual(verifyToken(changed.accessToken).permissions, ["REPORT_VIEW"]);
  await students(changed.accessToken, 403);
  faculty.permissions = ["manageStudents"];
  console.log("PASS refresh reflects current permissions instead of restoring revoked JWT permissions");
  faculty.status = "inactive";
  await refresh(auth.cookie, 403);
  faculty.status = "active";
  enterprise.isActive = false;
  await refresh(auth.cookie, 403);
  enterprise.isActive = true;
  enterprise.role = "super_admin";
  await refresh(auth.cookie, 403);
  enterprise.role = "college_faculty";
  collegeA.status = "suspended";
  await refresh(auth.cookie, 403);
  collegeA.status = "active";
  enterprise.facultyProfile = null as any;
  await refresh(auth.cookie, 403);
  enterprise.facultyProfile = faculty;
  faculty.collegeId = collegeB.id;
  await refresh(auth.cookie, 403);
  faculty.collegeId = collegeA.id;
  enterprise.collegeId = collegeB.id;
  await refresh(auth.cookie, 403);
  enterprise.collegeId = collegeA.id;
  enterprise.collegeId = null as any;
  await refresh(auth.cookie, 403);
  enterprise.collegeId = collegeA.id;
  users.delete(enterprise.id);
  await refresh(auth.cookie, 401);
  users.set(enterprise.id, enterprise);
  console.log("PASS revoked, disabled, deleted, missing, suspended and mismatched memberships reject renewal");
  // Server-signed stale tenant claims cannot switch the user's institution.
  const foreign = signRefreshToken({ sub: enterprise.id, role: "college_faculty", email: enterprise.email, collegeId: collegeB.id });
  sessions.push({ userId: enterprise.id, tokenHash: createHash("sha256").update(foreign).digest("hex"), expiresAt: new Date(Date.now() + 60000) });
  await refresh(`rr_refresh_token=${foreign}`, 403);
  await students(signAccessToken({ sub: enterprise.id, role: "college_faculty", email: enterprise.email }), 403);
  await students(signAccessToken({ sub: enterprise.id, role: "college_faculty", email: enterprise.email, collegeId: "unknown-college" }), 404);
  await refresh("", 401);
  await refresh("rr_refresh_token=invalid", 401);
  const expiredRefresh = jwt.sign({ sub: enterprise.id, role: enterprise.role, type: "refresh" }, env.JWT_SECRET, { expiresIn: -1 });
  await refresh(`rr_refresh_token=${expiredRefresh}`, 401);
  await refresh(`rr_refresh_token=${auth.accessToken}`, 401);
  console.log("PASS invalid/expired/wrong-type tokens and missing/invalid tenant contexts reject securely");
  const regular = await login(candidate.email);
  const regularToken = verifyToken((await refresh(regular.cookie)).accessToken);
  assert.equal(regularToken.role, "candidate");
  assert.equal(regularToken.collegeId, null);
  assert.deepEqual(regularToken.permissions, []);
  await students(signAccessToken({ sub: candidate.id, role: "candidate", email: candidate.email, collegeId: collegeA.id }), 403);
  console.log("PASS non-Enterprise login/renewal remains compatible and candidate Enterprise access is blocked");
  const student: any = { ...candidate, id: "student-review", role: "student", collegeId: collegeA.id,
    studentProfile: { collegeId: collegeA.id, status: "active" } };
  users.set(student.id, student);
  assert.equal((await loadSessionContext(student.id)).payload.collegeId, collegeA.id);
  student.studentProfile.status = "inactive";
  await assert.rejects(loadSessionContext(student.id), /membership is inactive/);
  console.log("PASS student token claims require an active matching student membership");
  const invited: any = { ...enterprise, id: "invited-review", email: "invited-review@example.com",
    facultyProfile: { ...faculty, permissions: ["STUDENT_VIEW"] } };
  users.set(invited.id, invited);
  const invitation: any = { id: "invitation-review", email: invited.email, role: invited.role,
    collegeId: collegeA.id, college: collegeA, status: "pending", expiresAt: new Date(Date.now() + 60000) };
  mock(prisma.invitation, "findUnique", async () => invitation);
  mock(prisma.invitation, "updateMany", async ({ where, data }) => {
    if (where.id === invitation.id) { invitation.status = data.status; return { count: 1 }; }
    return { count: 0 };
  });
  mock(prisma.user, "findFirst", async ({ where }) => [...users.values()].find((user) =>
    user.email === where.email && user.collegeId === where.collegeId) ?? null);
  mock(prisma.user, "update", async ({ where, data }) => { Object.assign(users.get(where.id), data); return users.get(where.id); });
  mock(prisma.refreshToken, "deleteMany", async () => ({ count: 0 }));
  mock(prisma.collegeFaculty, "updateMany", async ({ where, data }) => {
    Object.assign(users.get(where.userId).facultyProfile, data); return { count: 1 };
  });
  mock(prisma, "$transaction", async (callback) => callback(prisma));
  mock(prisma.enterpriseAuditLog, "create", async () => ({}));
  const accepted = await fetch(`${origin}/api/auth/invitations/accept`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "invitation-review-token", password }),
  });
  assert.equal(accepted.status, 200);
  const invitationCookie = accepted.headers.get("set-cookie")?.split(";")[0];
  assert(invitationCookie);
  const acceptedBody = await accepted.json() as any;
  assert.equal(verifyToken(acceptedBody.accessToken).collegeId, collegeA.id);
  assert.deepEqual(verifyToken(acceptedBody.accessToken).permissions, ["STUDENT_VIEW"]);
  assert.deepEqual(acceptedBody.user.permissions, ["STUDENT_VIEW"]);
  await students((await refresh(invitationCookie)).accessToken);
  console.log("PASS invitation activation registers a renewable cookie-backed session with consistent claims");

} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const undo of restore.reverse()) undo();
  await prisma.$disconnect();
}
