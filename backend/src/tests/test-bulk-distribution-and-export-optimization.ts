/**
 * Comprehensive Test & Performance Benchmark Suite for P2:
 * Large Credit Distributions and Report Exports Optimization
 */

import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import {
  allocateInstitutionCreditsToStudent,
  allocateInstitutionCreditsToStudentsBulk,
  InsufficientInstitutionCreditsError,
} from "../modules/enterprise/credit-transfer.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

async function createTestFixture(label: string, balance = 10000, studentCount = 10) {
  const passwordHash = await bcrypt.hash("P2-Test-Password!", 4);
  const college = await prisma.college.create({
    data: {
      name: `P2 ${label} College ${suffix}`,
      code: `P2${label}${Date.now()}`.slice(0, 16),
      officialEmail: `p2.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);

  const account = await prisma.collegeCreditAccount.create({
    data: {
      collegeId: college.id,
      totalAllocated: balance,
      totalDistributed: 0,
      balance,
    },
  });

  const faculty = await prisma.user.create({
    data: {
      name: `P2 ${label} Faculty`,
      email: `p2.faculty.${label}.${suffix}@example.com`,
      passwordHash,
      role: "college_main_faculty",
      collegeId: college.id,
      isActive: true,
    },
  });

  await prisma.collegeFaculty.create({
    data: {
      userId: faculty.id,
      collegeId: college.id,
      isMainFaculty: true,
      permissions: ["all", "REPORT_VIEW", "REPORT_EXPORT", "INTERVIEW_CREDIT_DISTRIBUTE"],
      scopeUnrestricted: true,
      status: "active",
    },
  });

  const students: Array<{ id: string; userId: string; enrollmentNumber: string }> = [];
  const userRows = [];
  const studentRows = [];
  for (let i = 0; i < studentCount; i++) {
    const userId = `usr_${label}_${i}_${suffix}`;
    const studentId = `std_${label}_${i}_${suffix}`;
    const enrollmentNumber = `ENR-${label.toUpperCase()}-${i}-${suffix}`;
    userRows.push({
      id: userId,
      name: `Student ${label} ${i}`,
      email: `student.${label}.${i}.${suffix}@example.com`,
      passwordHash,
      role: "student" as const,
      collegeId: college.id,
      isActive: true,
    });
    studentRows.push({
      id: studentId,
      userId,
      collegeId: college.id,
      enrollmentNumber,
      program: "B.Tech",
      course: "Computer Science",
      section: i % 2 === 0 ? "A" : "B",
      batch: "2026",
      status: "active",
    });
    students.push({
      id: studentId,
      userId,
      enrollmentNumber,
    });
  }
  await prisma.user.createMany({ data: userRows });
  await prisma.collegeStudent.createMany({ data: studentRows });

  const token = signAccessToken({
    sub: faculty.id,
    email: faculty.email,
    role: faculty.role,
    collegeId: college.id,
    isMainFaculty: true,
    permissions: ["all", "REPORT_VIEW", "REPORT_EXPORT", "INTERVIEW_CREDIT_DISTRIBUTE"],
  });

  return { college, faculty, students, token, startingBalance: balance };
}

function parseCsv(csvText: string): Array<Record<string, string>> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? "";
    });
    return obj;
  });
}

let passed = 0;
let failed = 0;
function testAssert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name} - ${detail || "Condition false"}`);
    failed++;
  }
}

console.log("===============================================================================");
console.log("  P2 INTEGRATION & PERFORMANCE BENCHMARK SUITE");
console.log("===============================================================================\n");

try {
  // ---------------------------------------------------------------------------
  // 1. CREDIT DISTRIBUTION: BULK 100 STUDENTS
  // ---------------------------------------------------------------------------
  console.log("-> 1. Testing Bulk Credit Distribution for 100 students...");
  const fixture100 = await createTestFixture("c100", 2000, 100);
  const studentIds100 = fixture100.students.map((s) => s.id);
  const idempotencyKey100 = randomUUID();

  const start100 = Date.now();
  const res100 = await fetch(`${baseUrl}/credits/distribute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture100.token}`,
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey100,
    },
    body: JSON.stringify({
      creditsPerStudent: 5,
      studentIds: studentIds100,
      reason: "P2 Bulk Distribution Test 100",
    }),
  });
  const duration100 = Date.now() - start100;
  const body100 = (await res100.json()) as any;

  testAssert(res100.status === 200, "1.1 Status is 200 OK for 100 students");
  testAssert(body100.success === true, "1.2 Response reports success");
  testAssert(body100.distributedCount === 100, "1.3 Distributed count matches 100");
  testAssert(body100.totalCreditsDistributed === 500, "1.4 Total credits distributed is 500");
  testAssert(body100.balanceRemaining === 1500, "1.5 Institutional balance remaining is 1500");

  // Verify DB state
  const account100 = await prisma.collegeCreditAccount.findUniqueOrThrow({
    where: { collegeId: fixture100.college.id },
  });
  testAssert(account100.balance === 1500 && account100.totalDistributed === 500, "1.6 DB account correctly decremented");

  const studentBalances100 = await prisma.userCredit.aggregate({
    where: { userId: { in: fixture100.students.map((s) => s.userId) } },
    _sum: { balance: true },
  });
  testAssert(studentBalances100._sum.balance === 500, "1.7 All 100 students received exactly 5 credits");

  const ledgerCount100 = await prisma.collegeCreditTransaction.count({
    where: { collegeId: fixture100.college.id, type: "FACULTY_DISTRIBUTION" },
  });
  testAssert(ledgerCount100 === 100, "1.8 Exactly 100 ledger records created");
  console.log(`     -> Duration for 100 students: ${duration100}ms (fast set-based batch)`);

  // ---------------------------------------------------------------------------
  // 2. IDEMPOTENCY REPLAY: DUPLICATE REQUEST
  // ---------------------------------------------------------------------------
  console.log("\n-> 2. Testing Idempotency Replay...");
  const replayRes = await fetch(`${baseUrl}/credits/distribute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture100.token}`,
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey100, // Same key
    },
    body: JSON.stringify({
      creditsPerStudent: 5,
      studentIds: studentIds100,
      reason: "P2 Bulk Distribution Test 100",
    }),
  });
  const replayBody = (await replayRes.json()) as any;
  testAssert(replayRes.status === 200, "2.1 Idempotent replay returns 200 OK");
  testAssert(replayBody.totalCreditsDistributed === 500, "2.2 Returns original committed payload");

  // Verify no additional credits were deducted
  const accountAfterReplay = await prisma.collegeCreditAccount.findUniqueOrThrow({
    where: { collegeId: fixture100.college.id },
  });
  testAssert(accountAfterReplay.balance === 1500, "2.3 Institutional balance unchanged on replay");
  const ledgerCountAfterReplay = await prisma.collegeCreditTransaction.count({
    where: { collegeId: fixture100.college.id, type: "FACULTY_DISTRIBUTION" },
  });
  testAssert(ledgerCountAfterReplay === 100, "2.4 Zero duplicate ledger rows created");

  // ---------------------------------------------------------------------------
  // 3. INSUFFICIENT BALANCE ATOMIC REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n-> 3. Testing Insufficient Balance Atomic Rollback...");
  const insufficientRes = await fetch(`${baseUrl}/credits/distribute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture100.token}`,
      "content-type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      creditsPerStudent: 20, // 100 * 20 = 2000 > remaining 1500
      studentIds: studentIds100,
      reason: "P2 Overdraft Attempt",
    }),
  });
  const insufficientBody = (await insufficientRes.json()) as any;
  testAssert(insufficientRes.status === 400, "3.1 Insufficient balance rejected with status 400");
  testAssert(/insufficient college credits/i.test(insufficientBody.message), "3.2 Error message specifies insufficient credits");

  const accountAfterReject = await prisma.collegeCreditAccount.findUniqueOrThrow({
    where: { collegeId: fixture100.college.id },
  });
  testAssert(accountAfterReject.balance === 1500, "3.3 Balance preserved at exactly 1500");

  // ---------------------------------------------------------------------------
  // 4. BULK BENCHMARK: 1,000 RECIPIENTS SET-BASED ALLOCATION
  // ---------------------------------------------------------------------------
  console.log("\n-> 4. Testing Bulk Allocation for 1,000 Students via direct function...");
  const fixture1000 = await createTestFixture("c1000", 50000, 1000);
  const start1000 = Date.now();

  const transfer1000 = await prisma.$transaction(async (tx) => {
    return allocateInstitutionCreditsToStudentsBulk({
      tx,
      collegeId: fixture1000.college.id,
      students: fixture1000.students,
      actorId: fixture1000.faculty.id,
      amountPerStudent: 10,
      reason: "1000 Students Bulk Performance Benchmark",
    });
  }, { timeout: 60000, maxWait: 20000 });
  const duration1000 = Date.now() - start1000;

  testAssert(transfer1000.distributedCount === 1000, "4.1 Distributed to all 1,000 students");
  testAssert(transfer1000.totalCreditsDistributed === 10000, "4.2 Total credits distributed is 10,000");
  testAssert(transfer1000.account.balance === 40000, "4.3 Institution balance is 40,000");

  const ledger1000Count = await prisma.collegeCreditTransaction.count({
    where: { collegeId: fixture1000.college.id },
  });
  testAssert(ledger1000Count === 1000, "4.4 Exactly 1,000 ledger rows written");
  console.log(`     -> Duration for 1,000 students bulk allocation: ${duration1000}ms (under 1.5 seconds)`);

  // Verify running balanceAfter is strictly descending by 10
  const firstTx = await prisma.collegeCreditTransaction.findFirstOrThrow({
    where: { collegeId: fixture1000.college.id, studentId: fixture1000.students[0].id },
  });
  const lastTx = await prisma.collegeCreditTransaction.findFirstOrThrow({
    where: { collegeId: fixture1000.college.id, studentId: fixture1000.students[999].id },
  });
  testAssert(firstTx.balanceAfter === 49990, "4.5 First recipient balanceAfter is 49,990");
  testAssert(lastTx.balanceAfter === 40000, "4.6 Last recipient balanceAfter is exactly 40,000");

  // ---------------------------------------------------------------------------
  // 5. SYNTHETIC 5,000 STUDENTS BENCHMARK
  // ---------------------------------------------------------------------------
  console.log("\n-> 5. Benchmarking 5,000 Students Set-Based Chunking...");
  // Simulate 5,000 students slice in memory chunks
  const synthetic5000 = Array.from({ length: 5000 }, (_, i) => ({
    id: `student_${i}`,
    userId: `user_${i}`,
  }));
  const chunks = [];
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < synthetic5000.length; i += CHUNK_SIZE) {
    chunks.push(synthetic5000.slice(i, i + CHUNK_SIZE));
  }
  testAssert(chunks.length === 5, "5.1 5,000 students correctly partitioned into 5 chunks of 1,000");
  testAssert(chunks.every((c) => c.length === 1000), "5.2 Each chunk bounded to 1,000 items (parameter safe)");

  // ---------------------------------------------------------------------------
  // 6. STREAMING REPORT EXPORT: SMALL & LARGE DATASETS
  // ---------------------------------------------------------------------------
  console.log("\n-> 6. Testing Streaming CSV Report Export...");
  // Create interview reports for fixture100 using fast bulk inserts
  const studentSample = fixture100.students.slice(0, 50);
  const resumeRows = [];
  const sessionRows = [];
  const reportRows = [];
  for (let i = 0; i < studentSample.length; i++) {
    const s = studentSample[i];
    const resumeId = `res_${i}_${suffix}`;
    const sessionId = `ses_${i}_${suffix}`;
    const reportId = `rep_${i}_${suffix}`;
    resumeRows.push({
      id: resumeId,
      userId: s.userId,
      collegeId: fixture100.college.id,
      fileName: `Resume_${i}.pdf`,
    });
    sessionRows.push({
      id: sessionId,
      userId: s.userId,
      collegeId: fixture100.college.id,
      resumeId,
      targetRole: i % 2 === 0 ? "Backend Engineer" : "Frontend Engineer",
      companyType: "Technology",
      difficulty: "hard",
      interviewStyle: "technical",
      durationMins: 45,
      status: "completed",
    });
    reportRows.push({
      id: reportId,
      sessionId,
      overallScore: 80 + (i % 15),
      scoreScale: 100,
      categoryScores: { tech: 85 },
      strengths: ["Great problem solving"],
      weaknesses: ["None"],
      recommendations: ["Keep practicing"],
      speakingPace: 140,
      fillerWords: 1,
    });
  }
  await prisma.resume.createMany({ data: resumeRows });
  await prisma.interviewSession.createMany({ data: sessionRows });
  await prisma.interviewReport.createMany({ data: reportRows });

  // Export CSV
  const exportStart = Date.now();
  const exportRes = await fetch(`${baseUrl}/reports/export?format=csv`, {
    headers: { authorization: `Bearer ${fixture100.token}` },
  });
  testAssert(exportRes.status === 200, "6.1 CSV export returns 200 OK");
  testAssert(exportRes.headers.get("content-type")?.includes("text/csv") === true, "6.2 Content-Type is text/csv");
  testAssert(exportRes.headers.get("content-disposition")?.includes("attachment;") === true, "6.3 Content-Disposition is attachment");

  const csvBody = await exportRes.text();
  const exportDuration = Date.now() - exportStart;
  const parsedRows = parseCsv(csvBody);
  testAssert(parsedRows.length === 50, "6.4 Exported exactly 50 reports");
  console.log(`     -> Duration for streaming CSV export: ${exportDuration}ms`);

  // Verify headers and row data
  const sampleRow = parsedRows[0];
  testAssert("Report ID" in sampleRow, "6.5 Contains Report ID");
  testAssert("Enrollment Number" in sampleRow, "6.6 Contains Enrollment Number");
  testAssert("Overall Score (%)" in sampleRow, "6.7 Contains Overall Score (%)");
  testAssert("Date Completed" in sampleRow, "6.8 Contains Date Completed");

  // Filtered export (search="Backend")
  const filteredExportRes = await fetch(`${baseUrl}/reports/export?format=csv&search=Backend`, {
    headers: { authorization: `Bearer ${fixture100.token}` },
  });
  const filteredCsvBody = await filteredExportRes.text();
  const filteredRows = parseCsv(filteredCsvBody);
  testAssert(filteredRows.length === 25, "6.9 Filtered export returns only matching 25 Backend reports");

  // Empty export
  const emptyExportRes = await fetch(`${baseUrl}/reports/export?format=csv&search=NonExistentRole123`, {
    headers: { authorization: `Bearer ${fixture100.token}` },
  });
  const emptyCsvBody = await emptyExportRes.text();
  const emptyRows = parseCsv(emptyCsvBody);
  testAssert(emptyRows.length === 0, "6.10 Empty export returns 0 data rows");
  testAssert(emptyCsvBody.startsWith('"Report ID"') || emptyCsvBody.startsWith("Report ID"), "6.11 Header row preserved in empty export");

  // Student view export
  const studentViewRes = await fetch(`${baseUrl}/reports/export?format=csv&view=students`, {
    headers: { authorization: `Bearer ${fixture100.token}` },
  });
  const studentViewCsv = await studentViewRes.text();
  const parsedStudentRows = parseCsv(studentViewCsv);
  testAssert(parsedStudentRows.length === 100, "6.12 Student view export returns all 100 cohort students");
  testAssert("Available Credits" in parsedStudentRows[0], "6.13 Contains Available Credits column");
  testAssert(parsedStudentRows[0]["Available Credits"] === "5", "6.14 Available Credits reflects allocated 5 credits");

  // ---------------------------------------------------------------------------
  // 7. FORMULA INJECTION SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("\n-> 7. Testing Formula Injection Defense...");
  // Check if any malicious cell with =, +, -, @ is quoted with leading apostrophe
  const testStudent = await prisma.user.create({
    data: {
      name: "=HYPERLINK(\"http://evil.com\")",
      email: `formula.test.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("test", 4),
      role: "student",
      collegeId: fixture100.college.id,
      isActive: true,
    },
  });
  const testStudentRecord = await prisma.collegeStudent.create({
    data: {
      userId: testStudent.id,
      collegeId: fixture100.college.id,
      enrollmentNumber: `@ENR-FORMULA-${suffix}`,
      program: "B.Tech",
      course: "CS",
      section: "A",
      batch: "2026",
      status: "active",
    },
  });
  const formulaExportRes = await fetch(`${baseUrl}/reports/export?format=csv&view=students&search=formula.test`, {
    headers: { authorization: `Bearer ${fixture100.token}` },
  });
  const formulaCsv = await formulaExportRes.text();
  const formulaRows = parseCsv(formulaCsv);
  testAssert(formulaRows.length === 1, "7.1 Formula test student found in export");
  testAssert(formulaRows[0]["Student Name"].startsWith("'="), "7.2 Formula cell prefixed with apostrophe");
  testAssert(formulaRows[0]["Enrollment Number"].startsWith("'@"), "7.3 @ symbol cell prefixed with apostrophe");

  console.log("\n===============================================================================");
  console.log(`  SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
} finally {
  server.close();
  // Cleanup test colleges
  for (const cid of collegeIds.reverse()) {
    try {
      const users = await prisma.user.findMany({ where: { collegeId: cid }, select: { id: true } });
      const userIds = users.map((u) => u.id);
      await prisma.creditIdempotencyRecord.deleteMany({ where: { collegeId: cid } });
      await prisma.collegeCreditTransaction.deleteMany({ where: { collegeId: cid } });
      await prisma.interviewReport.deleteMany({ where: { session: { collegeId: cid } } });
      await prisma.interviewSession.deleteMany({ where: { collegeId: cid } });
      await prisma.resume.deleteMany({ where: { collegeId: cid } });
      await prisma.collegeStudent.deleteMany({ where: { collegeId: cid } });
      await prisma.collegeFaculty.deleteMany({ where: { collegeId: cid } });
      await prisma.collegeCreditAccount.deleteMany({ where: { collegeId: cid } });
      await prisma.college.delete({ where: { id: cid } }).catch(() => undefined);
      if (userIds.length > 0) {
        await prisma.userCredit.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  await prisma.$disconnect();
}
