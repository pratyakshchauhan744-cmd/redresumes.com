export const FACULTY_PERMISSION_OPTIONS = [
  { value: "all", label: "Full access" },
  { value: "STUDENT_VIEW", label: "View students" },
  { value: "STUDENT_CREATE", label: "Create students" },
  { value: "STUDENT_EDIT", label: "Edit students" },
  { value: "STUDENT_DELETE", label: "Deactivate students" },
  { value: "FACULTY_VIEW", label: "View faculty" },
  { value: "FACULTY_CREATE", label: "Create faculty" },
  { value: "FACULTY_EDIT", label: "Edit faculty" },
  { value: "REPORT_VIEW", label: "View reports" },
  { value: "REPORT_EXPORT", label: "Export reports" },
  { value: "AUDIT_VIEW", label: "View audit logs" },
  { value: "INTERVIEW_CREDIT_VIEW", label: "View credit ledger" },
  { value: "INTERVIEW_CREDIT_ASSIGN", label: "Assign credits" },
] as const;

export const DEFAULT_FACULTY_PERMISSIONS = [
  "STUDENT_VIEW",
  "REPORT_VIEW",
  "REPORT_EXPORT",
];

export interface FacultyAuthorizationValues {
  permissions: string[];
  programAccess: string[];
  courseAccess: string[];
  sectionAccess: string[];
  batchAccess: string[];
  scopeUnrestricted: boolean;
  cohortAccess: FacultyCohortAccessRule[];
}

export interface FacultyCohortAccessRule {
  program: string;
  course: string;
  section: string;
  batch: string;
}

export function toggleFacultyPermission(permissions: string[], permission: string): string[] {
  if (permission === "all") return permissions.includes("all") ? [] : ["all"];
  const withoutAll = permissions.filter((value) => value !== "all");
  return withoutAll.includes(permission)
    ? withoutAll.filter((value) => value !== permission)
    : [...withoutAll, permission];
}

export function toggleAccessValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function cohortAccessKey(cohort: FacultyCohortAccessRule): string {
  return [cohort.program, cohort.course, cohort.section, cohort.batch].join("\u001f");
}

export function toggleCohortAccess(
  values: FacultyCohortAccessRule[],
  cohort: FacultyCohortAccessRule,
): FacultyCohortAccessRule[] {
  const key = cohortAccessKey(cohort);
  return values.some((value) => cohortAccessKey(value) === key)
    ? values.filter((value) => cohortAccessKey(value) !== key)
    : [...values, cohort];
}

export function resolveFacultyCohortAccess(
  faculty: Partial<FacultyAuthorizationValues> & { cohortAccess?: unknown },
  availableCohorts: FacultyCohortAccessRule[],
): FacultyCohortAccessRule[] {
  if (Array.isArray(faculty.cohortAccess)) {
    return faculty.cohortAccess.filter((value): value is FacultyCohortAccessRule => Boolean(
      value &&
      typeof value === "object" &&
      typeof value.program === "string" &&
      typeof value.course === "string" &&
      typeof value.section === "string" &&
      typeof value.batch === "string"
    ));
  }

  const dimensions = [
    faculty.programAccess ?? [],
    faculty.courseAccess ?? [],
    faculty.sectionAccess ?? [],
    faculty.batchAccess ?? [],
  ];
  if (dimensions.every((values) => values.length === 0)) return [];

  return availableCohorts.filter((cohort) =>
    (dimensions[0].length === 0 || dimensions[0].includes(cohort.program)) &&
    (dimensions[1].length === 0 || dimensions[1].includes(cohort.course)) &&
    (dimensions[2].length === 0 || dimensions[2].includes(cohort.section)) &&
    (dimensions[3].length === 0 || dimensions[3].includes(cohort.batch))
  );
}

export function getFacultyAuthorizationPayload(
  canManageAuthorization: boolean,
  values: FacultyAuthorizationValues,
): Partial<FacultyAuthorizationValues> {
  if (!canManageAuthorization) return {};
  return {
    permissions: [...values.permissions],
    programAccess: [...values.programAccess],
    courseAccess: [...values.courseAccess],
    sectionAccess: [...values.sectionAccess],
    batchAccess: [...values.batchAccess],
    scopeUnrestricted: values.scopeUnrestricted,
    cohortAccess: values.cohortAccess.map((cohort) => ({ ...cohort })),
  };
}
