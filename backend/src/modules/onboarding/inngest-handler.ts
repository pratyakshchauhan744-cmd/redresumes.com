import { serve } from "inngest/express";
import { inngestClient } from "../../lib/inngest/client.js";
import { redresumesOnboarding } from "../../inngest/functions/redresumes-onboarding.js";
import {
  handleMockInterviewStarted,
  handleMockInterviewCompleted,
  handlePortfolioUpgraded,
  handlePaidPlanUpgraded,
  handleUserUnsubscribed,
} from "../../inngest/functions/lifecycle-events.js";

// ---------------------------------------------------------------------------
// Inngest integration for Express backend.
// Registers all workflow and lifecycle event handler functions with Inngest.
// ---------------------------------------------------------------------------

/**
 * Express middleware that serves the Inngest API endpoint.
 * Mount it as: app.use("/api/inngest", inngestMiddleware)
 */
export const inngestMiddleware = serve({
  client: inngestClient,
  functions: [
    redresumesOnboarding,
    handleMockInterviewStarted,
    handleMockInterviewCompleted,
    handlePortfolioUpgraded,
    handlePaidPlanUpgraded,
    handleUserUnsubscribed,
  ],
});
