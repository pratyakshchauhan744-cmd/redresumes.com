import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Determine if EMAIL_FROM is a Gmail address (can't be used as Resend sender)
const emailFrom = env.EMAIL_FROM || "pratyakshchauhan744@gmail.com";
const isGmailSender = emailFrom.toLowerCase().includes("@gmail.com");

// Build a friendly display name for the from address
const fromAddress = isGmailSender
  ? emailFrom // Gmail: use bare address; display name set in transporter
  : (emailFrom.includes("<") ? emailFrom : `RedResumes Enterprise <${emailFrom}>`);

// Resend "from" field — only use custom domain; Gmail addresses are rejected by Resend
const resendFrom = (!isGmailSender && emailFrom)
  ? fromAddress
  : "RedResumes <onboarding@resend.dev>";

export class EmailService {
  /**
   * Helper: Send email using the best available provider.
   * Priority: Gmail SMTP (if EMAIL_FROM is @gmail.com) → Resend → Generic SMTP → Simulate
   */
  private static async sendEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; error?: string; simulated?: boolean; messageId?: string }> {

    // ── 1. Gmail SMTP (highest priority when using a Gmail FROM address) ─────
    if (isGmailSender && env.SMTP_USER && env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true, // SSL
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS, // Use Gmail App Password (not your account password)
          },
        });

        const info = await transporter.sendMail({
          from: `RedResumes Campus <${emailFrom}>`,
          to,
          subject,
          html,
        });
        console.log(`[EMAIL] Sent via Gmail SMTP → ${to} | msgId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (smtpErr: any) {
        console.error("[EMAIL] Gmail SMTP failed:", smtpErr?.message || smtpErr);
        // Fall through to Resend as backup
      }
    }

    // ── 2. Resend (for verified custom domains) ──────────────────────────────
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: resendFrom,
          to,
          subject,
          html,
        });
        if (result.error) {
          console.warn("[EMAIL] Resend reported delivery error:", result.error);
          // Don't return failure here — fall through to SMTP
        } else {
          console.log(`[EMAIL] Sent via Resend → ${to} | msgId: ${result.data?.id}`);
          return { success: true, messageId: result.data?.id };
        }
      } catch (err: any) {
        console.error("[EMAIL] Resend API failed:", err?.message || err);
      }
    }

    // ── 3. Generic SMTP fallback ─────────────────────────────────────────────
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: parseInt(env.SMTP_PORT as any) || 587,
          secure: Boolean(env.SMTP_SECURE),
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          html,
        });
        console.log(`[EMAIL] Sent via SMTP → ${to} | msgId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (smtpErr: any) {
        console.error("[EMAIL] Generic SMTP failed:", smtpErr?.message || smtpErr);
        return { success: false, error: smtpErr?.message || "SMTP delivery failed" };
      }
    }

    // ── 4. Simulation fallback (dev/no-config) ───────────────────────────────
    console.log(`[EMAIL SIMULATED] To: ${to} | Subject: "${subject}" — No mail provider configured.`);
    console.log(`[EMAIL SIMULATED] To send real emails, add SMTP_USER and SMTP_PASS (Gmail App Password) to your .env`);
    return { success: true, simulated: true };
  }

  /**
   * Sends faculty invitation email with activation link & temporary credentials
   */
  static async sendFacultyInvitation({
    to,
    recipientName,
    collegeName,
    isMainFaculty,
    activationLink,
    tempPassword,
  }: {
    to: string;
    recipientName: string;
    collegeName: string;
    isMainFaculty: boolean;
    activationLink: string;
    tempPassword?: string;
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

          ${
            tempPassword
              ? `
          <div style="background-color: #090d16; border: 1px dashed #334155; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Your Login Credentials</p>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #f8fafc;"><strong>Login ID:</strong> ${to}</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #f43f5e; font-family: monospace;"><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          `
              : ""
          }

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
      console.error("sendStudentWelcomeEmail error:", err);
      return { success: false, error: err?.message || "Failed to send welcome email" };
    }
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
