import { describe, expect, it } from "vitest";
import {
  getDistributionPreviewParams,
  isDistributionPreviewValid,
  type DistributionPreviewParams,
} from "./distributionPreview";

const previewed: DistributionPreviewParams = {
  program: "Program A",
  course: "Course A",
  section: "Section A",
  batch: "Batch A",
  creditsPerStudent: 5,
};

describe("distribution preview validity", () => {
  it.each([
    ["batch", { batch: "Batch B" }],
    ["program", { program: "Program B" }],
    ["course", { course: "Course B" }],
    ["section", { section: "Section B" }],
    ["credit amount", { creditsPerStudent: 10 }],
  ])("invalidates when %s changes", (_label, change) => {
    const current = getDistributionPreviewParams({ ...previewed, ...change });
    expect(isDistributionPreviewValid(current, previewed, 1, 1)).toBe(false);
  });

  it("allows confirmation when the form and revision still match", () => {
    expect(isDistributionPreviewValid(previewed, previewed, 1, 1)).toBe(true);
  });

  it("stays invalid after a change is reverted because the revision changed", () => {
    expect(isDistributionPreviewValid(previewed, previewed, 2, 1)).toBe(false);
  });

  it("rejects a missing preview", () => {
    expect(isDistributionPreviewValid(previewed, null, 1, null)).toBe(false);
  });
});
