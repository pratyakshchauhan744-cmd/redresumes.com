import assert from "node:assert/strict";
import {
  FacultyAuthorizationError,
  assertCanDeactivateFaculty,
  assertCanGrantPermissions,
  assertCanModifyFaculty,
  assertCanModifyFacultyAuthorization,
  assertNoForbiddenFacultyAssignmentFields,
  hasFacultyAuthorizationChanges,
  type FacultyMutationActor,
  type FacultyMutationTarget,
} from "../modules/enterprise/faculty-authorization.js";

const subordinate: FacultyMutationActor = {
  userId: "faculty-a",
  collegeId: "college-a",
  role: "college_faculty",
  isMainFaculty: false,
  status: "active",
  permissions: ["FACULTY_EDIT", "STUDENT_VIEW"],
};

const mainFaculty: FacultyMutationActor = {
  userId: "main-a",
  collegeId: "college-a",
  role: "college_main_faculty",
  isMainFaculty: true,
  status: "active",
  permissions: ["all"],
};

const selfTarget: FacultyMutationTarget = {
  userId: subordinate.userId,
  collegeId: subordinate.collegeId,
  isMainFaculty: false,
  status: "active",
  permissions: [...subordinate.permissions],
};

const otherFaculty: FacultyMutationTarget = {
  userId: "faculty-b",
  collegeId: "college-a",
  isMainFaculty: false,
  status: "active",
  permissions: ["STUDENT_VIEW"],
};

const mainTarget: FacultyMutationTarget = {
  userId: mainFaculty.userId,
  collegeId: mainFaculty.collegeId,
  isMainFaculty: true,
  status: "active",
  permissions: ["all"],
};

function expectAuthorizationError(
  name: string,
  operation: () => void,
  expectedStatus: 403 | 404 = 403
): void {
  assert.throws(operation, (error: unknown) => {
    assert(error instanceof FacultyAuthorizationError, `${name}: expected FacultyAuthorizationError`);
    assert.equal(error.status, expectedStatus, `${name}: unexpected HTTP status`);
    return true;
  });
  console.log(`PASS ${name}`);
}

expectAuthorizationError(
  "FACULTY_EDIT cannot grant self ['all']",
  () => assertCanModifyFacultyAuthorization(subordinate, selfTarget, ["all"])
);

expectAuthorizationError(
  "FACULTY_EDIT cannot add individual permissions to self",
  () => assertCanModifyFacultyAuthorization(
    subordinate,
    selfTarget,
    ["FACULTY_EDIT", "STUDENT_VIEW", "STUDENT_CREATE"]
  )
);

expectAuthorizationError(
  "faculty cannot mass-assign their own privileged role",
  () => assertNoForbiddenFacultyAssignmentFields({ role: "college_main_faculty" })
);

expectAuthorizationError(
  "faculty cannot grant another user permissions",
  () => assertCanModifyFacultyAuthorization(subordinate, otherFaculty, ["STUDENT_VIEW", "STUDENT_CREATE"])
);

expectAuthorizationError(
  "subordinate cannot change Main Faculty permissions",
  () => assertCanModifyFacultyAuthorization(subordinate, mainTarget, [])
);

expectAuthorizationError(
  "subordinate cannot suspend Main Faculty",
  () => assertCanModifyFacultyAuthorization(subordinate, mainTarget)
);

expectAuthorizationError(
  "subordinate cannot change Main Faculty profile or security fields",
  () => assertCanModifyFaculty(subordinate, mainTarget)
);

expectAuthorizationError(
  "faculty cannot mass-assign Main Faculty ownership fields",
  () => assertNoForbiddenFacultyAssignmentFields({ isMainFaculty: true, collegeId: "college-a" })
);

expectAuthorizationError(
  "subordinate cannot deactivate Main Faculty",
  () => assertCanDeactivateFaculty(subordinate, mainTarget)
);

expectAuthorizationError(
  "Institution A faculty cannot modify Institution B faculty",
  () => assertCanModifyFaculty(subordinate, { ...otherFaculty, collegeId: "college-b" }),
  404
);

assert.doesNotThrow(() => assertCanModifyFaculty(subordinate, otherFaculty));
console.log("PASS FACULTY_EDIT can update allowlisted non-security profile fields");

assert.doesNotThrow(() => assertCanModifyFaculty(mainFaculty, otherFaculty));
assert.doesNotThrow(() =>
  assertCanModifyFacultyAuthorization(mainFaculty, otherFaculty, ["STUDENT_VIEW", "REPORT_VIEW"])
);
console.log("PASS Main Faculty can perform legitimate faculty management");

assert.doesNotThrow(() => assertCanGrantPermissions(mainFaculty, ["FACULTY_EDIT", "REPORT_VIEW"]));
assert.doesNotThrow(() => assertCanGrantPermissions(mainFaculty, ["all"]));
console.log("PASS authorized administrator can grant allowed and privileged permissions");

assert.equal(hasFacultyAuthorizationChanges({ batchAccess: ["2026"] }), true);
assert.equal(hasFacultyAuthorizationChanges({ scopeUnrestricted: false }), true);
assert.equal(hasFacultyAuthorizationChanges({
  cohortAccess: [{ program: "B.Tech", course: "CSE", section: "A", batch: "2026" }],
}), true);
console.log("PASS batch and exact cohort assignments use privileged authorization checks");

expectAuthorizationError(
  "even Main Faculty cannot increase their own permissions",
  () => assertCanModifyFacultyAuthorization(
    { ...mainFaculty, permissions: ["FACULTY_EDIT"] },
    { ...mainTarget, permissions: ["FACULTY_EDIT"] },
    ["FACULTY_EDIT", "all"]
  )
);

console.log("\nFaculty authorization regression suite passed.");
