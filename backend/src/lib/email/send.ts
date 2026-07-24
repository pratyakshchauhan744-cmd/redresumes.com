import { resend } from "../resend.js";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { logEvent } from "../logging.js";

// ---------------------------------------------------------------------------
// Centralized email send helper — every outbound email goes through here.
// Adds required List-Unsubscribe headers for Gmail/Yahoo bulk-sender
// compliance, logs the send, and returns the provider message ID.
//
// Templates and the workflow function never call Resend directly.
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Used to record which email in the sequence was sent */
  emailNumber: number;
  /** Template key for audit trail (e.g. "email-1", "email-2-alt-clarity") */
  templateKey: string;
  /** Enrollment ID for the onboarding flow */
  enrollmentId: string;
  /** User ID for building unsubscribe link */
  userId: string;
  /** If true, this template is purely informational and shouldn't be
   *  suppressed when the user upgrades to paid. Default: false (= upgrade-oriented). */
  isInformational?: boolean;
}

export interface SendEmailResult {
  providerMessageId: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const fromAddress =
    env.RESEND_FROM ||
    (env.NODE_ENV === "production"
      ? "Arvind@redresumes.com"
      : "onboarding@resend.dev");
  const appUrl = env.APP_URL || "http://localhost:4000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${params.userId}`;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    html: params.html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    logEvent("email.send_failed", {
      to: params.to,
      templateKey: params.templateKey,
      enrollmentId: params.enrollmentId,
      error: error.message,
    });
    throw new Error(`Resend send failed: ${error.message}`);
  }

  const providerMessageId = data?.id ?? "unknown";

  // Record the send in our audit table
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

  // Analytics seam — emit an event for later wiring to PostHog/Segment
  logEvent("email.sent", {
    to: params.to,
    templateKey: params.templateKey,
    emailNumber: params.emailNumber,
    enrollmentId: params.enrollmentId,
    providerMessageId,
  });

  return { providerMessageId };
}
