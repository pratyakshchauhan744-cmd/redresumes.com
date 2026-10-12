import type { Response } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";

export const REFRESH_COOKIE_NAME = "rr_refresh_token";
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  path: "/api/auth",
});
export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...cookieOptions(), maxAge: REFRESH_MAX_AGE_MS });
}
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}
export async function persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
  await prisma.refreshToken.create({ data: {
    userId,
    tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
  } });
}
