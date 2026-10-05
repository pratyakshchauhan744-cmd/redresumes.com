/**
 * Authoritative Central Score Normalization and Readiness Utility (Frontend)
 *
 * Defines canonical score semantics:
 * Canonical Score = 0–100 (percentage scale)
 */

export type ReadinessRating = "Job-Ready" | "Moderate" | "Needs Practice" | "Not Attempted";

/**
 * Normalizes any score (0-10 or 0-100) to canonical percentage score (0-100).
 * If sourceScale is explicitly 10, converts 8/10 -> 80.
 * If score is already canonical 0-100, returns it clamped within [0, 100].
 */
export function normalizeInterviewScore(rawScore: unknown, sourceScale = 100): number {
  if (rawScore === null || rawScore === undefined) return 0;
  const num = Number(rawScore);
  if (!Number.isFinite(num)) return 0;

  if (sourceScale === 10) {
    return Math.max(0, Math.min(100, Math.round(num * 10 * 10) / 10));
  }

  return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
}

/**
 * Determines readiness rating based on canonical score (0-100).
 * 
 * Thresholds:
 *   80–100 -> "Job-Ready"
 *   60–79  -> "Moderate"
 *   0–59   -> "Needs Practice"
 *   null   -> "Not Attempted"
 */
export function getReadinessCategory(score: number | null | undefined): ReadinessRating {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "Not Attempted";
  }
  if (score >= 80) return "Job-Ready";
  if (score >= 60) return "Moderate";
  return "Needs Practice";
}

/**
 * Formats a canonical score as a percentage string (e.g. 80 -> "80%").
 */
export function formatScore(score: number | null | undefined, fallback = "—"): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return fallback;
  }
  return `${Math.round(score)}%`;
}

/**
 * Normalizes category score to canonical 0-100 value.
 * Handles both legacy 0-10 values and canonical 0-100 values safely.
 */
export function normalizeToCanonicalScore(score: unknown): number {
  if (score === null || score === undefined) return 0;
  const num = Number(score);
  if (!Number.isFinite(num)) return 0;
  // If already > 10, it's 0-100 scale
  if (num > 10) return Math.min(100, Math.round(num * 10) / 10);
  // Otherwise if <= 10 and was stored on 10 scale
  return Math.min(100, Math.round(num * 10 * 10) / 10);
}
