import assert from "node:assert/strict";
import { studentCreationSchema, studentUpdateSchema, reportQuerySchema, validateReportQuery, semesterSchema } from "../modules/enterprise/input-validation.js";
const valid = { name: " Rahul Sharma ", email: "rahul@example.com", enrollmentNumber: "EN-1", program: " B.Tech ", course: " Computer Science ", section: " A ", batch: " 2026 " };
const normalized = studentCreationSchema.parse(valid);
assert.equal(normalized.name, "Rahul Sharma"); assert.equal(normalized.program, "B.Tech"); assert.equal(normalized.course, "Computer Science"); assert.equal(normalized.batch, "2026");
for (const field of ["name", "program", "course", "section", "batch", "enrollmentNumber"] as const) {
  for (const value of ["", "   ", null, 123, undefined, "x".repeat(1000)]) assert.equal(studentCreationSchema.safeParse({ ...valid, [field]: value }).success, false, `${field}: ${value}`);
}
for (const field of ["program", "course", "section", "batch"] as const) {
  for (const value of ["", " ", null, 1]) assert.equal(studentUpdateSchema.safeParse({ [field]: value }).success, false);
}
assert.deepEqual(studentUpdateSchema.parse({ semester: 2 }), { semester: 2 });
assert.deepEqual(studentUpdateSchema.parse({ program: " MBA " }), { program: "MBA" });
assert.equal(studentUpdateSchema.safeParse({ department: null }).success, false);
assert.equal(studentUpdateSchema.parse({ department: "" }).department, "");
for (const value of [-1, 0, 13, 2.5, "2", "abc", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null]) assert.equal(semesterSchema.safeParse(value).success, false);
for (const value of [1, 6, 12]) assert.equal(semesterSchema.parse(value), value);
for (const direction of ["asc", "desc"]) assert.equal(reportQuerySchema.parse({ sortOrder: direction }).sortOrder, direction);
for (const query of [{ sortOrder: "invalid" }, { sortDirection: "invalid" }, { sortBy: "arbitrary" }, { sortOrder: ["asc", "desc"] }, { sortOrder: "asc", sortDirection: "desc" }]) assert.equal(reportQuerySchema.safeParse(query).success, false);
for (const value of ["2026-13-45", "2026-02-30", "not-a-date", "2025-02-29", "2026-01-01T24:00:00Z", "2026-01-01T12:00:00+14:01", "2026-01-01T12:00:00+05:99", "2026-01-01T12:00:00", "2026-01-01T12:00:00garbage", "", ["2026-01-01"]]) assert.equal(reportQuerySchema.safeParse({ startDate: value }).success, false, String(value));
for (const value of ["2024-02-29", "2026-01-01", "2026-01-01T12:00:00Z", "2026-01-01T12:00:00.123+05:30", "2026-01-01T12:00:00-07:00"]) assert.equal(reportQuerySchema.safeParse({ startDate: value }).success, true);
assert.equal(reportQuerySchema.safeParse({ startDate: "2026-02-02", endDate: "2026-02-01" }).success, false);
assert.equal(reportQuerySchema.safeParse({ dateFrom: "2026-02-02", dateTo: "2026-02-01" }).success, false);
assert.equal(reportQuerySchema.safeParse({ startDate: "2026-01-01T12:00:00+05:30", endDate: "2026-01-01T07:00:00Z" }).success, true);
assert.equal(reportQuerySchema.safeParse({}).success, true);
// An invalid query must never enter the downstream database handler.
let databaseCalls = 0; let validationError: unknown;
validateReportQuery({ query: { sortOrder: "bogus" } } as never, {} as never, error => { if (error) validationError = error; else databaseCalls++; });
assert(validationError); assert.equal(databaseCalls, 0);
console.log("PASS student text/partial update/semester normalization, strict dates, sorting and pre-query validation");
