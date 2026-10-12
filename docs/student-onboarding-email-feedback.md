# Student onboarding email feedback fix

## Root cause

The dashboard awaited `createStudent` but discarded its response, then unconditionally announced successful onboarding. The API already returns `success`, `student`, `invitationStatus` and `emailError` at the top level. Account creation commits before welcome email sending, so HTTP 201 with `invitationStatus: failed` represents a created account requiring invitation recovery. Resend also discarded its response. The list compounded the problem by labeling both `sent` and `delivered` as Delivered.

## Behavior

| Outcome | Feedback |
| --- | --- |
| Created + sent | Success: “Student account created. Invitation email accepted by the email service. Inbox delivery is not confirmed.” |
| Created + delivered | Success: “Student account created. Invitation email delivery confirmed.” |
| Created + failed / delivery_failed | Warning with a controlled explanation and “Use Resend Invitation from the student list; do not create the account again.” |
| Created + pending | Information: “Student account created. Invitation email is pending. Check its status in the student list.” |
| Created + accepted | Success: invitation accepted, without claiming inbox delivery. |
| Created + expired / revoked | Warning with explicit expired/revoked status and recovery guidance. |
| Missing/unrecognized invitation status | Information: status unavailable, check before resending. |
| Rejected creation | Error with a safe explanation. |
| Transport error, timeout, invalid response or server error | Warning that the account may have been created; check the list before retrying. No automatic account-creation retry. |

Confirmed creation resets/closes the form and refreshes students and initial dashboard data even when email sending fails. An unconfirmed request leaves the form open and refreshes the list for investigation. Its inline feedback uses warning styling rather than presenting uncertain creation as a definite failure.

Resend reuses the existing protected password-setup endpoint and request lock. It interprets response status instead of always reporting success, refreshes invitation status, and never recreates the account. A failed or uncertain resend closes its confirmation dialog so the feedback remains visible; a user can manually retry through the existing control. Backend metadata `deliveryStatus` continues to supply the current email status while the invitation token itself can remain pending for acceptance.

The list labels sent provider acceptance as Sent, reserves Delivered for an explicit delivered status, and displays other supported states without defaulting missing records to sent/pending.

## Types and security

Typed creation/resend interfaces replace the untyped creation response. The shared feedback helper explicitly handles each supported invitation status and default/unknown results. `ApiRequestError` carries HTTP status so a known 4xx rejection can be distinguished from an ambiguous network/server response; it preserves existing error messages for other consumers.

Public email errors are controlled recipient, rate-limit or availability explanations. Raw provider strings, stacks, SMTP credentials, API keys and invitation secrets are not rendered. New and historical student invitation errors are sanitized in API projections; single and imported student errors are sanitized before persistence. Provider failure logs identify the send stage without echoing the provider's raw response. Post-send bookkeeping errors also no longer expose raw messages in import results or logs. Authorization, accounting, student creation contracts and existing audits remain intact. No schema migration or new dependency is required.

## Modified files

- `src/types/studentOnboarding.ts:1`: typed creation and resend response interfaces.
- `src/utils/studentOnboarding.ts:9`: safe error explanations; `17`: status feedback; `35`: uncertain creation outcomes; `49`: confirmed-creation lifecycle.
- `src/lib/backendApi.ts:43`: HTTP/transport error classification; `853` and `915`: typed API calls.
- `src/pages/EnterpriseDashboardPage.tsx:1065`: response-aware creation; `1143`: response-aware resend; `1535`: informational notification style; `1938`: safe invitation tooltip/status labels; `3130`: inline uncertain-outcome warning.
- `backend/src/utils/student-email-error.ts:1`: public error redaction.
- `backend/src/modules/enterprise/routes.ts:1241`: safe list status/errors (also detail projections); `1613`: single welcome failure handling; `2237`: import failure messages; `2510`: safe resend failure metadata.
- `backend/src/services/email.service.ts:58`: provider failure logging redaction, also Resend/SMTP/welcome exception paths.
- `src/utils/studentOnboarding.test.ts:1`: notification, lifecycle, duplicate-click and security tests.
- `src/lib/backendApi.studentOnboarding.test.ts:1`: actual response/API-error integration tests.
- `backend/src/tests/test-student-onboarding-email-feedback.ts:1`: real HTTP/PostgreSQL creation, visibility and resend regression tests.
- `backend/src/tests/test-student-email-error.ts:1`: backend error-redaction unit checks.
- `backend/package.json`: onboarding email integration test command.
- `docs/student-onboarding-email-feedback.md`: this report.

Existing unrelated workspace changes were preserved.

## Test results

Passed:

- 66 frontend tests across six files: 31 onboarding feedback/lifecycle/security checks, 3 API response/error integration checks and existing API, refresh, permission and request-lock regressions.
- Backend public email error redaction/unit checks.
- Isolated PostgreSQL integration: provider acceptance; returned and thrown email failures preserve students; newly created students are visible with failed status; failed resend returns 502; successful resend persists sent status without recreating accounts; same-tenant unauthorized creation/resend returns 403 even with forged JWT permission flags.
- Existing onboarding initial-credit authorization suite, all groups.
- Existing credit accounting suite, 9 scenarios.
- Existing strict/partial import atomicity suite, 5 scenarios.
- Frontend and backend TypeScript checks and git whitespace checks.

No tests executed for this fix remain failed. Production provider delivery, browser end-to-end interaction and deployment were not run. The separate refresh-session invalidation regression noted in the preceding authorization report was not rerun or changed here. Tests use real database transactions and HTTP routes with mocked mail providers; they do not establish actual inbox delivery. Existing no-provider development simulation behavior is preserved.
