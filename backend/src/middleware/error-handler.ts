import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      issues: error.flatten()
    });
    return;
  }

  if (error instanceof Error) {
    console.error("Unhandled error encountered:", error);
    const lower = error.message.toLowerCase();
    const isDbError =
      lower.includes("can't reach database server") ||
      lower.includes("cant reach database server") ||
      lower.includes("postgres:5432") ||
      lower.includes("localhost:5433") ||
      lower.includes("prisma.");

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
