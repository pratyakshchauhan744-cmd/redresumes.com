export interface EnterprisePermissionUser {
  isMainFaculty?: boolean;
  permissions?: string[];
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  STUDENT_VIEW: ["manageStudents"],
  STUDENT_CREATE: ["manageStudents"],
  STUDENT_EDIT: ["manageStudents"],
  FACULTY_VIEW: ["manageFaculty"],
  FACULTY_CREATE: ["manageFaculty"],
  FACULTY_EDIT: ["manageFaculty"],
  INTERVIEW_CREDIT_VIEW: ["distributeCredits"],
  INTERVIEW_CREDIT_ASSIGN: ["distributeCredits"],
  REPORT_VIEW: ["viewAnalytics"],
  REPORT_EXPORT: ["exportReports"],
};

export function hasEnterprisePermission(user: EnterprisePermissionUser, permission: string): boolean {
  return Boolean(
    user.isMainFaculty ||
    user.permissions?.includes("all") ||
    user.permissions?.includes(permission) ||
    PERMISSION_ALIASES[permission]?.some((alias) => user.permissions?.includes(alias))
  );
}
