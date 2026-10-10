import { InsufficientInstitutionCreditsError } from "../modules/enterprise/credit-transfer.js";
import { EnterpriseAuthorizationError } from "./tenant.js";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { SessionContextError } from "../modules/auth/session-context.js";
import { env } from "../config/env.js";
import { isUniqueConstraintError } from "../utils/identity.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof SessionContextError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof EnterpriseAuthorizationError) {
    res.status(403).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof InsufficientInstitutionCreditsError) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  if (isUniqueConstraintError(error)) {
    res.status(409).json({
      success: false,
      message: "An account or record with these unique details already exists.",
    });
    return;
  }

  if (error instanceof ZodError) {
    // Build a user-friendly message from the first validation issue
    const firstIssue = error.errors[0];
    const fieldPath = firstIssue?.path?.length ? firstIssue.path.join(".") : "input";
    const humanMessage =
      firstIssue?.message && firstIssue.message !== "Required"
        ? firstIssue.message
        : `Invalid or missing value for field: "${fieldPath}"`;

    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: humanMessage,
      // Also include structured issues for debugging
      issues: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof Error) {
    console.error("Unhandled error encountered:", error);
    const lower = error.message.toLowerCase();
    const prismaCode = typeof (error as any)?.code === "string" ? (error as any).code : "";
    const isDbError =
      prismaCode.startsWith("P10") ||
      lower.includes("can't reach database server") ||
      lower.includes("cant reach database server") ||
      lower.includes("econnrefused") ||
      lower.includes("postgres:5432") ||
      lower.includes("localhost:5433");

    if (isDbError) {
      const message = env.NODE_ENV === "production"
        ? "Database service is temporarily unavailable. Please try again shortly."
        : "Database is offline. Start PostgreSQL (Docker) and try again.";
      res.status(503).json({ message });
      return;
    }

    const message = env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message;

    res.status(500).json({ message });
    return;
  }

  console.error("Unhandled non-Error object encountered:", error);
  res.status(500).json({ message: "Internal server error" });
}
