import { describe, expect, it } from "vitest";
import {
  getFacultyAuthorizationPayload,
  resolveFacultyCohortAccess,
  toggleAccessValue,
  toggleCohortAccess,
  toggleFacultyPermission,
} from "./facultyAccess";

const authorization = {
  permissions: ["STUDENT_VIEW"],
  programAccess: ["B.Tech"],
  courseAccess: ["Computer Science"],
  sectionAccess: ["A"],
  batchAccess: ["2026"],
  scopeUnrestricted: false,
  cohortAccess: [
    { program: "B.Tech", course: "Computer Science", section: "A", batch: "2026" },
  ],
};

describe("faculty access form helpers", () => {
  it("does not send hidden authorization defaults for non-administrators", () => {
    expect(getFacultyAuthorizationPayload(false, authorization)).toEqual({});
  });

  it("submits the administrator's explicit permission and cohort choices", () => {
    expect(getFacultyAuthorizationPayload(true, authorization)).toEqual(authorization);
  });

  it("makes full access mutually exclusive with granular permissions", () => {
    expect(toggleFacultyPermission(["STUDENT_VIEW"], "all")).toEqual(["all"]);
    expect(toggleFacultyPermission(["all"], "REPORT_VIEW")).toEqual(["REPORT_VIEW"]);
  });

  it("toggles cohort access values", () => {
    expect(toggleAccessValue(["A"], "B")).toEqual(["A", "B"]);
    expect(toggleAccessValue(["A", "B"], "A")).toEqual(["B"]);
  });

  it("keeps exact cohort combinations instead of creating a Cartesian set", () => {
    const cseA = authorization.cohortAccess[0];
    const mechanicalB = { program: "B.Tech", course: "Mechanical", section: "B", batch: "2027" };
    expect(toggleCohortAccess([cseA], mechanicalB)).toEqual([cseA, mechanicalB]);
    expect(toggleCohortAccess([cseA, mechanicalB], cseA)).toEqual([mechanicalB]);
  });

  it("converts legacy dimension scopes to matching concrete cohorts", () => {
    const cohorts = [
      authorization.cohortAccess[0],
      { program: "B.Tech", course: "Computer Science", section: "B", batch: "2026" },
    ];
    expect(resolveFacultyCohortAccess({
      programAccess: ["B.Tech"],
      courseAccess: ["Computer Science"],
      sectionAccess: ["A"],
      batchAccess: ["2026"],
    }, cohorts)).toEqual([cohorts[0]]);
  });
});
