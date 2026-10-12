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

export interface ReportScoreRecord {
  overallScore?: unknown;
  score?: unknown;
  scoreScale?: unknown;
  maxScore?: unknown;
  scale?: unknown;
  categoryScores?: unknown;
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
 * Never assumes scores <= 10 are legacy if no legacy metadata is present.
 */
export function isLegacyTenScaleRecord(record: {
  overallScore?: unknown;
  score?: unknown;
  scoreScale?: unknown;
  categoryScores?: unknown;
}): boolean {
  const scale = record.scoreScale !== undefined && record.scoreScale !== null
    ? Number(record.scoreScale)
    : undefined;
  if (scale === 10) return true;
  if (scale === 100) return false;

  const rawScore = record.overallScore !== undefined ? record.overallScore : record.score;
  const num = Number(rawScore);
  if (!Number.isFinite(num)) return false;

  // If score is > 10, it cannot be a 0-10 legacy scale score
  if (num > 10) return false;

  // If categoryScores are present, check for legacy evaluator indicators
  if (record.categoryScores && typeof record.categoryScores === "object") {
    const cs = record.categoryScores as Record<string, any>;
    const hasLegacyKeys = cs.clarity !== undefined || cs.communicationQuality !== undefined;
    const values = Object.values(cs).filter((v) => typeof v === "number" && Number.isFinite(v));
    const allValuesTenScale = values.length > 0 && values.every((v) => v >= 0 && v <= 10);
    if (hasLegacyKeys && allValuesTenScale) return true;
  }

  return false;
}

/**
 * Centralized score normalization utility.
 * Normalizes an interview report or score record to a canonical 0-100 percentage score.
 * 
 * Requirements:
 * - Return a consistent 0-100 percentage score (rounded to 1 decimal place), or null if invalid/missing.
 * - Use explicit scale metadata (scoreScale, maxScore, scale) whenever available.
 * - Preserve legitimate low percentage scores (e.g. 8 out of 100 -> 8%).
 * - Correctly convert legacy scores (e.g. 8 out of 10 -> 80%, 0 out of 10 -> 0%).
 * - Handle zero scores correctly without treating them as missing.
 * - Handle null, undefined, NaN, Infinite, and invalid values safely by returning null.
 * - Avoid division by zero (scale <= 0 -> returns null).
 * - Reject out-of-range values according to validation rules without silent corrupt clamping.
 * - Never mutate original input.
 */
export function normalizeReportScore(
  report: ReportScoreRecord | number | string | null | undefined
): number | null {
  if (report === null || report === undefined) {
    return null;
  }

  // Handle primitive number/string input (assumed canonical percentage unless metadata is wrapped)
  if (typeof report === "number" || typeof report === "string") {
    if (typeof report === "string" && report.trim() === "") {
      return null;
    }
    const num = Number(report);
    if (!Number.isFinite(num)) {
      return null;
    }
    if (num < 0 || num > 100) {
      return null;
    }
    return Math.round(num * 10) / 10;
  }

  if (typeof report !== "object") {
    return null;
  }

  const rawScore = (report as any).overallScore !== undefined 
    ? (report as any).overallScore 
    : (report as any).score;

  if (rawScore === null || rawScore === undefined || rawScore === "") {
    return null;
  }

  const scoreNum = Number(rawScore);
  if (!Number.isFinite(scoreNum)) {
    return null;
  }

  // Check for explicit scale metadata
  const rawScale = (report as any).scoreScale !== undefined 
    ? (report as any).scoreScale 
    : ((report as any).maxScore !== undefined 
      ? (report as any).maxScore 
      : (report as any).scale);

  let scaleNum: number | undefined;
  if (rawScale !== null && rawScale !== undefined && rawScale !== "") {
    const parsed = Number(rawScale);
    if (Number.isFinite(parsed)) {
      scaleNum = parsed;
    }
  }

  if (scaleNum !== undefined) {
    if (scaleNum <= 0) {
      return null; // Guard against division by zero and invalid scales
    }

    if (scaleNum === 100) {
      if (scoreNum < 0 || scoreNum > 100) {
        return null;
      }
      return Math.round(scoreNum * 10) / 10;
    }

    // Explicit scale provided (e.g. 10)
    if (scoreNum < 0 || scoreNum > scaleNum) {
      return null;
    }
    const normalized = (scoreNum / scaleNum) * 100;
    return Math.round(normalized * 10) / 10;
  }

  // No explicit scale metadata: check for legacy evaluator pattern via category scores
  if (isLegacyTenScaleRecord(report as any)) {
    if (scoreNum < 0 || scoreNum > 10) {
      return null;
    }
    const normalized = (scoreNum / 10) * 100;
    return Math.round(normalized * 10) / 10;
  }

  // Default canonical percentage scale
  if (scoreNum < 0 || scoreNum > 100) {
    return null;
  }
  return Math.round(scoreNum * 10) / 10;
}

/**
 * Safely resolves an overallScore from a database record to canonical 0-100,
 * protecting against legacy 0-10 records that have not yet been migrated.
 * Falls back to 0 if the score is missing or invalid.
 */
export function resolveCanonicalReportScore(
  report: ReportScoreRecord | number | string | null | undefined
): number {
  return normalizeReportScore(report) ?? 0;
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
