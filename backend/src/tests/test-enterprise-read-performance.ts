import assert from "node:assert/strict";
import { prisma } from "../db/prisma.js";
import router from "../modules/enterprise/routes.js";

// Exercise real read handlers without writing fixtures to a configured database.
// Unexpected full-history reads fail immediately.
const restorers: Array<() => void> = [];
function mock(model: any, method: string, implementation: (...args: any[]) => any) {
  const original = model[method];
  model[method] = implementation;
  restorers.push(() => { model[method] = original; });
}
async function read(path: string, query: Record<string, string> = {}, faculty = false) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods.get);
  assert(layer, `Missing GET ${path}`);
  let response: any;
  await layer.route.stack.at(-1).handle({
    collegeId: "tenant-a",
    user: { id: faculty ? "faculty-a" : "admin-a", role: faculty ? "college_faculty" : "super_admin" }, query,
  }, { json(value: any) { response = value; } }, (error: unknown) => { throw error; });
  assert(response, `${path} must return a response`);
  return response;
}
const cohort = { program: "B.Tech", course: "CS", section: "A", batch: "2026" };
const exactScope = { OR: [cohort] };
function assertScoped(where: any) {
  assert.equal(where.collegeId, "tenant-a");
  assert.deepEqual(where.AND[0], exactScope);
}
try {
  mock(prisma.user, "findUnique", async ({ where }) => ({
    isActive: true, role: where.id === "admin-a" ? "super_admin" : "college_faculty",
    collegeId: "tenant-a", college: { status: "active" },
    facultyProfile: where.id === "admin-a" ? null : await prisma.collegeFaculty.findFirst({
      where: { userId: where.id, collegeId: "tenant-a" },
    }),
  }));
  mock(prisma.collegeFaculty, "findFirst", async () => ({
    collegeId: "tenant-a", status: "active", isMainFaculty: false, permissions: ["STUDENT_VIEW"],
    scopeUnrestricted: false, cohortAccess: [cohort],
    programAccess: [], courseAccess: [], sectionAccess: [], batchAccess: [],
  }));
  mock(prisma.collegeStudent, "findMany", async () => { throw new Error("Unexpected full student read"); });
  let groupingCalls = 0;
  mock(prisma.collegeStudent, "groupBy", async (args) => {
    groupingCalls++;
    assertScoped(args.where);
    assert.equal(args.distinct, undefined);
    if (args.by[0] === "department") return [{ department: "CS" }];
    return [cohort, { ...cohort, batch: "2025" }, { ...cohort, program: "B.Sc" }];
  });
  const options = await read("/filter-options", {}, true);
  assert.equal(groupingCalls, 2);
  assert.deepEqual(options.programs, ["B.Sc", "B.Tech"]);
  assert.deepEqual(options.batches, ["2026", "2025"]);
  assert.equal(options.cohorts.length, 3);
  console.log("PASS filter grouping preserves exact scope, deduplication and ordering");

  mock(prisma.collegeStudent, "groupBy", async (args) => {
    assertScoped(args.where);
    return [{ status: "active", _count: { _all: 20000 } }, { status: "inactive", _count: { _all: 3 } }];
  });
  mock(prisma.college, "findUnique", async () => ({ id: "tenant-a", name: "College" }));
  for (const [model, method] of [[prisma.interviewSession, "count"], [prisma.interviewReport, "aggregate"],
    [prisma.collegeFaculty, "groupBy"], [prisma.collegeCreditAccount, "findUnique"]] as const) {
    mock(model, method, async () => { throw new Error("Unauthorized metric was queried"); });
  }
  const stats = await read("/stats", {}, true);
  assert.deepEqual(stats.students, { total: 20003, active: 20000 });
  assert.equal(stats.interviews.totalSessions, 0);
  console.log("PASS overview counts avoid student hydration and skip unauthorized metrics");

  mock(prisma.collegeStudent, "groupBy", async (args) => {
    assert.deepEqual(args.where, { collegeId: "tenant-a" });
    return [{ status: "active", _count: { _all: 20000 } }];
  });
  mock(prisma.collegeFaculty, "groupBy", async () => [{ status: "active", _count: { _all: 2 } }]);
  mock(prisma.collegeCreditAccount, "findUnique", async () => ({ balance: 50, totalAllocated: 100, totalDistributed: 50 }));
  mock(prisma.interviewSession, "count", async (args) => {
    assert.equal(args.where.collegeId, "tenant-a");
    assert.deepEqual(args.where.user.studentProfile.is, { collegeId: "tenant-a" });
    assert.equal(args.where.userId, undefined, "No expanded student-ID IN list");
    return args.where.report ? 5 : 6;
  });
  mock(prisma.interviewReport, "aggregate", async () => ({ _avg: { overallScore: 72.5 } }));
  mock(prisma.interviewReport, "groupBy", async () => [
    { overallScore: 72.5, scoreScale: 100, _count: { _all: 5 } },
  ]);
  const fullStats = await read("/stats");
  assert.deepEqual(fullStats.interviews, { totalSessions: 6, completedSessions: 5, avgScore: 73 });
  assert.equal(fullStats.credits.balance, 50);
  assert.equal(fullStats.faculty.active, 2);
  console.log("PASS full overview uses scoped relations and preserves metrics");

  mock(prisma.interviewReport, "groupBy", async (args) => {
    assertScoped(args.where.session.user.studentProfile.is);
    assert.equal(args.where.session.status, "completed");
    assert.deepEqual(args.by, ["overallScore", "scoreScale"]);
    return [
      { overallScore: 8, scoreScale: 10, _count: { _all: 2 } },
      { overallScore: 70, scoreScale: 100, _count: { _all: 1 } },
      { overallScore: 4, scoreScale: 100, _count: { _all: 1 } },
    ];
  });
  const summary = await read("/reports/summary", { course: "CS" }, true);
  assert.equal(summary.totalReports, 4);
  assert.equal(summary.averageOverallScore, 59);
  assert.deepEqual(summary.scoreDistribution.map((bucket: any) => bucket.count), [2, 1, 1]);
  console.log("PASS grouped summary preserves weighted counts and explicit legacy score scales");

  mock(prisma.collegeStudent, "count", async () => 1);
  mock(prisma.collegeStudent, "findMany", async (args) => {
    assertScoped(args.where);
    assert.equal(args.take, 10);
    assert.equal(args.skip, 0);
    return [{ id: "student-a", userId: "user-a", ...cohort,
      user: { id: "user-a", email: "page@example.com", name: "Student", credits: { balance: 5 }, _count: { resumes: 1 } } }];
  });
  mock(prisma.invitation, "findMany", async () => { throw new Error("Unbounded invitation history read"); });
  let invitationReads = 0;
  mock(prisma, "$queryRaw", async (sql) => {
    invitationReads++;
    assert.match(sql.sql, /SELECT DISTINCT ON \("email"\)/);
    assert.match(sql.sql, /"email" IN/);
    assert.match(sql.sql, /"createdAt" DESC, "id" DESC/);
    assert.deepEqual(sql.values, ["tenant-a", "page@example.com"]);
    return [{ email: "page@example.com", status: "pending", metadata: { deliveryStatus: "delivery_failed" }, createdAt: new Date(0) }];
  });
  const students = await read("/students", { limit: "10" }, true);
  assert.equal(invitationReads, 1);
  assert.equal(students.students[0].invitationStatus, "delivery_failed");
  assert.equal(students.students[0].creditBalance, 5);
  assert.deepEqual(students.students, students.data);
  mock(prisma.collegeStudent, "findMany", async () => []);
  await read("/students", { page: "2", limit: "10" }, true);
  assert.equal(invitationReads, 1, "Empty pages must not query invitations");
  console.log("PASS invitation retrieval is page-bound and empty pages skip the query");

  mock(prisma.collegeStudent, "count", async () => 1000);
  mock(prisma.collegeStudent, "findMany", async (args) => {
    assert.equal(args.skip, 20);
    assert.equal(args.take, 10);
    assertScoped(args.where);
    return [];
  });
  const analytics = await read("/reports", { view: "analytics", page: "3", limit: "10" }, true);
  assert.equal(analytics.total, 1000);
  assert.equal(analytics.pagination.totalPages, 100);
  console.log("PASS alternate analytics paginates before loading related histories");

  mock(prisma.interviewReport, "findMany", async (args) => {
    assertScoped(args.where.session.user.studentProfile);
    assert.equal(args.take, 10);
    return [];
  });
  mock(prisma.interviewReport, "count", async () => { throw new Error("Redundant report count"); });
  mock(prisma.interviewReport, "groupBy", async (args) => {
    assertScoped(args.where.session.user.studentProfile);
    assert.deepEqual(args.where.overallScore, { gte: 60 });
    return [{ overallScore: 80, _count: { _all: 2 } }, { overallScore: 60, _count: { _all: 1 } }];
  });
  const reports = await read("/reports", { limit: "10", minScore: "60" }, true);
  assert.equal(reports.total, 3);
  assert.equal(reports.summary.cohortAverage, 73);
  assert.equal(reports.summary.jobReadyCount, 2);
  assert.equal(reports.summary.moderateCount, 1);
  assert.equal(reports.summary.needsPracticeCount, 0);
  console.log("PASS report totals and score buckets share the filtered grouped query");
} finally {
  for (const restore of restorers.reverse()) restore();
  await prisma.$disconnect();
}
