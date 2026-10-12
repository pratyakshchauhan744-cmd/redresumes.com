/**
 * Comprehensive Integration & Regression Test Suite for P2:
 * Report Export Search Parity with Dashboard Listing
 */

import "dotenv/config";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as xlsx from "xlsx";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { env } from "../config/env.js";

const JWT_SECRET = env.JWT_SECRET || "change_me_super_secret_123";

function generateToken(payload: {
  userId: string;
  role: string;
  collegeId: string;
  isMainFaculty?: boolean;
  permissions?: string[];
}) {
  return jwt.sign(
    {
      sub: payload.userId,
      email: `${payload.userId}@example.com`,
      role: payload.role,
      collegeId: payload.collegeId,
      isMainFaculty: payload.isMainFaculty ?? false,
      permissions: payload.permissions ?? ["REPORT_VIEW", "REPORT_EXPORT"],
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
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

function check(condition: boolean, title: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${title}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${title}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("  STARTING INTEGRATION TEST SUITE: REPORT EXPORT SEARCH PARITY (P2)");
  console.log("===============================================================================\n");

  const app = express();
  app.use(express.json());
  app.use("/api/enterprise", enterpriseRoutes);
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash("TestPass123!", 8);

  const cleanupIds = {
    colleges: [] as string[],
    users: [] as string[],
    students: [] as string[],
    resumes: [] as string[],
    sessions: [] as string[],
    reports: [] as string[],
  };

  try {
    console.log("-> 1. Setting up test fixtures (Colleges, Faculty, Students, Sessions, Reports)...");

    // College Alpha
    const collegeAlpha = await prisma.college.create({
      data: {
        name: `Export Parity College Alpha ${ts}`,
        code: `EP-A-${ts}`,
        officialEmail: `admin@alpha-${ts}.edu`,
        status: "active",
      },
    });
    cleanupIds.colleges.push(collegeAlpha.id);

    // College Beta (for cross-institution isolation testing)
    const collegeBeta = await prisma.college.create({
      data: {
        name: `Export Parity College Beta ${ts}`,
        code: `EP-B-${ts}`,
        officialEmail: `admin@beta-${ts}.edu`,
        status: "active",
      },
    });
    cleanupIds.colleges.push(collegeBeta.id);

    // Faculty Alpha (Full Access)
    const facultyAlphaUser = await prisma.user.create({
      data: {
        name: "Dr. Alpha Admin",
        email: `faculty-alpha-${ts}@alpha.edu`,
        passwordHash,
        role: "college_faculty",
        collegeId: collegeAlpha.id,
        facultyProfile: {
          create: {
            collegeId: collegeAlpha.id,
            employeeId: `FAC-A-${ts}`,
            designation: "Dean",
            status: "active",
            isMainFaculty: true,
            permissions: ["REPORT_VIEW", "REPORT_EXPORT", "STUDENT_VIEW"],
            scopeUnrestricted: true,
          },
        },
      },
    });
    cleanupIds.users.push(facultyAlphaUser.id);

    // Faculty Alpha Restricted (Restricted to Section B only)
    const facultyRestrictedUser = await prisma.user.create({
      data: {
        name: "Prof. Restricted Section B",
        email: `faculty-restricted-${ts}@alpha.edu`,
        passwordHash,
        role: "college_faculty",
        collegeId: collegeAlpha.id,
        facultyProfile: {
          create: {
            collegeId: collegeAlpha.id,
            employeeId: `FAC-REST-${ts}`,
            designation: "Assistant Professor",
            status: "active",
            isMainFaculty: false,
            permissions: ["REPORT_VIEW", "REPORT_EXPORT"],
            scopeUnrestricted: false,
            sectionAccess: ["B"],
            cohortAccess: [
              {
                program: "B.Tech",
                course: "Information Technology",
                section: "B",
                batch: "2026",
              },
            ],
          },
        },
      },
    });
    cleanupIds.users.push(facultyRestrictedUser.id);

    // Faculty Beta (College Beta)
    const facultyBetaUser = await prisma.user.create({
      data: {
        name: "Dr. Beta Admin",
        email: `faculty-beta-${ts}@beta.edu`,
        passwordHash,
        role: "college_faculty",
        collegeId: collegeBeta.id,
        facultyProfile: {
          create: {
            collegeId: collegeBeta.id,
            employeeId: `FAC-B-${ts}`,
            designation: "Director",
            status: "active",
            isMainFaculty: true,
            permissions: ["REPORT_VIEW", "REPORT_EXPORT", "STUDENT_VIEW"],
            scopeUnrestricted: true,
          },
        },
      },
    });
    cleanupIds.users.push(facultyBetaUser.id);

    // Student 1: Rahul Sharma (College Alpha, Section A)
    // Target Role: Software Engineer (Prompt Regression Dataset)
    const studentRahul = await prisma.user.create({
      data: {
        name: "Rahul Sharma",
        email: `rahul-${ts}@example.com`,
        passwordHash,
        role: "student",
        collegeId: collegeAlpha.id,
        studentProfile: {
          create: {
            collegeId: collegeAlpha.id,
            enrollmentNumber: `ENR-RAHUL-${ts}`,
            program: "B.Tech",
            course: "Computer Science",
            section: "A",
            batch: "2026",
            status: "active",
          },
        },
      },
      include: { studentProfile: true },
    });
    cleanupIds.users.push(studentRahul.id);
    if (studentRahul.studentProfile) cleanupIds.students.push(studentRahul.studentProfile.id);

    const resumeRahul = await prisma.resume.create({
      data: { userId: studentRahul.id, collegeId: collegeAlpha.id, fileName: "Rahul_Resume.pdf" },
    });
    cleanupIds.resumes.push(resumeRahul.id);

    const sessionRahul1 = await prisma.interviewSession.create({
      data: {
        userId: studentRahul.id,
        collegeId: collegeAlpha.id,
        resumeId: resumeRahul.id,
        targetRole: "Software Engineer",
        companyType: "Product",
        difficulty: "hard",
        interviewStyle: "technical",
        durationMins: 45,
        status: "completed",
        createdAt: new Date("2026-10-01T10:00:00Z"),
        report: {
          create: {
            overallScore: 85,
            scoreScale: 100,
            categoryScores: { technical: 90, communication: 80 },
            strengths: ["Clean code", "Algorithm mastery"],
            weaknesses: ["Speaking speed"],
            recommendations: ["Pace yourself"],
            speakingPace: 140,
            fillerWords: 2,
            createdAt: new Date("2026-10-01T10:45:00Z"),
          },
        },
      },
      include: { report: true },
    });
    cleanupIds.sessions.push(sessionRahul1.id);
    if (sessionRahul1.report) cleanupIds.reports.push(sessionRahul1.report.id);

    // Student 2: Priya Patel (College Alpha, Section B)
    // Target Role: DevOps Engineer
    const studentPriya = await prisma.user.create({
      data: {
        name: "Priya Patel",
        email: `priya-${ts}@example.com`,
        passwordHash,
        role: "student",
        collegeId: collegeAlpha.id,
        studentProfile: {
          create: {
            collegeId: collegeAlpha.id,
            enrollmentNumber: `ENR-PRIYA-${ts}`,
            program: "B.Tech",
            course: "Information Technology",
            section: "B",
            batch: "2026",
            status: "active",
          },
        },
      },
      include: { studentProfile: true },
    });
    cleanupIds.users.push(studentPriya.id);
    if (studentPriya.studentProfile) cleanupIds.students.push(studentPriya.studentProfile.id);

    const resumePriya = await prisma.resume.create({
      data: { userId: studentPriya.id, collegeId: collegeAlpha.id, fileName: "Priya_Resume.pdf" },
    });
    cleanupIds.resumes.push(resumePriya.id);

    const sessionPriya1 = await prisma.interviewSession.create({
      data: {
        userId: studentPriya.id,
        collegeId: collegeAlpha.id,
        resumeId: resumePriya.id,
        targetRole: "DevOps Engineer",
        companyType: "Cloud",
        difficulty: "intermediate",
        interviewStyle: "analytical",
        durationMins: 30,
        status: "completed",
        createdAt: new Date("2026-10-03T10:00:00Z"),
        report: {
          create: {
            overallScore: 78,
            scoreScale: 100,
            categoryScores: { infrastructure: 80, automation: 76 },
            strengths: ["CI/CD pipelines", "Kubernetes"],
            weaknesses: ["Terraform depth"],
            recommendations: ["Practice IaC"],
            speakingPace: 135,
            fillerWords: 4,
            createdAt: new Date("2026-10-03T10:30:00Z"),
          },
        },
      },
      include: { report: true },
    });
    cleanupIds.sessions.push(sessionPriya1.id);
    if (sessionPriya1.report) cleanupIds.reports.push(sessionPriya1.report.id);

    // Student 3: Anita Desai (College Alpha, Section A)
    // Target Role: Product Manager (non-engineer role)
    const studentAnita = await prisma.user.create({
      data: {
        name: "Anita Desai",
        email: `anita-${ts}@example.com`,
        passwordHash,
        role: "student",
        collegeId: collegeAlpha.id,
        studentProfile: {
          create: {
            collegeId: collegeAlpha.id,
            enrollmentNumber: `ENR-ANITA-${ts}`,
            program: "MBA",
            course: "Business Analytics",
            section: "A",
            batch: "2026",
            status: "active",
          },
        },
      },
      include: { studentProfile: true },
    });
    cleanupIds.users.push(studentAnita.id);
    if (studentAnita.studentProfile) cleanupIds.students.push(studentAnita.studentProfile.id);

    const resumeAnita = await prisma.resume.create({
      data: { userId: studentAnita.id, collegeId: collegeAlpha.id, fileName: "Anita_Resume.pdf" },
    });
    cleanupIds.resumes.push(resumeAnita.id);

    const sessionAnita1 = await prisma.interviewSession.create({
      data: {
        userId: studentAnita.id,
        collegeId: collegeAlpha.id,
        resumeId: resumeAnita.id,
        targetRole: "Product Manager",
        companyType: "Startup",
        difficulty: "intermediate",
        interviewStyle: "behavioral",
        durationMins: 40,
        status: "completed",
        createdAt: new Date("2026-10-05T10:00:00Z"),
        report: {
          create: {
            overallScore: 68,
            scoreScale: 100,
            categoryScores: { strategy: 70, execution: 66 },
            strengths: ["Roadmapping"],
            weaknesses: ["Metrics definition"],
            recommendations: ["Focus on KPI design"],
            speakingPace: 150,
            fillerWords: 5,
            createdAt: new Date("2026-10-05T10:40:00Z"),
          },
        },
      },
      include: { report: true },
    });
    cleanupIds.sessions.push(sessionAnita1.id);
    if (sessionAnita1.report) cleanupIds.reports.push(sessionAnita1.report.id);

    // Student 4: Vikram Beta (College Beta, Section A)
    // Target Role: Software Engineer (to verify tenant isolation)
    const studentVikram = await prisma.user.create({
      data: {
        name: "Vikram Beta",
        email: `vikram-${ts}@beta.edu`,
        passwordHash,
        role: "student",
        collegeId: collegeBeta.id,
        studentProfile: {
          create: {
            collegeId: collegeBeta.id,
            enrollmentNumber: `ENR-VIKRAM-${ts}`,
            program: "B.Tech",
            course: "Computer Science",
            section: "A",
            batch: "2026",
            status: "active",
          },
        },
      },
      include: { studentProfile: true },
    });
    cleanupIds.users.push(studentVikram.id);
    if (studentVikram.studentProfile) cleanupIds.students.push(studentVikram.studentProfile.id);

    const resumeVikram = await prisma.resume.create({
      data: { userId: studentVikram.id, collegeId: collegeBeta.id, fileName: "Vikram_Resume.pdf" },
    });
    cleanupIds.resumes.push(resumeVikram.id);

    const sessionVikram1 = await prisma.interviewSession.create({
      data: {
        userId: studentVikram.id,
        collegeId: collegeBeta.id,
        resumeId: resumeVikram.id,
        targetRole: "Software Engineer",
        companyType: "Product",
        difficulty: "hard",
        interviewStyle: "technical",
        durationMins: 45,
        status: "completed",
        createdAt: new Date("2026-10-01T10:00:00Z"),
        report: {
          create: {
            overallScore: 92,
            scoreScale: 100,
            categoryScores: { technical: 95, communication: 89 },
            strengths: ["Outstanding code quality"],
            weaknesses: [],
            recommendations: [],
            speakingPace: 140,
            fillerWords: 1,
            createdAt: new Date("2026-10-01T10:45:00Z"),
          },
        },
      },
      include: { report: true },
    });
    cleanupIds.sessions.push(sessionVikram1.id);
    if (sessionVikram1.report) cleanupIds.reports.push(sessionVikram1.report.id);

    console.log("   -> All test fixtures created.\n");

    const tokenAlpha = generateToken({
      userId: facultyAlphaUser.id,
      role: "college_faculty",
      collegeId: collegeAlpha.id,
      isMainFaculty: true,
      permissions: ["REPORT_VIEW", "REPORT_EXPORT"],
    });

    const tokenRestricted = generateToken({
      userId: facultyRestrictedUser.id,
      role: "college_faculty",
      collegeId: collegeAlpha.id,
      isMainFaculty: false,
      permissions: ["REPORT_VIEW", "REPORT_EXPORT"],
    });

    const tokenBeta = generateToken({
      userId: facultyBetaUser.id,
      role: "college_faculty",
      collegeId: collegeBeta.id,
      isMainFaculty: true,
      permissions: ["REPORT_VIEW", "REPORT_EXPORT"],
    });

    const retryFetch = async <T>(fn: () => Promise<T>): Promise<T> => {
      let attempts = 4;
      let lastErr: any;
      while (attempts > 0) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          attempts--;
          if (attempts > 0) await new Promise((r) => setTimeout(r, 1200));
        }
      }
      throw lastErr;
    };

    const fetchListing = async (query: string, token = tokenAlpha) => {
      return retryFetch(async () => {
        const res = await fetch(`${baseUrl}/api/enterprise/reports?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status >= 500) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        return { status: res.status, body: data };
      });
    };

    const fetchExportCsv = async (query: string, token = tokenAlpha) => {
      return retryFetch(async () => {
        const res = await fetch(`${baseUrl}/api/enterprise/reports/export?format=csv&${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status >= 500) {
          throw new Error(`Server returned ${res.status}`);
        }
        const text = await res.text();
        return { status: res.status, rows: parseCsv(text), raw: text };
      });
    };

    const fetchExportXlsx = async (query: string, token = tokenAlpha) => {
      return retryFetch(async () => {
        const res = await fetch(`${baseUrl}/api/enterprise/reports/export?format=xlsx&${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status >= 500) {
          throw new Error(`Server returned ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet);
        return { status: res.status, rows };
      });
    };

    // ---------------------------------------------------------------------------
    // TEST 1: CORE REGRESSION - SEARCH "Engineer" MATCHES TARGET ROLE
    // ---------------------------------------------------------------------------
    console.log("-------------------------------------------------------------------------------");
    console.log("  [TEST 1] SEARCH 'Engineer' (TARGET ROLE MATCH WITHOUT STUDENT IDENTITY MATCH)");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=Engineer");
      check(listRes.status === 200, "1.1 Listing endpoint returns 200 for search 'Engineer'");
      const listReportIds = (listRes.body.reports as any[]).map((r) => r.id);

      check(
        listReportIds.includes(sessionRahul1.report!.id) &&
          listReportIds.includes(sessionPriya1.report!.id) &&
          !listReportIds.includes(sessionAnita1.report!.id),
        "1.2 Listing includes Software Engineer (Rahul) and DevOps Engineer (Priya), excludes Product Manager (Anita)"
      );

      const csvRes = await fetchExportCsv("search=Engineer");
      check(csvRes.status === 200, "1.3 Export CSV endpoint returns 200 for search 'Engineer'");
      const csvReportIds = csvRes.rows.map((r) => r["Report ID"]);

      check(
        csvReportIds.includes(sessionRahul1.report!.id),
        "1.4 Export CSV includes Rahul Sharma's report despite student name/email not matching 'Engineer'"
      );
      check(
        csvReportIds.includes(sessionPriya1.report!.id),
        "1.5 Export CSV includes Priya Patel's report"
      );
      check(
        !csvReportIds.includes(sessionAnita1.report!.id),
        "1.6 Export CSV excludes Anita Desai (Product Manager)"
      );

      // Verify report ID parity between listing and export
      const sortedListingIds = [...listReportIds].sort();
      const sortedCsvIds = [...csvReportIds].sort();
      check(
        JSON.stringify(sortedListingIds) === JSON.stringify(sortedCsvIds),
        "1.7 Exact ID parity: complete set of report IDs match between listing and export for 'Engineer'"
      );

      // Test XLSX parity as well
      const xlsxRes = await fetchExportXlsx("search=Engineer");
      check(xlsxRes.status === 200, "1.8 Export XLSX endpoint returns 200 for search 'Engineer'");
      const xlsxReportIds = xlsxRes.rows.map((r) => r["Report ID"]);
      check(
        JSON.stringify(sortedListingIds) === JSON.stringify([...xlsxReportIds].sort()),
        "1.9 Exact ID parity in XLSX export as well"
      );
    }

    // ---------------------------------------------------------------------------
    // TEST 2: SEARCH STUDENT NAME ("Rahul")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 2] SEARCH BY STUDENT NAME ('Rahul')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=Rahul");
      const csvRes = await fetchExportCsv("search=Rahul");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(listIds.length === 1 && listIds[0] === sessionRahul1.report!.id, "2.1 Listing returns only Rahul");
      check(csvIds.length === 1 && csvIds[0] === sessionRahul1.report!.id, "2.2 Export CSV returns only Rahul");
      check(JSON.stringify(listIds) === JSON.stringify(csvIds), "2.3 Exact ID parity for student name search");
    }

    // ---------------------------------------------------------------------------
    // TEST 3: SEARCH STUDENT EMAIL ("priya")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 3] SEARCH BY STUDENT EMAIL ('priya')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing(`search=priya-${ts}`);
      const csvRes = await fetchExportCsv(`search=priya-${ts}`);
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(listIds.length === 1 && listIds[0] === sessionPriya1.report!.id, "3.1 Listing returns only Priya");
      check(csvIds.length === 1 && csvIds[0] === sessionPriya1.report!.id, "3.2 Export CSV returns only Priya");
    }

    // ---------------------------------------------------------------------------
    // TEST 4: SEARCH ENROLLMENT NUMBER ("ENR-ANITA")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 4] SEARCH BY ENROLLMENT NUMBER ('ENR-ANITA')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing(`search=ENR-ANITA-${ts}`);
      const csvRes = await fetchExportCsv(`search=ENR-ANITA-${ts}`);
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(listIds.length === 1 && listIds[0] === sessionAnita1.report!.id, "4.1 Listing returns only Anita");
      check(csvIds.length === 1 && csvIds[0] === sessionAnita1.report!.id, "4.2 Export CSV returns only Anita");
    }

    // ---------------------------------------------------------------------------
    // TEST 5: SEARCH REPORT-SPECIFIC FIELD (INTERVIEW TYPE / STYLE: "behavioral")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 5] SEARCH BY REPORT-SPECIFIC FIELD (INTERVIEW STYLE: 'behavioral')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=behavioral");
      const csvRes = await fetchExportCsv("search=behavioral");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(listIds.includes(sessionAnita1.report!.id), "5.1 Listing matches Anita's behavioral interview");
      check(csvIds.includes(sessionAnita1.report!.id), "5.2 Export matches Anita's behavioral interview");
      check(JSON.stringify(listIds.sort()) === JSON.stringify(csvIds.sort()), "5.3 Parity for report interview style search");
    }

    // ---------------------------------------------------------------------------
    // TEST 6: SEARCH WITH NO MATCHES
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 6] SEARCH WITH NO MATCHES ('NonExistentQueryXYZ')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=NonExistentQueryXYZ");
      const csvRes = await fetchExportCsv("search=NonExistentQueryXYZ");
      const xlsxRes = await fetchExportXlsx("search=NonExistentQueryXYZ");

      check(listRes.body.reports.length === 0, "6.1 Listing returns 0 reports for non-matching query");
      check(csvRes.rows.length === 0, "6.2 Export CSV returns 0 data rows");
      check(csvRes.raw.includes("Report ID"), "6.3 Export CSV includes default header row");
      check(xlsxRes.rows.length === 0, "6.4 Export XLSX returns 0 data rows");
    }

    // ---------------------------------------------------------------------------
    // TEST 7: EMPTY SEARCH & WHITESPACE-ONLY SEARCH
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 7] EMPTY SEARCH & WHITESPACE-ONLY SEARCH");
    console.log("-------------------------------------------------------------------------------");
    {
      const listEmpty = await fetchListing("search=");
      const csvEmpty = await fetchExportCsv("search=");
      const listWhitespace = await fetchListing("search=%20%20%20");
      const csvWhitespace = await fetchExportCsv("search=%20%20%20");

      check(listEmpty.body.reports.length === 3, "7.1 Empty search returns all 3 College Alpha reports");
      check(csvEmpty.rows.length === 3, "7.2 Export CSV returns all 3 College Alpha reports");
      check(listWhitespace.body.reports.length === 3, "7.3 Whitespace-only search returns all 3 reports");
      check(csvWhitespace.rows.length === 3, "7.4 Export CSV with whitespace returns all 3 reports");
    }

    // ---------------------------------------------------------------------------
    // TEST 8: CASE-INSENSITIVE MATCHING ("eNgInEeR")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 8] CASE-INSENSITIVE SEARCH ('eNgInEeR')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=eNgInEeR");
      const csvRes = await fetchExportCsv("search=eNgInEeR");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id).sort();
      const csvIds = csvRes.rows.map((r) => r["Report ID"]).sort();

      check(listIds.length === 2, "8.1 Case-insensitive listing matches both engineers");
      check(csvIds.length === 2, "8.2 Case-insensitive export matches both engineers");
      check(JSON.stringify(listIds) === JSON.stringify(csvIds), "8.3 Case-insensitive search parity");
    }

    // ---------------------------------------------------------------------------
    // TEST 9: SEARCH WITH EXTRA SPACES ("   Engineer   ")
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 9] SEARCH WITH SURROUNDING WHITESPACE ('   Engineer   ')");
    console.log("-------------------------------------------------------------------------------");
    {
      const listRes = await fetchListing("search=%20%20%20Engineer%20%20%20");
      const csvRes = await fetchExportCsv("search=%20%20%20Engineer%20%20%20");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id).sort();
      const csvIds = csvRes.rows.map((r) => r["Report ID"]).sort();

      check(listIds.length === 2, "9.1 Trimmed search matches 2 reports in listing");
      check(csvIds.length === 2, "9.2 Trimmed search matches 2 reports in export");
      check(JSON.stringify(listIds) === JSON.stringify(csvIds), "9.3 Surrounding whitespace normalization parity");
    }

    // ---------------------------------------------------------------------------
    // TEST 10: SEARCH COMBINED WITH DATE FILTERS
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 10] SEARCH COMBINED WITH DATE FILTERS");
    console.log("-------------------------------------------------------------------------------");
    {
      // Rahul session is 2026-10-01, Priya session is 2026-10-03
      const listRes = await fetchListing("search=Engineer&startDate=2026-10-02T00:00:00Z");
      const csvRes = await fetchExportCsv("search=Engineer&startDate=2026-10-02T00:00:00Z");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(
        listIds.length === 1 && listIds[0] === sessionPriya1.report!.id,
        "10.1 Date filter combined with search excludes Rahul (prior date) in listing"
      );
      check(
        csvIds.length === 1 && csvIds[0] === sessionPriya1.report!.id,
        "10.2 Date filter combined with search excludes Rahul in export CSV"
      );
      check(JSON.stringify(listIds) === JSON.stringify(csvIds), "10.3 Search + Date filter exact parity");
    }

    // ---------------------------------------------------------------------------
    // TEST 11: SEARCH COMBINED WITH COHORT FILTERS (SECTION A)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 11] SEARCH COMBINED WITH COHORT FILTER (section=A)");
    console.log("-------------------------------------------------------------------------------");
    {
      // Both Rahul and Priya match "Engineer", but Rahul is Section A and Priya is Section B
      const listRes = await fetchListing("search=Engineer&section=A");
      const csvRes = await fetchExportCsv("search=Engineer&section=A");
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(
        listIds.length === 1 && listIds[0] === sessionRahul1.report!.id,
        "11.1 Section filter combined with search returns only Rahul in listing"
      );
      check(
        csvIds.length === 1 && csvIds[0] === sessionRahul1.report!.id,
        "11.2 Section filter combined with search returns only Rahul in export"
      );
      check(JSON.stringify(listIds) === JSON.stringify(csvIds), "11.3 Search + Cohort filter parity");
    }

    // ---------------------------------------------------------------------------
    // TEST 12: MULTIPLE PAGES OF MATCHING REPORTS (EXPORT INCLUDES ALL MATCHING)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 12] PAGINATION ISOLATION (EXPORT INCLUDES ALL MATCHES ACROSS PAGES)");
    console.log("-------------------------------------------------------------------------------");
    {
      // Listing with limit=1 returns only 1 row on page 1, with total=2
      const listPage1 = await fetchListing("search=Engineer&page=1&limit=1");
      check(
        listPage1.body.reports.length === 1 && listPage1.body.total === 2,
        "12.1 Listing page 1 has 1 item, total is 2"
      );

      // Export does not paginate: it exports all authorized matching records
      const csvRes = await fetchExportCsv("search=Engineer");
      check(
        csvRes.rows.length === 2,
        "12.2 Export contains all 2 matching reports across pages (not truncated to 1 page)"
      );
    }

    // ---------------------------------------------------------------------------
    // TEST 13: FACULTY WITH RESTRICTED SCOPE (FACULTY ONLY SEES ASSIGNED COHORT)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 13] RESTRICTED FACULTY SCOPE (SECTION B ONLY)");
    console.log("-------------------------------------------------------------------------------");
    {
      // Restricted faculty is scoped to Section B only (Priya)
      const listRes = await fetchListing("search=Engineer", tokenRestricted);
      const csvRes = await fetchExportCsv("search=Engineer", tokenRestricted);
      const listIds = (listRes.body.reports as any[]).map((r) => r.id);
      const csvIds = csvRes.rows.map((r) => r["Report ID"]);

      check(
        listIds.length === 1 && listIds[0] === sessionPriya1.report!.id,
        "13.1 Restricted faculty listing only returns Section B report (Priya)"
      );
      check(
        csvIds.length === 1 && csvIds[0] === sessionPriya1.report!.id,
        "13.2 Restricted faculty export only returns Section B report (Priya)"
      );
      check(
        !csvIds.includes(sessionRahul1.report!.id),
        "13.3 Restricted faculty cannot export Section A report (Rahul)"
      );
    }

    // ---------------------------------------------------------------------------
    // TEST 14: CROSS-INSTITUTION ACCESS ATTEMPT (TENANT ISOLATION)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 14] TENANT ISOLATION (COLLEGE ALPHA VS COLLEGE BETA)");
    console.log("-------------------------------------------------------------------------------");
    {
      // College Alpha faculty exports reports searching "Software Engineer"
      const alphaCsv = await fetchExportCsv("search=Software%20Engineer", tokenAlpha);
      const alphaIds = alphaCsv.rows.map((r) => r["Report ID"]);

      check(
        alphaIds.includes(sessionRahul1.report!.id),
        "14.1 College Alpha faculty exports Rahul's Software Engineer report"
      );
      check(
        !alphaIds.includes(sessionVikram1.report!.id),
        "14.2 College Alpha faculty CANNOT export College Beta's Software Engineer report (Vikram)"
      );

      // College Beta faculty exports reports searching "Software Engineer"
      const betaCsv = await fetchExportCsv("search=Software%20Engineer", tokenBeta);
      const betaIds = betaCsv.rows.map((r) => r["Report ID"]);

      check(
        betaIds.includes(sessionVikram1.report!.id),
        "14.3 College Beta faculty exports Vikram's Software Engineer report"
      );
      check(
        !betaIds.includes(sessionRahul1.report!.id),
        "14.4 College Beta faculty CANNOT export College Alpha's Software Engineer report (Rahul)"
      );
    }

    // ---------------------------------------------------------------------------
    // TEST 15: MALICIOUS SEARCH INPUT (SQL INJECTION & SCOPE BYPASS DEFENSE)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 15] MALICIOUS SEARCH INPUT HANDLING");
    console.log("-------------------------------------------------------------------------------");
    {
      const sqliSearch = encodeURIComponent("' OR '1'='1' --");
      const listRes = await fetchListing(`search=${sqliSearch}`);
      const csvRes = await fetchExportCsv(`search=${sqliSearch}`);

      check(listRes.status === 200, "15.1 Malicious search returns 200 without SQL crash");
      check(csvRes.status === 200, "15.2 Malicious search in export returns 200 without SQL crash");
      check(listRes.body.reports.length === 0, "15.3 SQL injection attempt returns 0 results");
      check(csvRes.rows.length === 0, "15.4 Export returns 0 rows, no unauthorized data leaked");
    }

    // ---------------------------------------------------------------------------
    // TEST 16: DATA INTEGRITY & SANITIZATION OF EXPORTED FIELDS
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("  [TEST 16] EXPORT DATA ACCURACY & SPREADSHEET HEADERS");
    console.log("-------------------------------------------------------------------------------");
    {
      const csvRes = await fetchExportCsv("search=Rahul");
      const row = csvRes.rows[0];

      check(row["Student Name"] === "Rahul Sharma", "16.1 Student Name correctly exported");
      check(row["Email"] === `rahul-${ts}@example.com`, "16.2 Email correctly exported");
      check(row["Target Role"] === "Software Engineer", "16.3 Target Role correctly exported");
      check(row["Difficulty"] === "hard", "16.4 Difficulty correctly exported");
      check(row["Overall Score (%)"] === "85", "16.5 Overall Score correctly exported as canonical score");
      check(row["Readiness Rating"] === "Job-Ready", "16.6 Readiness Rating correctly evaluated as Job-Ready");
      check(row["Speaking Pace (WPM)"] === "140", "16.7 Speaking Pace accurately preserved");
      check(row["Filler Words"] === "2", "16.8 Filler Words accurately preserved");
    }
  } finally {
    console.log("\n-> 99. Cleaning up fixtures and closing test server...");
    server.close();

    // Clean up created entities
    try {
      if (cleanupIds.reports.length > 0) {
        await prisma.interviewReport.deleteMany({ where: { id: { in: cleanupIds.reports } } });
      }
      if (cleanupIds.sessions.length > 0) {
        await prisma.interviewSession.deleteMany({ where: { id: { in: cleanupIds.sessions } } });
      }
      if (cleanupIds.resumes.length > 0) {
        await prisma.resume.deleteMany({ where: { id: { in: cleanupIds.resumes } } });
      }
      if (cleanupIds.students.length > 0) {
        await prisma.collegeStudent.deleteMany({ where: { id: { in: cleanupIds.students } } });
      }
      await prisma.collegeFaculty.deleteMany({ where: { collegeId: { in: cleanupIds.colleges } } });
      if (cleanupIds.users.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } });
      }
      if (cleanupIds.colleges.length > 0) {
        await prisma.college.deleteMany({ where: { id: { in: cleanupIds.colleges } } });
      }
      console.log("   -> Cleanup completed successfully.");
    } catch (cleanErr) {
      console.error("Cleanup encountered error:", cleanErr);
    }
  }

  console.log("\n===============================================================================");
  console.log(`  PARITY TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution threw error:", err);
  process.exit(1);
});
