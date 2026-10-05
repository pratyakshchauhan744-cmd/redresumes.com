/**
 * Comprehensive Regression & Validation Test Suite for E-04:
 * Enterprise Reports API Contract & Individual Evaluation Integrity
 */

import "dotenv/config";
import { prisma } from "../db/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { resolveCanonicalReportScore, getReadinessCategory } from "../utils/score.js";
import type { EnterpriseReportRow, EnterpriseReportsResponse } from "../types/enterpriseReports.js";

const JWT_SECRET = env.JWT_SECRET || "dev-jwt-secret-key-12345";

function generateTestToken(payload: {
  userId: string;
  role: string;
  collegeId?: string | null;
  isMainFaculty?: boolean;
  permissions?: string[];
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failedTests++;
  }
}

async function runContractTestSuite() {
  console.log("===============================================================================");
  console.log("  STARTING REGRESSION TEST SUITE: E-04 ENTERPRISE REPORTS API CONTRACT");
  console.log("===============================================================================\n");

  const timestamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // ---------------------------------------------------------------------------
  // STEP 0: FIXTURE SETUP (Institutions, Students, Multiple Reports)
  // ---------------------------------------------------------------------------
  console.log("-> 0. Creating test fixtures (Colleges, Students, Multiple Sessions)...");

  // Institution Alpha
  const collegeAlpha = await prisma.college.create({
    data: {
      name: `Contract Test College Alpha ${timestamp}`,
      code: `CT-ALPHA-${timestamp}`,
      officialEmail: `admin@alpha-${timestamp}.edu`,
      status: "active",
    },
  });

  // Institution Beta (For isolation tests)
  const collegeBeta = await prisma.college.create({
    data: {
      name: `Contract Test College Beta ${timestamp}`,
      code: `CT-BETA-${timestamp}`,
      officialEmail: `admin@beta-${timestamp}.edu`,
      status: "active",
    },
  });

  // Faculty User Alpha
  const userFacultyAlpha = await prisma.user.create({
    data: {
      name: "Prof. Vikram Sarabhai",
      email: `faculty-alpha-${timestamp}@alpha.edu`,
      passwordHash,
      role: "college_faculty",
      collegeId: collegeAlpha.id,
      facultyProfile: {
        create: {
          collegeId: collegeAlpha.id,
          employeeId: `FAC-A-${timestamp}`,
          designation: "Head of Placement",
          department: "Computer Science",
          status: "active",
          isMainFaculty: true,
          permissions: ["REPORT_VIEW", "REPORT_EXPORT", "STUDENT_VIEW"],
        },
      },
    },
  });

  // Student 1 (Alice Sharma) in College Alpha - Cohort: B.Tech CSE Sec A
  const userAlice = await prisma.user.create({
    data: {
      name: "Alice Sharma",
      email: `alice-${timestamp}@alpha.edu`,
      passwordHash,
      role: "student",
      collegeId: collegeAlpha.id,
      studentProfile: {
        create: {
          collegeId: collegeAlpha.id,
          enrollmentNumber: `ENR-ALICE-${timestamp}`,
          program: "B.Tech",
          course: "Computer Science & Engineering",
          section: "A",
          batch: "2026",
          status: "active",
        },
      },
    },
    include: { studentProfile: true },
  });

  // Student 2 (Bob Mehra) in College Alpha - Cohort: B.Tech MECH Sec B
  const userBob = await prisma.user.create({
    data: {
      name: "Bob Mehra",
      email: `bob-${timestamp}@alpha.edu`,
      passwordHash,
      role: "student",
      collegeId: collegeAlpha.id,
      studentProfile: {
        create: {
          collegeId: collegeAlpha.id,
          enrollmentNumber: `ENR-BOB-${timestamp}`,
          program: "B.Tech",
          course: "Mechanical Engineering",
          section: "B",
          batch: "2026",
          status: "active",
        },
      },
    },
    include: { studentProfile: true },
  });

  // Student 3 (Charlie Beta) in College Beta - for tenant isolation
  const userCharlie = await prisma.user.create({
    data: {
      name: "Charlie Beta",
      email: `charlie-${timestamp}@beta.edu`,
      passwordHash,
      role: "student",
      collegeId: collegeBeta.id,
      studentProfile: {
        create: {
          collegeId: collegeBeta.id,
          enrollmentNumber: `ENR-CHARLIE-${timestamp}`,
          program: "B.Tech",
          course: "Information Technology",
          section: "A",
          batch: "2026",
          status: "active",
        },
      },
    },
    include: { studentProfile: true },
  });

  // Resumes
  const resumeAlice = await prisma.resume.create({
    data: {
      userId: userAlice.id,
      collegeId: collegeAlpha.id,
      fileName: "Alice_Resume.pdf",
    },
  });

  const resumeBob = await prisma.resume.create({
    data: {
      userId: userBob.id,
      collegeId: collegeAlpha.id,
      fileName: "Bob_Resume.pdf",
    },
  });

  const resumeCharlie = await prisma.resume.create({
    data: {
      userId: userCharlie.id,
      collegeId: collegeBeta.id,
      fileName: "Charlie_Resume.pdf",
    },
  });

  // Alice Sharma Interview #1: Data Analyst, score 80, speakingPace 145
  const sessionAlice1 = await prisma.interviewSession.create({
    data: {
      userId: userAlice.id,
      collegeId: collegeAlpha.id,
      resumeId: resumeAlice.id,
      targetRole: "Data Analyst",
      companyType: "Product",
      difficulty: "intermediate",
      interviewStyle: "analytical",
      durationMins: 30,
      status: "completed",
      createdAt: new Date("2026-10-01T10:00:00Z"),
      report: {
        create: {
          overallScore: 80,
          scoreScale: 100,
          categoryScores: { analytical: 80, technical: 82, communication: 78 },
          speakingPace: 145,
          fillerWords: 3,
          strengths: ["Clear problem formulation", "Strong SQL acumen"],
          weaknesses: ["Could articulate data cleaning steps faster"],
          recommendations: ["Practice live coding queries"],
          createdAt: new Date("2026-10-01T10:35:00Z"),
        },
      },
    },
    include: { report: true },
  });

  // Alice Sharma Interview #2: Product Analyst, score 85, speakingPace 150
  const sessionAlice2 = await prisma.interviewSession.create({
    data: {
      userId: userAlice.id,
      collegeId: collegeAlpha.id,
      resumeId: resumeAlice.id,
      targetRole: "Product Analyst",
      companyType: "FinTech",
      difficulty: "hard",
      interviewStyle: "case_study",
      durationMins: 45,
      status: "completed",
      createdAt: new Date("2026-10-02T14:00:00Z"),
      report: {
        create: {
          overallScore: 85,
          scoreScale: 100,
          categoryScores: { analytical: 88, metrics: 84, communication: 83 },
          speakingPace: 150,
          fillerWords: 2,
          strengths: ["Excellent funnel analysis framework", "Insightful metrics prioritization"],
          weaknesses: ["Expand on A/B test sample sizing"],
          recommendations: ["Review statistical hypothesis tests"],
          createdAt: new Date("2026-10-02T14:50:00Z"),
        },
      },
    },
    include: { report: true },
  });

  // Bob Mehra Interview #1: Robotics Engineer, score 65, speakingPace null (missing optional audio)
  const sessionBob1 = await prisma.interviewSession.create({
    data: {
      userId: userBob.id,
      collegeId: collegeAlpha.id,
      resumeId: resumeBob.id,
      targetRole: "Robotics Engineer",
      companyType: "Hardware",
      difficulty: "standard",
      interviewStyle: "technical",
      durationMins: 30,
      status: "completed",
      createdAt: new Date("2026-09-28T09:00:00Z"),
      report: {
        create: {
          overallScore: 65,
          scoreScale: 100,
          categoryScores: { kinematics: 68, controlSystems: 62 },
          speakingPace: null, // Legitimate null
          fillerWords: null, // Legitimate null
          strengths: ["Solid understanding of PID controllers"],
          weaknesses: ["Needs deeper knowledge of ROS2 middleware"],
          recommendations: ["Complete ROS2 navigation tutorial"],
          createdAt: new Date("2026-09-28T09:35:00Z"),
        },
      },
    },
    include: { report: true },
  });

  // Charlie Beta Interview: Cloud Architect, score 90 (College Beta)
  const sessionCharlie1 = await prisma.interviewSession.create({
    data: {
      userId: userCharlie.id,
      collegeId: collegeBeta.id,
      resumeId: resumeCharlie.id,
      targetRole: "Cloud Architect",
      companyType: "Enterprise",
      difficulty: "expert",
      interviewStyle: "system_design",
      durationMins: 60,
      status: "completed",
      createdAt: new Date("2026-10-02T11:00:00Z"),
      report: {
        create: {
          overallScore: 90,
          scoreScale: 100,
          categoryScores: { architecture: 92, security: 88 },
          speakingPace: 130,
          fillerWords: 1,
          strengths: ["Superb multi-region disaster recovery plan"],
          weaknesses: ["Consider finops cost optimization"],
          recommendations: ["Review AWS savings plans"],
          createdAt: new Date("2026-10-02T12:05:00Z"),
        },
      },
    },
    include: { report: true },
  });

  console.log("   -> Fixtures created successfully.\n");

  try {
    // ---------------------------------------------------------------------------
    // VECTOR 1: BACKEND CONTRACT TEST (DATA SHAPE & REQUIRED UI FIELDS)
    // ---------------------------------------------------------------------------
    console.log("-------------------------------------------------------------------------------");
    console.log("  [VECTOR 1] BACKEND CONTRACT TEST & REQUIRED FIELDS");
    console.log("-------------------------------------------------------------------------------");

    const reportsAlpha = await prisma.interviewReport.findMany({
      where: {
        session: {
          status: "completed",
          user: {
            studentProfile: {
              collegeId: collegeAlpha.id,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        session: {
          select: {
            id: true,
            targetRole: true,
            difficulty: true,
            interviewStyle: true,
            durationMins: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                studentProfile: {
                  select: {
                    id: true,
                    enrollmentNumber: true,
                    program: true,
                    course: true,
                    section: true,
                    batch: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const mappedRows: EnterpriseReportRow[] = reportsAlpha.map((r) => {
      const studentProfile = r.session.user?.studentProfile;
      const canonicalScore = resolveCanonicalReportScore(r as any);
      const readinessRating = getReadinessCategory(canonicalScore) as "Job-Ready" | "Moderate" | "Needs Practice";

      return {
        id: r.id,
        reportId: r.id,
        sessionId: r.sessionId,
        student: {
          id: studentProfile?.id || "",
          userId: r.session.user?.id || "",
          name: r.session.user?.name || "Student",
          email: r.session.user?.email || "",
          phone: r.session.user?.phone || null,
          enrollmentNumber: studentProfile?.enrollmentNumber || "",
          program: studentProfile?.program || "",
          course: studentProfile?.course || "",
          section: studentProfile?.section || "",
          batch: studentProfile?.batch || "",
        },
        targetRole: r.session.targetRole,
        difficulty: r.session.difficulty,
        interviewStyle: r.session.interviewStyle,
        durationMins: r.session.durationMins,
        overallScore: canonicalScore,
        readinessRating,
        categoryScores: r.categoryScores as Record<string, number>,
        speakingPace: r.speakingPace ?? null,
        fillerWords: r.fillerWords ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    // 1.1 Verify total reports in College Alpha
    assert(
      mappedRows.length === 3,
      "1.1 Reports query returns all 3 individual completed interview reports for College Alpha",
      `Expected 3 reports, got ${mappedRows.length}`
    );

    // 1.2 Find Alice's Data Analyst report
    const aliceReport1 = mappedRows.find(
      (r) => r.sessionId === sessionAlice1.id || r.reportId === sessionAlice1.report?.id
    );

    assert(aliceReport1 !== undefined, "1.2 Alice Sharma's Data Analyst report exists in response");
    assert(
      aliceReport1?.student.name === "Alice Sharma",
      "1.3 Student name is correctly populated (Alice Sharma, NOT 'Student')",
      `Got name: ${aliceReport1?.student.name}`
    );
    assert(
      aliceReport1?.targetRole === "Data Analyst",
      "1.4 Target role is correctly populated (Data Analyst, NOT 'Software Engineer')",
      `Got targetRole: ${aliceReport1?.targetRole}`
    );
    assert(
      aliceReport1?.overallScore === 80,
      "1.5 Canonical overall score is 80 (80%), NOT 8%",
      `Got score: ${aliceReport1?.overallScore}`
    );
    assert(
      aliceReport1?.readinessRating === "Job-Ready",
      "1.6 Score 80 is classified as 'Job-Ready'",
      `Got readiness: ${aliceReport1?.readinessRating}`
    );
    assert(
      aliceReport1?.speakingPace === 145,
      "1.7 Speaking pace is 145 WPM",
      `Got speakingPace: ${aliceReport1?.speakingPace}`
    );
    assert(
      aliceReport1?.fillerWords === 3,
      "1.8 Filler words count is 3",
      `Got fillerWords: ${aliceReport1?.fillerWords}`
    );
    assert(
      aliceReport1?.reportId === sessionAlice1.report?.id,
      "1.9 reportId is the actual InterviewReport.id identifier",
      `Got reportId: ${aliceReport1?.reportId}`
    );
    assert(
      aliceReport1?.sessionId === sessionAlice1.id,
      "1.10 sessionId is the actual InterviewSession.id identifier",
      `Got sessionId: ${aliceReport1?.sessionId}`
    );

    // ---------------------------------------------------------------------------
    // VECTOR 2: MULTIPLE REPORTS FOR SAME STUDENT
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 2] MULTIPLE REPORTS FOR SAME STUDENT");
    console.log("-------------------------------------------------------------------------------");

    const aliceReports = mappedRows.filter((r) => r.student.userId === userAlice.id);

    assert(
      aliceReports.length === 2,
      "2.1 Alice Sharma has 2 distinct report rows (not collapsed into 1)",
      `Expected 2 report rows for Alice, got ${aliceReports.length}`
    );

    const roles = aliceReports.map((r) => r.targetRole).sort();
    assert(
      roles[0] === "Data Analyst" && roles[1] === "Product Analyst",
      "2.2 Both distinct interview roles appear independently ('Data Analyst' and 'Product Analyst')",
      `Got roles: ${roles.join(", ")}`
    );

    const scores = aliceReports.map((r) => r.overallScore).sort();
    assert(
      scores[0] === 80 && scores[1] === 85,
      "2.3 Both distinct interview scores appear independently (80% and 85%)",
      `Got scores: ${scores.join(", ")}`
    );

    // ---------------------------------------------------------------------------
    // VECTOR 3: MISSING OPTIONAL DATA HANDLING
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 3] MISSING OPTIONAL DATA (NULL SPEAKING PACE & FILLER WORDS)");
    console.log("-------------------------------------------------------------------------------");

    const bobReport = mappedRows.find((r) => r.student.userId === userBob.id);
    assert(bobReport !== undefined, "3.1 Bob Mehra's report exists in response");
    assert(
      bobReport?.speakingPace === null,
      "3.2 Missing speaking pace is represented explicitly as null (not fabricated)",
      `Got speakingPace: ${bobReport?.speakingPace}`
    );
    assert(
      bobReport?.fillerWords === null,
      "3.3 Missing filler words is represented explicitly as null (not fabricated)",
      `Got fillerWords: ${bobReport?.fillerWords}`
    );
    assert(
      bobReport?.overallScore === 65,
      "3.4 Bob's score is 65% (Readiness: 'Moderate')",
      `Got score: ${bobReport?.overallScore}`
    );
    assert(
      bobReport?.readinessRating === "Moderate",
      "3.5 Score 65 is correctly evaluated as 'Moderate'",
      `Got readiness: ${bobReport?.readinessRating}`
    );

    // ---------------------------------------------------------------------------
    // VECTOR 4: COHORT ISOLATION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 4] COHORT FILTERING ISOLATION");
    console.log("-------------------------------------------------------------------------------");

    // Filtering by Course: Mechanical Engineering should return only Bob's report
    const mechReports = await prisma.interviewReport.findMany({
      where: {
        session: {
          status: "completed",
          user: {
            studentProfile: {
              collegeId: collegeAlpha.id,
              course: "Mechanical Engineering",
            },
          },
        },
      },
    });

    assert(
      mechReports.length === 1 && mechReports[0].id === sessionBob1.report?.id,
      "4.1 Filtering by 'Mechanical Engineering' returns only Bob's report, excludes Alice's CSE reports",
      `Expected 1 report (Bob), got ${mechReports.length}`
    );

    // Filtering by Section: 'A' should return only Alice's reports (Sec A)
    const secAReports = await prisma.interviewReport.findMany({
      where: {
        session: {
          status: "completed",
          user: {
            studentProfile: {
              collegeId: collegeAlpha.id,
              section: "A",
            },
          },
        },
      },
    });

    assert(
      secAReports.length === 2,
      "4.2 Filtering by Section 'A' returns only Alice's 2 reports, excludes Bob (Sec B)",
      `Expected 2 reports (Alice), got ${secAReports.length}`
    );

    // ---------------------------------------------------------------------------
    // VECTOR 5: INSTITUTION / TENANT ISOLATION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 5] INSTITUTION / TENANT ISOLATION");
    console.log("-------------------------------------------------------------------------------");

    // College Alpha queries reports - must never see College Beta (Charlie)
    const sawCharlieInAlpha = mappedRows.some((r) => r.student.userId === userCharlie.id);
    assert(
      !sawCharlieInAlpha,
      "5.1 College Alpha reports query strictly EXCLUDES College Beta reports (Tenant isolation)",
      "College Beta student leaked into College Alpha reports!"
    );

    // College Beta queries reports - must never see College Alpha (Alice, Bob)
    const reportsBeta = await prisma.interviewReport.findMany({
      where: {
        session: {
          status: "completed",
          user: {
            studentProfile: {
              collegeId: collegeBeta.id,
            },
          },
        },
      },
      include: {
        session: {
          include: {
            user: { include: { studentProfile: true } },
          },
        },
      },
    });

    assert(
      reportsBeta.length === 1 && reportsBeta[0].id === sessionCharlie1.report?.id,
      "5.2 College Beta reports query returns exactly 1 report (Charlie)",
      `Expected 1 report, got ${reportsBeta.length}`
    );

    const sawAlphaInBeta = reportsBeta.some(
      (r) => r.session.user?.id === userAlice.id || r.session.user?.id === userBob.id
    );
    assert(
      !sawAlphaInBeta,
      "5.3 College Beta reports query strictly EXCLUDES College Alpha reports",
      "College Alpha student leaked into College Beta reports!"
    );

    // ---------------------------------------------------------------------------
    // VECTOR 6: REPORT NAVIGATION RESOLUTION (BY SESSIONID & REPORTID)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 6] REPORT DETAILS RESOLUTION & NAVIGATION");
    console.log("-------------------------------------------------------------------------------");

    // Test resolving report by sessionId
    const reportBySessionId = await prisma.interviewSession.findUnique({
      where: { id: sessionAlice1.id },
      include: { report: true },
    });
    assert(
      reportBySessionId?.report?.id === sessionAlice1.report?.id,
      "6.1 Report lookup by sessionId succeeds",
      "Failed to lookup report by sessionId"
    );

    // Test resolving report by reportId
    const reportByReportId = await prisma.interviewReport.findUnique({
      where: { id: sessionAlice1.report!.id },
      include: { session: true },
    });
    assert(
      reportByReportId?.sessionId === sessionAlice1.id,
      "6.2 Report lookup by reportId succeeds and returns associated session",
      "Failed to lookup session by reportId"
    );

    // ---------------------------------------------------------------------------
    // VECTOR 7: SQL-LEVEL AGGREGATION & SUMMARY
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [VECTOR 7] COHORT AGGREGATES & SUMMARY KPIS");
    console.log("-------------------------------------------------------------------------------");

    const scoreAgg = await prisma.interviewReport.aggregate({
      where: {
        session: {
          status: "completed",
          user: {
            studentProfile: {
              collegeId: collegeAlpha.id,
            },
          },
        },
      },
      _avg: { overallScore: true },
      _count: { id: true },
    });

    // Alice 1: 80, Alice 2: 85, Bob 1: 65 -> Average: (80 + 85 + 65) / 3 = 230 / 3 = 76.67 -> round: 77%
    const expectedAverage = Math.round((80 + 85 + 65) / 3);
    const actualAverage = Math.round(scoreAgg._avg.overallScore || 0);

    assert(
      actualAverage === expectedAverage && actualAverage === 77,
      "7.1 Cohort average score across all 3 reports is 77%, NOT 7.7%",
      `Expected ${expectedAverage}%, got ${actualAverage}%`
    );

    const highCount = await prisma.interviewReport.count({
      where: {
        session: {
          status: "completed",
          user: { studentProfile: { collegeId: collegeAlpha.id } },
        },
        overallScore: { gte: 80 },
      },
    });

    assert(
      highCount === 2,
      "7.2 Job-Ready (>=80) count is exactly 2 (Alice 1: 80, Alice 2: 85)",
      `Expected 2, got ${highCount}`
    );

    const moderateCount = await prisma.interviewReport.count({
      where: {
        session: {
          status: "completed",
          user: { studentProfile: { collegeId: collegeAlpha.id } },
        },
        overallScore: { gte: 60, lt: 80 },
      },
    });

    assert(
      moderateCount === 1,
      "7.3 Moderate (60-79) count is exactly 1 (Bob 1: 65)",
      `Expected 1, got ${moderateCount}`
    );
  } finally {
    // ---------------------------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------------------------
    console.log("\n-> Cleaning up test fixtures...");
    await prisma.interviewReport.deleteMany({
      where: {
        id: {
          in: [
            sessionAlice1.report?.id || "",
            sessionAlice2.report?.id || "",
            sessionBob1.report?.id || "",
            sessionCharlie1.report?.id || "",
          ].filter(Boolean),
        },
      },
    });

    await prisma.interviewSession.deleteMany({
      where: {
        id: { in: [sessionAlice1.id, sessionAlice2.id, sessionBob1.id, sessionCharlie1.id] },
      },
    });

    await prisma.resume.deleteMany({
      where: { id: { in: [resumeAlice.id, resumeBob.id, resumeCharlie.id] } },
    });

    await prisma.collegeStudent.deleteMany({
      where: {
        id: {
          in: [
            userAlice.studentProfile?.id || "",
            userBob.studentProfile?.id || "",
            userCharlie.studentProfile?.id || "",
          ].filter(Boolean),
        },
      },
    });

    await prisma.collegeFaculty.deleteMany({
      where: { collegeId: { in: [collegeAlpha.id, collegeBeta.id] } },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [userFacultyAlpha.id, userAlice.id, userBob.id, userCharlie.id],
        },
      },
    });

    await prisma.college.deleteMany({
      where: { id: { in: [collegeAlpha.id, collegeBeta.id] } },
    });
    console.log("   -> Cleanup completed.");
  }

  console.log("\n===============================================================================");
  console.log(`  E-04 TEST SUITE FINISHED: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runContractTestSuite().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
