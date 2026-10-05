import { describe, expect, it } from "vitest";
import { hasEnterprisePermission } from "./enterprisePermissions";

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
