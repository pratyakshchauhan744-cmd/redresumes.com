import { prisma } from "../../db/prisma.js";
import type { MockInterviewState } from "../inngest/client.js";

// ---------------------------------------------------------------------------
// Onboarding state — one query point for all suppression / branching checks.
// Every email step calls getOnboardingState() right before deciding what to
// send (or whether to send at all). New lifecycle flags (referral, team
// invite, etc.) can be added here without touching the workflow function.
// ---------------------------------------------------------------------------

export interface OnboardingState {
  unsubscribed: boolean;
  paidPlan: boolean;
  mockInterviewState: MockInterviewState;
  portfolioUpgraded: boolean;
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const flags = await prisma.userLifecycleFlags.findUnique({
    where: { userId },
  });

  if (!flags) {
    return {
      unsubscribed: false,
      paidPlan: false,
      mockInterviewState: "not_started",
      portfolioUpgraded: false,
    };
  }

  return {
    unsubscribed: flags.unsubscribedAt !== null,
    paidPlan: flags.paidPlanUpgradedAt !== null,
    mockInterviewState: deriveMockInterviewState(flags),
    portfolioUpgraded: flags.portfolioUpgradedAt !== null,
  };
}

export async function updateUserLifecycleFlags(
  userId: string,
  updates: {
    startedMockInterviewAt?: Date;
    enteredInterviewRoomAt?: Date;
    completedMockInterviewAt?: Date;
    paidInterviewAccessAt?: Date;
    portfolioUpgradedAt?: Date;
    paidPlanUpgradedAt?: Date;
    unsubscribedAt?: Date;
  }
) {
  return prisma.userLifecycleFlags.upsert({
    where: { userId },
    create: {
      userId,
      ...updates,
    },
    update: updates,
  });
}

// ---------------------------------------------------------------------------
// Mock interview state derivation — interviews are a paid feature, so we
// distinguish several engagement tiers. The flags table stores timestamps
// for each tier; we derive the "highest" state the user has reached.
// ---------------------------------------------------------------------------

function deriveMockInterviewState(flags: {
  startedMockInterviewAt: Date | null;
  enteredInterviewRoomAt: Date | null;
  completedMockInterviewAt: Date | null;
  paidInterviewAccessAt: Date | null;
}): MockInterviewState {
  if (flags.paidInterviewAccessAt) return "paid_access";
  if (flags.completedMockInterviewAt) return "completed_session";
  if (flags.enteredInterviewRoomAt) return "entered_room";
  if (flags.startedMockInterviewAt) return "started_trial";
  return "not_started";
}

// ---------------------------------------------------------------------------
// Suppression helpers — used by the workflow to decide per-email behavior.
// A template is "suppressed" if the user is unsubscribed, or if they've
// upgraded to a paid plan and the template is upgrade-oriented.
// ---------------------------------------------------------------------------

export function shouldSuppressAll(state: OnboardingState): boolean {
  return state.unsubscribed;
}

/**
 * Returns true if upgrade-oriented emails should be suppressed because the
 * user is already a paid subscriber. Purely informational / product-education
 * emails can still send — this check is only applied to templates flagged as
 * upgrade-oriented (controlled by the `isUpgradeOriented` template prop).
 */
export function shouldSuppressUpgrade(
  state: OnboardingState,
  templateIsUpgradeOriented: boolean
): boolean {
  return state.paidPlan && templateIsUpgradeOriented;
}

// ---------------------------------------------------------------------------
// Usage stats provider stub — Email 4 shows social-proof stats. Wire this
// to a real data source (analytics DB, PostHog API, etc.) to avoid
// hardcoding unverified claims.
// ---------------------------------------------------------------------------

export interface UsageStats {
  totalResumesCreated: number;
  totalMockInterviews: number;
  /** e.g. "Users who practiced mock interviews reported 40% more callbacks" —
   *  only populate this when you have verified data. */
  callbackImprovementClaim: string | null;
}

export async function getUsageStats(): Promise<UsageStats> {
  // TODO: replace with real analytics query
  const stats = await prisma.resume.count();
  const interviews = await prisma.interviewSession.count();

  return {
    totalResumesCreated: stats,
    totalMockInterviews: interviews,
    callbackImprovementClaim: null, // do NOT hardcode unverified percentages
  };
}
