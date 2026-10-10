# Enterprise credit request idempotency

Atomic conditional balance updates prevent overdrafts, but did not identify logical requests: a retry with enough remaining funds could perform another complete transfer. Durable request receipts now prevent this on:

- `POST /api/enterprise/credits/distribute`
- `POST /api/enterprise/credits/student-assign`
- `POST /api/enterprise/credits/assign-student` (same operation as the other alias)

## API contract

Send a cryptographically generated UUID v4 in `Idempotency-Key`. Missing, malformed, duplicate/comma-separated, or oversized keys return 400. UUID case is normalized. The scope is authenticated college + authenticated actor + operation + key. Client body tenant/actor identifiers are ignored. Another actor or tenant can use the same string for an independent operation, but cannot retrieve someone else's receipt.

A successful duplicate returns the original HTTP 200 JSON body. Different accounting inputs with the same scoped key return 409. PostgreSQL safely waits on an in-flight insert; transaction/pool timeout or database failure returns 503 with `Retry-After: 2`. Retry a 503 or ambiguous transport failure with exactly the same key and payload. Existing insufficient-balance and validation failures return 400 and do not persist a successful receipt.

Bulk payload hashing includes the amount, reason and effective filters after merging legacy nested and flat fields. Nested filters take precedence. Explicit recipients are deduplicated and sorted; empty filters are normalized. JSON object property order does not affect the SHA-256 hash. Single assignment includes student ID, amount and reason. Server-selected cohort membership is resolved only on the first successful execution: replay never reselects recipients as membership changes.

## Transaction and authorization

`CreditIdempotencyRecord` has a database composite unique index. `createMany(skipDuplicates)` uses PostgreSQL conflict handling to wait for a competing uncommitted claim. Explicit READ COMMITTED isolation allows the next query to see the committed receipt. A rolled-back competing transaction releases the key for another insert.

Claim, conditional institutional debit, student credit, per-recipient ledger writes, successful audit and completed response are committed in one transaction. PROCESSING is never committed by itself. A crash or failure before commit rolls everything back; response loss after commit leaves the durable receipt available. Replays never write allocations, ledger rows or successful audit events. Distinct keys still use the existing conditional balance updates and cannot overdraw the account.

Authentication, live enterprise permissions/active-faculty checks and current tenant checks run before receipt access. Single assignment also rechecks student access; bulk distribution reloads current faculty scope before receipt handling. There is no public receipt lookup route.

## Dashboard behavior

The shared browser helper generates a UUID per submission and stores it against a hash of the accounting payload, actor, tenant and operation. Pending keys survive page reloads and are shared by tabs. Web Locks coordinate key claims in supporting browsers. Completed markers also protect a delayed tab that initiated its submission before another tab finished. Existing in-flight guards and loading indicators remain.

Authentication refresh retries preserve the request options, including the key. Failed/ambiguous submissions retain their key. Confirmed success marks completion; a later intentional submission receives a fresh key. Browser storage must be available before a request is sent. After refreshing, re-enter the original settings to recover the pending operation. Changing accounting inputs represents a new logical operation. Browsers without Web Locks have best-effort shared key claims; server enforcement always applies to a shared key, but cannot infer whether independently generated keys represent the same user intent.

## Deployment and retention

1. Confirm the deployed database is baselined to the current enterprise schema.
2. Apply `20261008010000_credit_idempotency` using `prisma migrate deploy`; generate the Prisma client.
3. Coordinate backend and dashboard/API client rollout: these endpoints immediately require UUID keys. Old clients receive 400 rather than silently making unprotected transfers. All external integrations must update their retry behavior before rollout.
4. Configure proxies/CORS integrations to forward/allow `Idempotency-Key`; the application's default CORS middleware reflects requested headers.

The additive migration creates only a new table/index and a receipt-completeness check. It does not rewrite existing financial tables. Financial receipts have no TTL, cleanup job or cascading foreign keys: retain them indefinitely, including after actor/tenant deletion. Never purge successful claims or permit expired-key reuse. If response redaction is needed later, preserve the scoped key/hash as a permanent tombstone and explicitly reject reexecution. Restoring a backup must restore receipts together with balances and ledgers.

