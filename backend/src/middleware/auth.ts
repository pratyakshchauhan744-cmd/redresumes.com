import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyToken } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("requireAuth: missing or invalid authorization header:", authHeader);
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email
    };
    next();
  } catch (err: any) {
    console.log("requireAuth: token verification failed:", err.message, "Token value:", token.slice(0, 15) + "...");
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
