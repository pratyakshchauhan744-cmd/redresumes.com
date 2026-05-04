import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes, randomInt } from "crypto";
import nodemailer from "nodemailer";
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
    sameSite: "lax",
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE_MS
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
    sameSite: "lax",
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

async function issueAuthResponse(
  res: Response,
  user: { id: string; name: string; email: string; role: "candidate" | "employer" | "admin" }
): Promise<void> {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await persistRefreshToken(user.id, refreshToken);
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
      pendingOtpSignups.delete(sessionId);
      res.status(503).json({ message: getEmailDeliveryMessage(emailError) });
      return;
    }

    res.json({
      message: "OTP sent to your email for account verification.",
      sessionId,
      expiresInSeconds: OTP_TTL_MS / 1000
    });
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
    await issueAuthResponse(res, user);
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
    await issueAuthResponse(res, user);
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

    await issueAuthResponse(res, user);
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

    await issueAuthResponse(res, user);
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

    const payload = verifyToken(refreshToken);
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

    const accessToken = signAccessToken(payload);
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
      pendingOtpForgot.delete(sessionId);
      res.status(503).json({ message: getEmailDeliveryMessage(emailError) });
      return;
    }

    res.json({
      message: "OTP sent to your email.",
      sessionId,
      expiresInSeconds: OTP_TTL_MS / 1000
    });
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
