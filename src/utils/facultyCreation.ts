export interface FacultyCreationResult {
  invitationSent: boolean;
  message: string;
  warning?: string;
}

export interface RequestLock {
  current: boolean;
}

export function acquireRequestLock(lock: RequestLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseRequestLock(lock: RequestLock): void {
  lock.current = false;
}

export function getFacultyCreationFeedback(result: FacultyCreationResult): {
  type: "success" | "warning";
  message: string;
} {
  if (result.invitationSent) {
    return { type: "success", message: result.message };
  }

  return {
    type: "warning",
    message: result.warning ||
      "Faculty was created, but the invitation email could not be sent. Use Resend Invitation from the faculty list; do not create the account again.",
  };
}
