# Student onboarding credit authorization fix

## Root cause and policy

Student creation and both bulk import routes required only `STUDENT_CREATE`, but accepted positive initial credits and called the institutional debit/credit primitive. Atomic transfers protected balance integrity while permitting a faculty member to spend credits through a capability that did not authorize spending.

The existing policy unambiguously separates these capabilities: `backend/src/modules/enterprise/faculty-authorization.ts` lists `STUDENT_CREATE` and `INTERVIEW_CREDIT_ASSIGN` independently; dedicated allocation routes require `INTERVIEW_CREDIT_ASSIGN`; backend and frontend aliases map `manageStudents` only to student management and `distributeCredits` to credit operations. No new product-policy assumption or confirmation is needed. Existing Main Faculty, platform administrator and `all` behavior remains governed by the existing institutional permission resolver.

## Enforcement

Single creation validates numeric integer credits (0 through PostgreSQL INT maximum), then requires live `STUDENT_CREATE`, plus live `INTERVIEW_CREDIT_ASSIGN` for positive initial credits. Missing credits default to zero. Invalid numbers, negative/fractional values, nonnumeric input, booleans and objects are rejected.

The shared onboarding authorization helper loads the actor's actual stored role and delegates to the existing `resolveEnterprisePermission` policy. It reads current membership/permissions instead of JWT permission flags or client body fields. Denied attempts return 403 and log only the missing permission classification.

`executeBulkImport` normalizes every row and checks effective credit requests before validation discards rows or any transaction begins. This protects JSON, CSV and XLSX imports, row-specific credits, default credits, strict mode and partial mode. Positive credits on an otherwise invalid row still require authorization and deny the entire unauthorized request before zero-credit rows can be created. Even internal calls cannot assert a caller-provided super-admin flag to bypass this credit permission check. Invalid row credits retain the existing strict/partial validation semantics; they are never allocated. Multipart defaults are validated explicitly.

Authorized allocation retains the existing conditional institutional debit and transaction primitive. Initial credit audit events use `STUDENT_CREDITS_ASSIGNED`, with stored actor, college, student, amount, source and timestamp. Audit writes occur inside the credit transaction so rollback removes accounting and the financial audit together. Existing student-created and import-summary audits remain. Insufficient credits now return the expected business error as HTTP 400 instead of falling through to a generic HTTP 500.

## Dashboard

The existing permission model controls initial-credit inputs in Add Student and Bulk Import. Users without assignment permission see a zero-credit explanation; import guidance also explains that uploaded positive credit values must be removed. Initial state, form reset, permission revocation and submitted payloads use zero for users without credit-assignment permission. Authorized users retain their existing values and controls. Backend enforcement remains authoritative if the browser has stale permission state. Loading, duplicate-request guards and response feedback are preserved.

## Modified files and locations

- `backend/src/modules/enterprise/student-credit-authorization.ts:9`: shared live permission gate.
- `backend/src/modules/enterprise/routes.ts:1453`: single creation gate; `1561`: atomic financial audit; `1710`: credit column normalization; `1804`: complete import preflight; `2130`: transactional imported-student credit audit; `2320`: JSON defaults; multipart defaults also validated.
- `backend/src/middleware/error-handler.ts:14`: authorization errors return 403; insufficient credits return 400.
- `src/pages/EnterpriseDashboardPage.tsx:485`: permission-aware initial state; `541`: stale-state reset; `1061`: single payload gate; `1089`: import payload gate; `3165` and `3298`: permission-aware controls.
- `src/utils/enterprisePermissions.ts:34`: shared browser payload gate.
- `src/utils/enterprisePermissions.test.ts:33`: hidden/stale values and legacy/privileged permission tests.
- `backend/src/tests/test-student-initial-credit-authorization.ts:1`: isolated PostgreSQL integration coverage.
- `backend/package.json:33`: integration test script.
- `docs/student-initial-credit-authorization.md`: this report.

Existing unrelated workspace changes were preserved. No database schema migration is needed for this authorization fix.

## Verification results

Passed on isolated PostgreSQL 18.4:

- New initial-credit authorization suite: create-only zero-credit success; denied positive allocation; assignment-only denial; forged permissions; JSON/CSV/XLSX/default credit requests; invalid positive rows; strict and partial imports; zero-credit imports; malformed amounts; authorized allocations/audits; insufficient balance; injected transaction failure; concurrent authorized requests; legacy permissions and live revocation.
- Unauthorized request snapshots prove unchanged users, students, invitations, institution balance, student balance, total distributed, credit ledger and financial audits. No welcome emails are sent on denial.
- Existing credit-accounting suite: 9 scenarios passed.
- Existing strict/partial bulk import atomicity suite: 5 scenarios passed.
- Existing faculty authorization suite: 15 scenarios passed.
- Existing credit-ledger scope suite: 9 scenarios passed.
- Existing durable credit-idempotency suite: all 8 groups passed, including two processes, restart replay and accounting invariants.

Passed locally:

- Frontend permission, API, refresh and idempotency tests: 35 tests across 5 files.
- Frontend and backend TypeScript checks.
- Git whitespace checks.

Remaining failed regression: the existing student credential resend suite passes its first four scenarios, then fails at `backend/src/tests/test-student-credential-resend.ts:250`: after password reset it expects zero refresh tokens but finds one. This is in the unchanged invitation acceptance/session invalidation path, not initial-credit assignment. No claim is made that the entire invitation/session regression suite is green.

Not run: production deployment, production database changes and browser end-to-end interaction. The automated security coverage uses real HTTP handlers, actual multipart uploads, real database transactions and mocked welcome email delivery.

## Deployment and remaining risks

Deploy the backend and dashboard changes together. Existing unauthorized onboarding clients requesting positive credits will now receive 403 and must submit zero or obtain credit-assignment permission. Authorized clients and zero-credit onboarding remain compatible. The previously documented migration-baseline gap is unrelated to this authorization fix; this change adds no migration. Production email delivery was not exercised. The existing refresh-token invalidation regression needs separate investigation before signing off the full invitation/session workflow.
