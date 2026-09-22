import { prisma } from "../db/prisma.js";

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
}

/**
 * Logs an administrative, credit, or data modification action to the enterprise audit ledger.
 */
export async function logEnterpriseAudit(params: LogEnterpriseAuditParams) {
  try {
    return await prisma.enterpriseAuditLog.create({
      data: {
        collegeId: params.collegeId || undefined,
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: params.oldValue ? (typeof params.oldValue === "object" ? params.oldValue : { value: params.oldValue }) : undefined,
        newValue: params.newValue ? (typeof params.newValue === "object" ? params.newValue : { value: params.newValue }) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write enterprise audit log:", error);
    return null;
  }
}
