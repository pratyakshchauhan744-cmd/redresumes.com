import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Keep provider outages from holding account creation open for SMTP's defaults
// (minutes). SMTP bounds cover each network stage; HTTPS has one total deadline.
const EMAIL_TIMEOUT_MS = 3000;
const smtpTimeouts = {
  connectionTimeout: EMAIL_TIMEOUT_MS,
  greetingTimeout: EMAIL_TIMEOUT_MS,
  socketTimeout: EMAIL_TIMEOUT_MS,
  dnsTimeout: EMAIL_TIMEOUT_MS,
};
const emailFrom = env.EMAIL_FROM || "pratyakshchauhan744@gmail.com";
const isGmailSender = emailFrom.toLowerCase().includes("@gmail.com");
const fromAddress = isGmailSender || emailFrom.includes("<")
  ? emailFrom : `RedResumes Enterprise <${emailFrom}>`;
const resendFrom = env.RESEND_FROM || (!isGmailSender ? fromAddress : "RedResumes <onboarding@resend.dev>");
const hasSmtp = Boolean(env.SMTP_USER && env.SMTP_PASS);
// Reuse transporter configuration and avoid attempting the same Gmail endpoint
// again as the generic fallback after a failure.
const smtpTransporters = hasSmtp ? [
  ...(isGmailSender ? [nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, ...smtpTimeouts,
  })] : []),
  ...(env.SMTP_HOST && !(isGmailSender && env.SMTP_HOST.toLowerCase() === "smtp.gmail.com")
    ? [nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT,
      secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, ...smtpTimeouts,
    })] : []),
] : [];

