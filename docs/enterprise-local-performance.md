# School dashboard latency in local development

The local API is configured to use a remote Railway PostgreSQL database. The
number of students is not the main source of delay: even `SELECT 1` measured
roughly 0.5–1.1 seconds on a warm connection. Opening the first connection took
5.1–5.9 seconds. These measurements describe this computer's connection during
the investigation, not PostgreSQL execution time or a production latency SLA.

## Bottlenecks and changes

- Related-record reads previously fetched the user, college and faculty profile
  through three SQL queries. The student page similarly fetched students, users
  and credit balances separately. Enabled Prisma `relationJoins` and explicitly
  use `relationLoadStrategy: "join"` for authorization, session context, and the
  student/faculty lists. The generator feature also makes joins the default for
  other supported relation reads; deployment must regenerate Prisma Client.
  No database migration is needed. [Prisma's explanation of the two strategies](https://www.prisma.io/blog/prisma-orm-now-lets-you-choose-the-best-join-strategy-preview).
- Faculty scope and creation authorization repeated information already loaded
  by the request's live authorization check. These HTTP paths now reuse that
  request snapshot. Internal bulk imports retain their separate live lookup.
  Reads still perform the final live check before releasing data. Nothing caches
  authorization between requests.
- Student creation checks email/enrollment uniqueness concurrently. Both creation
  routes reuse the institution already resolved by tenant middleware. Account,
  credit, invitation and idempotency writes retain their transaction behavior.
- Switching from Overview to Students previously cancelled/refetched the same
  list. It now preserves the same request/data while the list remains visible.
  Filters, pagination, session changes and returning from another section still
  trigger a load. Faculty creation starts its list/statistics refresh without
  keeping the create action busy and skips the unrelated filter-options refresh.
- Enterprise email delivery was awaited without short provider deadlines. It
  now prefers configured Resend HTTPS, honors `RESEND_FROM`, and cancels a stalled
  HTTPS request after three seconds. SMTP DNS, connection, greeting and socket
  inactivity deadlines are three seconds each, **not** a three-second total SMTP
  deadline. Duplicate attempts against the Gmail host are removed. Timeouts do
  not automatically resend through another provider, and configured-provider
  failures cannot fall through to simulated success. The account still remains
  created if email delivery fails, with the existing warning/resend behavior.
  [Nodemailer documents the network timeout settings](https://nodemailer.com/smtp).
- The long-running API starts connecting to the database during startup, so the
  first login does not always initiate the connection. This is best-effort:
  additional pool connections and network outages can still delay requests.

## Read-only measurements

The same three-student page was used for both strategies in the final paired run:

| Read | Separate queries | Joined query | SQL query count |
| --- | ---: | ---: | ---: |
| Authorization relations | 3,310 ms | 1,512 ms | 3 → 1 |
| Student page relations | 3,066 ms | 1,252 ms | 3 → 1 |

Earlier runs measured 3,336 → 1,129 ms for authorization and 3,535 → 998 ms for
the student page. Network variability explains why timings differ between runs.
These are component timings, not complete page loads.

A separate full HTTP check against the real student-list route, including
authentication, tenant resolution, permissions, scoped pagination, invitation
lookup and the final access check, returned HTTP 200 with three rows every time:

| Request | Elapsed |
| --- | ---: |
| First request in the temporary process | 8,499 ms |
| Second request | 3,628 ms |
| Third request | 2,081 ms |

The first request still paid remote connection/pool setup costs. **The code
changes do not guarantee subsecond responses or remove cold remote-database
latency.** This temporary route server did not run the application bootstrap
warmup. No live student/faculty creation or real email was used for measurement.

For development without that network cost, use a local PostgreSQL database.
The repository already defines one in `backend/docker-compose.yml`, exposed on
port 5433. Docker Desktop was not running during this investigation. Switching
databases also switches the dataset; remote school accounts would not magically
exist locally. The configured database and its records were left intact. The
current environment loader lets root `.env` override `backend/.env`, so changing
only the backend file may not change the active database.

## Verification and repeatability

- Frontend: all 175 tests passed; frontend and backend TypeScript checks passed.
- Backend: read-query, request/creation performance, scope, credit-idempotency
  unit, email timeout, HTTP login/refresh, cross-instance revocation and database
  outage regression checks passed. Mutations/email delivery used mocks.
- Existing read/revocation tests were missing a report grouping mock; added it
  so the isolated suites cannot accidentally read the configured database there.
  Two frontend audit test files used the Node runner inside Vitest; their imports
  now use the configured Vitest runner.

Run the diagnostic with network access:

```sh
npm --prefix backend run benchmark:enterprise-reads
```

It only reads and prints timings, query counts and row counts. It does not print
identities, SQL, connection strings, tokens, or passwords.

For a fresh checkout, regenerate the client before starting the API:

```sh
npm --prefix backend run prisma:generate
npm run dev
```

The client has already been regenerated in this workspace. Restart any existing
development process to ensure it uses the regenerated client.
