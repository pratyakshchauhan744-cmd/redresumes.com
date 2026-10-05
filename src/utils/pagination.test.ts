import { describe, expect, it } from "vitest";
import { getPaginationMeta } from "./pagination";

describe("pagination metadata", () => {
  it("calculates ranges and navigation for partial final pages", () => {
    expect(getPaginationMeta(2, 15, 10)).toEqual({
      page: 2,
      totalPages: 2,
      start: 11,
      end: 15,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it("handles empty datasets without a page zero", () => {
    expect(getPaginationMeta(1, 0, 20)).toEqual({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it("clamps a stale page after filters reduce the result count", () => {
    expect(getPaginationMeta(8, 21, 10).page).toBe(3);
  });
});
