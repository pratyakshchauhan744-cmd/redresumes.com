# Authenticated export downloads

## Root cause

`downloadReports` used a standalone fetch with the caller's access token. It bypassed the standard cookie credentials, coordinated refresh, stale-token replacement, one-retry limit, session-expiration handling and HTTP error parsing. It also ignored the filename returned by the server.

## Implementation

The existing request transport now returns an authenticated `Response`; the JSON wrapper parses that response as before. Export downloads call the same transport, then consume the successful response as a Blob. There is one authentication implementation for both response types.

Requests include `credentials: include`, resolve the current stored/replacement token, and use the existing cookie refresh mechanism when needed. A 401 refreshes and retries once with the same path, query, options, method and body. Concurrent JSON/export requests share the existing refresh flight. Refresh rejection uses the existing token clearing and login redirect. A second 401 is handled like the standard JSON client without another refresh. 403, 404, 429, server and transport errors do not initiate authentication retries.

The download function signature and query/filter serialization are unchanged. Both existing dashboard export callers hold their loading indicators throughout renewal and use one synchronous request lock to prevent same-render duplicate CSV/Excel submissions. Permission decisions and institution scoping remain entirely in the existing backend export route. No report calculations, onboarding, credit accounting or database schema were changed.

## File compatibility and security

Current protected report downloads support CSV and XLSX. Their contents and MIME types remain Blob data and are never sent through JSON parsing. Invalid/missing content types, empty bodies, common HTML/JSON error bodies and non-ZIP XLSX responses are rejected before a download is initiated. These checks detect common invalid responses; they do not fully validate every workbook archive.

`Content-Disposition` supplies the filename, including UTF-8 `filename*`. Malformed extended names fall back to ordinary filename or the existing dated filename. Path components/control characters are removed, and an unexpected extension cannot turn the file into an executable download. The response Blob is preserved unchanged. Anchors and temporary object URLs are cleaned up in a finally block, including click failures.

The existing allowed-origin CORS configuration now exposes only `Content-Disposition` so the configured cross-origin API can supply filenames. Its origin allowlist and credentials policy are unchanged. Requests remain directed to the configured API origin; tokens are attached only through the shared authorization header and are never added to download URLs or logged. Existing refresh cookie/CSRF behavior is preserved.

## Files modified

- `src/lib/backendApi.ts:178`: shared authenticated Response transport; `299`: unchanged JSON parsing contract over that transport; `1089`: authenticated report download.
- `src/utils/exportDownload.ts:1`: filename parsing and safe fallback; Blob validation and browser download cleanup.
- `src/pages/EnterpriseDashboardPage.tsx:456`: synchronous shared export lock; `1317` and `1339`: locked CSV/Excel submission.
- `backend/src/app.ts:83`: expose Content-Disposition through existing CORS middleware.
- `src/lib/backendApi.exports.test.ts`: authentication and binary/browser download regression tests.
- `src/utils/exportDownload.test.ts`: filename safety and shared lock tests.
- `docs/export-authentication.md`: this report.

## Actual verification

Passed: 52 tests across six frontend test files:

- 18 export integration cases: valid/stored token, missing token/cookie renewal, expired token and one retry, stale token reuse, shared concurrent refresh with JSON, failed refresh/logout/redirect, second 401 limit, 403/404/429/500 errors, HTML/network failures, CSV/MIME/filename preservation, XLSX byte integrity/UTF-8 filename, invalid JSON/HTML/empty responses, invalid XLSX and cleanup after click failure.
- 8 filename/lock cases.
- Existing JSON API tests (13), refresh lifecycle tests (9), idempotency retry test (1) and typed onboarding API tests (3).

Frontend and backend TypeScript checks passed. Whitespace checks passed for the files changed by this fix. The repository-wide whitespace check reports pre-existing trailing whitespace in `backend/src/utils/score.ts`, which was left untouched as requested.

Not run: browser end-to-end download interaction, live production refresh/provider testing or deployment. No new tests remain failed. Real browser download behavior and deployed CORS header exposure should be included in deployment smoke testing. No migration or new dependency is required. Existing unrelated workspace changes were preserved.
