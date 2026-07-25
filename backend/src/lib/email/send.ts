import nodemailer from "nodemailer";
import { resend } from "../resend.js";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { logEvent } from "../logging.js";

// ---------------------------------------------------------------------------
// Centralized email send helper.
// Primary: SMTP (Gmail verified credentials).
// Fallback: Resend SDK.
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  emailNumber: number;
  templateKey: string;
  enrollmentId: string;
  userId: string;
  isInformational?: boolean;
}

export interface SendEmailResult {
  providerMessageId: string;
}

// Default production SMTP fallback credentials to guarantee 100% email delivery on Railway
const DEFAULT_SMTP_HOST = env.SMTP_HOST || "smtp.gmail.com";
const DEFAULT_SMTP_PORT = env.SMTP_PORT || 465;
const DEFAULT_SMTP_USER = env.SMTP_USER || "pratyakshchauhan744@gmail.com";
const DEFAULT_SMTP_PASS = env.SMTP_PASS || "iuqg cluj yujo sfhe";

const smtpTransporter = nodemailer.createTransport({
  host: DEFAULT_SMTP_HOST,
  port: DEFAULT_SMTP_PORT,
  secure: true,
  auth: {
    user: DEFAULT_SMTP_USER,
    pass: DEFAULT_SMTP_PASS,
  },
});

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const appUrl = env.APP_URL || "http://localhost:4000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${params.userId}`;

  let providerMessageId = "";

  // 1. Primary Transport: SMTP (Guaranteed Active & Verified)
  try {
    const senderEmail = DEFAULT_SMTP_USER;
    const info = await smtpTransporter.sendMail({
      from: `"Arvind from RedResumes" <${senderEmail}>`,
      replyTo: "Arvind@redresumes.com",
      to: params.to,
      subject: params.subject,
      html: params.html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (info?.messageId) {
      providerMessageId = info.messageId;
      logEvent("email.smtp_sent", { to: params.to, messageId: providerMessageId });
    }
  } catch (smtpErr: any) {
    logEvent("email.smtp_error", { error: smtpErr.message });
  }

  // 2. Secondary Transport Fallback: Resend SDK
  if (!providerMessageId && env.RESEND_API_KEY) {
    try {
      const fromAddress =
        env.RESEND_FROM || "Arvind from RedResumes <Arvind@redresumes.com>";

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: params.to,
        replyTo: "Arvind@redresumes.com",
        subject: params.subject,
        html: params.html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (!error && data?.id) {
        providerMessageId = data.id;
        logEvent("email.resend_sent", { to: params.to, messageId: providerMessageId });
      } else if (error) {
        logEvent("email.resend_error", { error: error.message });
      }
    } catch (resendErr: any) {
      logEvent("email.resend_exception", { error: resendErr.message });
    }
  }

  if (!providerMessageId) {
    throw new Error("No valid email transport (SMTP or Resend) succeeded.");
  }

  // Record send in audit table
  await prisma.onboardingEmailSend.create({
    data: {
      enrollmentId: params.enrollmentId,
      emailNumber: params.emailNumber,
      templateKey: params.templateKey,
      subject: params.subject,
      providerMessageId,
      status: "sent",
    },
  });

  logEvent("email.sent", {
    to: params.to,
    templateKey: params.templateKey,
    emailNumber: params.emailNumber,
    enrollmentId: params.enrollmentId,
    providerMessageId,
  });

  return { providerMessageId };
}
