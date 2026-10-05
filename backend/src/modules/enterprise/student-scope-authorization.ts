export interface FacultyCohortAccessRule {
  program: string;
  course: string;
  section: string;
  batch: string;
}

export interface FacultyStudentScope {
  collegeId: string;
  hasAccess: boolean;
  unrestricted: boolean;
  programAccess: string[];
  courseAccess: string[];
  sectionAccess: string[];
  batchAccess?: string[];
  scopeUnrestricted?: boolean;
  /** NULL is accepted only as a defensive compatibility path for pre-migration data. */
  cohortAccess?: FacultyCohortAccessRule[] | null;
}

export interface StudentScopeIdentity {
  collegeId: string;
  program: string;
  course: string;
  section: string;
  batch?: string;
}

function permits(allowedValues: string[], actualValue: string): boolean {
  return allowedValues.length === 0 || allowedValues.includes(actualValue);
}

export function parseFacultyCohortAccess(value: unknown): FacultyCohortAccessRule[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new Error("Invalid faculty cohort access data.");

  return value.map((rule) => {
    const candidate = rule && typeof rule === "object"
      ? rule as Record<string, unknown>
      : null;
    if (
      !candidate ||
      typeof candidate.program !== "string" ||
      typeof candidate.course !== "string" ||
      typeof candidate.section !== "string" ||
      typeof candidate.batch !== "string"
    ) {
      // Fail closed instead of turning corrupt rules into unrestricted access.
      throw new Error("Invalid faculty cohort access rule.");
    }
    return {
      program: candidate.program,
      course: candidate.course,
      section: candidate.section,
      batch: candidate.batch,
    };
  });
}

/**
 * Exact cohort rules are ORed as complete tuples, preventing Cartesian scope
 * expansion. The unrestricted state is explicit so [] can safely deny access.
 */
export function isStudentWithinFacultyScope(
  faculty: FacultyStudentScope,
  student: StudentScopeIdentity
): boolean {
  if (!faculty.hasAccess || faculty.collegeId !== student.collegeId) return false;
  if (faculty.unrestricted || faculty.scopeUnrestricted) return true;

  if (faculty.cohortAccess !== null && faculty.cohortAccess !== undefined) {
    return faculty.cohortAccess.some((rule) =>
      rule.program === student.program &&
      rule.course === student.course &&
      rule.section === student.section &&
      rule.batch === student.batch
    );
  }

  return permits(faculty.programAccess, student.program) &&
    permits(faculty.courseAccess, student.course) &&
    permits(faculty.sectionAccess, student.section) &&
    permits(faculty.batchAccess ?? [], student.batch ?? "");
}

/** Produces the Prisma fragment used by list, read, report, credit, and mutation queries. */
export function buildFacultyStudentScopeConditions(faculty: FacultyStudentScope): Record<string, unknown> {
  if (!faculty.hasAccess) return { id: { in: [] } };
  if (faculty.unrestricted || faculty.scopeUnrestricted) return {};

  if (faculty.cohortAccess !== null && faculty.cohortAccess !== undefined) {
    if (faculty.cohortAccess.length === 0) return { id: { in: [] } };
    return {
      OR: faculty.cohortAccess.map((rule) => ({
        program: rule.program,
        course: rule.course,
        section: rule.section,
        batch: rule.batch,
      })),
    };
  }

  const conditions: Record<string, unknown> = {};
  if (faculty.programAccess.length > 0) conditions.program = { in: faculty.programAccess };
  if (faculty.courseAccess.length > 0) conditions.course = { in: faculty.courseAccess };
  if (faculty.sectionAccess.length > 0) conditions.section = { in: faculty.sectionAccess };
  if ((faculty.batchAccess?.length ?? 0) > 0) conditions.batch = { in: faculty.batchAccess };
  return conditions;
}
