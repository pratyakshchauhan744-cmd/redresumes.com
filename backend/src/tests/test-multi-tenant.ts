import "dotenv/config";
import { prisma } from "../db/prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signAccessToken, verifyToken } from "../utils/jwt.js";

async function runTests() {
  console.log("================================================================");
  console.log("REDRESUMES ENTERPRISE: MULTI-TENANT ISOLATION & RBAC TEST SUITE");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const testCollegeCode = `TEST_${timestamp.toString().slice(-4)}`;
    const testOfficialEmail = `admin@college-${timestamp}.edu`;
    const facultyEmail = `main.faculty.${timestamp}@college.edu`;
    const studentEmail = `student.${timestamp}@college.edu`;
    const initialCredits = 1000;
    const creditsToAssign = 5;

    console.log("-> 1. Testing Super Admin College Creation & Tenant Initialization...");
    const rawTempPassword = `Rr#${crypto.randomBytes(4).toString("hex")}!9`;
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const created = await prisma.$transaction(async (tx) => {
      const college = await tx.college.create({
        data: {
          name: `Test Institute of Technology ${timestamp}`,
          universityName: "Apex University",
          code: testCollegeCode,
          officialEmail: testOfficialEmail,
          status: "active",
        },
      });

      const creditAccount = await tx.collegeCreditAccount.create({
        data: {
          collegeId: college.id,
          totalAllocated: initialCredits,
          totalDistributed: 0,
          balance: initialCredits,
        },
      });

      const facultyUser = await tx.user.create({
        data: {
          name: "Dr. Main Faculty Admin",
          email: facultyEmail,
          passwordHash,
          role: "college_main_faculty",
          collegeId: college.id,
          isActive: true,
        },
      });

      const facultyProfile = await tx.collegeFaculty.create({
        data: {
          userId: facultyUser.id,
          collegeId: college.id,
          department: "Computer Science & Engineering",
          designation: "Head of Department",
          isMainFaculty: true,
          permissions: [
            "STUDENT_VIEW",
            "STUDENT_CREATE",
            "STUDENT_EDIT",
            "STUDENT_DELETE",
            "FACULTY_VIEW",
            "FACULTY_CREATE",
            "FACULTY_EDIT",
            "REPORT_VIEW",
            "REPORT_EXPORT",
            "INTERVIEW_CREDIT_VIEW",
            "INTERVIEW_CREDIT_ASSIGN",
          ],
          status: "active",
        },
      });

      const invitation = await tx.invitation.create({
        data: {
          collegeId: college.id,
          email: facultyEmail,
          role: "college_main_faculty",
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "pending",
        },
      });

      return { college, creditAccount, facultyUser, facultyProfile, invitation };
    });

    assert(created.college.code === testCollegeCode, "College record created with unique code");
    assert(created.creditAccount.balance === initialCredits, "College credit ledger initialized correctly");
    assert(created.facultyUser.role === "college_main_faculty", "Main faculty role assigned correctly");
    assert(created.facultyProfile.isMainFaculty === true, "Main faculty profile created");

    console.log("\n-> 2. Testing JWT Signing & Enterprise Claims Verification...");
    const accessToken = signAccessToken({
      sub: created.facultyUser.id,
      email: created.facultyUser.email,
      role: created.facultyUser.role,
      collegeId: created.college.id,
      isMainFaculty: true,
      permissions: created.facultyProfile.permissions,
    });

    const verified = verifyToken(accessToken, "access");
    assert(verified.collegeId === created.college.id, "JWT contains verified collegeId");
    assert(verified.isMainFaculty === true, "JWT contains isMainFaculty flag");
    assert(Array.isArray(verified.permissions), "JWT contains permissions array");

    console.log("\n-> 3. Testing Student Onboarding & Invitation...");
    const studentUser = await prisma.user.create({
      data: {
        name: "Test Student John",
        email: studentEmail,
        passwordHash,
        role: "student",
        collegeId: created.college.id,
      },
    });

    const studentProfile = await prisma.collegeStudent.create({
      data: {
        userId: studentUser.id,
        collegeId: created.college.id,
        enrollmentNumber: `ENR_${timestamp.toString().slice(-4)}`,
        program: "B.Tech",
        course: "Computer Science",
        section: "A",
        batch: "2026",
        status: "active",
      },
    });

    assert(studentProfile.collegeId === created.college.id, "Student profile scoped to college tenant");

    console.log("\n-> 4. Testing Atomic College Credit Distribution to Student...");
    const distributionResult = await prisma.$transaction(async (tx) => {
      const updatedAcc = await tx.collegeCreditAccount.update({
        where: { collegeId: created.college.id },
        data: {
          balance: { decrement: creditsToAssign },
          totalDistributed: { increment: creditsToAssign },
        },
      });

      const updatedUserCredit = await tx.userCredit.upsert({
        where: { userId: studentUser.id },
        create: {
          userId: studentUser.id,
          balance: creditsToAssign,
        },
        update: {
          balance: { increment: creditsToAssign },
        },
      });

      const txn = await tx.collegeCreditTransaction.create({
        data: {
          collegeId: created.college.id,
          studentId: studentProfile.id,
          createdById: created.facultyUser.id,
          type: "FACULTY_DISTRIBUTION",
          amount: creditsToAssign,
          balanceAfter: updatedAcc.balance,
          reason: "Placement AI Mock Interview Drive 2026",
        },
      });

      return { updatedAcc, updatedUserCredit, txn };
    });

    assert(
      distributionResult.updatedAcc.balance === initialCredits - creditsToAssign,
      "College credit balance decremented correctly"
    );
    assert(
      distributionResult.updatedUserCredit.balance === creditsToAssign,
      "Student user credit balance incremented correctly"
    );
    assert(
      distributionResult.txn.type === "FACULTY_DISTRIBUTION",
      "Credit transaction ledger entry recorded"
    );

    console.log("\n-> 5. Cleaning up test data...");
    await prisma.collegeCreditTransaction.deleteMany({ where: { collegeId: created.college.id } });
    await prisma.collegeStudent.deleteMany({ where: { collegeId: created.college.id } });
    await prisma.collegeFaculty.deleteMany({ where: { collegeId: created.college.id } });
    await prisma.invitation.deleteMany({ where: { collegeId: created.college.id } });
    await prisma.collegeCreditAccount.deleteMany({ where: { collegeId: created.college.id } });
    await prisma.userCredit.deleteMany({ where: { userId: { in: [created.facultyUser.id, studentUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [created.facultyUser.id, studentUser.id] } } });
    await prisma.college.delete({ where: { id: created.college.id } });

    console.log("-> Cleanup complete.");

    console.log("\n================================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
