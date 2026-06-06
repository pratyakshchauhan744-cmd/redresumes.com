import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes, randomInt } from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import type { SignInMethod } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/jwt.js";

const router = Router();

const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { message: "Too many verification attempts, please try again in 5 minutes" }
});

const otpStartLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: "Too many OTP requests, please try again later" }
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["candidate", "employer"]).default("candidate")
});

const registerStartSchema = registerSchema;

const registerVerifySchema = z.object({
  sessionId: z.string().min(12),
  otp: z.string().length(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const googleLoginSchema = z.object({
  credential: z.string().min(20)
});

const loginStartSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const loginVerifySchema = z.object({
  sessionId: z.string().min(12),
  otp: z.string().length(6)
});

const forgotPasswordStartSchema = z.object({
  email: z.string().email()
});

const forgotPasswordVerifySchema = z.object({
  sessionId: z.string().min(12),
  otp: z.string().length(6)
});

const forgotPasswordResetSchema = z.object({
  sessionId: z.string().min(12),
  password: z.string().min(8)
});

type PendingOtpLogin = {
  sessionId: string;
  userId: string;
  email: string;
  otp: string;
  expiresAt: number;
};

type PendingOtpSignup = {
  sessionId: string;
  name: string;
  email: string;
  password: string;
  role: "candidate" | "employer" | "admin";
  otp: string;
  expiresAt: number;
};

type PendingOtpForgot = {
  sessionId: string;
  userId: string;
  email: string;
  otp: string;
  verified: boolean;
  expiresAt: number;
};

const pendingOtpLogins = new Map<string, PendingOtpLogin>();
const pendingOtpSignups = new Map<string, PendingOtpSignup>();
const pendingOtpForgot = new Map<string, PendingOtpForgot>();
const OTP_TTL_MS = 5 * 60 * 1000;
const REFRESH_COOKIE_NAME = "rr_refresh_token";
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const googleOAuthClient = new OAuth2Client();

type VerifiedGooglePayload = {
  sub: string;
  email: string;
  email_verified?: boolean | "true" | "false";
  name?: string;
  aud?: string;
  iss?: string;
  exp?: string | number;
};

type GoogleAuthFailureCode =
  | "malformed_token"
  | "tokeninfo_rejected"
  | "missing_identity"
  | "audience_mismatch"
  | "issuer_mismatch"
  | "expired"
  | "verify_failed";

class GoogleAuthError extends Error {
  code: GoogleAuthFailureCode;
  status?: number;
  audience?: string;
  expectedProjects?: string;

  constructor(message: string, code: GoogleAuthFailureCode, details: { status?: number; audience?: string; expectedProjects?: string } = {}) {
    super(message);
    this.code = code;
    this.status = details.status;
    this.audience = details.audience;
    this.expectedProjects = details.expectedProjects;
  }
}

function getAllowedGoogleClientIds(): string[] {
  return [
    env.GOOGLE_CLIENT_ID,
    env.VITE_GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_IDS
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function decodeBase64UrlJson(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
}

function decodeGoogleCredentialPayload(credential: string): Partial<VerifiedGooglePayload> {
  const parts = credential.split(".");
  if (parts.length !== 3) {
    throw new GoogleAuthError("Google returned a malformed credential.", "malformed_token");
  }

  const payload = decodeBase64UrlJson(parts[1]);
  if (!payload || typeof payload !== "object") {
    throw new GoogleAuthError("Google credential payload is unreadable.", "malformed_token");
  }

  return payload as Partial<VerifiedGooglePayload>;
}

function getGoogleClientProjectNumber(clientId: string): string | null {
  const match = clientId.match(/^(\d+)-[a-z0-9]+\.apps\.googleusercontent\.com$/i);
  return match?.[1] ?? null;
}

function isAllowedGoogleAudience(audience: string | undefined, allowedClientIds: string[]): boolean {
  if (!audience) return false;
  if (allowedClientIds.includes(audience)) return true;

  const audienceProject = getGoogleClientProjectNumber(audience);
  if (!audienceProject) return false;

  return allowedClientIds.some((clientId) => getGoogleClientProjectNumber(clientId) === audienceProject);
}

function getAllowedGoogleProjectNumbers(allowedClientIds: string[]): string[] {
  return Array.from(new Set(allowedClientIds.map(getGoogleClientProjectNumber).filter((value): value is string => Boolean(value))));
}

function isGoogleEmailVerified(value: VerifiedGooglePayload["email_verified"]): boolean {
  return value === true || value === "true";
}

async function verifyGoogleCredential(credential: string, allowedClientIds: string[]): Promise<VerifiedGooglePayload> {
  const decodedPayload = decodeGoogleCredentialPayload(credential);
  const decodedAudience = typeof decodedPayload.aud === "string" ? decodedPayload.aud : undefined;
  const expectedProjects = getAllowedGoogleProjectNumbers(allowedClientIds).join(",");

  if (!decodedAudience || !isAllowedGoogleAudience(decodedAudience, allowedClientIds)) {
    throw new GoogleAuthError("Google credential belongs to a different OAuth client.", "audience_mismatch", {
      audience: decodedAudience ?? "missing",
      expectedProjects
    });
  }

  // Primary method: use google-auth-library's verifyIdToken (recommended for production).
  // This performs local JWT signature verification using Google's cached public keys.
  try {
    console.log("[Google Auth] Verifying credential via verifyIdToken, audience:", decodedAudience);
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: decodedAudience
    });
    const payload = ticket.getPayload();
    if (payload?.sub && payload.email) {
      if (!isAllowedGoogleAudience(payload.aud, allowedClientIds)) {
        throw new GoogleAuthError("Google token audience mismatch after verification.", "audience_mismatch", {
          audience: payload.aud ?? "missing",
          expectedProjects
        });
      }
      console.log("[Google Auth] verifyIdToken succeeded for:", payload.email);
      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        aud: payload.aud,
        iss: payload.iss,
        exp: payload.exp
      };
    }
    console.warn("[Google Auth] verifyIdToken returned payload but missing sub/email:", { sub: payload?.sub, email: payload?.email });
  } catch (verifyError) {
    console.warn("[Google Auth] verifyIdToken failed:", verifyError instanceof Error ? verifyError.message : verifyError);
  }

  // Fallback: try the tokeninfo endpoint (meant for debugging, but useful as a last resort).
  console.log("[Google Auth] Trying tokeninfo endpoint as fallback...");
  let fetchResponse: globalThis.Response | undefined;
  try {
    fetchResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  } catch (fetchError) {
    console.warn("[Google Auth] tokeninfo fetch failed:", fetchError);
  }

  if (fetchResponse && fetchResponse.ok) {
    const payload = await fetchResponse.json() as VerifiedGooglePayload;
    if (!payload.sub || !payload.email) {
      throw new GoogleAuthError("Google token payload is missing required identity fields.", "missing_identity", {
        audience: payload.aud,
        expectedProjects
      });
    }
    if (!isAllowedGoogleAudience(payload.aud, allowedClientIds)) {
      throw new GoogleAuthError("Google token audience mismatch.", "audience_mismatch", {
        audience: payload.aud ?? "missing",
        expectedProjects
      });
    }
    if (payload.iss && !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
      throw new GoogleAuthError("Google token issuer mismatch.", "issuer_mismatch", {
        audience: payload.aud,
        expectedProjects
      });
    }
    if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
      throw new GoogleAuthError("Google token is expired.", "expired", {
        audience: payload.aud,
        expectedProjects
      });
    }
    console.log("[Google Auth] tokeninfo fallback succeeded for:", payload.email);
    return payload;
  }

  const tokenInfoText = fetchResponse ? await fetchResponse.text().catch(() => "") : "network error";
  console.warn("[Google Auth] tokeninfo also failed:", fetchResponse?.status, tokenInfoText.slice(0, 200));

  // Both methods failed — try one more time with verifyIdToken using all allowed client IDs
  try {
    console.log("[Google Auth] Final attempt: verifyIdToken with all allowed client IDs");
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: allowedClientIds
    });
    const payload = ticket.getPayload();
    if (payload?.sub && payload.email) {
      console.log("[Google Auth] Final verifyIdToken attempt succeeded for:", payload.email);
      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        aud: payload.aud,
        iss: payload.iss,
        exp: payload.exp
      };
    }
  } catch (finalError) {
    const msg = finalError instanceof Error ? finalError.message : String(finalError);
    console.error("[Google Auth] All verification methods failed. Final error:", msg);
    throw new GoogleAuthError(`Google token could not be verified: ${msg}`, "verify_failed", {
      status: fetchResponse?.status,
      audience: decodedAudience,
      expectedProjects
    });
  }

  throw new GoogleAuthError("Google token payload could not be verified after all attempts.", "verify_failed", {
    status: fetchResponse?.status,
    audience: decodedAudience,
    expectedProjects
  });
}

