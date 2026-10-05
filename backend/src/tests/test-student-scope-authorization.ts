import assert from "node:assert/strict";
import {
  buildFacultyStudentScopeConditions,
  isStudentWithinFacultyScope,
  parseFacultyCohortAccess,
  type FacultyStudentScope,
  type StudentScopeIdentity,
} from "../modules/enterprise/student-scope-authorization.js";

const restricted: FacultyStudentScope = {
  collegeId: "college-a",
  hasAccess: true,
  unrestricted: false,
  programAccess: ["B.Tech"],
  courseAccess: ["Computer Science"],
  sectionAccess: ["A"],
};

const inScope: StudentScopeIdentity = {
  collegeId: "college-a",
  program: "B.Tech",
  course: "Computer Science",
  section: "A",
};

assert.equal(isStudentWithinFacultyScope(restricted, inScope), true);
assert.equal(isStudentWithinFacultyScope(restricted, { ...inScope, program: "BBA" }), false);
assert.equal(isStudentWithinFacultyScope(restricted, { ...inScope, course: "Mechanical" }), false);
assert.equal(isStudentWithinFacultyScope(restricted, { ...inScope, section: "B" }), false);
assert.equal(isStudentWithinFacultyScope(restricted, { ...inScope, collegeId: "college-b" }), false);
console.log("PASS restricted scope requires tenant, program, course, and section matches");

const dimensionWildcard = { ...restricted, courseAccess: [], sectionAccess: [] };
assert.equal(
  isStudentWithinFacultyScope(dimensionWildcard, { ...inScope, course: "Mechanical", section: "Z" }),
  true
);
console.log("PASS empty arrays preserve existing per-dimension unrestricted semantics");

const administrator = { ...restricted, unrestricted: true };
assert.equal(
  isStudentWithinFacultyScope(administrator, { ...inScope, program: "BBA", course: "Finance", section: "Z" }),
  true
);
assert.equal(
  isStudentWithinFacultyScope(administrator, { ...inScope, collegeId: "college-b" }),
  false
);
console.log("PASS unrestricted administrators retain tenant-wide access only");

assert.equal(isStudentWithinFacultyScope({ ...restricted, hasAccess: false }, inScope), false);
assert.deepEqual(buildFacultyStudentScopeConditions({ ...restricted, hasAccess: false }), { id: { in: [] } });
assert.deepEqual(buildFacultyStudentScopeConditions(administrator), {});
assert.deepEqual(buildFacultyStudentScopeConditions(restricted), {
  program: { in: ["B.Tech"] },
  course: { in: ["Computer Science"] },
  section: { in: ["A"] },
});
console.log("PASS query conditions and object authorization use identical scope semantics");

const exactCohorts: FacultyStudentScope = {
  ...restricted,
  cohortAccess: [
    { program: "B.Tech", course: "Computer Science", section: "A", batch: "2026" },
    { program: "B.Tech", course: "Mechanical", section: "B", batch: "2027" },
  ],
};
const cseA2026 = { ...inScope, batch: "2026" };
const mechanicalB2027 = { ...inScope, course: "Mechanical", section: "B", batch: "2027" };
assert.equal(isStudentWithinFacultyScope(exactCohorts, cseA2026), true);
assert.equal(isStudentWithinFacultyScope(exactCohorts, mechanicalB2027), true);
assert.equal(isStudentWithinFacultyScope(exactCohorts, { ...cseA2026, section: "B" }), false);
assert.equal(isStudentWithinFacultyScope(exactCohorts, { ...mechanicalB2027, section: "A" }), false);
assert.equal(isStudentWithinFacultyScope(exactCohorts, { ...cseA2026, batch: "2027" }), false);
assert.deepEqual(buildFacultyStudentScopeConditions(exactCohorts), {
  OR: [
    { program: "B.Tech", course: "Computer Science", section: "A", batch: "2026" },
    { program: "B.Tech", course: "Mechanical", section: "B", batch: "2027" },
  ],
});
console.log("PASS exact cohort tuples block Cartesian and cross-batch scope expansion");

assert.equal(isStudentWithinFacultyScope({ ...exactCohorts, cohortAccess: [] }, cseA2026), false);
assert.equal(isStudentWithinFacultyScope({
  ...exactCohorts,
  scopeUnrestricted: true,
  cohortAccess: [],
}, cseA2026), true);
console.log("PASS explicit unrestricted state distinguishes all cohorts from no cohorts");

assert.throws(() => parseFacultyCohortAccess([{ program: "B.Tech" }]));
console.log("PASS malformed exact cohort data fails closed");

const existing = { ...inScope, batch: "2026", status: "active" };
const statusOnlyUpdate = { ...existing, status: "inactive" };
const sectionTransfer = { ...existing, section: "B" };
const courseTransfer = { ...existing, course: "Mechanical" };
const programTransfer = { ...existing, program: "BBA" };
assert.equal(isStudentWithinFacultyScope(restricted, statusOnlyUpdate), true);
assert.equal(isStudentWithinFacultyScope(restricted, sectionTransfer), false);
assert.equal(isStudentWithinFacultyScope(restricted, courseTransfer), false);
assert.equal(isStudentWithinFacultyScope(restricted, programTransfer), false);
console.log("PASS effective post-update state blocks full and partial scope-transfer attacks");

console.log("E-09 student scope authorization unit suite passed.");
