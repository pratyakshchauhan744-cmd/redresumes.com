import { Inngest } from "inngest";
import type { Events } from "../../lib/inngest/client.js";
import { prisma } from "../../db/prisma.js";
import {
  getOnboardingState,
  shouldSuppressAll,
  shouldSuppressUpgrade,
  getUsageStats,
} from "../../lib/onboarding/rules.js";
import { sendEmail } from "../../lib/email/send.js";
import { renderEmail1 } from "../../lib/email/templates/email-1.js";
import { renderEmail2 } from "../../lib/email/templates/email-2.js";
import { renderEmail3 } from "../../lib/email/templates/email-3.js";
import { renderEmail4 } from "../../lib/email/templates/email-4.js";
import { logEvent } from "../../lib/logging.js";

const inngest = new Inngest({ id: "redresumes" });

// ---------------------------------------------------------------------------
// Durable onboarding sequence — triggered by user/resume.downloaded
//
// Each email step follows the same pattern:
//   1. step.sleep() for the configured delay
//   2. step.run() to fetch current onboarding state (deterministic check)
//   3. Early-return if user unsubscribed
//   4. Decide which variant to send (or suppress if paid + upgrade-oriented)
//   5. step.run() to render + send the email via the centralized helper
//
// Every side-effecting action is wrapped in step.run() so Inngest can
// checkpoint, retry, and resume without double-sending.
// ---------------------------------------------------------------------------

export const redresumesOnboarding = inngest.createFunction(
  {
    id: "redresumes-onboarding-sequence",
    // Concurrency limit per user prevents overlapping flows if somehow
    // two events slip past the DB-level idempotency check
    concurrency: [{ scope: "account", key: "event.data.userId", limit: 1 }],
    triggers: [{ event: "user/resume.downloaded" }],
  },
  async ({ event, step }: { event: { data: Events["user/resume.downloaded"]["data"] }; step: any }) => {
    const { userId, resumeId, userEmail, userName } = event.data;

    // ── Resolve enrollment ID ────────────────────────────────────────
    const enrollment = await step.run("resolve-enrollment", async () => {
      const row = await prisma.onboardingEnrollment.findFirst({
        where: { userId, flowType: "resume_onboarding", status: "active" },
        select: { id: true },
      });
      return row;
    });

    if (!enrollment) {
      logEvent("onboarding.no_enrollment", { userId });
      return { status: "skipped", reason: "no_active_enrollment" };
    }

    const enrollmentId = enrollment.id;

    // ── EMAIL 1: Welcome + ATS Scorecard (immediate) ─────────────────
    const state1 = await step.run("check-state-email-1", async () => {
      return getOnboardingState(userId);
    });

    if (shouldSuppressAll(state1)) {
      return { status: "stopped", reason: "unsubscribed_before_email_1" };
    }

    await step.run("send-email-1", async () => {
      const template = renderEmail1({ userName, resumeId, userId });

      if (shouldSuppressUpgrade(state1, template.isUpgradeOriented)) {
        logEvent("email.suppressed", { emailNumber: 1, templateKey: template.templateKey, userId });
        return { suppressed: true };
      }

      await sendEmail({
        to: userEmail,
        subject: template.subject,
        html: template.html,
        emailNumber: 1,
        templateKey: template.templateKey,
        enrollmentId,
        userId,
      });

      return { suppressed: false };
    });

    // ── WAIT 2 DAYS ──────────────────────────────────────────────────
    await step.sleep("wait-for-email-2", "2 days");

    // ── EMAIL 2: Mock Interview Pitch (branching) ────────────────────
    const state2 = await step.run("check-state-email-2", async () => {
      return getOnboardingState(userId);
    });

    if (shouldSuppressAll(state2)) {
      return { status: "stopped", reason: "unsubscribed_before_email_2" };
    }

    await step.run("send-email-2", async () => {
      const template = renderEmail2({
        userName,
        userId,
        mockInterviewState: state2.mockInterviewState,
      });

      if (shouldSuppressUpgrade(state2, template.isUpgradeOriented)) {
        logEvent("email.suppressed", { emailNumber: 2, templateKey: template.templateKey, userId });
        return { suppressed: true, variant: template.variant };
      }

      await sendEmail({
        to: userEmail,
        subject: template.subject,
        html: template.html,
        emailNumber: 2,
        templateKey: template.templateKey,
        enrollmentId,
        userId,
      });

      return { suppressed: false, variant: template.variant };
    });

    // ── WAIT 2 MORE DAYS ─────────────────────────────────────────────
    await step.sleep("wait-for-email-3", "2 days");

    // ── EMAIL 3: Portfolio Upsell / Activation (branching) ───────────
    const state3 = await step.run("check-state-email-3", async () => {
      return getOnboardingState(userId);
    });

    if (shouldSuppressAll(state3)) {
      return { status: "stopped", reason: "unsubscribed_before_email_3" };
    }

    await step.run("send-email-3", async () => {
      const template = renderEmail3({
        userName,
        userId,
        portfolioUpgraded: state3.portfolioUpgraded,
      });

      if (shouldSuppressUpgrade(state3, template.isUpgradeOriented)) {
        logEvent("email.suppressed", { emailNumber: 3, templateKey: template.templateKey, userId });
        return { suppressed: true, variant: template.variant };
      }

      await sendEmail({
        to: userEmail,
        subject: template.subject,
        html: template.html,
        emailNumber: 3,
        templateKey: template.templateKey,
        enrollmentId,
        userId,
      });

      return { suppressed: false, variant: template.variant };
    });

    // ── WAIT 3 MORE DAYS ─────────────────────────────────────────────
    await step.sleep("wait-for-email-4", "3 days");

    // ── EMAIL 4: Social Proof / Stats ────────────────────────────────
    const state4 = await step.run("check-state-email-4", async () => {
      return getOnboardingState(userId);
    });

    if (shouldSuppressAll(state4)) {
      return { status: "stopped", reason: "unsubscribed_before_email_4" };
    }

    await step.run("send-email-4", async () => {
      const stats = await getUsageStats();
      const template = renderEmail4({ userName, userId, stats });

      if (shouldSuppressUpgrade(state4, template.isUpgradeOriented)) {
        logEvent("email.suppressed", { emailNumber: 4, templateKey: template.templateKey, userId });
        return { suppressed: true };
      }

      await sendEmail({
        to: userEmail,
        subject: template.subject,
        html: template.html,
        emailNumber: 4,
        templateKey: template.templateKey,
        enrollmentId,
        userId,
      });

      return { suppressed: false };
    });

    // ── Mark enrollment complete ─────────────────────────────────────
    await step.run("mark-complete", async () => {
      await prisma.onboardingEnrollment.update({
        where: { id: enrollmentId },
        data: { status: "completed" },
      });
    });

    return { status: "completed" };
  }
);
