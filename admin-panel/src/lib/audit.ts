import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export interface AuditLogInput {
  actorId: string;
  action: string; // e.g. "ADJUST_CREDITS", "ROLE_CHANGE", "UPDATE_SETTING", "USER_IMPERSONATION"
  targetType?: string; // DB column
  targetId?: string | null; // DB column
  entityType?: string; // Backward compatibility alias
  entityId?: string | null; // Backward compatibility alias
  details?: Record<string, any> | null;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient; // Optional transaction client for atomic logs
}

/**
 * Inserts an entry into the AdminAuditLog table.
 * Supports running within an existing Prisma transaction or utilizing the base prisma client.
 */
export async function logAdminAction(input: AuditLogInput) {
  const db = input.tx || prisma;
  
  const targetType = input.targetType || input.entityType || "General";
  const targetId = input.targetId || input.entityId || null;

  let details: any = input.details || null;
  if (!details && (input.oldValue || input.newValue || input.userAgent)) {
    details = {
      ...(input.oldValue ? { oldValue: input.oldValue } : {}),
      ...(input.newValue ? { newValue: input.newValue } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    };
  }

  try {
    return await db.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType,
        targetId,
        entityType: targetType,
        entityId: targetId,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
        oldValue: input.oldValue ? (input.oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValue: input.newValue ? (input.newValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    // We log but do not crash the request if audit logging fails (unless in a transactional context)
    console.error("Failed to write admin audit log:", error);
    if (input.tx) {
      throw error; // Re-throw if in transaction to force rollback
    }
  }
}
