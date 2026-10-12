export const FACULTY_PERMISSIONS = [
  "STUDENT_VIEW",
  "STUDENT_CREATE",
  "STUDENT_EDIT",
  "STUDENT_DELETE",
  "FACULTY_VIEW",
  "FACULTY_CREATE",
  "FACULTY_EDIT",
  "REPORT_VIEW",
  "REPORT_EXPORT",
  "AUDIT_VIEW",
  "INTERVIEW_CREDIT_VIEW",
  "INTERVIEW_CREDIT_ASSIGN",
] as const;

export type FacultyPermission = (typeof FACULTY_PERMISSIONS)[number];

export const ASSIGNABLE_FACULTY_PERMISSIONS = [...FACULTY_PERMISSIONS, "all"] as const;

export const DEFAULT_FACULTY_PERMISSIONS: FacultyPermission[] = [
  "STUDENT_VIEW",
  "REPORT_VIEW",
  "REPORT_EXPORT",
];
// AUDIT_VIEW is intentionally excluded: it exposes institution-wide
// administrative/security history and must be granted explicitly. Existing
// REPORT_VIEW faculty therefore do not gain audit access during deployment.

export const FACULTY_AUTHORIZATION_FIELDS = [
  "permissions",
  "programAccess",
  "courseAccess",
  "sectionAccess",
  "batchAccess",
  "scopeUnrestricted",
  "cohortAccess",
  "status",
] as const;

export const FORBIDDEN_FACULTY_ASSIGNMENT_FIELDS = [
  "id",
  "role",
  "isMainFaculty",
  "collegeId",
  "college",
  "institutionId",
  "enterpriseId",
  "userId",
  "user",
  "isActive",
  "email",
  "password",
  "passwordHash",
  "ownerId",
  "ownership",
] as const;

export interface FacultyMutationActor {
  userId: string;
  collegeId: string;
  role: string;
  isMainFaculty: boolean;
  status: string;
  permissions: string[];
}

export interface FacultyMutationTarget {
  userId: string;
  collegeId: string;
  isMainFaculty: boolean;
  status: string;
  permissions: string[];
}

export class FacultyAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 = 403
  ) {
    super(message);
    this.name = "FacultyAuthorizationError";
  }
}

function hasOwn(body: unknown, field: string): boolean {
  return Boolean(body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, field));
}

export function assertNoForbiddenFacultyAssignmentFields(body: unknown): void {
  const forbiddenField = FORBIDDEN_FACULTY_ASSIGNMENT_FIELDS.find((field) => hasOwn(body, field));
  if (forbiddenField) {
    throw new FacultyAuthorizationError(
      `Field "${forbiddenField}" cannot be modified through the faculty update endpoint.`
    );
  }
}

export function hasFacultyAuthorizationChanges(body: unknown): boolean {
  return FACULTY_AUTHORIZATION_FIELDS.some((field) => hasOwn(body, field));
}

export function isPrivilegedFacultyActor(actor: FacultyMutationActor): boolean {
  return actor.role === "super_admin" ||
    (actor.role === "college_main_faculty" && actor.isMainFaculty && actor.status === "active");
}

export function assertSameFacultyTenant(
  actor: FacultyMutationActor,
  target: FacultyMutationTarget
): void {
  if (actor.collegeId !== target.collegeId) {
    // Match the existing route convention and avoid disclosing cross-tenant records.
    throw new FacultyAuthorizationError("Faculty member not found in your college.", 404);
  }
}

export function canGrantPermission(actor: FacultyMutationActor, permission: string): boolean {
  if (!isPrivilegedFacultyActor(actor)) return false;
  return permission === "all" || FACULTY_PERMISSIONS.includes(permission as FacultyPermission);
}

export function assertCanGrantPermissions(
  actor: FacultyMutationActor,
  permissions: string[]
): void {
  const invalidPermission = permissions.find((permission) => !canGrantPermission(actor, permission));
  if (invalidPermission) {
    throw new FacultyAuthorizationError(
      `You are not authorized to grant permission "${invalidPermission}".`
    );
  }
}

export function assertCanModifyFaculty(
  actor: FacultyMutationActor,
  target: FacultyMutationTarget
): void {
  assertSameFacultyTenant(actor, target);

  if (target.isMainFaculty && !isPrivilegedFacultyActor(actor)) {
    throw new FacultyAuthorizationError(
      "Only the Main Faculty administrator can modify the Main Faculty account."
    );
  }
}

export function assertCanModifyFacultyAuthorization(
  actor: FacultyMutationActor,
  target: FacultyMutationTarget,
  requestedPermissions?: string[]
): void {
  assertCanModifyFaculty(actor, target);

  if (!isPrivilegedFacultyActor(actor)) {
    throw new FacultyAuthorizationError(
      "Only the Main Faculty administrator can modify faculty permissions, access scope, or status."
    );
  }

  if (actor.userId === target.userId && requestedPermissions) {
    const current = new Set(target.permissions);
    const addsPermission = requestedPermissions.some((permission) => !current.has(permission));
    if (addsPermission) {
      throw new FacultyAuthorizationError("You cannot increase your own permissions.");
    }
  }

  if (requestedPermissions) {
    assertCanGrantPermissions(actor, requestedPermissions);
  }
}

export function assertCanDeactivateFaculty(
  actor: FacultyMutationActor,
  target: FacultyMutationTarget
): void {
  assertSameFacultyTenant(actor, target);

  if (!isPrivilegedFacultyActor(actor)) {
    throw new FacultyAuthorizationError(
      "Only the Main Faculty administrator can deactivate faculty accounts."
    );
  }
  if (target.isMainFaculty) {
    throw new FacultyAuthorizationError("The Main Faculty account cannot be deactivated here.");
  }
  if (actor.userId === target.userId) {
    throw new FacultyAuthorizationError("You cannot deactivate your own account.");
  }
}
