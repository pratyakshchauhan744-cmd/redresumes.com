/** Public student invitation errors never echo provider responses or credentials. */
export function publicStudentEmailError(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (/rate.?limit|too many requests|quota/i.test(value)) return "The email service is temporarily limited. Try resending later.";
  if (/invalid recipient|invalid email|mailbox unavailable|recipient rejected/i.test(value)) return "The recipient address could not be accepted. Verify the student's email address before resending.";
  if (/timeout|timed out|temporarily unavailable|connection refused/i.test(value)) return "The email service is temporarily unavailable. Try resending later.";
  return "The invitation email could not be sent. Please resend the invitation or contact your administrator.";
}
