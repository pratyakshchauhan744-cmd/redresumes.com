import { describe, expect, it } from "vitest";
import { getCreditLedgerActorLabel } from "./creditLedger";

describe("credit ledger actor attribution", () => {
  it("displays the recorded faculty actor", () => {
    expect(getCreditLedgerActorLabel({
      name: "Priya Sharma",
      email: "priya@example.edu",
      role: "college_faculty",
    })).toBe("Priya Sharma");
  });

  it("is data-driven for a different administrator", () => {
    expect(getCreditLedgerActorLabel({
      name: "Rahul Verma",
      email: "rahul@example.edu",
      role: "college_main_faculty",
    })).toBe("Rahul Verma");
  });
});
