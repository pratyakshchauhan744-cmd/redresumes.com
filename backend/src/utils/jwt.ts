import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  role: "candidate" | "employer" | "admin";
  email: string;
  type?: "access" | "refresh";
};

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"]
  });
}

export function verifyToken(token: string, expectedType?: "access" | "refresh"): JwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  if (expectedType && payload.type && payload.type !== expectedType) {
    throw new Error(`Token type mismatch: expected ${expectedType}`);
  }
  return payload;
}
