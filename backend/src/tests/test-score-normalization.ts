/**
 * Comprehensive Regression & Validation Test Suite for E-03:
 * Canonical Score Normalization & Enterprise Analytics Integration
 */

import { prisma } from "../db/prisma.js";
import {
  normalizeInterviewScore,
  normalizeCategoryScores,
  getReadinessCategory,
  validateCanonicalScore,
  isLegacyTenScaleRecord,
  resolveCanonicalReportScore,
  formatPercentageScore,
} from "../utils/score.js";
import { completeSessionAndGenerateReport } from "../modules/interview/service.js";

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("  STARTING REGRESSION TEST SUITE: E-03 CANONICAL SCORE NORMALIZATION");
  console.log("===============================================================================\n");

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

  // ---------------------------------------------------------------------------
  // VECTOR 1: UNIT NORMALIZATION & BOUNDARY TESTS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("  [VECTOR 1] EVALUATOR SCORE NORMALIZATION (0-10 -> 0-100)");
  console.log("-------------------------------------------------------------------------------");

  assert(normalizeInterviewScore(8, 10) === 80, "1.1 Standard evaluator score: 8/10 -> 80%");
  assert(normalizeInterviewScore(7, 10) === 70, "1.2 Standard evaluator score: 7/10 -> 70%");
  assert(normalizeInterviewScore(9, 10) === 90, "1.3 Standard evaluator score: 9/10 -> 90%");
  assert(normalizeInterviewScore(0, 10) === 0, "1.4 Boundary evaluator score: 0/10 -> 0%");
  assert(normalizeInterviewScore(5, 10) === 50, "1.5 Boundary evaluator score: 5/10 -> 50%");
  assert(normalizeInterviewScore(10, 10) === 100, "1.6 Boundary evaluator score: 10/10 -> 100%");
  assert(normalizeInterviewScore(8.5, 10) === 85, "1.7 Decimal precision: 8.5/10 -> 85%");
  assert(normalizeInterviewScore(7.25, 10) === 72.5, "1.8 Decimal precision: 7.25/10 -> 72.5%");

  // ---------------------------------------------------------------------------
  // VECTOR 2: NO DOUBLE CONVERSION & CANONICAL IDENTITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 2] DOUBLE-CONVERSION PREVENTION & SCALE CONTRACT");
  console.log("-------------------------------------------------------------------------------");

  assert(normalizeInterviewScore(80, 100) === 80, "2.1 Canonical 80/100 remains 80 (never 800)");
  assert(normalizeInterviewScore(92, 100) === 92, "2.2 Seed score 92/100 remains 92");
  assert(normalizeInterviewScore(67, 100) === 67, "2.3 Seed score 67/100 remains 67");
  assert(
    resolveCanonicalReportScore({ overallScore: 80, scoreScale: 100 }) === 80,
    "2.4 resolveCanonicalReportScore preserves 80 with scoreScale: 100"
  );
  assert(
    resolveCanonicalReportScore({ overallScore: 8.0, scoreScale: 10 }) === 80,
    "2.5 resolveCanonicalReportScore converts legacy 8.0 with scoreScale: 10 to 80"
  );

  // ---------------------------------------------------------------------------
  // VECTOR 3: SCORE VALIDATION & ROBUSTNESS AGAINST MALFORMED INPUTS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 3] ROBUST VALIDATION OF IMPOSSIBLE/CORRUPT VALUES");
  console.log("-------------------------------------------------------------------------------");

  assert(!validateCanonicalScore(-5).isValid, "3.1 Negative score -5 rejected");
  assert(!validateCanonicalScore(101).isValid, "3.2 Out of bounds score 101 rejected");
  assert(!validateCanonicalScore(NaN).isValid, "3.3 NaN score rejected");
  assert(!validateCanonicalScore(Infinity).isValid, "3.4 Infinity score rejected");
  assert(!validateCanonicalScore(null).isValid, "3.5 Null score safely handled");
  assert(validateCanonicalScore(80).isValid && validateCanonicalScore(80).score === 80, "3.6 Legitimate 80 validated");

  // ---------------------------------------------------------------------------
  // VECTOR 4: BUSINESS READINESS THRESHOLD CLASSIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 4] READINESS THRESHOLD CLASSIFICATION (PROJECT CONTRACT)");
  console.log("-------------------------------------------------------------------------------");

  // Project thresholds: >= 80 -> "Job-Ready", >= 60 -> "Moderate", < 60 -> "Needs Practice", null -> "Not Attempted"
  assert(getReadinessCategory(80) === "Job-Ready", "4.1 80% classified as 'Job-Ready'");
  assert(getReadinessCategory(95) === "Job-Ready", "4.2 95% classified as 'Job-Ready'");
  assert(getReadinessCategory(100) === "Job-Ready", "4.3 100% classified as 'Job-Ready'");
  assert(getReadinessCategory(79) === "Moderate", "4.4 79% classified as 'Moderate'");
  assert(getReadinessCategory(60) === "Moderate", "4.5 60% classified as 'Moderate'");
  assert(getReadinessCategory(59) === "Needs Practice", "4.6 59% classified as 'Needs Practice'");
  assert(getReadinessCategory(0) === "Needs Practice", "4.7 0% classified as 'Needs Practice'");
  assert(getReadinessCategory(null) === "Not Attempted", "4.8 null classified as 'Not Attempted'");
  assert(getReadinessCategory(undefined) === "Not Attempted", "4.9 undefined classified as 'Not Attempted'");

  // CRITICAL REQUIREMENT: 8/10 MUST BE EVALUATED AS 80 -> "Job-Ready"
  const normalizedCandidateScore = normalizeInterviewScore(8, 10);
  assert(
    getReadinessCategory(normalizedCandidateScore) === "Job-Ready",
    "4.10 Evaluator 8/10 normalized to 80 evaluates to 'Job-Ready' (NOT 'Needs Practice')"
  );

  // ---------------------------------------------------------------------------
  // VECTOR 5: COHORT AGGREGATIONS & AVERAGES
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 5] COHORT AGGREGATIONS (8/10, 7/10, 9/10 -> 80% COHORT AVERAGE)");
  console.log("-------------------------------------------------------------------------------");

  const rawScores = [8, 7, 9];
  const normalizedScores = rawScores.map((s) => normalizeInterviewScore(s, 10));
  assert(
    JSON.stringify(normalizedScores) === JSON.stringify([80, 70, 90]),
    "5.1 Raw scores [8, 7, 9] correctly normalized to [80, 70, 90]"
  );
  const cohortAvg = Math.round(
    normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length
  );
  assert(cohortAvg === 80, `5.2 Cohort average is 80% (got ${cohortAvg}%, not 8%)`);
  assert(formatPercentageScore(cohortAvg) === "80%", "5.3 Formatted cohort average displays '80%'");

  // ---------------------------------------------------------------------------
  // VECTOR 6: CATEGORY SCORES NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 6] MULTI-DIMENSIONAL CATEGORY SCORES NORMALIZATION");
  console.log("-------------------------------------------------------------------------------");

  const rawCategories = {
    communicationQuality: 8.0,
    technicalAccuracy: 7.5,
    problemSolving: 9.0,
    confidence: 8.5,
    completeness: 6.0,
    domainKnowledge: 7.0,
  };
  const normalizedCats = normalizeCategoryScores(rawCategories, 10);
  assert(normalizedCats.communicationQuality === 80, "6.1 communicationQuality: 8.0 -> 80");
  assert(normalizedCats.technicalAccuracy === 75, "6.2 technicalAccuracy: 7.5 -> 75");
  assert(normalizedCats.problemSolving === 90, "6.3 problemSolving: 9.0 -> 90");
  assert(normalizedCats.confidence === 85, "6.4 confidence: 8.5 -> 85");
  assert(normalizedCats.completeness === 60, "6.5 completeness: 6.0 -> 60");
  assert(normalizedCats.domainKnowledge === 70, "6.6 domainKnowledge: 7.0 -> 70");

  // ---------------------------------------------------------------------------
  // VECTOR 7: END-TO-END DATABASE PERSISTENCE & REPORT GENERATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("  [VECTOR 7] END-TO-END INTERVIEW EVALUATION & REPORT PERSISTENCE");
  console.log("-------------------------------------------------------------------------------");

  const testUserEmail = `score.test.${Date.now()}@example.com`;
  let testUser: any = null;
  let testResume: any = null;
  let testSession: any = null;

  try {
    testUser = await prisma.user.create({
      data: {
        name: "Test Candidate",
        email: testUserEmail,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        role: "student",
        isActive: true,
      },
    });

    testResume = await prisma.resume.create({
      data: {
        userId: testUser.id,
        fileName: "Test_Resume.pdf",
        parsedData: { skills: ["TypeScript", "Node.js"] },
      },
    });

    testSession = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        resumeId: testResume.id,
        targetRole: "Senior Full Stack Engineer",
        companyType: "Product",
        difficulty: "hard",
        interviewStyle: "technical",
        durationMins: 30,
        status: "in_progress",
      },
    });

    // Create 3 questions with 8/10 evaluation scores
    const q1 = await prisma.interviewQuestion.create({
      data: {
        sessionId: testSession.id,
        questionText: "How do you design scalable distributed systems?",
        questionType: "base",
        orderIndex: 1,
      },
    });

    await prisma.interviewAnswer.create({
      data: {
        questionId: q1.id,
        answerText: "We use microservices with event-driven message queues and idempotent workers.",
        score: normalizeInterviewScore(8.0, 10),
        scoreScale: 100,
        feedback: {
          communicationQuality: 8.0,
          technicalAccuracy: 8.0,
          problemSolving: 8.0,
          confidence: 8.0,
          completeness: 8.0,
          domainKnowledge: 8.0,
        },
      },
    });

    const q2 = await prisma.interviewQuestion.create({
      data: {
        sessionId: testSession.id,
        questionText: "Explain how you handle optimistic concurrency.",
        questionType: "followup",
        orderIndex: 2,
      },
    });

    await prisma.interviewAnswer.create({
      data: {
        questionId: q2.id,
        answerText: "Using version numbers or timestamps checked on update, retrying on conflict.",
        score: normalizeInterviewScore(8.0, 10),
        scoreScale: 100,
        feedback: {
          communicationQuality: 8.0,
          technicalAccuracy: 8.0,
          problemSolving: 8.0,
          confidence: 8.0,
          completeness: 8.0,
          domainKnowledge: 8.0,
        },
      },
    });

    // Generate report via interview service
    const generatedReport = await completeSessionAndGenerateReport(testSession.id, 140, 2, 85);

    assert(generatedReport !== null, "7.1 Report created successfully");
    assert(generatedReport?.overallScore === 80, `7.2 Canonical overallScore in DB is 80 (got ${generatedReport?.overallScore})`);
    assert((generatedReport as any)?.scoreScale === 100, "7.3 scoreScale stored as 100");

    const catScores = generatedReport?.categoryScores as Record<string, number>;
    assert(catScores.communicationQuality === 80, "7.4 Category score communicationQuality is 80");
    assert(catScores.technicalAccuracy === 80, "7.5 Category score technicalAccuracy is 80");

    // Enterprise classification verification
    const readiness = getReadinessCategory(generatedReport?.overallScore);
    assert(readiness === "Job-Ready", `7.6 Real interview 8/10 gets 'Job-Ready' readiness rating (got ${readiness})`);

    // Verify SQL aggregate behavior
    const aggResult = await prisma.interviewReport.aggregate({
      _avg: { overallScore: true },
      where: { sessionId: testSession.id },
    });
    assert(
      Math.round(aggResult._avg.overallScore ?? 0) === 80,
      `7.7 DB SQL aggregate _avg.overallScore yields 80 (got ${aggResult._avg.overallScore})`
    );

  } finally {
    // Cleanup fixtures
    if (testSession) {
      await prisma.interviewReport.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.interviewAnswer.deleteMany({
        where: { question: { sessionId: testSession.id } },
      });
      await prisma.interviewQuestion.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.interviewSession.deleteMany({ where: { id: testSession.id } });
    }
    if (testResume) {
      await prisma.resume.deleteMany({ where: { id: testResume.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("  TEST SUITE EXECUTION SUMMARY");
  console.log("===============================================================================");
  console.log(`  Total Tests Executed : ${passedTests + failedTests}`);
  console.log(`  Tests Passed         : ${passedTests}`);
  console.log(`  Tests Failed         : ${failedTests}`);

  if (failedTests === 0) {
    console.log("\n  ALL CANONICAL SCORE NORMALIZATION & ENTERPRISE TESTS PASSED!");
  } else {
    throw new Error(`${failedTests} test(s) failed in regression test suite.`);
  }
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
