# Enterprise student and report input validation

## Root causes

Creation used untrimmed strings; PUT/PATCH had separate, weaker cohort and semester schemas. Imports coerced non-string text and truncated semester strings with `parseInt`. Report handlers cast sort direction and constructed dates without checking calendar validity or range ordering.

## Files changed

- `backend/src/modules/enterprise/input-validation.ts`: shared Zod student, semester, and report schemas; report middleware.
- `backend/src/modules/enterprise/routes.ts`: schemas for creation, PUT/PATCH, imports, report list/summary/export; strict spreadsheet semester parsing; removes duplicate import field checks.
- `backend/src/middleware/error-handler.ts`: `VALIDATION_ERROR` identifier on existing Zod 400 responses.
- `backend/src/tests/test-enterprise-input-validation.ts`: schema and middleware tests.
- `backend/src/tests/test-enterprise-input-validation-routes.ts`: HTTP/PostgreSQL tests and Prisma-operation guards.
- `backend/package.json`: commands for both new suites.

## Student rules

Required text must be a string, is trimmed, and cannot be blank. Internal spaces remain. Existing minimum lengths remain: name 2 and batch 4. Maximums: name/program/course/section 200, enrollment number 100, batch 50, email 254. Email remains validated; identifier content and case remain unchanged beyond surrounding whitespace trimming.

Department remains optional and can be cleared with an empty string. Optional academic year, phone, and gender also permit empty strings, with maximum 50 (department 200). Null is rejected. Required program, course, section, and batch cannot be cleared. Omitted update fields remain untouched.

Both update aliases share the established semester range of integer 1–12. Negative, zero, fractional, nonfinite, unsafe, out-of-range values and numeric JSON strings are rejected. Spreadsheet semesters may be digit strings; malformed strings such as `2abc` are rejected instead of truncated. Numeric spreadsheet enrollment identifiers retain their existing conversion to strings.

Bulk imports keep per-row errors and strict/non-strict behavior. Invalid strict imports return 400 through the existing route contract; non-strict imports can create valid rows and report invalid ones. Credit validation and accounting retain their existing behavior.

## Report rules

Direction must be `asc` or `desc`. Both `sortOrder` and `sortDirection` work; conflicts are rejected. Missing values retain existing defaults. Allowed sort fields preserve all existing aliases: `createdAt`, `date`, `latestInterviewDate`, `overallScore`, `averageScore`, `score`, `name`, `studentName`, `enrollmentNumber`, `rollNumber`, `targetRole`.

Dates accept `YYYY-MM-DD` or ISO timestamps with explicit `Z` or `±HH:mm` timezone. Timestamps support minute or second precision and up to three fractional second digits. Validation checks leap years, month/day bounds, time components, offsets up to ±14:00, and chronological ordering. Impossible dates, zone-free timestamps, and repeated/non-string date or sort parameters are rejected.

Existing `startDate`/`endDate` and `dateFrom`/`dateTo` aliases and precedence remain. Date-only values retain UTC-midnight interpretation, including the existing end boundary. Authorization runs before validation; validation runs before affected domain queries.

## Error example

Whitespace-only program returns HTTP 400:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Program is required",
  "issues": { "program": ["Program is required"] }
}
```

Only explicit Zod failures use this response. Existing 401/403/404/409 handling and genuine server-error handling remain unchanged.

## Verification

Passed:

- Backend `npm run test:enterprise-input-validation`.
- New HTTP/database suite: normalized creation, malformed input rejected before student transactions/report data queries, both update aliases, omitted fields preserved, tenant isolation, invalid and valid imports.
- Existing credit-accounting suite: nine groups.
- Existing bulk-import atomicity suite: five groups.
- Existing report/export search parity suite: 60 assertions, zero failures, including dates, CSV/XLSX, faculty scopes, and tenant isolation.
- Backend `npx tsc --noEmit` and root `npm run lint` (TypeScript check).
- Whitespace check on changed files.

The HTTP suite requires `CREDIT_IDEMPOTENCY_TEST_DATABASE_URL` pointing to a migrated isolated localhost database whose name contains `idempotency_test`. It overrides application database configuration before loading Prisma. Verification used temporary local PostgreSQL and mocked email; no production database was used.

## Limits

No database schema or frontend changes were needed. Pagination and score-range parsing retain existing behavior. Summary and student-view reports retain existing filter/sorting semantics. The internal report filter builder assumes validated HTTP input. Bulk row errors retain their existing response contract. No deployment was performed.
