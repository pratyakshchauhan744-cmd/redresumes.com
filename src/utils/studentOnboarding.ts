import { ApiRequestError } from "../lib/backendApi";
import type { StudentCreationResponse, StudentInvitationResponse } from "../types/studentOnboarding";
export interface OnboardingFeedback {
  type: "success" | "warning" | "info" | "error";
  message: string;
}

/** Render controlled explanations, never raw provider text, credentials or traces. */
export function safeInvitationError(error?: string | null): string {
  if (!error) return "The invitation email could not be sent.";
  if (/rate.?limit|too many requests|quota|temporarily limited/i.test(error)) return "The email service is temporarily limited. Try resending later.";
  if (/invalid recipient|invalid email|mailbox unavailable|recipient rejected|recipient address could not be accepted/i.test(error)) return "The recipient address could not be accepted. Verify the student's email address before resending.";
  if (/timeout|timed out|temporarily unavailable|connection refused/i.test(error)) return "The email service is temporarily unavailable. Try resending later.";
  return "The invitation email could not be sent. Please resend the invitation or contact your administrator.";
}

export function invitationFeedback(result: StudentInvitationResponse, created = false): OnboardingFeedback {
  const prefix = created ? "Student account created. " : "";
  if (!result.success) return { type: "error", message: created ? "Unable to create student. Please check the details and try again." : "Unable to send the invitation. " + safeInvitationError(result.emailError) };
  if (result.invitationPersistenceFailed || result.invitationStatus === "persistence_failed" || result.invitationStatus === "status_persistence_failed") {
    return {
      type: "warning",
      message: prefix + (result.invitationPersistenceWarning || "Invitation status could not be saved to the database. Check the student list before resending."),
    };
  }
  switch (result.invitationStatus) {
    case "sent": return { type: "success", message: prefix + "Invitation email accepted by the email service. Inbox delivery is not confirmed." };
    case "delivered": return { type: "success", message: prefix + "Invitation email delivery confirmed." };
    case "failed":
    case "delivery_failed": return { type: created ? "warning" : "error", message: prefix + safeInvitationError(result.emailError) + " Use Resend Invitation from the student list; do not create the account again." };
    case "pending": return { type: "info", message: prefix + "Invitation email is pending. Check its status in the student list." };
    case "accepted": return { type: "success", message: prefix + "The invitation has been accepted." };
    case "expired": return { type: "warning", message: prefix + "The invitation has expired. Please resend the invitation." };
    case "revoked": return { type: "warning", message: prefix + "The invitation was revoked. Check the current invitation before resending." };
    default: return { type: "info", message: prefix + "Invitation email status is unavailable. Check the student list before resending." };
  }
}
export function studentCreationFeedback(result: StudentCreationResponse): OnboardingFeedback {
  return invitationFeedback(result, true);
}
export function studentCreationFailure(error: unknown): OnboardingFeedback {
  if (error instanceof ApiRequestError && error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 408) {
    return { type: "error", message: error.status === 403 ? "You do not have permission to create this student." : error.status === 409 ? "A student or account with these details already exists. Check the student list before trying again." : "Unable to create student. Please check the details and try again." };
  }
  return { type: "warning", message: "The request did not return a confirmed result. The student account may have been created. Refresh and check the student list before trying again; use Resend Invitation if the account exists." };
}
export function invitationRetryFailure(error: unknown): OnboardingFeedback {
  if (error instanceof ApiRequestError && error.status !== undefined) {
    return { type: "error", message: error.status === 403 ? "You do not have permission to resend this invitation." : "Unable to send the invitation. The student account remains unchanged. Please try Resend Invitation again later." };
  }
  return { type: "info", message: "The resend request did not return a confirmed result. Check the invitation status before resending again. The student account remains unchanged." };
}

/** Once creation is confirmed, refresh/reset even when invitation sending failed. */
export async function completeStudentOnboarding(request: () => Promise<StudentCreationResponse>, onCreated: () => void): Promise<OnboardingFeedback> {
  const result = await request();
  if (result.success) onCreated();
  return studentCreationFeedback(result);
}
