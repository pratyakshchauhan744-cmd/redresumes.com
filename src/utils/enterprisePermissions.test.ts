import { describe, expect, it } from "vitest";
import { authorizedInitialCredits, canResendStudentInvitation, hasEnterprisePermission } from "./enterprisePermissions";

describe("enterprise audit navigation permission", () => {
  it("does not treat REPORT_VIEW or its legacy alias as AUDIT_VIEW", () => {
    expect(hasEnterprisePermission({ permissions: ["REPORT_VIEW"] }, "AUDIT_VIEW")).toBe(false);
    expect(hasEnterprisePermission({ permissions: ["viewAnalytics"] }, "AUDIT_VIEW")).toBe(false);
  });

  it("allows explicit audit viewers and main faculty", () => {
    expect(hasEnterprisePermission({ permissions: ["AUDIT_VIEW"] }, "AUDIT_VIEW")).toBe(true);
    expect(hasEnterprisePermission({ isMainFaculty: true, permissions: [] }, "AUDIT_VIEW")).toBe(true);
  });
});

describe("student invitation resend permission", () => {
  it("hides resend from read-only faculty", () => {
    expect(canResendStudentInvitation({ permissions: ["STUDENT_VIEW"] })).toBe(false);
  });

  it("allows faculty with STUDENT_CREATE", () => {
    expect(canResendStudentInvitation({
      permissions: ["STUDENT_VIEW", "STUDENT_CREATE"],
    })).toBe(true);
  });

  it("preserves full access and Main Faculty behavior", () => {
    expect(canResendStudentInvitation({ permissions: ["all"] })).toBe(true);
    expect(canResendStudentInvitation({ isMainFaculty: true, permissions: [] })).toBe(true);
  });
});

describe("initial student credit permission", () => {
  it("zeros hidden or stale credits for student creators without credit assignment", () => {
    expect(authorizedInitialCredits({ permissions: ["STUDENT_CREATE"] }, 10)).toBe(0);
    expect(authorizedInitialCredits({ permissions: ["manageStudents"] }, 2)).toBe(0);
    expect(hasEnterprisePermission({ permissions: ["STUDENT_CREATE"] }, "INTERVIEW_CREDIT_ASSIGN")).toBe(false);
  });
  it("preserves requested credits for explicit, legacy and privileged access", () => {
    for (const user of [{ permissions: ["INTERVIEW_CREDIT_ASSIGN"] }, { permissions: ["distributeCredits"] }, { permissions: ["all"] }, { isMainFaculty: true }]) {
      expect(authorizedInitialCredits(user, 3)).toBe(3);
    }
  });
});
