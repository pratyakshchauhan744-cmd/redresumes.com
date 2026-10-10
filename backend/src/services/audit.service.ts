import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";
import { sanitizeAuditValue } from "../utils/audit-sanitization.js";

export interface LogEnterpriseAuditParams {
  collegeId?: string | null;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: any;
  transactionClient?: Prisma.TransactionClient;
  propagateErrors?: boolean;
}

/**
 * Logs an administrative, credit, or data modification action to the enterprise audit ledger.
 */
export async function logEnterpriseAudit(params: LogEnterpriseAuditParams) {
  try {
    const client = params.transactionClient ?? prisma;
    return await client.enterpriseAuditLog.create({
      data: {
        collegeId: params.collegeId || undefined,
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: params.oldValue ? sanitizeAuditValue(
          typeof params.oldValue === "object" ? params.oldValue : { value: params.oldValue }
        ) as Prisma.InputJsonValue : undefined,
        newValue: params.newValue ? sanitizeAuditValue(
          typeof params.newValue === "object" ? params.newValue : { value: params.newValue }
        ) as Prisma.InputJsonValue : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata
          ? sanitizeAuditValue(params.metadata) as Prisma.InputJsonValue
          : undefined,
      },
    });
  } catch (error) {
    // Atomic callers handle failures; do not log Prisma errors containing audit payloads.
    if (params.propagateErrors) throw error;
    console.error("Failed to write enterprise audit log:", error);
    return null;
  }
}
