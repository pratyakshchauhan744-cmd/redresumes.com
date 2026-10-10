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
  try {
    return await resolveTenant(req, res, next);
  } catch (error) {
    // Express 4 does not forward rejected async middleware promises itself.
    // Database outages must reach the error handler, never terminate the API.
    next(error);
  }
}

async function resolveTenant(req: Request, res: Response, next: NextFunction) {
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

export class EnterpriseAuthorizationError extends Error {}
export interface EnterpriseAuthorization {
  root: boolean;
  permissions: string[];
  fingerprint: string;
}
// Only memoize within this HTTP request. No process/distributed authorization
// cache can outlive a membership change committed before the next request.
const requestAuthorization = new WeakMap<Request, Promise<EnterpriseAuthorization>>();

export function resolveEnterpriseAuthorization(req: Request, fresh = false): Promise<EnterpriseAuthorization> {
  const existing = fresh ? undefined : requestAuthorization.get(req);
  if (existing) return existing;
  const resolution = (async () => {
    if (!req.user || !req.collegeId) throw new EnterpriseAuthorizationError("Active institutional access is required.");
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        isActive: true, role: true, collegeId: true,
        college: { select: { status: true } },
        facultyProfile: { select: {
          collegeId: true, status: true, isMainFaculty: true, permissions: true,
          programAccess: true, courseAccess: true, sectionAccess: true, batchAccess: true,
          scopeUnrestricted: true, cohortAccess: true,
        } },
      },
    });
    if (!current?.isActive || current.role !== req.user.role) {
      throw new EnterpriseAuthorizationError("Your institutional access is unavailable or revoked.");
    }
    if (current.role === "super_admin") return { root: true, permissions: ["all"], fingerprint: "super_admin" };
    const faculty = current.facultyProfile;
    if ((current.role !== "college_faculty" && current.role !== "college_main_faculty") ||
        current.collegeId !== req.collegeId || current.college?.status !== "active" ||
        !faculty || faculty.collegeId !== req.collegeId || faculty.status !== "active") {
      throw new EnterpriseAuthorizationError("Your institutional access is unavailable or revoked.");
    }
    const permissions = normalizeFacultyPermissions(faculty.permissions);
    req.user.permissions = permissions;
    req.user.isMainFaculty = faculty.isMainFaculty;
    return { root: faculty.isMainFaculty, permissions, fingerprint: JSON.stringify({
      ...faculty, permissions: [...permissions].sort(),
    }) };
  })();
  requestAuthorization.set(req, resolution);
  return resolution;
}

export async function requireEnterpriseAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const initial = await resolveEnterpriseAuthorization(req);
    if (req.method === "GET") {
      // Recheck before releasing a read response. A request that was already
      // running when access was revoked must not release its old-scope data.
      const send = res.send.bind(res);
      res.send = ((body: unknown) => {
        if (res.statusCode >= 400) return send(body);
        void resolveEnterpriseAuthorization(req, true).then((current) => {
          res.send = send;
          if (current.fingerprint === initial.fingerprint) {
            send(body);
          } else {
            res.removeHeader("Content-Disposition");
            res.status(403).type("json");
            send(JSON.stringify({ success: false, message: "Institutional access changed. Please retry." }));
          }
        }).catch((error: unknown) => {
          res.send = send;
          res.removeHeader("Content-Disposition");
          res.type("json");
          if (error instanceof EnterpriseAuthorizationError) {
            res.status(403).type("json");
            send(JSON.stringify({ success: false, message: error.message }));
          } else {
            next(error);
          }
        });
        return res;
      }) as typeof res.send;
    }
    next();
  } catch (error) {
    if (error instanceof EnterpriseAuthorizationError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function resolveEnterprisePermission(req: Request, permission: string): Promise<EnterprisePermissionDecision> {
  try {
    const authorization = await resolveEnterpriseAuthorization(req);
    return {
      allowed: authorization.root || authorization.permissions.includes("all") || authorization.permissions.includes(permission),
      inactiveFaculty: false,
    };
  } catch (error) {
    if (error instanceof EnterpriseAuthorizationError) return { allowed: false, inactiveFaculty: true };
    throw error;
  }
}

/** A composite endpoint exposes only the metrics allowed by individual permissions. */
export function requireAnyEnterprisePermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authorization = await resolveEnterpriseAuthorization(req);
      if (authorization.root || authorization.permissions.includes("all") ||
          permissions.some((permission) => authorization.permissions.includes(permission))) {
        next();
        return;
      }
      res.status(403).json({ success: false, message: "You do not have permission to access this institutional information." });
    } catch (error) {
      if (error instanceof EnterpriseAuthorizationError) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
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

    try {
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
    } catch (error) {
      next(error);
    }
  };
}
