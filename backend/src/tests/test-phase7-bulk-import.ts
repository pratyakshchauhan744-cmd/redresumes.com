import "dotenv/config";
import * as xlsx from "xlsx";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { executeBulkImport, normalizeExcelHeaders, generateSecureTemporaryPassword } from "../modules/enterprise/routes.js";

async function runPhase7Tests() {
  console.log("================================================================");
  console.log("PHASE 7 AUTOMATED TEST SUITE: BULK EXCEL/CSV IMPORT ENGINE");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const collegeA_Code = `COL_A_${timestamp.toString().slice(-4)}`;
  const collegeB_Code = `COL_B_${timestamp.toString().slice(-4)}`;

  try {
    // 0. Setup College A and College B tenants
    console.log("-> Initializing Multi-Tenant Test Data...");
    const [collegeA, collegeB] = await Promise.all([
      prisma.college.create({
        data: {
          name: `Apex Engineering College ${timestamp}`,
          code: collegeA_Code,
          officialEmail: `apex.${timestamp}@college.edu`,
          status: "active",
        },
      }),
      prisma.college.create({
        data: {
          name: `Beacon Institute of Tech ${timestamp}`,
          code: collegeB_Code,
          officialEmail: `beacon.${timestamp}@college.edu`,
          status: "active",
        },
      }),
    ]);

    // Create credit accounts
    await Promise.all([
      prisma.collegeCreditAccount.create({
        data: { collegeId: collegeA.id, totalAllocated: 5000, balance: 5000 },
      }),
      prisma.collegeCreditAccount.create({
        data: { collegeId: collegeB.id, totalAllocated: 5000, balance: 5000 },
      }),
    ]);

    // Create main faculty actors
    const dummyPasswordHash = await bcrypt.hash("TempPass#123", 10);
    const facultyA = await prisma.user.create({
      data: {
        name: "Faculty Lead A",
        email: `faculty.a.${timestamp}@apex.edu`,
        passwordHash: dummyPasswordHash,
        role: "college_main_faculty",
        collegeId: collegeA.id,
      },
    });

    console.log(`-> Setup complete. College A: ${collegeA.id}, College B: ${collegeB.id}\n`);

    // TEST 1: Header Normalization
    console.log("-> TEST 1: Header Normalization with variations");
    const rawHeadersSample = {
      "Full Name": "Aarav Sharma",
      "Student Email": "aarav.test@apex.edu",
      "Roll No.": "ENR-001",
      "Degree Program": "B.Tech",
      "Branch / Specialization": "Computer Science",
      "Class Sec": "A",
      "Graduation Year": "2026",
      "Contact Phone": "+91 9876543210",
      "Initial Credits": "2",
    };
    const normalized = normalizeExcelHeaders(rawHeadersSample);
    assert(normalized.name === "Aarav Sharma", "Normalizes 'Full Name' to name");
    assert(normalized.email === "aarav.test@apex.edu", "Normalizes 'Student Email' to email");
    assert(normalized.enrollmentNumber === "ENR-001", "Normalizes 'Roll No.' to enrollmentNumber");
    assert(normalized.program === "B.Tech", "Normalizes 'Degree Program' to program");
    assert(normalized.course === "Computer Science", "Normalizes 'Branch / Specialization' to course");
    assert(normalized.section === "A", "Normalizes 'Class Sec' to section");
    assert(normalized.batch === "2026", "Normalizes 'Graduation Year' to batch");
    assert(normalized.phone === "+91 9876543210", "Normalizes 'Contact Phone' to phone");
    assert(normalized.initialCredits === 2, "Normalizes 'Initial Credits' string to number");

    // TEST 2: Valid Excel Spreadsheet Generation & Processing
    console.log("\n-> TEST 2: Valid Excel Spreadsheet Import");
    const validStudents = [
      {
        "Student Name": "Student One",
        "Email ID": `std1.${timestamp}@apex.edu`,
        "Roll Number": `APEX-2026-001`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
        "Phone": "+91 9999900001",
        "Credits": 1,
      },
      {
        "Student Name": "Student Two",
        "Email ID": `std2.${timestamp}@apex.edu`,
        "Roll Number": `APEX-2026-002`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
        "Phone": "+91 9999900002",
        "Credits": 1,
      },
    ];

    // Build real binary Excel workbook
    const ws = xlsx.utils.json_to_sheet(validStudents);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Students");
    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Parse buffer back to rows
    const parsedWb = xlsx.read(excelBuffer, { type: "buffer" });
    const parsedRows: any[] = xlsx.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]], { defval: "" });

    const importResult1 = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: parsedRows,
      atomic: true,
    });

    assert(importResult1.success === true, "Valid Excel import completes with success: true");
    assert(importResult1.totalCreated === 2, "All 2 valid students created in database");
    assert(importResult1.totalFailed === 0, "0 errors reported for clean valid import");
    assert(importResult1.createdStudents.length === 2, "Returns 2 created students in payload");

    // Verify DB records
    const dbStudent1 = await prisma.collegeStudent.findUnique({
      where: { collegeId_enrollmentNumber: { collegeId: collegeA.id, enrollmentNumber: "APEX-2026-001" } },
      include: { user: { include: { credits: true } } },
    });
    assert(Boolean(dbStudent1), "Student 1 exists in DB under College A");
    assert(dbStudent1?.user.role === "student", "User role set to 'student'");
    assert(dbStudent1?.user.credits?.balance === 1, "Initial credit assigned to student 1");

    // TEST 3: Missing Required Headers / Fields
    console.log("\n-> TEST 3: Missing Required Headers");
    const missingHeadersRows = [
      {
        "Student Name": "Incomplete Student",
        "Email ID": `incomplete.${timestamp}@apex.edu`,
        // Missing Roll Number, Program, Course, Section, Batch!
      },
    ];
    const missingHeadersResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: missingHeadersRows,
      atomic: false,
    });
    assert(missingHeadersResult.totalCreated === 0, "No students created when required headers missing");
    assert(missingHeadersResult.errors.length > 0, "Validation errors collected for missing fields");
    assert(
      missingHeadersResult.errors.some((e) => e.reason.includes("Enrollment Number")),
      "Reports missing Enrollment Number error"
    );

    // TEST 4: In-File Duplicate Detection
    console.log("\n-> TEST 4: In-File Duplicate Detection");
    const inFileDataWithDuplicates = [
      {
        "Student Name": "Duplicate In File 1",
        "Email ID": `dup.file.${timestamp}@apex.edu`,
        "Roll Number": `DUP-FILE-001`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
      {
        "Student Name": "Duplicate In File 2 (Same Email)",
        "Email ID": `dup.file.${timestamp}@apex.edu`, // Duplicate Email!
        "Roll Number": `DUP-FILE-002`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
      {
        "Student Name": "Duplicate In File 3 (Same Roll)",
        "Email ID": `unique.${timestamp}@apex.edu`,
        "Roll Number": `DUP-FILE-001`, // Duplicate Roll Number!
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "B",
        "Batch": "2026",
      },
    ];
    const inDupResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: inFileDataWithDuplicates,
      atomic: false,
    });
    assert(inDupResult.totalCreated === 1, "Only first unique row created");
    assert(inDupResult.totalFailed === 2, "2 duplicate rows rejected");
    assert(
      inDupResult.errors.some((e) => e.reason.includes("Duplicate email") && e.row === 2),
      "Identifies row 2 duplicate email within file"
    );
    assert(
      inDupResult.errors.some((e) => e.reason.includes("Duplicate enrollment number") && e.row === 3),
      "Identifies row 3 duplicate roll number within file"
    );

    // TEST 5: Database Duplicate Detection (already in college DB)
    console.log("\n-> TEST 5: Database Existing Student Duplicate Detection");
    const dbDuplicateRows = [
      {
        "Student Name": "Attempt Existing Re-import",
        "Email ID": `std1.${timestamp}@apex.edu`, // Already in DB from Test 2
        "Roll Number": `APEX-2026-001`, // Already in DB from Test 2
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
    ];
    const dbDupResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: dbDuplicateRows,
      atomic: false,
    });
    assert(dbDupResult.totalCreated === 0, "Existing database student is not duplicated");
    assert(dbDupResult.totalFailed === 1, "Reported as failed row");
    assert(
      dbDupResult.errors.some((e) => e.reason.includes("already exists in this college")),
      "Correctly flags student already existing in college"
    );

    // TEST 6: Cross-Tenant Email Collision
    console.log("\n-> TEST 6: Cross-Tenant Isolation Rejection");
    // Email std1 belongs to College A. College B now attempts to import std1!
    const crossTenantRows = [
      {
        "Student Name": "Infiltrator Student",
        "Email ID": `std1.${timestamp}@apex.edu`, // Registered under College A!
        "Roll Number": `BEACON-2026-999`,
        "Program": "B.Tech",
        "Course": "IT",
        "Section": "B",
        "Batch": "2026",
      },
    ];
    const crossTenantResult = await executeBulkImport({
      collegeId: collegeB.id,
      actorId: facultyA.id,
      rawRows: crossTenantRows,
      atomic: false,
    });
    assert(crossTenantResult.totalCreated === 0, "Cross-tenant email collision rejected");
    assert(
      crossTenantResult.errors.some((e) => e.reason.includes("Cross-tenant conflict")),
      "Rejects with clear cross-tenant conflict error message"
    );

    // Verify student was NOT added to College B
    const beaconStudent = await prisma.collegeStudent.findUnique({
      where: { collegeId_enrollmentNumber: { collegeId: collegeB.id, enrollmentNumber: "BEACON-2026-999" } },
    });
    assert(beaconStudent === null, "College B database has no student record");

    // TEST 7: Atomic Rollback Behavior
    console.log("\n-> TEST 7: Atomic Rollback Behavior (atomic: true)");
    const atomicMixedRows = [
      {
        "Student Name": "Atomic Candidate 1",
        "Email ID": `atomic1.${timestamp}@apex.edu`,
        "Roll Number": `ATOMIC-001`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
      {
        "Student Name": "Atomic Candidate 2 (Invalid Email)",
        "Email ID": "not-an-email", // INVALID!
        "Roll Number": `ATOMIC-002`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
    ];

    const atomicResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: atomicMixedRows,
      atomic: true, // STRICT ROLLBACK MODE
    });

    assert(atomicResult.success === false, "Atomic import returns success: false upon any error");
    assert(atomicResult.totalCreated === 0, "Zero records created in atomic mode");
    assert(atomicResult.totalFailed > 0, "Errors reported");

    // Verify Candidate 1 was NOT created in DB (full rollback)
    const rolledBackStudent = await prisma.collegeStudent.findUnique({
      where: { collegeId_enrollmentNumber: { collegeId: collegeA.id, enrollmentNumber: "ATOMIC-001" } },
    });
    assert(rolledBackStudent === null, "Atomic Candidate 1 was not persisted to database (rollback verified)");

    // TEST 8: Partial Import Mode (atomic: false)
    console.log("\n-> TEST 8: Partial Import Mode (atomic: false)");
    const partialMixedRows = [
      {
        "Student Name": "Partial Valid Student",
        "Email ID": `partial.valid.${timestamp}@apex.edu`,
        "Roll Number": `PARTIAL-001`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
      {
        "Student Name": "Partial Invalid Student",
        "Email ID": "bad-email",
        "Roll Number": `PARTIAL-002`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": "A",
        "Batch": "2026",
      },
    ];

    const partialResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: partialMixedRows,
      atomic: false,
    });

    assert(partialResult.success === true, "Partial import returns success: true");
    assert(partialResult.totalCreated === 1, "Valid row created");
    assert(partialResult.totalFailed === 1, "Invalid row isolated in errors list");
    const partialCreated = await prisma.collegeStudent.findUnique({
      where: { collegeId_enrollmentNumber: { collegeId: collegeA.id, enrollmentNumber: "PARTIAL-001" } },
    });
    assert(Boolean(partialCreated), "Valid student successfully saved in DB");

    // TEST 9: 500+ Scale & Chunking Test
    console.log("\n-> TEST 9: 500+ Scale & Chunked Processing Test");
    const SCALE_COUNT = 520;
    const largeCohortRows: Array<Record<string, any>> = [];

    for (let i = 1; i <= SCALE_COUNT; i++) {
      largeCohortRows.push({
        "Student Name": `Scale Student ${i}`,
        "Email ID": `scale.${i}.${timestamp}@apex.edu`,
        "Roll Number": `SCALE-2026-${String(i).padStart(4, "0")}`,
        "Program": "B.Tech",
        "Course": "CSE",
        "Section": i % 2 === 0 ? "A" : "B",
        "Batch": "2026",
        "Phone": `+91 98000${String(i).padStart(5, "0")}`,
      });
    }

    const startTime = Date.now();
    const scaleResult = await executeBulkImport({
      collegeId: collegeA.id,
      actorId: facultyA.id,
      rawRows: largeCohortRows,
      atomic: true,
    });
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    assert(scaleResult.success === true, `Processed ${SCALE_COUNT} students in ${durationSec}s`);
    assert(scaleResult.totalCreated === SCALE_COUNT, `All ${SCALE_COUNT} students successfully created`);
    assert(scaleResult.totalFailed === 0, "0 errors in 500+ scale cohort");

    // Verify chunking correctness by counting database entries
    const dbScaleCount = await prisma.collegeStudent.count({
      where: { collegeId: collegeA.id, enrollmentNumber: { startsWith: "SCALE-2026-" } },
    });
    assert(dbScaleCount === SCALE_COUNT, `Database confirms exactly ${SCALE_COUNT} records persisted`);

    // Verify invitation tokens and password hashes
    const sampleScaleStudent = await prisma.collegeStudent.findUnique({
      where: { collegeId_enrollmentNumber: { collegeId: collegeA.id, enrollmentNumber: "SCALE-2026-0001" } },
      include: { user: true },
    });
    assert(Boolean(sampleScaleStudent?.user.passwordHash.startsWith("$2")), "Password properly hashed with bcrypt");
    assert(Boolean(!sampleScaleStudent?.user.passwordHash.includes("Rr#")), "Plaintext password never stored in DB");

    const sampleInvitation = await prisma.invitation.findFirst({
      where: { collegeId: collegeA.id, email: `scale.1.${timestamp}@apex.edu` },
    });
    assert(Boolean(sampleInvitation), "Invitation record created for scale student");
    assert(Boolean(sampleInvitation?.tokenHash), "SHA-256 token hash generated for activation");

    console.log("\n================================================================");
    console.log(`PHASE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Test execution encountered unexpected error:", error);
    process.exit(1);
  } finally {
    // Cleanup test colleges
    await prisma.college.deleteMany({
      where: { code: { in: [collegeA_Code, collegeB_Code] } },
    });
    await prisma.$disconnect();
  }
}

runPhase7Tests();
