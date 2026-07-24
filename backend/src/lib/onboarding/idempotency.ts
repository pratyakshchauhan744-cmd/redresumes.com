import { prisma } from "../../db/prisma.js";

// ---------------------------------------------------------------------------
// Idempotency key generation — deterministic from userId + flowType so
// duplicate resume-download events (retries, re-downloads) won't start
// parallel onboarding flows for the same user.
// ---------------------------------------------------------------------------

export function buildIdempotencyKey(userId: string, flowType: string): string {
  return `onboarding:${userId}:${flowType}`;
}

/**
 * Attempts to create an OnboardingEnrollment row with a DB-level unique
 * constraint on (userId, flowType). Returns the enrollment if created,
 * or null if a row already exists (meaning the flow is already running
 * or has already completed for this user).
 *
 * This is the source of truth for deduplication — not an in-memory check.
 */
export async function tryEnroll(params: {
  userId: string;
  flowType: string;
  sourceResumeId: string;
}): Promise<{ enrolled: true; enrollmentId: string } | { enrolled: false }> {
  const idempotencyKey = buildIdempotencyKey(params.userId, params.flowType);

  try {
    const enrollment = await prisma.onboardingEnrollment.create({
      data: {
        userId: params.userId,
        flowType: params.flowType,
        sourceResumeId: params.sourceResumeId,
        idempotencyKey,
        status: "active",
      },
    });

    return { enrolled: true, enrollmentId: enrollment.id };
  } catch (error: any) {
    // Prisma P2002 = unique constraint violation — enrollment already exists
    if (error?.code === "P2002") {
      return { enrolled: false };
    }
    throw error;
  }
}
