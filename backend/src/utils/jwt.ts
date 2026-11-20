import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  email: string;
  collegeId?: string | null;
  isMainFaculty?: boolean;
  permissions?: string[];
  type?: "access" | "refresh";
};

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  // Refresh sessions are revoked in the database on logout or password reset.
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, {
    jwtid: randomUUID()
  });
}

export function verifyToken(token: string, expectedType?: "access" | "refresh"): JwtPayload {
  // Refresh expiry is enforced by the stored session, including legacy tokens.
  const payload = jwt.verify(token, env.JWT_SECRET, { ignoreExpiration: expectedType === "refresh" }) as JwtPayload;
  if (expectedType && payload.type && payload.type !== expectedType) {
    throw new Error(`Token type mismatch: expected ${expectedType}`);
  }
  return payload;
}
