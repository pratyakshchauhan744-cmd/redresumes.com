import { prisma } from "../../db/prisma.js";
import { normalizeFacultyPermissions } from "../../middleware/tenant.js";
import type { JwtPayload } from "../../utils/jwt.js";

export class SessionContextError extends Error {
  readonly status = 403;
}

/** All login/renewal paths derive authorization from current server state. */
export async function loadSessionContext(userId: string, previous?: JwtPayload) {
  const user = await prisma.user.findUnique({
    relationLoadStrategy: "join",
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, collegeId: true,
      college: { select: { id: true, name: true, code: true, website: true, status: true } },
      facultyProfile: { select: {
        collegeId: true, status: true, isMainFaculty: true, permissions: true,
      } },
      studentProfile: true,
    },
  });
  if (!user?.isActive) throw new SessionContextError("Account is unavailable or deactivated. Please sign in again.");
  // A role/tenant change requires a new login; renewal cannot silently select
  // a different institution or upgrade the role of an existing session.
  if (previous && (previous.role !== user.role ||
    (previous.collegeId != null && previous.collegeId !== user.collegeId))) {
    throw new SessionContextError("Session membership has changed. Please sign in again.");
  }
  const isFaculty = user.role === "college_faculty" || user.role === "college_main_faculty";
  const isStudent = user.role === "student";
  if (isFaculty || isStudent) {
    if (!user.collegeId || !user.college || user.college.id !== user.collegeId || user.college.status !== "active") {
      throw new SessionContextError("An active institution membership is required.");
    }
    const membership = isFaculty ? user.facultyProfile : user.studentProfile;
    if (!membership || membership.collegeId !== user.collegeId || membership.status !== "active") {
      throw new SessionContextError("Institution membership is inactive or revoked.");
    }
  }
  const isMainFaculty = isFaculty && Boolean(user.facultyProfile?.isMainFaculty);
  const permissions = isFaculty ? normalizeFacultyPermissions(user.facultyProfile?.permissions) : [];
  const payload: JwtPayload = {
    sub: user.id, role: user.role, email: user.email,
    collegeId: user.collegeId, isMainFaculty, permissions,
  };
  const college = user.college ? {
    id: user.college.id, name: user.college.name, code: user.college.code,
    domain: user.college.website, status: user.college.status,
  } : null;
  return { payload, user: {
    id: user.id, name: user.name, email: user.email, role: user.role,
    collegeId: user.collegeId, college, isMainFaculty, permissions,
    studentProfile: isStudent ? user.studentProfile : null,
  } };
}
