import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { executeBulkImport } from "../modules/enterprise/routes.js";
import { allocateInstitutionCreditsToStudent } from "../modules/enterprise/credit-transfer.js";
import { EmailService } from "../services/email.service.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const originalWelcomeEmail = EmailService.sendStudentWelcomeEmail;
EmailService.sendStudentWelcomeEmail = async () => ({ success: true, simulated: true });

const collegeIds: string[] = [];

function row(label: string, initialCredits: unknown) {
  return {
    name: `E06 Student ${label}`,
    email: `e06.${label}.${suffix}@example.com`,
    enrollmentNumber: `E06-${label}-${suffix}`,
    program: "B.Tech",
    course: "Computer Science",
    section: "A",
    batch: "2026",
    initialCredits,
  };
}

async function fixture(balance: number) {
  const passwordHash = await bcrypt.hash("E06-Test-Password!", 4);
  const college = await prisma.college.create({
    data: {
      name: `E06 College ${collegeIds.length} ${suffix}`,
      code: `E06${Date.now()}${collegeIds.length}`,
      officialEmail: `e06.college.${collegeIds.length}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);
  await prisma.collegeCreditAccount.create({
    data: { collegeId: college.id, totalAllocated: balance, totalDistributed: 0, balance },
  });
  const actor = await prisma.user.create({
    data: {
      name: "E06 Faculty",
      email: `e06.faculty.${collegeIds.length}.${suffix}@example.com`,
      passwordHash,
      role: "college_main_faculty",
      collegeId: college.id,
      isActive: true,
      facultyProfile: {
        create: {
          collegeId: college.id,
          isMainFaculty: true,
          permissions: ["all"],
          status: "active",
        },
      },
    },
  });
  return { college, actor };
}

async function account(collegeId: string) {
  return prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId } });
}

async function allocatedCredits(collegeId: string) {
  const students = await prisma.collegeStudent.findMany({
    where: { collegeId },
    include: { user: { include: { credits: true } } },
  });
  return students.reduce((sum, student) => sum + (student.user.credits?.balance ?? 0), 0);
}

async function assertInvariant(collegeId: string, startingBalance: number) {
  const current = await account(collegeId);
  const studentCredits = await allocatedCredits(collegeId);
  const ledger = await prisma.collegeCreditTransaction.aggregate({
    where: { collegeId, type: "FACULTY_DISTRIBUTION" },
    _sum: { amount: true },
  });
  const debited = startingBalance - current.balance;
  assert.equal(studentCredits, debited, "student credits must equal institutional debit");
  assert.equal(ledger._sum.amount ?? 0, debited, "ledger must equal institutional debit");
  assert.equal(current.totalDistributed, debited, "distributed total must equal institutional debit");
  assert(current.balance >= 0, "institutional balance must never be negative");
}

try {
  {
    const { college, actor } = await fixture(1);
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("sequential-a", 1), row("sequential-b", 1)],
      atomic: false,
    });
    assert.equal(result.totalCreated, 1);
    assert.equal(result.totalFailed, 1);
    assert.match(result.errors[0].reason, /Insufficient college credits/);
    assert.equal(await prisma.collegeStudent.count({ where: { collegeId: college.id } }), 1);
    assert.equal(await prisma.user.count({ where: { email: row("sequential-b", 1).email as string } }), 0);
    assert.equal((await account(college.id)).balance, 0);
    await assertInvariant(college.id, 1);
    console.log("PASS exact E-06 non-strict reproduction funds only one row");
  }

  {
    const { college, actor } = await fixture(2);
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("enough-a", 1), row("enough-b", 1)],
      atomic: false,
    });
    assert.equal(result.totalCreated, 2);
    assert.equal((await account(college.id)).balance, 0);
    const ledgerActors = await prisma.collegeCreditTransaction.findMany({
      where: { collegeId: college.id },
      select: { createdById: true },
    });
    assert(ledgerActors.length > 0);
    assert(ledgerActors.every((transaction) => transaction.createdById === actor.id));
    await assertInvariant(college.id, 2);
    console.log("PASS bulk-import credit ledger entries use the authenticated actor");
  }

  {
    const { college, actor } = await fixture(1);
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("strict-a", 1), row("strict-b", 1)],
      atomic: true,
    });
    assert.equal(result.success, false);
    assert.equal(result.totalCreated, 0);
    assert.equal(await prisma.collegeStudent.count({ where: { collegeId: college.id } }), 0);
    assert.equal((await account(college.id)).balance, 1);
    await assertInvariant(college.id, 1);
    console.log("PASS strict insufficient import creates nothing and debits nothing");
  }

  {
    const { college, actor } = await fixture(5);
    const failedRow = row("creation-failure", 1);
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: failedRow.name,
            email: failedRow.email as string,
            passwordHash: "test-only",
            role: "student",
            collegeId: college.id,
          },
        });
        const profile = await tx.collegeStudent.create({
          data: {
            userId: user.id,
            collegeId: college.id,
            enrollmentNumber: failedRow.enrollmentNumber,
            program: failedRow.program,
            course: failedRow.course,
            section: failedRow.section,
            batch: failedRow.batch,
          },
        });
        await allocateInstitutionCreditsToStudent({
          tx,
          collegeId: college.id,
          studentId: profile.id,
          userId: user.id,
          actorId: actor.id,
          amount: 1,
          type: "FACULTY_DISTRIBUTION",
          reason: "E-06 forced downstream rollback test",
        });
        throw new Error("simulated downstream student-row failure");
      }, { timeout: 30000, maxWait: 15000 }),
      /simulated downstream student-row failure/
    );
    assert.equal((await account(college.id)).balance, 5);
    assert.equal(await prisma.user.count({ where: { email: failedRow.email as string } }), 0);
    await assertInvariant(college.id, 5);
    console.log("PASS downstream creation/ledger failure rolls back debit and student");
  }

  {
    const { college, actor } = await fixture(10);
    const invalidRows = [
      row("invalid-negative", -1),
      row("invalid-nan", Number.NaN),
      row("invalid-infinity", Number.POSITIVE_INFINITY),
      row("invalid-string", "abc"),
      row("invalid-fraction", 1.5),
    ];
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: invalidRows,
      atomic: false,
    });
    assert.equal(result.totalCreated, 0);
    assert.equal(result.totalFailed, invalidRows.length);
    assert(result.errors.every((error) => /finite, non-negative integer/.test(error.reason)));
    assert.equal((await account(college.id)).balance, 10);
    await assertInvariant(college.id, 10);
    console.log("PASS invalid credit values are rejected without accounting mutations");
  }

  {
    const { college, actor } = await fixture(3);
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("zero", 0)],
      atomic: false,
    });
    assert.equal(result.totalCreated, 1);
    assert.equal((await account(college.id)).balance, 3);
    assert.equal(await prisma.collegeCreditTransaction.count({ where: { collegeId: college.id } }), 0);
    await assertInvariant(college.id, 3);
    console.log("PASS zero-credit row creates student without balance or ledger mutation");
  }

  {
    const { college, actor } = await fixture(0);
    EmailService.sendStudentWelcomeEmail = async ({ to }) => ({
      success: !to.includes("delivery-fail"),
      simulated: true,
      error: to.includes("delivery-fail") ? "simulated delivery failure" : undefined,
    });
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("delivery-success", 0), row("delivery-fail", 0)],
      atomic: false,
    });
    assert.equal(result.totalCreated, 2);
    assert.equal(result.emailsSent, 1);
    assert.equal(result.emailsFailed, 1);
    assert.equal(result.createdStudents.filter((student) => student.invitationStatus === "sent").length, 1);
    assert.equal(result.createdStudents.filter((student) => student.invitationStatus === "failed").length, 1);
    EmailService.sendStudentWelcomeEmail = async () => ({ success: true, simulated: true });
    console.log("PASS bulk import reports actual successful and failed email delivery counts");
  }

  {
    const { college, actor } = await fixture(5);
    const duplicate = row("duplicate", 0);
    await executeBulkImport({ collegeId: college.id, actorId: actor.id, rawRows: [duplicate], atomic: false });
    const before = await account(college.id);
    const retried = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [{ ...duplicate, initialCredits: 5 }],
      atomic: false,
    });
    assert.equal(retried.totalCreated, 0);
    assert(retried.totalFailed >= 1);
    assert.equal((await account(college.id)).balance, before.balance);
    assert.equal(await allocatedCredits(college.id), 0);
    console.log("PASS duplicate retry neither debits institution nor changes existing account");
  }

  {
    const { college, actor } = await fixture(1);
    const [left, right] = await Promise.all([
      executeBulkImport({
        collegeId: college.id,
        actorId: actor.id,
        rawRows: [row("concurrent-a", 1)],
        atomic: false,
      }),
      executeBulkImport({
        collegeId: college.id,
        actorId: actor.id,
        rawRows: [row("concurrent-b", 1)],
        atomic: false,
      }),
    ]);
    assert.deepEqual([left.totalCreated, right.totalCreated].sort(), [0, 1]);
    assert.equal((await account(college.id)).balance, 0);
    assert.equal(await allocatedCredits(college.id), 1);
    await assertInvariant(college.id, 1);
    console.log("PASS concurrent one-credit imports produce exactly one funded student");
  }

  console.log("E-06 credit-accounting regression suite passed.");
} finally {
  EmailService.sendStudentWelcomeEmail = originalWelcomeEmail;
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}
