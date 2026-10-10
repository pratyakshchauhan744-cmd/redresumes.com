import { describe, expect, it } from "vitest";
import { exportFilename } from "./exportDownload";
import { acquireRequestLock, releaseRequestLock } from "./facultyCreation";
describe("download filename safety", () => {
  it.each([
    ['attachment; filename="reports.csv"', "reports.csv"],
    ["attachment; filename=reports.csv", "reports.csv"],
    ["attachment; filename*=UTF-8''students%20%E2%9C%93.csv; filename=fallback.csv", "students ✓.csv"],
    ["attachment; filename*=UTF-8''%ZZ; filename=fallback.csv", "fallback.csv"],
    ['attachment; filename="../../reports.csv"', "reports.csv"],
    ['attachment; filename="payload.exe"', "default.csv"],
    [null, "default.csv"],
  ])("resolves %s", (header, expected) => expect(exportFilename(header, "default.csv")).toBe(expected));
  it("closes same-render CSV/Excel duplicate-click windows through one shared lock", () => {
    const lock = { current: false }; expect(acquireRequestLock(lock)).toBe(true); expect(acquireRequestLock(lock)).toBe(false); releaseRequestLock(lock); expect(acquireRequestLock(lock)).toBe(true);
  });
});
