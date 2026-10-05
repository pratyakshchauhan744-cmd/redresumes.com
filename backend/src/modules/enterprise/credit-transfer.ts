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
