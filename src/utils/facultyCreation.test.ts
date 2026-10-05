import { describe, expect, it } from "vitest";
import { acquireRequestLock, getFacultyCreationFeedback, releaseRequestLock } from "./facultyCreation";

describe("faculty creation feedback", () => {
  it("reports successful invitation delivery", () => {
    expect(getFacultyCreationFeedback({ invitationSent: true, message: "Created and invited." })).toEqual({
      type: "success",
      message: "Created and invited.",
    });
  });

  it("reports committed creation as a warning when invitation delivery fails", () => {
    const feedback = getFacultyCreationFeedback({
      invitationSent: false,
      message: "Faculty was created.",
      warning: "Created, but delivery failed. Use Resend Invitation.",
    });

    expect(feedback.type).toBe("warning");
    expect(feedback.message).toContain("Use Resend Invitation");
  });

  it("blocks a second create submission until the first request releases its lock", () => {
    const lock = { current: false };
    expect(acquireRequestLock(lock)).toBe(true);
    expect(acquireRequestLock(lock)).toBe(false);
    releaseRequestLock(lock);
    expect(acquireRequestLock(lock)).toBe(true);
  });
});
