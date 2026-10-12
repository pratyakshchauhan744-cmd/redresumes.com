export const ENTERPRISE_AUDIT_ACTIONS = {
  FACULTY_CREATED: "FACULTY_CREATED",
  FACULTY_UPDATED: "FACULTY_UPDATED",
  FACULTY_DEACTIVATED: "FACULTY_DEACTIVATED",
  FACULTY_INVITATION_RESENT: "FACULTY_INVITATION_RESENT",
  STUDENT_CREATED: "STUDENT_CREATED",
  STUDENT_UPDATED: "STUDENT_UPDATED",
  STUDENT_DEACTIVATED: "STUDENT_DEACTIVATED",
  STUDENTS_BULK_IMPORTED: "STUDENTS_BULK_IMPORTED",
  STUDENT_CREDITS_ASSIGNED: "STUDENT_CREDITS_ASSIGNED",
  BULK_CREDITS_DISTRIBUTED: "BULK_CREDITS_DISTRIBUTED",
  CREDITS_ALLOCATED: "CREDITS_ALLOCATED",
  REPORTS_EXPORTED: "REPORTS_EXPORTED",
  COLLEGE_CREATED: "COLLEGE_CREATED",
  COLLEGE_UPDATED: "COLLEGE_UPDATED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  STUDENT_PASSWORD_SETUP_SENT: "STUDENT_PASSWORD_SETUP_SENT",
  STUDENT_PASSWORD_SETUP_DELIVERY_FAILED: "STUDENT_PASSWORD_SETUP_DELIVERY_FAILED",
} as const;

export type EnterpriseAuditAction =
  typeof ENTERPRISE_AUDIT_ACTIONS[keyof typeof ENTERPRISE_AUDIT_ACTIONS];

/**
 * Historical / legacy action aliases to ensure backward compatibility
 * for saved URLs or external integrations.
 */
export const ENTERPRISE_AUDIT_ACTION_ALIASES: Record<string, EnterpriseAuditAction> = {
  STUDENTS_IMPORTED: ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED,
  CREDITS_DISTRIBUTED: ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED,
  FACULTY_INVITED: ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED,
};

export function resolveCanonicalAuditAction(
  action: string | undefined | null
): string | undefined {
  if (!action) return undefined;
  const trimmed = action.trim();
  if (!trimmed) return undefined;
  if (trimmed in ENTERPRISE_AUDIT_ACTION_ALIASES) {
    return ENTERPRISE_AUDIT_ACTION_ALIASES[trimmed];
  }
  return trimmed;
}

export interface EnterpriseAuditActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface EnterpriseAuditLog {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  actor: EnterpriseAuditActor | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface EnterpriseAuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EnterpriseAuditLogsResponse {
  success: boolean;
  logs: EnterpriseAuditLog[];
  pagination: EnterpriseAuditPagination;
}
