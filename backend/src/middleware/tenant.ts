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

/**
 * Middleware: Enforces specific granular RBAC permissions for enterprise operations.
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // Platform super_admin and college_main_faculty have root enterprise permissions
    if (req.user.role === "super_admin" || req.user.role === "college_main_faculty" || req.user.isMainFaculty) {
      return next();
    }

    // Check permissions on request or fetch from faculty profile
    let permissions = req.user.permissions;
    if (!permissions && req.user.collegeId) {
      const faculty = await prisma.collegeFaculty.findUnique({
        where: { userId: req.user.id },
        select: { permissions: true, isMainFaculty: true, status: true },
      });

      if (faculty?.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your faculty staff profile is currently inactive or suspended.",
        });
      }

      if (faculty?.isMainFaculty) {
        return next();
      }

      permissions = faculty?.permissions || [];
    }

    if (permissions && permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied: Missing required permission "${permission}".`,
    });
  };
}