The existing repository migration history cannot bootstrap an empty database: `20261003000000_enforce_nonnegative_college_credit_balance` references enterprise tables missing from earlier migrations. This predates this change. Do not resolve it by resetting production. Verify the production migration baseline separately. Database tests here used a fresh schema generated from the current Prisma schema (excluding the new model), then applied the balance constraint and the new idempotency migration verbatim.

## Related mutation review

| Operation | Finding |
| --- | --- |
| Bulk/filtered distribution | Protected with the shared utility. |
| Single assignment/manual positive allocation and its aliases | Protected with the shared utility. |
| Single-student creation with initial credits | New identity/profile creation and unique email/enrollment constraints reject repeated creation before another committed grant. A full onboarding response receipt remains useful for retry UX, but wrapping credits alone would not make invitation delivery idempotent. |
| Bulk student import initial credits | Credits are allocated only while creating a new row inside its transaction; existing identity/profile uniqueness prevents regranting to an already created student. Full import/job response and delivery idempotency require a separate import contract. |
| Admin college credit top-ups (`backend/src/modules/admin/college-routes.ts`) | Independent additive top-ups still require equivalent durable operation receipts. Identified as follow-up; this change does not alter the admin API or its clients. |
| Institution-to-student credit transfer primitive | Covered when called from the two protected allocation operations; onboarding relies on new-identity uniqueness. It cannot safely claim keys per recipient in place of the outer logical transaction. |

## Validation

`test-credit-idempotency.ts` requires `CREDIT_IDEMPOTENCY_TEST_DATABASE_URL` to point to an isolated localhost database whose name contains `idempotency_test`. It uses real PostgreSQL, two backend processes and separate connection pools, and restarts a backend before replay. It verifies ten simultaneous requests, stored response replay, amount/recipient conflicts, canonical recipient sets, missing/malformed keys, independent keys, insufficient balance rollback/retry, injected failure after ledger writes, tenant isolation, single-route aliases and deactivated faculty denial. It checks balances, distributed totals, student balances, ledger totals/counts and audit count.

Also run the backend hash/key unit test, browser key lifecycle tests and API authentication retry test. The existing concurrency suite now sends keys to preserve its independent-operation overdraft scenarios.

## Modified files for this fix

- Backend: `backend/src/modules/enterprise/credit-idempotency.ts`, `backend/src/modules/enterprise/routes.ts`, `backend/src/services/audit.service.ts`, `backend/package.json`.
- Persistence: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261008010000_credit_idempotency/migration.sql`.
- Frontend: `src/utils/creditIdempotency.ts`, `src/lib/backendApi.ts`, `src/pages/EnterpriseDashboardPage.tsx`.
- Tests: `backend/src/tests/test-credit-idempotency.ts`, `backend/src/tests/test-credit-idempotency-unit.ts`, `backend/src/tests/test-credit-allocation-concurrency.ts`, `backend/src/tests/test-student-scope-routes.ts`, `src/utils/creditIdempotency.test.ts`, `src/lib/backendApi.idempotency.test.ts`.
- Documentation: `docs/enterprise-credit-idempotency.md`.

Existing unrelated workspace edits were preserved.

## Test results

- Passed: real PostgreSQL idempotency suite, including two backend processes, restart, accounting invariants and live faculty revocation.
- Passed: existing credit allocation concurrency suite (four scenarios).
- Passed: UUID/hash backend unit checks.
- Passed: targeted frontend run, 28 tests (key lifecycle, API key preservation, existing API and refresh regressions).
- Passed: frontend and backend TypeScript checks; whitespace checks.
- Broad Vitest run: all 76 collected tests passed before the final additional delayed-tab test; two pre-existing Node-runner files were reported as empty Vitest suites. Running those two files with `node --import tsx --test` passed all 16 tests.
- Existing broader student-scope route suite failed at an unrelated `PATCH /students/:id`: expected 404 for an out-of-scope update, received 200. The idempotency route tests passed their own authorization checks. This change does not modify that PATCH implementation.
- Fresh migration-chain deployment failed at an existing enterprise balance migration because its tables are absent from the earlier migration baseline. The new migration itself applied successfully against the current enterprise schema in isolated PostgreSQL.
- Production migrations/deployment and browser end-to-end interaction were not run.
