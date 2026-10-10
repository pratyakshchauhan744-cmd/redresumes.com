import { isLocalAccessToken } from "../lib/auth";

export interface EnterpriseTabPermissions {
  canViewStudents: boolean;
  canViewFaculty: boolean;
  canViewCredits: boolean;
  canViewReports: boolean;
  canViewAuditLogs: boolean;
}

export interface EnterpriseLoadingStates {
  statsLoading: boolean;
  filterOptionsLoading: boolean;
  studentsLoading: boolean;
  facultyLoading: boolean;
  creditsLoading: boolean;
  reportsLoading: boolean;
  reportSummaryLoading: boolean;
  auditLoading: boolean;
}

/**
 * Checks if a session token indicates an offline, demo, or unauthenticated session.
 */
export const isOfflineOrDemoToken = (token?: string | null): boolean => {
  return !token || isLocalAccessToken(token);
};

/**
 * Returns initial loading states for the enterprise dashboard.
 * In offline/demo mode, loading is settled immediately (all false).
 * In online mode, tabs initialize to loading true only if the user has permission.
 */
export const getInitialLoadingStates = (
  token: string | null | undefined,
  permissions: EnterpriseTabPermissions
): EnterpriseLoadingStates => {
  const isOffline = isOfflineOrDemoToken(token);
  if (isOffline) {
    return {
      statsLoading: false,
      filterOptionsLoading: false,
      studentsLoading: false,
      facultyLoading: false,
      creditsLoading: false,
      reportsLoading: false,
      reportSummaryLoading: false,
      auditLoading: false,
    };
  }

  return {
    statsLoading: true,
    filterOptionsLoading: true,
    studentsLoading: permissions.canViewStudents,
    facultyLoading: permissions.canViewFaculty,
    creditsLoading: permissions.canViewCredits,
    reportsLoading: permissions.canViewReports,
    reportSummaryLoading: permissions.canViewReports,
    auditLoading: permissions.canViewAuditLogs,
  };
};

/**
 * Safe default stats metrics for offline sessions to prevent UI errors/crashes.
 */
export const getOfflineFallbackStats = () => ({
  students: { total: 0, active: 0 },
  faculty: { total: 0, active: 0 },
  credits: { balance: 0, totalAllocated: 0, totalDistributed: 0 },
  interviews: { totalSessions: 0, completedSessions: 0, avgScore: 0 },
});

/**
 * Safe default filter options for offline sessions.
 */
export const getOfflineFallbackFilterOptions = () => ({
  programs: [] as string[],
  courses: [] as string[],
  sections: [] as string[],
  batches: [] as string[],
  departments: [] as string[],
  cohorts: [] as any[],
});

/**
 * Returns the appropriate empty-state message depending on whether the session is offline or live.
 */
export const getTableEmptyMessage = (isOffline: boolean, defaultMessage: string): string => {
  return isOffline ? "Demo mode: Live data is unavailable." : defaultMessage;
};
