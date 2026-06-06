import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

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
    if (
      lower.includes("can't reach database server") ||
      lower.includes("cant reach database server") ||
      lower.includes("postgres:5432") ||
      lower.includes("localhost:5433") ||
      lower.includes("prisma.")
    ) {
      res.status(503).json({
        message: "Database is offline. Start PostgreSQL (Docker) and try again.",
        error: error.message
      });
      return;
    }
    res.status(500).json({ message: error.message });
    return;
  }

  console.error("Unhandled non-Error object encountered:", error);
  res.status(500).json({ message: "Internal server error" });
}
