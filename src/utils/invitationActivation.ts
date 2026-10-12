export type InvitationFailureState = "expired" | "used" | "invalid" | "network";

export function getInvitationToken(search: string): string | null {
  const token = new URLSearchParams(search).get("invite");
  return token?.trim() || null;
}

export function classifyInvitationFailure(message: string): InvitationFailureState {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("already been accepted") || normalized.includes("previously used")) return "used";
  if (
    normalized.includes("invalid") ||
    normalized.includes("revoked") ||
    normalized.includes("no longer available") ||
    normalized.includes("not found")
  ) {
    return "invalid";
  }
  return "network";
}

export function validateInvitationPasswords(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}