function getGoogleAuthClientMessage(error: unknown): string {
  if (!(error instanceof GoogleAuthError)) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Google sign-in could not be verified (${msg}). Please refresh the page and try again.`;
  }

  if (error.code === "audience_mismatch") {
    return `Google OAuth client mismatch. Token audience is ${error.audience}; expected Google project ${error.expectedProjects || "unknown"}. Add the matching Web Client ID to GOOGLE_CLIENT_IDS.`;
  }
  if (error.code === "malformed_token") {
    return "Google returned an unreadable login credential. Refresh this page and try again.";
  }
  if (error.code === "expired") {
    return "Google login expired. Please click the Google button again.";
  }
  if (error.code === "verify_failed") {
    return `Google sign-in could not be verified (${error.message}). Please refresh the page and try again.`;
  }

  return "Google sign-in could not be verified. Please refresh the page and try again.";
}

function shouldExposeOtpForDemo(): boolean {
  return env.NODE_ENV !== "production" || process.env.OTP_DEMO_FALLBACK === "true";
}

function buildOtpStartResponse(message: string, sessionId: string, otp: string, fallbackReason?: string) {
  const response: { message: string; sessionId: string; expiresInSeconds: number; devOtp?: string } = {
    message,
    sessionId,
    expiresInSeconds: OTP_TTL_MS / 1000
  };

  if (shouldExposeOtpForDemo()) {
    response.devOtp = otp;
    if (fallbackReason) {
      response.message = `OTP email delivery is temporarily unavailable. Use OTP ${otp} to continue.`;
    }
  }

  return response;
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE_MS
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api/auth"
  });
}

async function persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: tokenHash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS)
    }
  });
}

async function recordSignIn(userId: string, method: SignInMethod): Promise<void> {
  try {
    await prisma.signInEvent.create({
      data: {
        userId,
        method
      }
    });
  } catch (error) {
    console.warn("Sign-in activity logging skipped:", error instanceof Error ? error.message : "unknown error");
  }
}

async function issueAuthResponse(
  res: Response,
  user: { id: string; name: string; email: string; role: "candidate" | "employer" | "admin" },
  method: SignInMethod
): Promise<void> {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await persistRefreshToken(user.id, refreshToken);
  await recordSignIn(user.id, method);
  setRefreshCookie(res, refreshToken);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken
  });
}

async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  const from = process.env.EMAIL_FROM ?? "no-reply@redresumes.com";
  const subject = "Your RedResumes OTP Code";
  const text = `Your OTP is ${otp}. It is valid for 5 minutes.`;

  if (provider === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey.includes("PASTE_YOUR_SENDGRID_KEY_HERE")) {
      throw new Error("EMAIL_CONFIG_ERROR: SENDGRID_API_KEY is not configured.");
    }
    if (!from || !from.includes("@")) {
      throw new Error("EMAIL_CONFIG_ERROR: EMAIL_FROM is not configured with a valid sender address.");
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from },
        subject,
        content: [{ type: "text/plain", value: text }]
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`EMAIL_SEND_FAILED: SendGrid request failed (${response.status}): ${body}`);
    }
    return;
  }

  if (provider === "smtp") {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = String(process.env.SMTP_SECURE ?? "false") === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error("EMAIL_CONFIG_ERROR: SMTP_HOST, SMTP_USER, and SMTP_PASS are required for SMTP mode.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text
    });
    return;
  }

  console.log(`[OTP DEMO] ${email} -> ${otp}`);
}

function getEmailDeliveryMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown email delivery error.";
  const lower = message.toLowerCase();

  if (message.includes("EMAIL_CONFIG_ERROR")) {
    return "OTP email is not configured on server. Set EMAIL_FROM and email provider credentials.";
  }
  if (message.includes("SendGrid request failed (401)")) {
    return "SendGrid API key is invalid or expired. Update SENDGRID_API_KEY in backend/.env.";
  }
  if (message.includes("SendGrid request failed (403)")) {
    return "SendGrid sender is not verified. Verify EMAIL_FROM in SendGrid Sender Authentication.";
  }
  if (lower.includes("username and password not accepted") || lower.includes("invalid login") || lower.includes("badcredentials")) {
    return "SMTP login failed. Use a Gmail App Password in SMTP_PASS (not your normal Gmail password).";
  }

  return "Failed to send OTP email. Please check email provider configuration and try again.";
}



router.post("/register/start", otpStartLimiter, async (req, res, next) => {
  try {
    const body = registerStartSchema.parse(req.body);
    const email = normalizedEmail(body.email);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ message: "This email is already registered. Please sign in." });
      return;
    }

    const sessionId = randomBytes(24).toString("hex");
    const otp = generateOtp();
    pendingOtpSignups.set(sessionId, {
      sessionId,
      name: body.name.trim(),
      email,
      password: body.password,
      role: body.role,
      otp,
      expiresAt: Date.now() + OTP_TTL_MS
    });

    setTimeout(() => {
      pendingOtpSignups.delete(sessionId);
    }, OTP_TTL_MS);

    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      if (shouldExposeOtpForDemo()) {
        res.json(buildOtpStartResponse("OTP generated for account verification.", sessionId, otp, getEmailDeliveryMessage(emailError)));
        return;
      }
      pendingOtpSignups.delete(sessionId);
      res.status(503).json({ message: getEmailDeliveryMessage(emailError) });
      return;
    }

    res.json(buildOtpStartResponse("OTP sent to your email for account verification.", sessionId, otp));
  } catch (error) {
    next(error);
  }
});

router.post("/register/verify", otpVerifyLimiter, async (req, res, next) => {
  try {
    const body = registerVerifySchema.parse(req.body);
    const pending = pendingOtpSignups.get(body.sessionId);
    if (!pending) {
      res.status(401).json({ message: "OTP session expired. Please create account again." });
      return;
    }
    if (Date.now() > pending.expiresAt) {
      pendingOtpSignups.delete(body.sessionId);
      res.status(401).json({ message: "OTP expired. Please create account again." });
      return;
    }
    if (pending.otp !== body.otp) {
      res.status(401).json({ message: "Invalid OTP." });
      return;
    }

    const exists = await prisma.user.findUnique({ where: { email: pending.email } });
    if (exists) {
      pendingOtpSignups.delete(body.sessionId);
      res.status(409).json({ message: "This email is already registered. Please sign in." });
      return;
    }

    const passwordHash = await bcrypt.hash(pending.password, 10);
    const user = await prisma.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        passwordHash,
        role: pending.role
      }
    });

    pendingOtpSignups.delete(body.sessionId);
    await issueAuthResponse(res, user, "email_password");
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = normalizedEmail(body.email);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash,
        role: body.role
      }
    });

    res.status(201);
    await issueAuthResponse(res, user, "email_password");
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const email = normalizedEmail(body.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    await issueAuthResponse(res, user, "email_password");
  } catch (error) {
    next(error);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    const allowedClientIds = getAllowedGoogleClientIds();
    console.log("[Google Auth] Allowed client IDs:", allowedClientIds);
    if (allowedClientIds.length === 0) {
      res.status(503).json({ message: "Google login is not configured. Set GOOGLE_CLIENT_ID on the server." });
      return;
    }

    const body = googleLoginSchema.parse(req.body);
    let payload: VerifiedGooglePayload;
    try {
      payload = await verifyGoogleCredential(body.credential, allowedClientIds);
    } catch (error) {
      console.warn("[Google Auth] credential rejected.", error instanceof Error ? error.message : error);
      res.status(401).json({
        message: getGoogleAuthClientMessage(error)
      });
      return;
    }

    if (!payload.sub || !payload.email || !isGoogleEmailVerified(payload.email_verified)) {
      res.status(401).json({ message: "Google account email is not verified." });
      return;
    }

    const email = normalizedEmail(payload.email);
    const displayName = payload.name?.trim() || email.split("@")[0] || "Google User";
    const existing = await prisma.user.findUnique({ where: { email } });
    const user = existing ?? await prisma.user.create({
      data: {
        name: displayName,
        email,
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        role: "candidate"
      }
    });

    await issueAuthResponse(res, user, "google");
  } catch (error) {
    next(error);
  }
});

router.post("/login/start", otpStartLimiter, async (req, res, next) => {
  try {
    const body = loginStartSchema.parse(req.body);
    const email = normalizedEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const sessionId = randomBytes(24).toString("hex");
    const otp = generateOtp();
    pendingOtpLogins.set(sessionId, {
      sessionId,
      userId: user.id,
      email: user.email,
      otp,
      expiresAt: Date.now() + OTP_TTL_MS
    });

    setTimeout(() => {
      pendingOtpLogins.delete(sessionId);
    }, OTP_TTL_MS);

    try {
      await sendOtpEmail(user.email, otp);
    } catch (emailError) {
      pendingOtpLogins.delete(sessionId);
      res.status(503).json({ message: getEmailDeliveryMessage(emailError) });
      return;
    }

    const response: { message: string; sessionId: string; expiresInSeconds: number; devOtp?: string } = {
      message: "OTP sent to your email.",
      sessionId,
      expiresInSeconds: OTP_TTL_MS / 1000
    };

    if (env.NODE_ENV !== "production") {
      response.devOtp = otp;
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post("/login/verify", otpVerifyLimiter, async (req, res, next) => {
  try {
    const body = loginVerifySchema.parse(req.body);
    const pending = pendingOtpLogins.get(body.sessionId);
    if (!pending) {
      res.status(401).json({ message: "OTP session expired. Please login again." });
      return;
    }
    if (Date.now() > pending.expiresAt) {
      pendingOtpLogins.delete(body.sessionId);
      res.status(401).json({ message: "OTP expired. Please login again." });
      return;
    }
    if (pending.otp !== body.otp) {
      res.status(401).json({ message: "Invalid OTP." });
      return;
    }

    pendingOtpLogins.delete(body.sessionId);
    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user) {
      res.status(401).json({ message: "User not found." });
      return;
    }

    await issueAuthResponse(res, user, "email_password");
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken || typeof refreshToken !== "string") {
      res.status(401).json({ message: "Missing refresh token cookie" });
      return;
    }

    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch (err) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }
    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash: tokenHash(refreshToken),
        expiresAt: { gt: new Date() }
      }
    });

    if (!stored) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role, email: payload.email });
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken && typeof refreshToken === "string") {
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: tokenHash(refreshToken) }
      });
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password/start", otpStartLimiter, async (req, res, next) => {
  try {
    const body = forgotPasswordStartSchema.parse(req.body);
    const email = normalizedEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // To prevent email enumeration, simulate success
      res.json({ message: "If that email is registered, we have sent an OTP.", sessionId: "dummy", expiresInSeconds: OTP_TTL_MS / 1000 });
      return;
    }

    const sessionId = randomBytes(24).toString("hex");
    const otp = generateOtp();
    pendingOtpForgot.set(sessionId, {
      sessionId,
      userId: user.id,
      email: user.email,
      otp,
      verified: false,
      expiresAt: Date.now() + OTP_TTL_MS
    });

    setTimeout(() => {
      pendingOtpForgot.delete(sessionId);
    }, OTP_TTL_MS);

    try {
      await sendOtpEmail(user.email, otp);
    } catch (emailError) {
      if (shouldExposeOtpForDemo()) {
        res.json(buildOtpStartResponse("OTP generated for password reset.", sessionId, otp, getEmailDeliveryMessage(emailError)));
        return;
      }
      pendingOtpForgot.delete(sessionId);
      res.status(503).json({ message: getEmailDeliveryMessage(emailError) });
      return;
    }

    res.json(buildOtpStartResponse("OTP sent to your email.", sessionId, otp));
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password/verify", otpVerifyLimiter, async (req, res, next) => {
  try {
    const body = forgotPasswordVerifySchema.parse(req.body);
    const pending = pendingOtpForgot.get(body.sessionId);
    if (!pending) {
      res.status(401).json({ message: "OTP session expired. Please request a new OTP." });
      return;
    }
    if (Date.now() > pending.expiresAt) {
      pendingOtpForgot.delete(body.sessionId);
      res.status(401).json({ message: "OTP expired. Please request a new OTP." });
      return;
    }
    if (pending.otp !== body.otp) {
      res.status(401).json({ message: "Invalid OTP." });
      return;
    }

    pending.verified = true;
    res.json({ message: "OTP verified successfully." });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password/reset", async (req, res, next) => {
  try {
    const body = forgotPasswordResetSchema.parse(req.body);
    const pending = pendingOtpForgot.get(body.sessionId);
    if (!pending || !pending.verified) {
      res.status(401).json({ message: "Unauthorized or session expired. Please verify OTP first." });
      return;
    }
    if (Date.now() > pending.expiresAt) {
      pendingOtpForgot.delete(body.sessionId);
      res.status(401).json({ message: "Session expired. Please start over." });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.update({
      where: { id: pending.userId },
      data: { passwordHash }
    });

    pendingOtpForgot.delete(body.sessionId);
    
    await prisma.refreshToken.deleteMany({
      where: { userId: pending.userId }
    });

    res.json({ message: "Password has been successfully reset. You can now log in." });
  } catch (error) {
    next(error);
  }
});

export default router;