/** Strip emails, API-key/token-like strings and bearer values; bound the length. */
export function sanitizeProviderMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "no message returned";
  return value
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[redacted-email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(re_|sk_|key_)[A-Za-z0-9_-]+/gi, "[redacted-key]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export class EmailService {
  /** Prefer transactional HTTPS when configured; fall back to bounded SMTP. */
  private static async sendEmail({ to, subject, html }: {
    to: string; subject: string; html: string;
  }): Promise<{ success: boolean; error?: string; simulated?: boolean; messageId?: string }> {
    let lastError = "The email service is temporarily unavailable.";
    // The HTTPS provider's rejection is the most actionable error. Keep it so a
    // later SMTP fallback failure cannot overwrite it with a generic message.
    let resendError: string | undefined;
    if (env.RESEND_API_KEY) {
      try {
        // Native fetch supports cancellation, unlike an uncancelled Promise.race
        // around the SDK. Abort the network request when the deadline expires.
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: resendFrom, to, subject, html }),
          signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        });
        const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
        if (response.ok && result.id) return { success: true, messageId: result.id };
        const detail = sanitizeProviderMessage(result.message);
        // Log status and sanitized message only: no key, recipient or payload.
        console.error(`[EMAIL] Resend rejected request: HTTP ${response.status} - ${detail}`);
        resendError = `Resend rejected request (HTTP ${response.status}): ${detail}`;
        lastError = resendError;
      } catch (error) {
        // A timeout has an ambiguous delivery outcome. Do not submit the same
        // email to another provider while the first may already have accepted it.
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          return { success: false, error: "Email delivery timed out. Check invitation status before resending." };
        }
        lastError = "The email service is temporarily unavailable.";
      }
    }

    for (const transporter of smtpTransporters) {
      try {
        const info = await transporter.sendMail({ from: fromAddress, to, subject, html });
        return { success: true, messageId: info.messageId };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "SMTP delivery failed";
        const code = (error as { code?: string })?.code;
        console.error(`[EMAIL] SMTP fallback failed${code ? ` (${code})` : ""}${resendError ? "; Resend had already rejected the request" : ""}`);
        if (code === "ETIMEDOUT") {
          return {
            success: false,
            error: resendError ?? "Email delivery timed out. Check invitation status before resending.",
          };
        }
        // Keep the original Resend rejection rather than the SMTP error.
        if (resendError) lastError = resendError;
      }
    }
    // Never report a configured provider's failure as successful simulation.
    if (env.RESEND_API_KEY || smtpTransporters.length > 0) return { success: false, error: lastError };
    console.log("[EMAIL SIMULATED] No mail provider configured.");
    return { success: true, simulated: true };
  }

  /**
   * Sends a faculty invitation link. Faculty choose their password during
   * invitation acceptance; plaintext credentials are never emailed.
   */
  static async sendFacultyInvitation({
    to,
    recipientName,
    collegeName,
    isMainFaculty,
    activationLink,
  }: {
    to: string;
    recipientName: string;
    collegeName: string;
    isMainFaculty: boolean;
    activationLink: string;
  }) {
    const roleTitle = isMainFaculty ? "Main Faculty Administrator" : "Faculty Member / Evaluator";
    const subject = `Welcome to RedResumes Enterprise — ${collegeName}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #090d16; color: #f1f5f9; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #f43f5e; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">RedResumes<span style="color: #fff; font-size: 14px; font-weight: 500; margin-left: 8px; background-color: #e11d48; padding: 3px 8px; border-radius: 6px;">Campus</span></h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Institutional Placement & AI Mock Interview Platform</p>
        </div>

        <div style="background-color: #0f172a; padding: 28px; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 24px;">
          <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Welcome, ${recipientName}!</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            You have been invited as <strong>${roleTitle}</strong> for <strong>${collegeName}</strong> on RedResumes.
          </p>

          <div style="text-align: center; margin: 28px 0 16px;">
            <a href="${activationLink}" style="display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);">
              Activate Your Account
            </a>
          </div>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
          If you did not expect this invitation, please ignore this email.<br/>
          &copy; ${new Date().getFullYear()} RedResumes Inc. All rights reserved.
        </p>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends student onboarding welcome email with credentials & login URL
   */
  static async sendStudentWelcomeEmail({
    to,
    recipientName,
    collegeName,
    enrollmentNumber,
    tempPassword,
    loginUrl,
  }: {
    to: string;
    recipientName: string;
    collegeName: string;
    enrollmentNumber: string;
    tempPassword: string;
    loginUrl: string;
  }): Promise<{ success: boolean; error?: string; simulated?: boolean }> {
    const subject = `Welcome to RedResumes — ${collegeName}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #090d16; color: #f1f5f9; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #f43f5e; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">RedResumes<span style="color: #fff; font-size: 14px; font-weight: 500; margin-left: 8px; background-color: #e11d48; padding: 3px 8px; border-radius: 6px;">Campus</span></h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Institutional Placement & AI Mock Interview Platform</p>
        </div>

        <div style="background-color: #0f172a; padding: 28px; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 24px;">
          <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Welcome to RedResumes, ${recipientName}!</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            <strong>${collegeName}</strong> has provisioned your student account for RedResumes AI Mock Interviews (Roll No: <strong>${enrollmentNumber}</strong>).
          </p>

          <div style="background-color: #090d16; border: 1px dashed #334155; padding: 18px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Your Student Login Credentials</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8fafc;"><strong>Login ID:</strong> <span style="font-family: monospace; color: #38bdf8;">${to}</span></p>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #f8fafc;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #f43f5e; font-weight: 700;">${tempPassword}</span></p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;"><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #38bdf8; text-decoration: underline;">${loginUrl}</a></p>
          </div>

          <div style="text-align: center; margin: 28px 0 16px;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);">
              Log In & Start AI Mock Interview
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; line-height: 1.5;">
            Please log in and update your password upon first access. Never share your credentials with anyone.
          </p>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} RedResumes Inc. All rights reserved.
        </p>
      </div>
    `;

    try {
      return await this.sendEmail({ to, subject, html });
    } catch (err: any) {
      console.error("Student welcome email send failed.");
      return { success: false, error: err?.message || "Failed to send welcome email" };
    }
  }

  /**
   * Sends a single-use password setup link without exposing or changing the
   * student's current credential. The password changes only when the link is
   * accepted through the invitation endpoint.
   */
  static async sendStudentPasswordSetupEmail({
    to,
    recipientName,
    collegeName,
    enrollmentNumber,
    setupLink,
  }: {
    to: string;
    recipientName: string;
    collegeName: string;
    enrollmentNumber: string;
    setupLink: string;
  }): Promise<{ success: boolean; error?: string; simulated?: boolean; messageId?: string }> {
    const subject = `Set up your RedResumes password — ${collegeName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #090d16; color: #f1f5f9; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <h1 style="color: #f43f5e; margin: 0 0 24px; font-size: 26px;">RedResumes Campus</h1>
        <div style="background-color: #0f172a; padding: 28px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Set up your password</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Hello ${recipientName}, ${collegeName} requested a new password setup link for your student account
            (${enrollmentNumber}). Your current password remains valid until you complete this setup.
          </p>
          <div style="text-align: center; margin: 28px 0 16px;">
            <a href="${setupLink}" style="display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 8px;">
              Choose a New Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
            This single-use link expires in 24 hours. If you did not request it, ignore this email and continue using your existing password.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }

  /**
   * Alias for backward compatibility
   */
  static async sendStudentInvitation(params: {
    to: string;
    recipientName: string;
    collegeName: string;
    enrollmentNumber: string;
    activationLink: string;
    tempPassword?: string;
  }) {
    return this.sendStudentWelcomeEmail({
      to: params.to,
      recipientName: params.recipientName,
      collegeName: params.collegeName,
      enrollmentNumber: params.enrollmentNumber,
      tempPassword: params.tempPassword || "TempPass#123",
      loginUrl: params.activationLink,
    });
  }

  /**
   * Sends credit allocation notice to college administrators
   */
  static async sendCreditAllocationNotice({
    to,
    collegeName,
    creditsAllocated,
    totalBalance,
    reason,
  }: {
    to: string;
    collegeName: string;
    creditsAllocated: number;
    totalBalance: number;
    reason: string;
  }) {
    const subject = `Credits Allocated to ${collegeName} — RedResumes Enterprise`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #090d16; color: #f1f5f9; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Credit Allocation Notice</h2>
        <p style="color: #cbd5e1; font-size: 14px;">
          RedResumes Super Admin has allocated <strong>${creditsAllocated} credits</strong> to <strong>${collegeName}</strong>.
        </p>
        <div style="background-color: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #1e293b; margin: 16px 0;">
          <p style="margin: 0; color: #38bdf8; font-size: 16px; font-weight: 700;">New Balance: ${totalBalance} Credits</p>
          <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px;">Reason: ${reason}</p>
        </div>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }
}
