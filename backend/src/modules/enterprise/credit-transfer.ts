import type { Prisma } from "@prisma/client";

export class InsufficientInstitutionCreditsError extends Error {
  readonly available: number;
  readonly requested: number;

  constructor(requested: number, available: number) {
    super(`Insufficient college credits. Required: ${requested}, Available: ${available}`);
    this.name = "InsufficientInstitutionCreditsError";
    this.requested = requested;
    this.available = available;
  }
}

export function assertValidCreditAmount(amount: unknown, field = "initialCredits"): asserts amount is number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
    throw new Error(`${field} must be a finite, non-negative integer.`);
  }
}

/**
 * Atomically transfers institution credits to one student inside the caller's
 * transaction. The conditional UPDATE is the concurrency boundary: PostgreSQL
 * re-checks the balance predicate after waiting for a concurrent row update.
 */
export async function allocateInstitutionCreditsToStudent({
  tx,
  collegeId,
  studentId,
  userId,
  actorId,
  amount,
  type,
  reason,
  batchFilter,
}: {
  tx: Prisma.TransactionClient;
  collegeId: string;
  studentId: string;
  userId: string;
  actorId: string;
  amount: number;
  type: string;
  reason: string;
  batchFilter?: Prisma.InputJsonValue;
}) {
  assertValidCreditAmount(amount, "Credit amount");
  if (amount === 0) return null;

  const debit = await tx.collegeCreditAccount.updateMany({
    where: {
      collegeId,
      balance: { gte: amount },
    },
    data: {
      balance: { decrement: amount },
      totalDistributed: { increment: amount },
    },
  });

  if (debit.count !== 1) {
    const account = await tx.collegeCreditAccount.findUnique({
      where: { collegeId },
      select: { balance: true },
    });
    throw new InsufficientInstitutionCreditsError(amount, account?.balance ?? 0);
  }

  const account = await tx.collegeCreditAccount.findUniqueOrThrow({
    where: { collegeId },
    select: { balance: true },
  });

  const studentCredit = await tx.userCredit.upsert({
    where: { userId },
    create: { userId, balance: amount },
    update: { balance: { increment: amount } },
  });

  const transaction = await tx.collegeCreditTransaction.create({
    data: {
      collegeId,
      studentId,
      createdById: actorId,
      type,
      amount,
      balanceAfter: account.balance,
      reason,
      batchFilter,
    },
  });

  return { account, studentCredit, transaction };
}

/**
 * Atomically transfers institution credits to multiple students inside the caller's
 * transaction using efficient set-based bulk operations.
 *
 * Concurrency & Invariants:
 * 1. Single conditional UPDATE decrements institution balance by (students.length * amountPerStudent)
 *    and increments totalDistributed in one round trip. PostgreSQL re-checks the balance predicate
 *    upon acquiring the row lock, preventing over-allocation under concurrent requests.
 * 2. In chunks of 1,000 students (bounded parameter limits):
 *    a. Pre-creates missing UserCredit records with balance 0 using createMany(skipDuplicates: true).
 *    b. Atomically increments student balances using updateMany(balance: { increment: amountPerStudent }).
 *    c. Bulk inserts CollegeCreditTransaction ledger records with exact running balanceAfter.
 * 3. Atomic: All recipients funded or transaction rolls back completely (raising InsufficientInstitutionCreditsError).
 */
export async function allocateInstitutionCreditsToStudentsBulk({
  tx,
  collegeId,
  students,
  actorId,
  amountPerStudent,
  type = "FACULTY_DISTRIBUTION",
  reason,
  batchFilter,
}: {
  tx: Prisma.TransactionClient;
  collegeId: string;
  students: Array<{ id: string; userId: string }>;
  actorId: string;
  amountPerStudent: number;
  type?: string;
  reason: string;
  batchFilter?: Prisma.InputJsonValue;
}) {
  assertValidCreditAmount(amountPerStudent, "Credit amount");
  if (amountPerStudent === 0 || students.length === 0) {
    const currentAccount = await tx.collegeCreditAccount.findUniqueOrThrow({
      where: { collegeId },
      select: { balance: true },
    });
    return {
      account: currentAccount,
      totalCreditsDistributed: 0,
      distributedCount: 0,
    };
  }

  const totalRequired = students.length * amountPerStudent;

  // 1. Single conditional atomic debit on institutional balance
  const debit = await tx.collegeCreditAccount.updateMany({
    where: {
      collegeId,
      balance: { gte: totalRequired },
    },
    data: {
      balance: { decrement: totalRequired },
      totalDistributed: { increment: totalRequired },
    },
  });

  if (debit.count !== 1) {
    const account = await tx.collegeCreditAccount.findUnique({
      where: { collegeId },
      select: { balance: true },
    });
    throw new InsufficientInstitutionCreditsError(totalRequired, account?.balance ?? 0);
  }

  const account = await tx.collegeCreditAccount.findUniqueOrThrow({
    where: { collegeId },
    select: { balance: true },
  });

  const startingBalance = account.balance + totalRequired;
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const chunkUserIds = chunk.map((s) => s.userId);

    // 2. Ensure userCredit records exist for all recipients
    await tx.userCredit.createMany({
      data: chunkUserIds.map((userId) => ({ userId, balance: 0 })),
      skipDuplicates: true,
    });

    // 3. Atomically increment student balances in bulk
    await tx.userCredit.updateMany({
      where: { userId: { in: chunkUserIds } },
      data: { balance: { increment: amountPerStudent } },
    });

    // 4. Bulk insert ledger transaction rows with exact sequential balanceAfter
    const ledgerChunk = chunk.map((student, chunkIdx) => {
      const overallIdx = i + chunkIdx;
      return {
        collegeId,
        studentId: student.id,
        createdById: actorId,
        type,
        amount: amountPerStudent,
        balanceAfter: startingBalance - (overallIdx + 1) * amountPerStudent,
        reason,
        batchFilter: batchFilter as Prisma.InputJsonValue | undefined,
      };
    });

    await tx.collegeCreditTransaction.createMany({
      data: ledgerChunk,
    });
  }

  return {
    account,
    totalCreditsDistributed: totalRequired,
    distributedCount: students.length,
  };
}

