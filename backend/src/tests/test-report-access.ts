import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import interviewRoutes from "../modules/interview/routes.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testApp = express();
testApp.use(express.json());
testApp.use("/api/interview", interviewRoutes);
testApp.use("/api/enterprise", enterpriseRoutes);
testApp.use(errorHandler);

const server = testApp.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

let collegeIds: string[] = [];

function tokenFor(user: {
  id: string;
  email: string;
  role: any;
  collegeId: string | null;
}, permissions: string[] = []) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    collegeId: user.collegeId,
    permissions,
  });
}

async function get(path: string, token: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

try {
  const passwordHash = await bcrypt.hash("ReportAccess123!", 8);
  const fixtures = await prisma.$transaction(async (tx) => {
    const collegeA = await tx.college.create({
      data: {
        name: `E05 College A ${suffix}`,
        code: `E05A${Date.now().toString().slice(-7)}`,
        officialEmail: `e05-a-${suffix}@example.com`,
        status: "active",
      },
    });
    const collegeB = await tx.college.create({
      data: {
        name: `E05 College B ${suffix}`,
        code: `E05B${Date.now().toString().slice(-7)}`,
        officialEmail: `e05-b-${suffix}@example.com`,
        status: "active",
      },
    });

    const createStudent = async (
      emailPrefix: string,
      collegeId: string,
      enrollmentNumber: string,
      course: string,
      section: string
    ) => tx.user.create({
      data: {
        name: emailPrefix,
        email: `${emailPrefix.toLowerCase()}-${suffix}@example.com`,
        passwordHash,
        role: "student",
        collegeId,
        isActive: true,
        studentProfile: {
          create: {
            collegeId,
            enrollmentNumber,
            program: "B.Tech",
            course,
            section,
            batch: "2026",
            status: "active",
          },
        },
      },
      include: { studentProfile: true },
    });

    const studentA = await createStudent("Alice", collegeA.id, `A-${suffix}`, "Computer Science", "A");
    const studentOutsideScope = await createStudent("Bob", collegeA.id, `B-${suffix}`, "Mechanical", "B");
    const studentB = await createStudent("Charlie", collegeB.id, `C-${suffix}`, "Computer Science", "A");

    const createFaculty = async (
      emailPrefix: string,
      collegeId: string,
      permissions: string[],
      courseAccess: string[] = []
    ) => tx.user.create({
      data: {
        name: emailPrefix,
        email: `${emailPrefix.toLowerCase()}-${suffix}@example.com`,
        passwordHash,
        role: "college_faculty",
        collegeId,
        isActive: true,
        facultyProfile: {
          create: {
            collegeId,
            isMainFaculty: false,
            permissions,
            programAccess: ["B.Tech"],
            courseAccess,
            sectionAccess: ["A"],
            status: "active",
          },
        },
      },
    });

    const facultyAllowed = await createFaculty("AllowedFaculty", collegeA.id, ["REPORT_VIEW"], ["Computer Science"]);
    const facultyNoPermission = await createFaculty("NoReportFaculty", collegeA.id, ["STUDENT_VIEW"], ["Computer Science"]);
    const facultyStudentAndReport = await createFaculty(
      "StudentAndReportFaculty",
      collegeA.id,
      ["STUDENT_VIEW", "REPORT_VIEW", "REPORT_EXPORT"],
      ["Computer Science"]
    );
    const facultyNoPermissions = await createFaculty("NoPermissionsFaculty", collegeA.id, [], ["Computer Science"]);
    const facultyExportOnly = await createFaculty("ExportOnlyFaculty", collegeA.id, ["REPORT_EXPORT"], ["Computer Science"]);
    const facultyB = await createFaculty("CrossTenantFaculty", collegeB.id, ["REPORT_VIEW"], ["Computer Science"]);

    const createReportedSession = async (userId: string, collegeId: string, targetRole: string) => {
      const resume = await tx.resume.create({
        data: { userId, collegeId, fileName: `${targetRole}.pdf` },
      });
      return tx.interviewSession.create({
        data: {
          userId,
          collegeId,
          resumeId: resume.id,
          targetRole,
          companyType: "Product",
          difficulty: "intermediate",
          interviewStyle: "technical",
          durationMins: 30,
          status: "completed",
          questions: {
            create: {
              questionText: `Explain your experience for ${targetRole}`,
              questionType: "technical",
              orderIndex: 0,
              answer: {
                create: {
                  answerText: "A detailed answer long enough to support an existing evaluation report.",
                  score: 80,
                  scoreScale: 100,
                },
              },
            },
          },
          report: {
            create: {
              overallScore: 80,
              scoreScale: 100,
              categoryScores: { technical: 80 },
              strengths: ["Clear answer"],
              weaknesses: ["Add detail"],
              recommendations: ["Keep practicing"],
              speakingPace: 145,
              fillerWords: 2,
            },
          },
        },
        include: { report: true },
      });
    };

    const sessionA1 = await createReportedSession(studentA.id, collegeA.id, "Data Analyst");
    const sessionA2 = await createReportedSession(studentA.id, collegeA.id, "Product Analyst");
    const outsideScopeSession = await createReportedSession(studentOutsideScope.id, collegeA.id, "Robotics Engineer");
    const sessionB = await createReportedSession(studentB.id, collegeB.id, "Cloud Architect");
    const noReportResume = await tx.resume.create({
      data: { userId: studentA.id, collegeId: collegeA.id, fileName: "NoReport.pdf" },
    });
    const noReportSession = await tx.interviewSession.create({
      data: {
        userId: studentA.id,
        collegeId: collegeA.id,
        resumeId: noReportResume.id,
        targetRole: "Security Analyst",
        companyType: "Product",
        difficulty: "intermediate",
        interviewStyle: "technical",
        durationMins: 30,
        status: "completed",
        questions: {
          create: {
            questionText: "Explain a security control",
            questionType: "technical",
            orderIndex: 0,
            answer: { create: { answerText: "A sufficiently detailed answer for authorization testing." } },
          },
        },
      },
    });

    return {
      collegeA,
      collegeB,
      studentA,
      studentOutsideScope,
      studentB,
      facultyAllowed,
      facultyNoPermission,
      facultyStudentAndReport,
      facultyNoPermissions,
      facultyExportOnly,
      facultyB,
      sessionA1,
      sessionA2,
      outsideScopeSession,
      sessionB,
      noReportSession,
    };
  }, { maxWait: 20_000, timeout: 60_000 });
  collegeIds = [fixtures.collegeA.id, fixtures.collegeB.id];

  const studentAToken = tokenFor(fixtures.studentA);
  const otherStudentToken = tokenFor(fixtures.studentOutsideScope);
  const allowedFacultyToken = tokenFor(fixtures.facultyAllowed, ["REPORT_VIEW"]);
  const noPermissionToken = tokenFor(fixtures.facultyNoPermission, ["STUDENT_VIEW"]);
  const studentAndReportToken = tokenFor(fixtures.facultyStudentAndReport, ["STUDENT_VIEW", "REPORT_VIEW"]);
  const noPermissionsToken = tokenFor(fixtures.facultyNoPermissions);
  const exportOnlyToken = tokenFor(fixtures.facultyExportOnly, ["REPORT_EXPORT"]);
  const crossTenantFacultyToken = tokenFor(fixtures.facultyB, ["REPORT_VIEW"]);

  const assertNoReportData = (value: unknown) => {
    const protectedKeys = new Set([
      "interviewSessions",
      "interviewSessionsCount",
      "averageScore",
      "totalCompletedInterviews",
      "report",
      "reports",
      "questions",
      "answer",
      "answers",
      "score",
      "overallScore",
      "categoryScores",
      "feedback",
      "strengths",
      "weaknesses",
      "recommendations",
      "speakingPace",
      "fillerWords",
      "voiceConfidence",
      "evaluation",
    ]);

    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (!node || typeof node !== "object") return;
      for (const [key, child] of Object.entries(node)) {
        assert(!protectedKeys.has(key), `unexpected report-derived field: ${key}`);
        visit(child);
      }
    };

    visit(value);
  };

  for (const detailPath of [
    `/api/enterprise/students/${fixtures.studentA.studentProfile!.id}`,
    `/api/enterprise/students/${fixtures.studentA.studentProfile!.id}/details`,
  ]) {
    const studentOnlyResponse = await get(detailPath, noPermissionToken);
    assert.equal(studentOnlyResponse.status, 200);
    const studentOnlyBody = await studentOnlyResponse.json() as { student: Record<string, unknown> };
    assert.equal(studentOnlyBody.student.name, fixtures.studentA.name);
    assert.equal(studentOnlyBody.student.course, "Computer Science");
    assertNoReportData(studentOnlyBody);

    const fullResponse = await get(detailPath, studentAndReportToken);
    assert.equal(fullResponse.status, 200);
    const fullBody = await fullResponse.json() as {
      student: { interviewSessions: Array<{ questions: unknown[]; strengths: string[] }> };
    };
    assert.equal(fullBody.student.interviewSessions.length, 2);
    assert(fullBody.student.interviewSessions.every((session) => session.questions.length === 1));
    assert(fullBody.student.interviewSessions.every((session) => session.strengths.includes("Clear answer")));
  }
  console.log("PASS STUDENT_VIEW-only detail responses omit all nested report data while combined access retains it");

  const studentListResponse = await get("/api/enterprise/students", noPermissionToken);
  assert.equal(studentListResponse.status, 200);
  assertNoReportData(await studentListResponse.json());
  console.log("PASS student directory listing omits interview-count side channels without REPORT_VIEW");

  assert.equal(
    (await get(`/api/enterprise/students/${fixtures.studentA.studentProfile!.id}`, allowedFacultyToken)).status,
    403
  );
  assert.equal(
    (await get(`/api/enterprise/students/${fixtures.studentA.studentProfile!.id}`, noPermissionsToken)).status,
    403
  );
  console.log("PASS REPORT_VIEW does not implicitly grant STUDENT_VIEW and no-permission access is denied");

  assert.equal((await get("/api/enterprise/reports/export?format=csv", exportOnlyToken)).status, 403);
  assert.equal((await get("/api/enterprise/reports/export?format=csv", studentAndReportToken)).status, 200);
  console.log("PASS report export requires both REPORT_VIEW and REPORT_EXPORT");

  assert.equal(
    (await get(`/api/enterprise/students/${fixtures.studentOutsideScope.studentProfile!.id}`, studentAndReportToken)).status,
    404
  );
  assert.equal(
    (await get(`/api/enterprise/students/${fixtures.studentOutsideScope.studentProfile!.id}/details`, studentAndReportToken)).status,
    404
  );
  console.log("PASS combined permissions cannot bypass assigned faculty scope");

  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.id}`, studentAToken)).status, 200);
  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.id}`, otherStudentToken)).status, 403);
  console.log("PASS student ownership allows own report and denies another student's report");

  const directFacultyResponse = await get(`/api/interview/report/${fixtures.sessionA1.id}`, allowedFacultyToken);
  assert.equal(directFacultyResponse.status, 200);
  const directFacultyReport = await directFacultyResponse.json() as { sessionId: string };
  assert.equal(directFacultyReport.sessionId, fixtures.sessionA1.id);
  console.log("PASS authorized faculty can directly inspect a same-tenant, in-scope report");

  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.id}`, noPermissionToken)).status, 403);
  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.report!.id}`, noPermissionToken)).status, 403);
  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.id}`, crossTenantFacultyToken)).status, 403);
  assert.equal((await get(`/api/interview/report/${fixtures.sessionA1.report!.id}`, crossTenantFacultyToken)).status, 403);
  assert.equal((await get(`/api/interview/report/${fixtures.outsideScopeSession.id}`, allowedFacultyToken)).status, 403);
  assert.equal((await get(`/api/interview/report/${fixtures.sessionB.id}`, allowedFacultyToken)).status, 403);
  console.log("PASS missing permission, cohort scope, cross-tenant, and sequential-ID IDOR attempts are denied");

  assert.equal((await get(`/api/interview/report/${fixtures.noReportSession.id}`, allowedFacultyToken)).status, 404);
  assert.equal(
    await prisma.interviewReport.count({ where: { sessionId: fixtures.noReportSession.id } }),
    0
  );
  console.log("PASS faculty report inspection is read-only and cannot generate a missing report");

  const enterpriseResponse = await get("/api/enterprise/reports?limit=20", allowedFacultyToken);
  assert.equal(enterpriseResponse.status, 200);
  const enterpriseBody = await enterpriseResponse.json() as {
    reports: Array<{ reportId: string; sessionId: string; student: { id: string } }>;
  };
  const aliceRows = enterpriseBody.reports.filter((row) => row.student.id === fixtures.studentA.studentProfile?.id);
  assert.equal(aliceRows.length, 2);
  assert.deepEqual(
    aliceRows.map((row) => row.sessionId).sort(),
    [fixtures.sessionA1.id, fixtures.sessionA2.id].sort()
  );
  assert(aliceRows.every((row) => row.reportId !== row.sessionId));
  console.log("PASS Enterprise rows expose distinct reportId, sessionId, and student.id values");

  assert.equal((await get("/api/interview/report/missing-session-id", allowedFacultyToken)).status, 404);
  console.log("PASS missing sessions return 404 without redirect or crash");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (collegeIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { collegeId: { in: collegeIds } },
      select: { id: true },
    });
    await prisma.college.deleteMany({ where: { id: { in: collegeIds } } });
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}

console.log("\nE-05 report access regression suite passed.");
