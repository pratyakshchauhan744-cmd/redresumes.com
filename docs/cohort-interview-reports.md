# Cohort interview reports

The enterprise Reports tab now lists students. Each student links to a paginated
history of their completed interview sessions that have a persisted evaluation.
History and report navigation remain within the dashboard. The URL stores cohort
filters, search, student-list page, selected student, history page, and session;
browser Back restores these values. Checkbox selections persist between history
pages while that student's history remains mounted.

## API

Existing routes updated:

- `GET /api/enterprise/reports?view=students`: student summaries, actual evaluated
  session count, most recent normalized score, and report date. Existing summary
  fields remain available. The default individual-report API remains available.
- `GET /api/enterprise/reports/summary?view=students`: session-based analytics for
  the same students selected by search and cohort filters.
- `GET /api/enterprise/reports/export?view=students&format=csv|xlsx`: all matching
  student rows, including interview counts and latest scores, across all pages.

New routes (IDs are database `CollegeStudent.id` and `InterviewSession.id`):

- `GET /api/enterprise/students/:studentId/interviews?page=1&limit=10`
- `GET /api/enterprise/students/:studentId/interviews/:sessionId/report`
- `GET /api/enterprise/students/:studentId/interviews/:sessionId/report/pdf`
- `POST /api/enterprise/students/:studentId/reports/export`
  - Selected: `{ "mode": "selected", "sessionIds": ["..."] }`
  - All eligible sessions: `{ "mode": "all" }`

Report retrieval is read-only; it does not invoke AI evaluation or PDF rendering.
PDF rendering runs only for explicit download requests. ZIPs contain one PDF per
selected session; no interview evaluations are merged. Server errors do not return
a partial archive or an attachment with a success status.

## Authorization and data

All routes use existing institutional authentication, active-tenant checks,
`REPORT_VIEW`, and current faculty cohort scope. Queries verify both the student's
institution and the session's institution/user ID. ZIP downloads additionally
require the existing `REPORT_EXPORT` permission; individual viewing/PDF actions
require `REPORT_VIEW`. Exports recheck current authorization and student scope
before releasing bytes, including POST requests.

Session timing exposes real timestamps: `session.createdAt` (startedAt),
`session.completedAt` (completedAt, recorded when the interview session finishes or
is completed), and `report.createdAt` (evaluation completion time). History sorts by
evaluation completion time, then stable report ID. Interview numbers are
chronological display labels; retrieval always uses IDs. Scheduled duration and
actual session elapsed time are surfaced accurately from the real database timestamps.

Scores respect stored `scoreScale` metadata (8/10 = 80%; 8/100 = 8%). Analytics
count evaluation sessions, not students. Invalid scores are excluded from averages
and distribution buckets without removing the underlying session from the count.
Missing voice metrics display “Not recorded”; fabricated timeline timestamps and
latency metrics were removed from the shared viewer.

Search matches name, email, enrollment, and completed-interview role/style. In
student view a role match selects that student, and counts/analytics/export include
all their eligible interviews. Cohort, course, section, batch, and faculty scope
apply before pagination.

## Download bounds and deployment

- ZIP: maximum 50 reports and 25 MiB; all-report requests above the limit fail
  explicitly. Select smaller groups for longer histories.
- PDF/ZIP rendering: 90-second application deadline; a PDF page render has its own
  20-second timeout. Hosting platforms may impose a shorter request deadline.
- 30 download requests per IP per 15 minutes, one active export per faculty user,
  and two simultaneous exports per backend process. These in-memory protections
  apply per process; a multi-instance deployment would need a shared limiter/job
  queue for global limits.
- Reuses the resume PDF Chromium launcher, including its serverless runtime path.
  The backend runtime must have the existing Puppeteer/Chromium dependencies
  available. The new ZIP dependency is JSZip; there is no new PDF library.
- PDF HTML is escaped; JavaScript and external resource requests are disabled.
  A report's HTML is capped at 2 MiB before rendering.

## Validation

Use only an isolated local PostgreSQL database with `reports_test` in its name.
Apply the existing schema to the empty test database, then run:

```sh
REPORTS_TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:PORT/redresumes_reports_test' \
  npm --prefix backend run test:student-interview-reports
npm test
npx playwright test tests/e2e/enterprise-interview-reports.spec.ts
npx tsc --noEmit
npm --prefix backend run build
npx vite build
```

The integration suite refuses nonlocal/non-test database URLs and resets the URL
*after* the existing environment loader runs. It exercises actual Express middleware
and Prisma queries, real ZIP packing, and a deterministic PDF renderer for failure
and membership assertions. Set `REPORT_PDF_SMOKE_PATH` to additionally render an
actual Chromium PDF to that temporary path for visual QA. Browser tests cover 1/5/20
interviews, exact report selection without downloads, PDF/ZIP actions, browser Back,
filter preservation, error/retry behavior, mobile overflow, and keyboard navigation.

## Changed files

Frontend:

- `src/pages/EnterpriseDashboardPage.tsx`
- `src/components/StudentInterviewHistory.tsx` (new)
- `src/pages/InterviewReportPage.tsx`
- `src/lib/backendApi.ts`
- `src/types/enterpriseReports.ts`
- `src/utils/exportDownload.ts`

Backend:

- `backend/src/modules/enterprise/routes.ts`
- `backend/src/modules/enterprise/report-filters.ts`
- `backend/src/modules/enterprise/student-reports.ts` (new)
- `backend/src/modules/enterprise/student-interview-routes.ts` (new)
- `backend/src/modules/enterprise/interview-report-pdf.ts` (new)
- `backend/src/modules/resume-pdf/routes.ts`
- `backend/src/utils/pdf-browser.ts` (new shared launcher)

Tests and dependencies:

- `backend/src/tests/test-student-interview-reports.ts` (new)
- `backend/src/tests/test-score-calculation-consistency.ts`
- `tests/e2e/enterprise-interview-reports.spec.ts` (new)
- `src/lib/backendApi.exports.test.ts`
- `src/pages/EnterpriseDashboardPage.offline.test.ts`
- `package.json`, `package-lock.json`, `backend/package.json`, `backend/package-lock.json`
- This document.

Validation completed: 181 frontend unit tests, 8 Chromium E2E tests, the new
PostgreSQL integration suite, 60 existing export/search checks, and 55 score
consistency checks. Frontend TypeScript, backend build, and Vite production build
passed. Actual Chromium PDFs (one and three pages) and desktop/mobile report/history
screenshots were visually inspected. Vite emits the existing `.env` NODE_ENV warning;
Prisma emits the existing package.json configuration deprecation warning. These do
not prevent the builds. No deployment was performed.
