import assert from "node:assert/strict";
import { test } from "vitest";
import {
  AUDIT_ACTION_FILTER_OPTIONS,
  ENTERPRISE_AUDIT_ACTIONS,
  ENTERPRISE_AUDIT_ACTION_ALIASES,
  resolveCanonicalAuditAction,
} from "../types/enterpriseAudit";

test("Every audit filter option corresponds to a canonical backend audit action", () => {
  const canonicalValues = new Set(Object.values(ENTERPRISE_AUDIT_ACTIONS));

  for (const option of AUDIT_ACTION_FILTER_OPTIONS) {
    assert(
      canonicalValues.has(option.value as any),
      `Filter option "${option.label}" has non-canonical value: ${option.value}`
    );
    assert(option.label && option.label.trim().length > 0, "Filter label must not be empty");
    assert(option.value && option.value.trim().length > 0, "Filter value must not be empty");
  }
});

test("E-18: STUDENTS_IMPORTED is replaced by STUDENTS_BULK_IMPORTED", () => {
  const filterValues = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.value);
  assert.equal(filterValues.includes("STUDENTS_IMPORTED" as any), false);
  assert.equal(filterValues.includes(ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED), true);

  const bulkImportOption = AUDIT_ACTION_FILTER_OPTIONS.find(
    (o) => o.value === ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED
  );
  assert(bulkImportOption);
  assert.equal(bulkImportOption.label, "Students Imported (Bulk)");
});

test("E-18: CREDITS_DISTRIBUTED is replaced by BULK_CREDITS_DISTRIBUTED", () => {
  const filterValues = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.value);
  assert.equal(filterValues.includes("CREDITS_DISTRIBUTED" as any), false);
  assert.equal(filterValues.includes(ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED), true);

  const creditDistOption = AUDIT_ACTION_FILTER_OPTIONS.find(
    (o) => o.value === ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED
  );
  assert(creditDistOption);
  assert.equal(creditDistOption.label, "Credits Distributed (Cohort)");
});

test("E-18: FACULTY_INVITED is replaced by FACULTY_CREATED", () => {
  const filterValues = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.value);
  assert.equal(filterValues.includes("FACULTY_INVITED" as any), false);
  assert.equal(filterValues.includes(ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED), true);

  const facultyCreatedOption = AUDIT_ACTION_FILTER_OPTIONS.find(
    (o) => o.value === ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED
  );
  assert(facultyCreatedOption);
  assert.equal(facultyCreatedOption.label, "Faculty Created");
});

test("E-18: REPORT_VIEWED is completely removed from selectable filters", () => {
  const filterValues = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.value);
  assert.equal(filterValues.includes("REPORT_VIEWED" as any), false);
  const filterLabels = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.label.toLowerCase());
  assert.equal(filterLabels.some((l) => l.includes("report viewed")), false);
});

test("Legacy action aliases resolve correctly", () => {
  assert.equal(
    resolveCanonicalAuditAction("STUDENTS_IMPORTED"),
    ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED
  );
  assert.equal(
    resolveCanonicalAuditAction("CREDITS_DISTRIBUTED"),
    ENTERPRISE_AUDIT_ACTIONS.BULK_CREDITS_DISTRIBUTED
  );
  assert.equal(
    resolveCanonicalAuditAction("FACULTY_INVITED"),
    ENTERPRISE_AUDIT_ACTIONS.FACULTY_CREATED
  );
  assert.equal(
    resolveCanonicalAuditAction("STUDENTS_BULK_IMPORTED"),
    ENTERPRISE_AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED
  );
  assert.equal(resolveCanonicalAuditAction(""), undefined);
  assert.equal(resolveCanonicalAuditAction(null), undefined);
});
