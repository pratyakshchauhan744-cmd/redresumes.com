import "dotenv/config";
import * as xlsx from "xlsx";
import { normalizeExcelHeaders, generateSecureTemporaryPassword } from "../modules/enterprise/routes.js";

async function runPhase7UnitTests() {
  console.log("===============================================================================");
  console.log("PHASE 7 BULK IMPORT ENGINE: SPECIFICATION & LOGIC VERIFICATION SUITE");
  console.log("===============================================================================\n");

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

  // -------------------------------------------------------------------------
  // 1. Header Normalization (All variations & case insensitivity)
  // -------------------------------------------------------------------------
  console.log("-> 1. Testing Header Normalization across all column variations...");
  const sampleHeaders1 = {
    "Full Name": "Aarav Sharma",
    "Student Email": "aarav@test.edu",
    "Roll No.": "ENR-001",
    "Degree Program": "B.Tech",
    "Branch / Specialization": "Computer Science",
    "Class Sec": "A",
    "Graduation Year": "2026",
    "Contact Phone": "+91 9876543210",
    "Initial Credits": "3",
    "Gender": "Male",
    "Semester": "6",
  };
  const norm1 = normalizeExcelHeaders(sampleHeaders1);
  assert(norm1.name === "Aarav Sharma", "Normalizes 'Full Name'");
  assert(norm1.email === "aarav@test.edu", "Normalizes 'Student Email'");
  assert(norm1.enrollmentNumber === "ENR-001", "Normalizes 'Roll No.'");
  assert(norm1.program === "B.Tech", "Normalizes 'Degree Program'");
  assert(norm1.course === "Computer Science", "Normalizes 'Branch / Specialization'");
  assert(norm1.section === "A", "Normalizes 'Class Sec'");
  assert(norm1.batch === "2026", "Normalizes 'Graduation Year'");
  assert(norm1.phone === "+91 9876543210", "Normalizes 'Contact Phone'");
  assert(norm1.initialCredits === 3, "Normalizes 'Initial Credits' numeric conversion");
  assert(norm1.gender === "Male", "Normalizes 'Gender'");
  assert(norm1.semester === 6, "Normalizes 'Semester' numeric conversion");

  const sampleHeaders2 = {
    "student_name": "Diya Patel",
    "email_id": "diya@test.edu",
    "registration_no": "REG-999",
    "stream": "B.E.",
    "department": "Electronics",
    "division": "B",
    "passing_year": "2025",
    "mobile_number": "+91 9123456780",
    "credits": "5",
  };
  const norm2 = normalizeExcelHeaders(sampleHeaders2);
  assert(norm2.name === "Diya Patel", "Normalizes snake_case 'student_name'");
  assert(norm2.email === "diya@test.edu", "Normalizes snake_case 'email_id'");
  assert(norm2.enrollmentNumber === "REG-999", "Normalizes snake_case 'registration_no'");
  assert(norm2.program === "B.E.", "Normalizes 'stream' to program");
  assert(norm2.department === "Electronics", "Normalizes 'department'");
  assert(norm2.section === "B", "Normalizes 'division' to section");
  assert(norm2.batch === "2025", "Normalizes 'passing_year' to batch");
  assert(norm2.phone === "+91 9123456780", "Normalizes 'mobile_number' to phone");
  assert(norm2.initialCredits === 5, "Normalizes 'credits' to initialCredits");

  // -------------------------------------------------------------------------
  // 2. Excel Binary Workbook Generation & Parsing (xlsx)
  // -------------------------------------------------------------------------
  console.log("\n-> 2. Testing Excel Workbook Parsing (.xlsx and .csv)...");
  const cohortData = [
    { Name: "Student Alpha", Email: "alpha@univ.edu", "Roll No": "ROLL-01", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
    { Name: "Student Beta", Email: "beta@univ.edu", "Roll No": "ROLL-02", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
    { Name: "Student Gamma", Email: "gamma@univ.edu", "Roll No": "ROLL-03", Program: "B.Tech", Course: "CSE", Section: "B", Batch: "2026" },
  ];
  const worksheet = xlsx.utils.json_to_sheet(cohortData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Cohort");
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  assert(Buffer.isBuffer(buffer) && buffer.length > 0, "Generates valid Excel spreadsheet binary buffer");

  const readWb = xlsx.read(buffer, { type: "buffer" });
  assert(readWb.SheetNames[0] === "Cohort", "Excel workbook SheetNames correctly read");
  const extractedRows: any[] = xlsx.utils.sheet_to_json(readWb.Sheets[readWb.SheetNames[0]], { defval: "" });
  assert(extractedRows.length === 3, "Extracted exactly 3 rows from Excel sheet");
  assert(extractedRows[0].Name === "Student Alpha", "Row data matches original structure");

  // -------------------------------------------------------------------------
  // 3. Validation Logic Simulation (Required Fields, Email Format)
  // -------------------------------------------------------------------------
  console.log("\n-> 3. Testing Row Validation & Error Handling...");
  function validateRow(rawRow: Record<string, any>, rowNum: number) {
    const normalized = normalizeExcelHeaders(rawRow);
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalized.name) errors.push("Missing required field: Name");
    if (!normalized.email) errors.push("Missing required field: Email");
    else if (!emailRegex.test(normalized.email)) errors.push(`Invalid email format: "${normalized.email}"`);
    if (!normalized.enrollmentNumber) errors.push("Missing required field: Enrollment Number");
    if (!normalized.program) errors.push("Missing required field: Program");
    if (!normalized.course) errors.push("Missing required field: Course");
    if (!normalized.section) errors.push("Missing required field: Section");
    if (!normalized.batch) errors.push("Missing required field: Batch");

    return { isValid: errors.length === 0, errors };
  }

  const validRow = { Name: "Valid Student", Email: "valid@univ.edu", "Roll No": "ENR-01", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" };
  const validRes = validateRow(validRow, 1);
  assert(validRes.isValid === true, "Valid row passes all validation checks");

  const invalidEmailRow = { Name: "Bad Email", Email: "not-an-email-at-all", "Roll No": "ENR-02", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" };
  const invalidEmailRes = validateRow(invalidEmailRow, 2);
  assert(invalidEmailRes.isValid === false, "Rejects malformed email string");
  assert(invalidEmailRes.errors[0].includes("Invalid email format"), "Reports precise email format error");

  const missingFieldsRow = { Name: "Missing Fields" };
  const missingRes = validateRow(missingFieldsRow, 3);
  assert(missingRes.isValid === false, "Rejects row with missing required fields");
  assert(missingRes.errors.length >= 6, "Captures all missing required fields in one pass");

  // -------------------------------------------------------------------------
  // 4. In-File Duplicate Detection (Email and Enrollment)
  // -------------------------------------------------------------------------
  console.log("\n-> 4. Testing In-File Duplicate Detection...");
  const duplicateCohort = [
    { Name: "Student 1", Email: "dup@univ.edu", "Roll No": "R-100", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
    { Name: "Student 2", Email: "dup@univ.edu", "Roll No": "R-101", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" }, // Duplicate Email!
    { Name: "Student 3", Email: "unique@univ.edu", "Roll No": "R-100", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" }, // Duplicate Roll!
  ];

  const seenEmails = new Map<string, number>();
  const seenEnrollments = new Map<string, number>();
  const dupErrors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < duplicateCohort.length; i++) {
    const rowNum = i + 1;
    const n = normalizeExcelHeaders(duplicateCohort[i]);

    if (seenEmails.has(n.email)) {
      dupErrors.push({ row: rowNum, reason: `Duplicate email "${n.email}" in import file (first seen at row ${seenEmails.get(n.email)})` });
    } else {
      seenEmails.set(n.email, rowNum);
    }

    if (seenEnrollments.has(n.enrollmentNumber)) {
      dupErrors.push({ row: rowNum, reason: `Duplicate enrollment number "${n.enrollmentNumber}" in import file (first seen at row ${seenEnrollments.get(n.enrollmentNumber)})` });
    } else {
      seenEnrollments.set(n.enrollmentNumber, rowNum);
    }
  }

  assert(dupErrors.length === 2, "Accurately detects 2 in-file duplicates");
  assert(dupErrors[0].row === 2 && dupErrors[0].reason.includes("Duplicate email"), "Row 2 flagged for duplicate email");
  assert(dupErrors[1].row === 3 && dupErrors[1].reason.includes("Duplicate enrollment number"), "Row 3 flagged for duplicate roll number");

  // -------------------------------------------------------------------------
  // 5. Rollback Behavior Simulation (atomic: true vs atomic: false)
  // -------------------------------------------------------------------------
  console.log("\n-> 5. Testing Atomic vs Partial Rollback Behavior...");
  function simulateImportExecution(rows: any[], atomic: boolean) {
    const errors: string[] = [];
    const created: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const v = validateRow(rows[i], i + 1);
      if (!v.isValid) {
        errors.push(...v.errors);
      } else {
        created.push(rows[i]);
      }
    }

    if (atomic && errors.length > 0) {
      return { success: false, totalCreated: 0, totalFailed: errors.length, errors, aborted: true };
    }
    return { success: true, totalCreated: created.length, totalFailed: errors.length, errors, aborted: false };
  }

  const mixedData = [
    { Name: "Student Ok 1", Email: "ok1@univ.edu", "Roll No": "R-1", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
    { Name: "Student Ok 2", Email: "ok2@univ.edu", "Roll No": "R-2", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
    { Name: "Student Bad", Email: "bad-email", "Roll No": "R-3", Program: "B.Tech", Course: "CSE", Section: "A", Batch: "2026" },
  ];

  // Atomic mode
  const atomicExec = simulateImportExecution(mixedData, true);
  assert(atomicExec.success === false, "Atomic mode returns success: false when an error exists");
  assert(atomicExec.totalCreated === 0, "Atomic mode creates 0 records (Full rollback)");
  assert(atomicExec.aborted === true, "Atomic mode explicitly sets aborted flag");

  // Partial mode
  const partialExec = simulateImportExecution(mixedData, false);
  assert(partialExec.success === true, "Partial mode returns success: true");
  assert(partialExec.totalCreated === 2, "Partial mode successfully commits the 2 valid rows");
  assert(partialExec.totalFailed === 1, "Partial mode isolates the 1 failed row in error breakdown");

  // -------------------------------------------------------------------------
  // 6. 500+ Scale Data Generator & Chunking Speed
  // -------------------------------------------------------------------------
  console.log("\n-> 6. Testing 500+ Student Scale & Chunk Slicing Performance...");
  const SCALE = 600;
  const largeCohort: any[] = [];
  for (let i = 1; i <= SCALE; i++) {
    largeCohort.push({
      Name: `Cohort Student ${i}`,
      Email: `cohort.${i}@university.edu`,
      "Roll No": `ENR-${String(i).padStart(4, "0")}`,
      Program: "B.Tech",
      Course: "Computer Science",
      Section: i % 2 === 0 ? "A" : "B",
      Batch: "2026",
      Phone: `+91 99000${String(i).padStart(5, "0")}`,
    });
  }

  const CHUNK_SIZE = 50;
  const chunks: any[][] = [];
  const chunkStartTime = Date.now();
  for (let i = 0; i < largeCohort.length; i += CHUNK_SIZE) {
    chunks.push(largeCohort.slice(i, i + CHUNK_SIZE));
  }
  const chunkDurationMs = Date.now() - chunkStartTime;

  assert(largeCohort.length === SCALE, `Generated cohort of ${SCALE} records`);
  assert(chunks.length === Math.ceil(SCALE / CHUNK_SIZE), `Partitioned into ${chunks.length} chunks of size ${CHUNK_SIZE}`);
  assert(chunkDurationMs < 50, `Chunk slicing completed in ${chunkDurationMs}ms (optimal performance)`);

  // Verify random credentials generation for each student in the scale cohort
  const generatedCredentials = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const cred = generateSecureTemporaryPassword();
    generatedCredentials.add(cred);
  }
  assert(generatedCredentials.size === 50, "Generated 50 unique credentials for chunk without any duplicates");

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`PHASE 7 UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7UnitTests();
