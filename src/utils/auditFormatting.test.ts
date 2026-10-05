import assert from "node:assert/strict";
import test from "node:test";
import {
  formatEntityName,
  getTargetUser,
  formatAuditDetails,
  calculatePaginationRange,
} from "./auditFormatting";
import type { EnterpriseAuditLog } from "../types/enterpriseAudit";

test("Pagination range calculations - First page (Test 2)", () => {
  const result = calculatePaginationRange(1, 10, 50);
  assert.equal(result.start, 1);
  assert.equal(result.end, 10);
  assert.equal(result.total, 50);
  assert.equal(result.text, "Showing 1–10 of 50 audit events");
});

test("Pagination range calculations - Middle page (Test 3)", () => {
  const result = calculatePaginationRange(3, 10, 50);
  assert.equal(result.start, 21);
  assert.equal(result.end, 30);
  assert.equal(result.total, 50);
  assert.equal(result.text, "Showing 21–30 of 50 audit events");
});

test("Pagination range calculations - Last page (Test 4)", () => {
  const result = calculatePaginationRange(5, 10, 50);
  assert.equal(result.start, 41);
  assert.equal(result.end, 50);
  assert.equal(result.total, 50);
  assert.equal(result.text, "Showing 41–50 of 50 audit events");
});

test("Pagination range calculations - Partial last page (Test 5)", () => {
  const result = calculatePaginationRange(5, 10, 43);
  assert.equal(result.start, 41);
  assert.equal(result.end, 43);
  assert.equal(result.total, 43);
  assert.equal(result.text, "Showing 41–43 of 43 audit events");
});

test("Pagination range calculations - Empty audit log (Test 6)", () => {
  const result = calculatePaginationRange(1, 10, 0);
  assert.equal(result.start, 0);
  assert.equal(result.end, 0);
  assert.equal(result.total, 0);
  assert.equal(result.text, "No audit events");
  assert.doesNotMatch(result.text, /Showing 1–0/);
});

test("Entity rendering handles lowercase and prefix entity names (Test 7)", () => {
  assert.equal(formatEntityName("faculty"), "Faculty");
  assert.equal(formatEntityName("student"), "Student");
  assert.equal(formatEntityName("CollegeFaculty"), "Faculty");
  assert.equal(formatEntityName("CollegeStudent"), "Student");
  assert.equal(formatEntityName("InterviewCredit"), "Interview Credit");
  assert.equal(formatEntityName(null), "—");
  assert.equal(formatEntityName(undefined), "—");
});

test("Change rendering formats before/after without [object Object] (Test 8)", () => {
  const log: EnterpriseAuditLog = {
    id: "log-1",
    action: "FACULTY_UPDATED",
    entity: "CollegeFaculty",
    entityId: "fac-1",
    actor: { id: "admin-1", name: "Admin", email: "admin@college.edu", role: "college_main_faculty" },
    oldValue: { permission: false },
    newValue: { permission: true },
    ipAddress: "127.0.0.1",
    metadata: null,
    createdAt: "2026-10-04T12:00:00.000Z",
  };

  const details = formatAuditDetails(log);
  assert.equal(details, "permission: false → true");
  assert.doesNotMatch(details, /\[object Object\]/);
});

test("Metadata rendering formats structured metadata safely (Test 9)", () => {
  const log: EnterpriseAuditLog = {
    id: "log-2",
    action: "CREDITS_ALLOCATED",
    entity: "InterviewCredit",
    entityId: "cred-1",
    actor: { id: "admin-1", name: "Admin", email: "admin@college.edu", role: "college_main_faculty" },
    oldValue: null,
    newValue: null,
    ipAddress: null,
    metadata: { reason: "Annual Cohort Grant", batch: "2026", count: 100 },
    createdAt: "2026-10-04T12:00:00.000Z",
  };

  const details = formatAuditDetails(log);
  assert.equal(details, "reason: Annual Cohort Grant, batch: 2026, count: 100");
  assert.doesNotMatch(details, /\[object Object\]/);
});

test("Null values render safely without crashing (Test 10)", () => {
  const log: EnterpriseAuditLog = {
    id: "log-3",
    action: "UNKNOWN_ACTION",
    entity: null,
    entityId: null,
    actor: null,
    oldValue: null,
    newValue: null,
    ipAddress: null,
    metadata: null,
    createdAt: "2026-10-04T12:00:00.000Z",
  };

  assert.equal(formatEntityName(log.entity), "—");
  assert.equal(formatAuditDetails(log), "—");
  assert.equal(getTargetUser(log), null);
});

test("Target user derivation does NOT map targetUser to actor", () => {
  const logWithoutTarget: EnterpriseAuditLog = {
    id: "log-4",
    action: "STUDENT_VIEWED",
    entity: "CollegeStudent",
    entityId: "stud-1",
    actor: { id: "fac-1", name: "Professor Smith", email: "smith@college.edu", role: "college_faculty" },
    oldValue: null,
    newValue: null,
    ipAddress: null,
    metadata: null,
    createdAt: "2026-10-04T12:00:00.000Z",
  };

  // Must NOT invent targetUser = actor
  const target = getTargetUser(logWithoutTarget);
  assert.equal(target, null);

  const logWithStudentTarget: EnterpriseAuditLog = {
    id: "log-5",
    action: "STUDENT_CREATED",
    entity: "CollegeStudent",
    entityId: "stud-2",
    actor: { id: "fac-1", name: "Professor Smith", email: "smith@college.edu", role: "college_faculty" },
    oldValue: null,
    newValue: { name: "Alice Sharma", email: "alice@college.edu" },
    ipAddress: null,
    metadata: null,
    createdAt: "2026-10-04T12:00:00.000Z",
  };

  const targetFromNewValue = getTargetUser(logWithStudentTarget);
  assert.deepEqual(targetFromNewValue, { name: "Alice Sharma", email: "alice@college.edu" });
});
