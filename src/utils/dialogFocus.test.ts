import { describe, expect, it } from "vitest";
import { getFocusTrapTarget, shouldCloseDialogOnEscape } from "./dialogFocus";

describe("accessible dialog keyboard behavior", () => {
  it("wraps Tab from the last focusable control to the first", () => {
    const controls = ["first", "middle", "last"];
    expect(getFocusTrapTarget(controls, "last", false)).toBe("first");
  });

  it("wraps Shift+Tab from the first focusable control to the last", () => {
    const controls = ["first", "middle", "last"];
    expect(getFocusTrapTarget(controls, "first", true)).toBe("last");
  });

  it("does not redirect focus while navigation remains inside the dialog", () => {
    const controls = ["first", "middle", "last"];
    expect(getFocusTrapTarget(controls, "middle", false)).toBeNull();
  });

  it("allows Escape unless an active request disables closing", () => {
    expect(shouldCloseDialogOnEscape("Escape", false)).toBe(true);
    expect(shouldCloseDialogOnEscape("Escape", true)).toBe(false);
    expect(shouldCloseDialogOnEscape("Enter", false)).toBe(false);
  });
});
