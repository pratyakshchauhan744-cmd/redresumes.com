import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export class CreditIdempotencyError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

export function requireCreditIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CreditIdempotencyError(400, "Idempotency-Key is required and must be a UUID v4.");
  }
  return value.toLowerCase();
}

export function parseOptionalIdempotencyKey(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CreditIdempotencyError(400, "Idempotency-Key must be a valid UUID v4.");
  }
  return value.toLowerCase();
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, canonical(v)])
  );
  return value;
}

export function creditPayloadHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
}

/** PostgreSQL INSERT ON CONFLICT waits on an uncommitted competing claim.
 * READ COMMITTED then reads its committed receipt. A rollback removes the claim,
 * allowing the waiting insert to win. Never commit a PROCESSING record separately.
 */
export async function executeIdempotentCreditOperation(
  db: PrismaClient,
  scope: { collegeId: string; actorId: string; operation: string; key: string },
  payload: unknown,
  execute: (tx: Prisma.TransactionClient) => Promise<Prisma.InputJsonObject>,
) {
  const payloadHash = creditPayloadHash(payload);
  try {
    return await db.$transaction(async (tx) => {
      const claim = await tx.creditIdempotencyRecord.createMany({
        data: { ...scope, payloadHash }, skipDuplicates: true,
      });
      const record = await tx.creditIdempotencyRecord.findUniqueOrThrow({
        where: { collegeId_actorId_operation_key: scope },
      });
      if (record.payloadHash !== payloadHash) {
        throw new CreditIdempotencyError(409, "Idempotency key was already used with a different credit request.");
      }
      if (claim.count === 0) {
        if (record.status !== "COMPLETED" || !record.responseBody || !record.responseStatus) {
          throw new CreditIdempotencyError(503, "Credit operation is processing. Retry with the same Idempotency-Key.");
        }
        return { status: record.responseStatus, body: record.responseBody };
      }
      const body = await execute(tx);
      await tx.creditIdempotencyRecord.update({
        where: { id: record.id },
        data: { status: "COMPLETED", responseStatus: 200, responseBody: body, completedAt: new Date() },
      });
      return { status: 200, body };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 20000, timeout: 60000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientUnknownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientValidationError) {
      // Log only a classification: Prisma messages can contain financial request data.
      console.error("Enterprise credit transaction failed", {
        operation: scope.operation,
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error.name,
      });
      throw new CreditIdempotencyError(503, "Credit operation could not finish. Retry with the same Idempotency-Key.");
    }
    throw error;
  }
}
