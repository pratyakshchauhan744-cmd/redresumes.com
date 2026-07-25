import nodemailer from "nodemailer";
import { resend } from "../resend.js";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { logEvent } from "../logging.js";

// ---------------------------------------------------------------------------
// Centralized email send helper — prioritizing Gmail SMTP for instant delivery.
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

const smtpTransporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 465,
        secure: env.SMTP_SECURE ?? true,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    : null;

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const appUrl = env.APP_URL || "http://localhost:4000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${params.userId}`;

  let providerMessageId = "";

  // 1. Primary Transport: Gmail SMTP (Verified & Active)
  if (smtpTransporter) {
    try {
      const senderEmail = env.SMTP_USER || "pratyakshchauhan744@gmail.com";
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
  }

  // 2. Secondary Transport Fallback: Resend SDK
  if (!providerMessageId && env.RESEND_API_KEY) {
    try {
      const fromAddress =
        env.RESEND_FROM ||
        (env.NODE_ENV === "production"
          ? "Arvind from RedResumes <Arvind@redresumes.com>"
          : "onboarding@resend.dev");

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
