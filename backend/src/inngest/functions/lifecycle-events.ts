import { Inngest } from "inngest";
import type { Events } from "../../lib/inngest/client.js";
import { updateUserLifecycleFlags } from "../../lib/onboarding/rules.js";
import { logEvent } from "../../lib/logging.js";

const inngest = new Inngest({ id: "redresumes" });

// ---------------------------------------------------------------------------
// Inngest listeners for user lifecycle events.
// Every time a user interacts with mock interviews, upgrades portfolio,
// upgrades to paid plan, or unsubscribes, these functions automatically update
// UserLifecycleFlags in the database.
// ---------------------------------------------------------------------------

export const handleMockInterviewStarted = inngest.createFunction(
  { id: "handle-mock-interview-started", triggers: [{ event: "user/mock_interview.started" }] },
  async ({ event, step }: { event: { data: Events["user/mock_interview.started"]["data"] }; step: any }) => {
    const { userId, state } = event.data;

    await step.run("update-lifecycle-flags", async () => {
      const now = new Date();
      const updates: Parameters<typeof updateUserLifecycleFlags>[1] = {};

      if (state === "entered_room") {
        updates.enteredInterviewRoomAt = now;
      } else if (state === "paid_access") {
        updates.paidInterviewAccessAt = now;
      } else {
        updates.startedMockInterviewAt = now;
      }

      await updateUserLifecycleFlags(userId, updates);
      logEvent("lifecycle.mock_interview_started", { userId, state });
    });
  }
);

export const handleMockInterviewCompleted = inngest.createFunction(
  { id: "handle-mock-interview-completed", triggers: [{ event: "user/mock_interview.completed" }] },
  async ({ event, step }: { event: { data: Events["user/mock_interview.completed"]["data"] }; step: any }) => {
    const { userId } = event.data;

    await step.run("update-lifecycle-flags", async () => {
      await updateUserLifecycleFlags(userId, {
        completedMockInterviewAt: new Date(),
      });
      logEvent("lifecycle.mock_interview_completed", { userId });
    });
  }
);

export const handlePortfolioUpgraded = inngest.createFunction(
  { id: "handle-portfolio-upgraded", triggers: [{ event: "user/portfolio.upgraded" }] },
  async ({ event, step }: { event: { data: Events["user/portfolio.upgraded"]["data"] }; step: any }) => {
    const { userId } = event.data;

    await step.run("update-lifecycle-flags", async () => {
      await updateUserLifecycleFlags(userId, {
        portfolioUpgradedAt: new Date(),
      });
      logEvent("lifecycle.portfolio_upgraded", { userId });
    });
  }
);

export const handlePaidPlanUpgraded = inngest.createFunction(
  { id: "handle-paid-plan-upgraded", triggers: [{ event: "user/paid_plan.upgraded" }] },
  async ({ event, step }: { event: { data: Events["user/paid_plan.upgraded"]["data"] }; step: any }) => {
    const { userId } = event.data;

    await step.run("update-lifecycle-flags", async () => {
      await updateUserLifecycleFlags(userId, {
        paidPlanUpgradedAt: new Date(),
      });
      logEvent("lifecycle.paid_plan_upgraded", { userId });
    });
  }
);

export const handleUserUnsubscribed = inngest.createFunction(
  { id: "handle-user-unsubscribed", triggers: [{ event: "user/unsubscribed" }] },
  async ({ event, step }: { event: { data: Events["user/unsubscribed"]["data"] }; step: any }) => {
    const { userId } = event.data;

    await step.run("update-lifecycle-flags", async () => {
      await updateUserLifecycleFlags(userId, {
        unsubscribedAt: new Date(),
      });
      logEvent("lifecycle.unsubscribed", { userId });
    });
  }
);
