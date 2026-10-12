import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../lib/backendApi";
import { completeStudentOnboarding, invitationFeedback, invitationRetryFailure, safeInvitationError, studentCreationFailure, studentCreationFeedback } from "./studentOnboarding";
import { acquireRequestLock, releaseRequestLock } from "./facultyCreation";
import type { StudentCreationResponse } from "../types/studentOnboarding";
afterEach(() => vi.restoreAllMocks());
const result = (status?: string, emailError?: string): StudentCreationResponse => ({ success: true, student: { id: "student", userId: "user" }, invitationStatus: status, emailError });

describe("student account and invitation outcomes", () => {
  it.each([
    ["sent", "success", "accepted by the email service"], ["delivered", "success", "delivery confirmed"],
    ["failed", "warning", "Resend Invitation"], ["delivery_failed", "warning", "Resend Invitation"],
    ["pending", "info", "pending"], ["accepted", "success", "accepted"],
    ["expired", "warning", "expired"], ["revoked", "warning", "revoked"],
    ["unexpected", "info", "status is unavailable"], [undefined, "info", "status is unavailable"],
  ])("interprets %s without inventing delivery", (status, type, message) => {
    const feedback = studentCreationFeedback(result(status));
    expect(feedback.type).toBe(type); expect(feedback.message).toContain(message);
    expect(feedback.message).toContain("Student account created.");
  });
  it("reports warning when invitation persistence fails even if account creation succeeded", () => {
    const feedback1 = studentCreationFeedback({
      ...result("persistence_failed"),
      invitationPersistenceFailed: true,
      invitationPersistenceWarning: "Custom persistence warning",
    });
    expect(feedback1.type).toBe("warning");
    expect(feedback1.message).toContain("Custom persistence warning");

    const feedback2 = studentCreationFeedback({
      ...result("sent"),
      invitationPersistenceFailed: true,
    });
    expect(feedback2.type).toBe("warning");
    expect(feedback2.message).toContain("could not be saved to the database");
  });
  it("treats rejected creation as failure rather than an invitation failure", () => {
    expect(studentCreationFeedback({ ...result("failed"), success: false }).type).toBe("error");
  });
  it.each(["sent", "failed", "pending"])("refreshes and resets confirmed creation for %s", async status => {
    const request = vi.fn(async () => result(status));
    const state = { listRefreshes: 0, formOpen: true, reset: false };
    const feedback = await completeStudentOnboarding(request, () => { state.listRefreshes++; state.formOpen = false; state.reset = true; });
    expect(request).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ listRefreshes: 1, formOpen: false, reset: true });
    expect(feedback.type).toBe(status === "failed" ? "warning" : status === "pending" ? "info" : "success");
  });
  it("does not reset or report creation after a rejected or unknown request", async () => {
    const onCreated = vi.fn();
    await completeStudentOnboarding(async () => ({ ...result(), success: false }), onCreated);
    await expect(completeStudentOnboarding(async () => { throw new ApiRequestError("network unavailable"); }, onCreated)).rejects.toThrow();
    expect(onCreated).not.toHaveBeenCalled();
  });
  it("prevents repeated clicks from submitting a second account request", async () => {
    const lock = { current: false };
    let resolve!: (value: StudentCreationResponse) => void;
    const request = vi.fn(() => new Promise<StudentCreationResponse>(done => { resolve = done; }));
    const submit = async () => {
      if (!acquireRequestLock(lock)) return;
      try { return await completeStudentOnboarding(request, vi.fn()); } finally { releaseRequestLock(lock); }
    };
    const first = submit(); await submit(); expect(request).toHaveBeenCalledTimes(1);
    resolve(result("failed")); await first; expect(lock.current).toBe(false);
  });
});
describe("safe errors and uncertain network results", () => {
  it.each(["SMTP_PASS=secret\n at send (/internal/mail.ts:12)", "Bearer sk_test_secret https://provider.internal", "timeout SMTP_USER=private", "quota API_KEY=secret"])("never echoes provider internals: %s", error => {
    const feedback = studentCreationFeedback(result("failed", error));
    expect(feedback.message).not.toMatch(/secret|SMTP|Bearer|internal|API_KEY|sk_test/);
    expect(feedback.type).toBe("warning");
  });
  it("preserves safe recipient, quota and outage guidance", () => {
    expect(safeInvitationError("recipient rejected private details")).toContain("Verify");
    expect(safeInvitationError("rate limit credential")).toContain("later");
    expect(safeInvitationError("connection refused password")).toContain("temporarily unavailable");
  });
  it.each([400, 403, 409])( "reports an HTTP %s rejection safely", status => {
    const feedback = studentCreationFailure(new ApiRequestError("secret provider error", status));
    expect(feedback.type).toBe("error"); expect(feedback.message).not.toContain("secret");
  });
  it.each([undefined, 408, 500, 502, 504])("keeps a %s creation outcome uncertain", status => {
    const feedback = studentCreationFailure(new ApiRequestError("internal error", status));
    expect(feedback.type).toBe("warning"); expect(feedback.message).toContain("may have been created");
    expect(feedback.message).toContain("check the student list");
  });
});
describe("invitation retry", () => {
  it("reports API status instead of assuming resend success", () => {
    expect(invitationFeedback({ success: true, invitationStatus: "sent" }).type).toBe("success");
    expect(invitationFeedback({ success: true, invitationStatus: "pending" }).type).toBe("info");
    expect(invitationFeedback({ success: false, invitationStatus: "failed", emailError: "secret" }).type).toBe("error");
    expect(invitationFeedback({ success: true, invitationStatus: "failed" }).type).toBe("error");
  });
  it("reports forbidden and ambiguous resend results without exposing raw errors", () => {
    expect(invitationRetryFailure(new ApiRequestError("secret", 403)).message).toContain("permission");
    expect(invitationRetryFailure(new ApiRequestError("secret", 502)).type).toBe("error");
    expect(invitationRetryFailure(new Error("secret")).type).toBe("info");
  });
});
