/**
 * Canonical identity form used by authentication and account-creation flows.
 * Email ownership is global in this application (`User.email` is globally unique).
 */
export function normalizeEmailIdentity(email: string): string {
  return email.trim().toLowerCase();
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
