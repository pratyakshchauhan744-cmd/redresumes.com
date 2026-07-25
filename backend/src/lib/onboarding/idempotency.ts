import { prisma } from "../../db/prisma.js";

// ---------------------------------------------------------------------------
// Idempotency key generation — deterministic from userId + flowType.
// ---------------------------------------------------------------------------

export function buildIdempotencyKey(userId: string, flowType: string): string {
  return `onboarding:${userId}:${flowType}:${Date.now()}`;
}

/**
 * Creates or updates an OnboardingEnrollment row for the user download.
 * Allows fresh enrollments and re-download triggers so users receive
 * their onboarding/scorecard email whenever they download a resume.
 */
export async function tryEnroll(params: {
  userId: string;
  flowType: string;
  sourceResumeId: string;
}): Promise<{ enrolled: true; enrollmentId: string }> {
  const idempotencyKey = buildIdempotencyKey(params.userId, params.flowType);

  const enrollment = await prisma.onboardingEnrollment.upsert({
    where: {
      userId_flowType: {
        userId: params.userId,
        flowType: params.flowType,
      },
    },
    create: {
      userId: params.userId,
      flowType: params.flowType,
      sourceResumeId: params.sourceResumeId,
      idempotencyKey,
      status: "active",
    },
    update: {
      sourceResumeId: params.sourceResumeId,
      idempotencyKey,
      updatedAt: new Date(),
      status: "active",
    },
  });

  return { enrolled: true, enrollmentId: enrollment.id };
}
