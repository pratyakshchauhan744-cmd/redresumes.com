import { describe, expect, it } from "vitest";
import {
  classifyInvitationFailure,
  getInvitationToken,
  validateInvitationPasswords,
} from "./invitationActivation";

describe("faculty invitation activation routing", () => {
  it("keeps normal login mode when no invitation token is present", () => {
    expect(getInvitationToken("")).toBeNull();
    expect(getInvitationToken("?email=faculty%40example.com")).toBeNull();
  });

  it("enters invitation mode with a token even when email is missing or tampered", () => {
    expect(getInvitationToken("?invite=token-a")).toBe("token-a");
    expect(getInvitationToken("?invite=token-a&email=attacker%40example.com")).toBe("token-a");
  });

  it("classifies expired, used, invalid, and network verification failures", () => {
    expect(classifyInvitationFailure("This invitation link has expired.")).toBe("expired");
    expect(classifyInvitationFailure("This invitation has already been accepted.")).toBe("used");
    expect(classifyInvitationFailure("Invalid invitation token.")).toBe("invalid");
    expect(classifyInvitationFailure("Cannot reach backend.")).toBe("network");
  });

  it("matches the backend password policy and blocks mismatched confirmation", () => {
    expect(validateInvitationPasswords("short", "short")).toMatch(/8 characters/);
    expect(validateInvitationPasswords("ExamplePassword123", "DifferentPassword123")).toMatch(/do not match/);
    expect(validateInvitationPasswords("ExamplePassword123", "ExamplePassword123")).toBeNull();
  });
});
