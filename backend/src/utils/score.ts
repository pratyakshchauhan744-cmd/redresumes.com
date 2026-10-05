/**
 * Authoritative Central Score Normalization and Readiness Utility
 * 
 * Defines canonical score semantics across the application:
 * Canonical Stored & Reporting Score = 0–100 (Percentage scale)
 * Evaluator Raw Score = 0–10
 */

export type ReadinessRating = "Job-Ready" | "Moderate" | "Needs Practice" | "Not Attempted";

export interface ScoreValidationResult {
  isValid: boolean;
  score: number | null;
  error?: string;
}

/**
 * Validates whether a score is a finite number within legitimate canonical bounds (0 to 100).
 */
export function validateCanonicalScore(score: unknown): ScoreValidationResult {
  if (score === null || score === undefined || score === "") {
    return { isValid: false, score: null, error: "Score is null or undefined" };
  }

  const num = Number(score);
  if (!Number.isFinite(num)) {
    return { isValid: false, score: null, error: "Score is NaN or Infinity" };
  }

  if (num < 0 || num > 100) {
    return {
      isValid: false,
      score: null,
      error: `Score out of canonical percentage bounds [0, 100]: ${num}`,
    };
  }

  return { isValid: true, score: Math.round(num * 10) / 10 };
}

/**
 * Normalizes an evaluator raw score (0-10 scale) to canonical percentage score (0-100 scale).
 * Clamps result strictly within [0, 100] and avoids double-conversion if the score is already
 * on a 0-100 scale according to explicit scale metadata or canonical value range.
 * 
 * @param rawScore - Evaluator score (e.g., 8.0 on a 0-10 scale)
 * @param sourceScale - The scale of rawScore, defaults to 10
 * @returns Canonical score (0-100) rounded to 1 decimal place
 */
export function normalizeInterviewScore(rawScore: unknown, sourceScale = 10): number {
  if (rawScore === null || rawScore === undefined) return 0;
  const num = Number(rawScore);
  if (!Number.isFinite(num)) return 0;

  if (sourceScale === 100) {
    // Already on a 0-100 scale, clamp within bounds
    return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
  }

  if (sourceScale <= 0) return 0;

  // Normalization from sourceScale (e.g. 10) to 100
  const normalized = (num / sourceScale) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized * 10) / 10));
}

/**
 * Normalizes category scores object from evaluator scale (0-10) to canonical percentage scale (0-100).
 */
export function normalizeCategoryScores(
  categoryScores: Record<string, unknown> | null | undefined,
  sourceScale = 10
): Record<string, number> {
  if (!categoryScores || typeof categoryScores !== "object") {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, val] of Object.entries(categoryScores)) {
    if (typeof val === "number" && Number.isFinite(val)) {
      normalized[key] = normalizeInterviewScore(val, sourceScale);
    } else if (typeof val === "string" && !isNaN(Number(val))) {
      normalized[key] = normalizeInterviewScore(Number(val), sourceScale);
    }
  }

  return normalized;
}

/**
 * Maps a canonical score (0-100) to its authoritative business readiness category.
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

  if (score >= 80) {
    return "Job-Ready";
  }
  if (score >= 60) {
    return "Moderate";
  }
  return "Needs Practice";
}

/**
 * Authoritative alias for getReadinessCategory matching legacy codebase naming.
 */
export const getReadinessRating = getReadinessCategory;

/**
 * Detects whether a legacy record stored in the database is on the old 0-10 scale.
 * Uses explicit scale metadata if present, and inspects categoryScores pattern.
 */
export function isLegacyTenScaleRecord(record: {
  overallScore: number;
  scoreScale?: number | null;
  categoryScores?: unknown;
}): boolean {
  if (record.scoreScale === 10) return true;
  if (record.scoreScale === 100) return false;

  // If scoreScale is not set (legacy schema), check overallScore and category scores
  if (record.overallScore > 10) return false;

  if (record.categoryScores && typeof record.categoryScores === "object") {
    const cs = record.categoryScores as Record<string, any>;
    // Check if it has legacy evaluator keys (clarity, communicationQuality, etc.)
    const hasLegacyKeys = cs.clarity !== undefined || cs.communicationQuality !== undefined;
    const allValuesTenScale = Object.values(cs).every(
      (v) => typeof v !== "number" || (v >= 0 && v <= 10)
    );
    if (hasLegacyKeys && allValuesTenScale) return true;
  }

  // Fallback for record with overallScore <= 10
  return record.overallScore <= 10 && record.overallScore > 0;
}

/**
 * Safely resolves an overallScore from a database record to canonical 0-100,
 * protecting against legacy 0-10 records that have not yet been migrated.
 */
export function resolveCanonicalReportScore(report: {
  overallScore: number;
  scoreScale?: number | null;
  categoryScores?: unknown;
}): number {
  if (isLegacyTenScaleRecord(report)) {
    return normalizeInterviewScore(report.overallScore, 10);
  }
  return Math.max(0, Math.min(100, Math.round(report.overallScore * 10) / 10));
}

/**
 * Formats a canonical score as a percentage string (e.g. 80 -> "80%").
 */
export function formatPercentageScore(score: number | null | undefined, fallback = "N/A"): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return fallback;
  }
  return `${Math.round(score)}%`;
}
