# Enterprise dashboard connectivity

The dashboard screenshot showed failed statistics and students, rather than a rejected faculty login.

Three application issues were found:

- Root `npm run dev` started only Vite, so the API could be missing. It now starts the local API and frontend together, reuses an existing healthy API, and supports a configured remote API. Separate commands remain available: `dev:frontend` and `dev:backend`.
- A rejected database lookup in `requireTenant` was not forwarded to Express 4's error handler. It could terminate the API, causing all later dashboard requests to fail. Errors now go through `next(error)` while tenant authorization remains unchanged.
- Prisma's default five-second connection deadline was insufficient for the configured remote database proxy. Connections now default to 30 seconds and the pool wait to 60 seconds, preserving explicit settings and the existing connection limit.

Files: `scripts/dev.mjs`, root `package.json`, `README.md`, `backend/src/db/prisma.ts`, `backend/src/middleware/tenant.ts`, `backend/src/tests/test-tenant-database-failure.ts`, and backend `package.json`.

Verification: repeated simulated database failures return 503 while the same API still responds to health requests; backend and frontend TypeScript checks pass; startup was checked on a spare frontend port and confirmed API reuse; eight parallel real database reads succeeded with extended timeouts. Final local HTTP verification returned 200 for login, enterprise statistics, and students. The database can still be unavailable independently of these fixes; no data or permissions were changed.

Run `npm run dev` from the repository root and keep that terminal open. Frontend defaults to port 3000 and API to the configured backend port (4000 by default).
