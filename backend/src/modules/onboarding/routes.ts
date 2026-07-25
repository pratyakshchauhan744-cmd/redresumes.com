import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { sendEvent } from "../../lib/inngest/client.js";
import { tryEnroll } from "../../lib/onboarding/idempotency.js";
import { sendEmail } from "../../lib/email/send.js";
import { renderEmail1 } from "../../lib/email/templates/email-1.js";
import { logEvent } from "../../lib/logging.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/onboarding/resume-downloaded
//
// Trigger endpoint for the onboarding flow. Called when a user downloads
// or creates a resume. Performs DB-level idempotency check before emitting
// the Inngest event — duplicate calls (retries, re-downloads) are silently
// skipped without starting a second flow.
// ---------------------------------------------------------------------------

router.post("/resume-downloaded", async (req, res) => {
  try {
    const { userId, resumeId } = req.body;

    if (!userId || !resumeId) {
      res.status(400).json({ error: "userId and resumeId are required" });
      return;
    }

    // Fetch user info for the email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // DB-level idempotency — unique constraint on (userId, flowType)
    const result = await tryEnroll({
      userId,
      flowType: "resume_onboarding",
      sourceResumeId: resumeId,
    });

    if (!result.enrolled) {
      logEvent("onboarding.duplicate_skipped", { userId, resumeId });
      res.status(200).json({ status: "already_enrolled" });
      return;
    }

    // 1. Return HTTP 200 OK immediately so frontend PDF download never hangs
    res.status(200).json({ status: "enrolled", enrollmentId: result.enrollmentId });

    // 2. Execute email dispatch & Inngest event asynchronously in background
    setImmediate(async () => {
      try {
        const email1 = renderEmail1({
          userName: user.name || "",
          resumeId,
          userId,
        });
        await sendEmail({
          to: user.email,
          subject: email1.subject,
          html: email1.html,
          emailNumber: 1,
          templateKey: email1.templateKey,
          enrollmentId: result.enrollmentId,
          userId,
        });
        logEvent("onboarding.immediate_email_sent", { userId, resumeId });
      } catch (emailErr: any) {
        logEvent("onboarding.immediate_email_failed", { userId, error: emailErr.message });
      }

      try {
        await sendEvent("user/resume.downloaded", {
          data: {
            userId,
            resumeId,
            userEmail: user.email,
            userName: user.name ?? "",
          },
        });
      } catch (sendErr: any) {
        logEvent("onboarding.event_send_failed", { userId, error: sendErr.message });
      }
    });

    logEvent("onboarding.enrolled", {
      userId,
      resumeId,
      enrollmentId: result.enrollmentId,
    });

    res.status(200).json({
      status: "enrolled",
      enrollmentId: result.enrollmentId,
    });
  } catch (error: any) {
    logEvent("onboarding.trigger_error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/onboarding/unsubscribe?userId=...
//
// One-click unsubscribe endpoint. Sets the unsubscribedAt flag in
// UserLifecycleFlags so the next workflow step sees it and stops.
// ---------------------------------------------------------------------------

router.get("/unsubscribe", async (req, res) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).send("Missing userId");
      return;
    }

    await prisma.userLifecycleFlags.upsert({
      where: { userId },
      create: { userId, unsubscribedAt: new Date() },
      update: { unsubscribedAt: new Date() },
    });

    // Also emit an Inngest event so other systems can react
    await sendEvent("user/unsubscribed", { data: { userId } });

    logEvent("onboarding.unsubscribed", { userId });

    res.status(200).send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>You've been unsubscribed</h2>
          <p>You won't receive any more onboarding emails from RedResumes.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    logEvent("onboarding.unsubscribe_error", { error: error.message });
    res.status(500).send("Something went wrong. Please try again.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/unsubscribe (List-Unsubscribe-Post: One-Click)
//
// RFC 8058 one-click unsubscribe via POST — required for Gmail/Yahoo
// bulk sender compliance. Same logic as the GET handler above.
// ---------------------------------------------------------------------------

router.post("/unsubscribe", async (req, res) => {
  try {
    const userId = (req.query.userId || req.body?.userId) as string;

    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    await prisma.userLifecycleFlags.upsert({
      where: { userId },
      create: { userId, unsubscribedAt: new Date() },
      update: { unsubscribedAt: new Date() },
    });

    await sendEvent("user/unsubscribed", { data: { userId } });
    logEvent("onboarding.unsubscribed_oneclick", { userId });

    res.status(200).json({ status: "unsubscribed" });
  } catch (error: any) {
    logEvent("onboarding.unsubscribe_error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
