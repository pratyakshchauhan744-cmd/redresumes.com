import { prisma } from "../../db/prisma.js";
import { normalizeFacultyPermissions } from "../../middleware/tenant.js";
import {
  isStudentWithinFacultyScope,
  parseFacultyCohortAccess,
} from "../enterprise/student-scope-authorization.js";

export interface ReportSessionIdentity {
  id: string;
  userId: string | null;
  collegeId: string | null;
}

export interface InterviewReportAccessDecision {
  allowed: boolean;
  isOwner: boolean;
  reason:
    | "owner"
    | "super_admin"
    | "faculty"
    | "unauthenticated"
    | "unsupported_role"
    | "inactive_faculty"
    | "missing_permission"
    | "missing_student"
    | "cross_tenant"
    | "outside_scope";
}

export interface FacultyReportScope {
  programAccess: string[];
  courseAccess: string[];
  sectionAccess: string[];
  batchAccess?: string[];
  scopeUnrestricted?: boolean;
  cohortAccess?: unknown;
}

export interface ReportStudentScope {
  program: string;
  course: string;
  section: string;
  batch?: string;
}

export function isStudentWithinFacultyReportScope(
  faculty: FacultyReportScope,
  student: ReportStudentScope
): boolean {
  return isStudentWithinFacultyScope({
    collegeId: "report-scope",
    hasAccess: true,
    unrestricted: false,
    programAccess: faculty.programAccess,
    courseAccess: faculty.courseAccess,
    sectionAccess: faculty.sectionAccess,
    batchAccess: faculty.batchAccess ?? [],
    scopeUnrestricted: faculty.scopeUnrestricted,
    cohortAccess: faculty.cohortAccess === undefined
      ? null
      : parseFacultyCohortAccess(faculty.cohortAccess),
  }, {
    collegeId: "report-scope",
    program: student.program,
    course: student.course,
    section: student.section,
    batch: student.batch ?? "",
  });
}

/**
 * Authorizes read-only access to one interview report using trusted database state.
 * Student ownership is preserved. Faculty access additionally requires REPORT_VIEW,
 * matching tenant membership, and the student's cohort to fall within faculty scope.
 */
export async function authorizeInterviewReportRead(
  actorId: string | undefined,
  session: ReportSessionIdentity
): Promise<InterviewReportAccessDecision> {
  if (!actorId) {
    return { allowed: false, isOwner: false, reason: "unauthenticated" };
  }

  if (session.userId === actorId) {
    return { allowed: true, isOwner: true, reason: "owner" };
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      role: true,
      collegeId: true,
      isActive: true,
      facultyProfile: {
        select: {
          collegeId: true,
          status: true,
          isMainFaculty: true,
          permissions: true,
          programAccess: true,
          courseAccess: true,
          sectionAccess: true,
          batchAccess: true,
          scopeUnrestricted: true,
          cohortAccess: true,
        },
      },
    },
  });

  if (!actor?.isActive) {
    return { allowed: false, isOwner: false, reason: "unsupported_role" };
  }
  if (actor.role === "super_admin") {
    return { allowed: true, isOwner: false, reason: "super_admin" };
  }
  if (actor.role !== "college_faculty" && actor.role !== "college_main_faculty") {
    return { allowed: false, isOwner: false, reason: "unsupported_role" };
  }

  const faculty = actor.facultyProfile;
  if (!faculty || faculty.status !== "active") {
    return { allowed: false, isOwner: false, reason: "inactive_faculty" };
  }

  const permissions = normalizeFacultyPermissions(faculty.permissions);
  const hasReportPermission = faculty.isMainFaculty ||
    permissions.includes("all") ||
    permissions.includes("REPORT_VIEW");
  if (!hasReportPermission) {
    return { allowed: false, isOwner: false, reason: "missing_permission" };
  }

  if (!session.userId) {
    return { allowed: false, isOwner: false, reason: "missing_student" };
  }

  const student = await prisma.collegeStudent.findUnique({
    where: { userId: session.userId },
    select: {
      collegeId: true,
      program: true,
      course: true,
      section: true,
      batch: true,
    },
  });
  if (!student) {
    return { allowed: false, isOwner: false, reason: "missing_student" };
  }

  const actorCollegeId = actor.collegeId;
  if (
    !actorCollegeId ||
    faculty.collegeId !== actorCollegeId ||
    student.collegeId !== actorCollegeId ||
    (session.collegeId !== null && session.collegeId !== actorCollegeId)
  ) {
    return { allowed: false, isOwner: false, reason: "cross_tenant" };
  }

  if (!faculty.isMainFaculty && !isStudentWithinFacultyReportScope(faculty, student)) {
    return { allowed: false, isOwner: false, reason: "outside_scope" };
  }

  return { allowed: true, isOwner: false, reason: "faculty" };
}
