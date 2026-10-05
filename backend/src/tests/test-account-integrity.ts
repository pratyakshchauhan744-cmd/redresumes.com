import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";
import { EmailService } from "../services/email.service.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeCode = `E02${Date.now().toString().slice(-8)}`;
const facultyEmail = `Faculty.${suffix}@Example.com`;
const studentEmail = `student.${suffix}@example.com`;
const mainEmail = `main.${suffix}@example.com`;

const testApp = express();
testApp.use(express.json());
testApp.use("/api/enterprise", enterpriseRoutes);
testApp.use(errorHandler);

const server = testApp.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/enterprise`;

const originalStudentEmail = EmailService.sendStudentWelcomeEmail;
const originalFacultyEmail = EmailService.sendFacultyInvitation;
EmailService.sendStudentWelcomeEmail = async () => ({ success: true, simulated: true });
EmailService.sendFacultyInvitation = async () => ({ success: true, simulated: true });

let collegeId: string | undefined;

async function post(path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function studentPayload(email: string, enrollmentNumber: string) {
  return {
    name: "Integrity Student",
    email,
    enrollmentNumber,
    program: "B.Tech",
    course: "Computer Science",
    section: "A",
    batch: "2026",
    initialCredits: 0,
  };
}

function facultyPayload(email: string) {
  return {
    name: "Integrity Faculty",
    email,
    department: "Computer Science",
    designation: "Professor",
    isMainFaculty: false,
    permissions: ["STUDENT_VIEW", "REPORT_VIEW"],
    programAccess: [],
    courseAccess: [],
    sectionAccess: [],
  };
}

try {
  const passwordHash = await bcrypt.hash("KnownPassword123!", 8);
  const setup = await prisma.$transaction(async (tx) => {
    const college = await tx.college.create({
      data: {
        name: `E02 Integrity College ${suffix}`,
        code: collegeCode,
        officialEmail: `college.${suffix}@example.com`,
        status: "active",
      },
    });
    await tx.collegeCreditAccount.create({
      data: { collegeId: college.id, totalAllocated: 100, totalDistributed: 0, balance: 100 },
    });

    const main = await tx.user.create({
      data: {
        name: "Main Faculty",
        email: mainEmail,
        passwordHash,
        role: "college_main_faculty",
        collegeId: college.id,
        isActive: true,
      },
    });
    await tx.collegeFaculty.create({
      data: {
        userId: main.id,
        collegeId: college.id,
        isMainFaculty: true,
        permissions: ["all"],
        status: "active",
      },
    });

    const faculty = await tx.user.create({
      data: {
        name: "Existing Faculty",
        email: facultyEmail,
        passwordHash,
        role: "college_faculty",
        collegeId: college.id,
        isActive: true,
      },
    });
    await tx.collegeFaculty.create({
      data: {
        userId: faculty.id,
        collegeId: college.id,
        isMainFaculty: false,
        permissions: ["FACULTY_EDIT", "REPORT_VIEW"],
        programAccess: ["B.Tech"],
        status: "active",
      },
    });

    const student = await tx.user.create({
      data: {
        name: "Existing Student",
        email: studentEmail,
        passwordHash,
        role: "student",
        collegeId: college.id,
        isActive: true,
      },
    });
    await tx.collegeStudent.create({
      data: {
        userId: student.id,
        collegeId: college.id,
        enrollmentNumber: `EXIST-${suffix}`,
        program: "B.Tech",
        course: "Computer Science",
        section: "A",
        batch: "2026",
        status: "active",
      },
    });

    return { college, main, faculty, student };
  });
  collegeId = setup.college.id;

  const token = signAccessToken({
    sub: setup.main.id,
    email: setup.main.email,
    role: setup.main.role,
    collegeId,
    isMainFaculty: true,
    permissions: ["all"],
  });

  const facultyBefore = await prisma.user.findUniqueOrThrow({
    where: { id: setup.faculty.id },
    include: { facultyProfile: true, studentProfile: true },
  });
  const studentBefore = await prisma.user.findUniqueOrThrow({
    where: { id: setup.student.id },
    include: { facultyProfile: true, studentProfile: true },
  });

  const facultyAsStudent = await post(
    "/students",
    token,
    studentPayload(facultyEmail.toLowerCase(), `F-AS-S-${suffix}`)
  );
  assert.equal(facultyAsStudent.status, 409);

  const studentAsFaculty = await post("/faculty", token, facultyPayload(studentEmail.toUpperCase()));
  assert.equal(studentAsFaculty.status, 409);

  const duplicateStudent = await post(
    "/students",
    token,
    studentPayload(`  ${studentEmail.toUpperCase()}  `, `DUP-S-${suffix}`)
  );
  assert.equal(duplicateStudent.status, 409);

  const duplicateFaculty = await post("/faculty", token, facultyPayload(facultyEmail));
  assert.equal(duplicateFaculty.status, 409);

  const bulkConflict = await post("/students/bulk-import", token, {
    students: [studentPayload(facultyEmail.toLowerCase(), `BULK-DUP-${suffix}`)],
    atomic: false,
    initialCredits: 0,
  });
  assert.equal(bulkConflict.status, 201);
  const bulkConflictBody = await bulkConflict.json() as { totalCreated: number; totalFailed: number };
  assert.equal(bulkConflictBody.totalCreated, 0);
  assert.equal(bulkConflictBody.totalFailed, 1);

  const facultyAfter = await prisma.user.findUniqueOrThrow({
    where: { id: setup.faculty.id },
    include: { facultyProfile: true, studentProfile: true },
  });
  const studentAfter = await prisma.user.findUniqueOrThrow({
    where: { id: setup.student.id },
    include: { facultyProfile: true, studentProfile: true },
  });

  assert.deepEqual(facultyAfter, facultyBefore, "faculty identity/profile changed after rejected creation");
  assert.deepEqual(studentAfter, studentBefore, "student identity/profile changed after rejected creation");
  assert.equal(facultyAfter.studentProfile, null, "conflicting student profile was created for faculty");
  assert.equal(studentAfter.facultyProfile, null, "conflicting faculty profile was created for student");
  console.log("PASS duplicate, cross-role, and bulk attempts preserve existing accounts and profiles");

  const uniqueStudentEmail = `unique.student.${suffix}@example.com`;
  const uniqueStudent = await post(
    "/students",
    token,
    studentPayload(uniqueStudentEmail, `UNIQUE-S-${suffix}`)
  );
  assert.equal(uniqueStudent.status, 201);

  const uniqueFacultyEmail = `unique.faculty.${suffix}@example.com`;
  const uniqueFaculty = await post("/faculty", token, facultyPayload(uniqueFacultyEmail));
  assert.equal(uniqueFaculty.status, 201);
  console.log("PASS unique student and faculty identities are created successfully");

  const concurrentEmail = `concurrent.${suffix}@example.com`;
  const concurrentResponses = await Promise.all([
    post("/students", token, studentPayload(concurrentEmail, `CON-A-${suffix}`)),
    post("/students", token, studentPayload(concurrentEmail.toUpperCase(), `CON-B-${suffix}`)),
  ]);
  assert.deepEqual(concurrentResponses.map((response) => response.status).sort(), [201, 409]);

  const concurrentUsers = await prisma.user.findMany({
    where: { email: { equals: concurrentEmail, mode: "insensitive" } },
    include: { studentProfile: true, facultyProfile: true },
  });
  assert.equal(concurrentUsers.length, 1);
  assert(concurrentUsers[0].studentProfile);
  assert.equal(concurrentUsers[0].facultyProfile, null);
  console.log("PASS concurrent normalized-email creation yields one identity and one conflict");
} finally {
  EmailService.sendStudentWelcomeEmail = originalStudentEmail;
  EmailService.sendFacultyInvitation = originalFacultyEmail;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

  if (collegeId) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}

console.log("\nAccount-integrity regression suite passed.");
