import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";

// Extend Express Request interface with enterprise multi-tenant context
declare global {
  namespace Express {
    interface Request {
      collegeId?: string;
      college?: {
        id: string;
        name: string;
        code: string;
        status: string;
      };
    }
  }
}

/**
 * Middleware: Enforces that the request has an authenticated user affiliated with an active college tenant.
 * Zero-Trust Principle: The college context is derived strictly from verified JWT claims or verified DB records.
 */
// Short-lived in-process cache for college tenant data to avoid a DB query per request
const _collegeCache = new Map<string, { data: { id: string; name: string; code: string; status: string }; expiresAt: number }>();

/** Call this after any operation that changes a college's status or core fields. */
export function invalidateCollegeCache(collegeId: string) {
  _collegeCache.delete(collegeId);
}

export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  // Super admins can operate globally or pass a target collegeId header
  if (req.user.role === "super_admin") {
    const targetCollegeId = (req.headers["x-target-college-id"] as string) || req.user.collegeId;
    if (targetCollegeId) {
      const cached = _collegeCache.get(targetCollegeId);
      let college: { id: string; name: string; code: string; status: string } | null = null;

      if (cached && cached.expiresAt > Date.now()) {
        college = cached.data;
      } else {
        college = await prisma.college.findUnique({
          where: { id: targetCollegeId },
          select: { id: true, name: true, code: true, status: true },
        });
        if (college) {
          _collegeCache.set(targetCollegeId, { data: college, expiresAt: Date.now() + 60_000 });
        }
      }

      if (college) {
        req.collegeId = college.id;
        req.college = college;
        return next();
      }
    }
  }

  const collegeId = req.user.collegeId;
  if (!collegeId) {
    return res.status(403).json({
      success: false,
      message: "Access forbidden: Your account is not affiliated with any college or university tenant.",
    });
  }

  // Check cache first
  const cached = _collegeCache.get(collegeId);
  let college: { id: string; name: string; code: string; status: string } | null = null;

  if (cached && cached.expiresAt > Date.now()) {
    college = cached.data;
  } else {
    college = await prisma.college.findUnique({
      where: { id: collegeId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (college) {
      _collegeCache.set(collegeId, { data: college, expiresAt: Date.now() + 60_000 });
    }
  }

  if (!college) {
    return res.status(404).json({
      success: false,
      message: "College tenant record not found.",
    });
  }

  if (college.status !== "active") {
    return res.status(403).json({
      success: false,
      message: `Access suspended: The college tenant "${college.name}" is currently ${college.status}. Please contact support.`,
    });
  }

  req.collegeId = college.id;
  req.college = college;
  next();
}

/**
 * Middleware: Enforces that the user is the Main Faculty Admin of the college (or platform super_admin).
 */
export function requireCollegeAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  if (req.user.role === "super_admin" || req.user.role === "college_main_faculty" || req.user.isMainFaculty) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access forbidden: Action requires College Main Faculty administrator privileges.",
  });
}

const LEGACY_PERMISSION_MAP: Record<string, string[]> = {
  manageFaculty: ["FACULTY_VIEW", "FACULTY_CREATE", "FACULTY_EDIT"],
  manageStudents: ["STUDENT_VIEW", "STUDENT_CREATE", "STUDENT_EDIT", "STUDENT_DELETE"],
  distributeCredits: ["INTERVIEW_CREDIT_VIEW", "INTERVIEW_CREDIT_ASSIGN"],
  viewAnalytics: ["REPORT_VIEW"],
  exportReports: ["REPORT_EXPORT"],
};

/**
 * Expands permissions created by the original enterprise UI into the canonical
 * permissions used by the API. Keeping this at the authorization boundary lets
 * existing faculty accounts continue to work without weakening endpoint checks.
 */
export function normalizeFacultyPermissions(permissions: string[] | null | undefined): string[] {
  const normalized = new Set(permissions ?? []);
  for (const permission of permissions ?? []) {
    for (const canonicalPermission of LEGACY_PERMISSION_MAP[permission] ?? []) {
      normalized.add(canonicalPermission);
    }
  }
  return [...normalized];
}

export interface EnterprisePermissionDecision {
  allowed: boolean;
  inactiveFaculty: boolean;
}

/**
 * Resolves one enterprise permission from authoritative faculty state. JWT
 * permissions are retained only for roles without a faculty profile.
 */
export async function resolveEnterprisePermission(
  req: Request,
  permission: string
): Promise<EnterprisePermissionDecision> {
  if (!req.user) return { allowed: false, inactiveFaculty: false };
  if (req.user.role === "super_admin") return { allowed: true, inactiveFaculty: false };

  let permissions = normalizeFacultyPermissions(req.user.permissions);
  if (req.user.role === "college_faculty" || req.user.role === "college_main_faculty") {
    const faculty = await prisma.collegeFaculty.findFirst({
      where: { userId: req.user.id, collegeId: req.collegeId ?? req.user.collegeId ?? undefined },
      select: { permissions: true, isMainFaculty: true, status: true },
    });

    if (!faculty || faculty.status !== "active") {
      return { allowed: false, inactiveFaculty: true };
    }

    permissions = normalizeFacultyPermissions(faculty.permissions);
    req.user.permissions = permissions;
    req.user.isMainFaculty = faculty.isMainFaculty;
    if (faculty.isMainFaculty) return { allowed: true, inactiveFaculty: false };
  }

  return {
    allowed: permissions.includes("all") || permissions.includes(permission),
    inactiveFaculty: false,
  };
}

/**
 * Middleware: Enforces specific granular RBAC permissions for enterprise operations.
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const decision = await resolveEnterprisePermission(req, permission);
    if (decision.inactiveFaculty) {
      return res.status(403).json({
        success: false,
        message: "Your faculty staff profile is currently inactive or suspended.",
      });
    }

    if (decision.allowed) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied: Missing required permission "${permission}".`,
    });
  };
}
