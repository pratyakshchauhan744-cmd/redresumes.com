import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { executeBulkImport } from "../modules/enterprise/routes.js";
import { EmailService } from "../services/email.service.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
const sentEmails: string[] = [];
const originalWelcomeEmail = EmailService.sendStudentWelcomeEmail;
EmailService.sendStudentWelcomeEmail = async ({ to }) => {
  sentEmails.push(to);
  return { success: true, simulated: true };
};

async function fixture(label: string, balance = 100) {
  const passwordHash = await bcrypt.hash("E11-Test-Password!", 4);
  const college = await prisma.college.create({
    data: {
      name: `E11 ${label} ${suffix}`,
      code: `E11-${label}-${suffix}`,
      officialEmail: `e11.${label}.${suffix}@example.com`,
      status: "active",
      creditAccount: {
        create: { totalAllocated: balance, totalDistributed: 0, balance },
      },
    },
  });
  collegeIds.push(college.id);

  const actor = await prisma.user.create({
    data: {
      name: `E11 ${label} Faculty`,
      email: `e11.faculty.${label}.${suffix}@example.com`,
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

  return { college, actor, balance };
}

function row(label: string, initialCredits = 0) {
  return {
    name: `E11 ${label}`,
    email: `e11.${label}.${suffix}@example.com`,
    enrollmentNumber: `E11-${label}-${suffix}`,
    program: "B.Tech",
    course: "Computer Science",
    section: "A",
    batch: "2026",
    initialCredits,
  };
}

async function snapshot(collegeId: string) {
  const account = await prisma.collegeCreditAccount.findUniqueOrThrow({ where: { collegeId } });
  return {
    students: await prisma.collegeStudent.count({ where: { collegeId } }),
    studentUsers: await prisma.user.count({ where: { collegeId, role: "student" } }),
    studentCredits: await prisma.userCredit.count({
      where: { user: { collegeId, role: "student" } },
    }),
    invitations: await prisma.invitation.count({ where: { collegeId, role: "student" } }),
    ledgerEntries: await prisma.collegeCreditTransaction.count({ where: { collegeId } }),
    successAudits: await prisma.enterpriseAuditLog.count({
      where: { collegeId, action: "STUDENTS_BULK_IMPORTED" },
    }),
    balance: account.balance,
    totalDistributed: account.totalDistributed,
  };
}

try {
  {
    const { college, actor } = await fixture("success");
    const emailStart = sentEmails.length;
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("success-1", 2), row("success-2", 2), row("success-3", 2)],
      atomic: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.totalCreated, 3);
    assert.deepEqual(await snapshot(college.id), {
      students: 3,
      studentUsers: 3,
      studentCredits: 3,
      invitations: 3,
      ledgerEntries: 3,
      successAudits: 1,
      balance: 94,
      totalDistributed: 6,
    });
    assert.equal(sentEmails.length - emailStart, 3);
    console.log("PASS successful strict import commits every row, related record, credit mutation, and audit");
  }

  {
    const { college, actor } = await fixture("midway-runtime");
    const before = await snapshot(college.id);
    const emailStart = sentEmails.length;
    const rows = [
      row("midway-1", 10),
      row("midway-2", 10),
      row("midway-3", 10),
      row("midway-4", 10),
    ];
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: rows,
      atomic: true,
      testHooks: {
        afterRowPersisted: (rowNumber) => {
          if (rowNumber === 3) throw new Error("forced unexpected midway failure");
        },
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.totalCreated, 0);
    assert.equal(result.totalFailed, rows.length);
    assert.deepEqual(await snapshot(college.id), before);
    assert.equal(sentEmails.length, emailStart);
    for (const attempted of rows) {
      assert.equal(await prisma.user.count({ where: { email: attempted.email } }), 0);
    }
    console.log("PASS unexpected midway failure rolls back users, profiles, invitations, credits, ledger, and audit");
  }

  {
    const { college, actor } = await fixture("last-row-runtime");
    const before = await snapshot(college.id);
    const emailStart = sentEmails.length;
    const rows = Array.from({ length: 10 }, (_, index) => row(`last-row-${index + 1}`, 1));
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: rows,
      atomic: true,
      testHooks: {
        afterRowPersisted: (rowNumber) => {
          if (rowNumber === 10) throw new Error("forced final-row failure");
        },
      },
    });

    assert.equal(result.success, false);
    assert.deepEqual(await snapshot(college.id), before);
    assert.equal(sentEmails.length, emailStart);
    console.log("PASS failure on the final row rolls back all nine earlier successful row mutations");
  }

  {
    const { college, actor } = await fixture("validation");
    const before = await snapshot(college.id);
    let executionHookCalls = 0;
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("validation-good", 1), { ...row("validation-bad", 1), email: "invalid-email" }],
      atomic: true,
      testHooks: { afterRowPersisted: () => { executionHookCalls += 1; } },
    });

    assert.equal(result.success, false);
    assert.equal(executionHookCalls, 0);
    assert.deepEqual(await snapshot(college.id), before);
    console.log("PASS strict validation failure performs no transactional mutations");
  }

  {
    const { college, actor } = await fixture("non-strict");
    const emailStart = sentEmails.length;
    const result = await executeBulkImport({
      collegeId: college.id,
      actorId: actor.id,
      rawRows: [row("partial-1", 2), row("partial-2", 2), row("partial-3", 2)],
      atomic: false,
      testHooks: {
        afterRowPersisted: (rowNumber) => {
          if (rowNumber === 2) throw new Error("forced isolated row failure");
        },
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.totalCreated, 2);
    assert.equal(result.totalFailed, 1);
    assert.deepEqual(await snapshot(college.id), {
      students: 2,
      studentUsers: 2,
      studentCredits: 2,
      invitations: 2,
      ledgerEntries: 2,
      successAudits: 1,
      balance: 96,
      totalDistributed: 4,
    });
    assert.equal(sentEmails.length - emailStart, 2);
    assert.equal(await prisma.user.count({ where: { email: row("partial-2").email } }), 0);
    console.log("PASS non-strict mode preserves successful rows while the failed row remains internally atomic");
  }

  console.log("E-11 bulk-import transactional atomicity regression suite passed.");
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
