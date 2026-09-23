# RedResumes Enterprise Multi-Tenant SaaS Platform

Comprehensive technical documentation, architecture specification, security controls, and operational guide for the RedResumes Enterprise Multi-College SaaS Platform.

---

## 1. Executive Overview

RedResumes Enterprise extends the core RedResumes AI candidate interview and resume platform into an institutional, multi-tenant SaaS solution designed for colleges, universities, and technical institutes.

The platform enables academic institutions to:
1. **Onboard Cohorts at Scale**: Ingest hundreds to thousands of students via streamlined Excel/CSV bulk import with automated account creation, credential generation, and welcome email delivery.
2. **Manage Faculty & Evaluators**: Empower Main Faculty administrators to invite departmental colleagues, assign granular permissions, and toggle access with immediate credential revocation.
3. **Control Mock Interview Credits**: Super Admins allocate institution-level credit pools. Main Faculty distribute credits to student cohorts with real-time balance calculations, batch filtering, and atomic ledger auditing.
4. **Analyze Cohort Performance**: Inspect student interview evaluations across programs, branches, semesters, sections, and batches, with formula-injection-safe CSV and Excel (`.xlsx`) exports.
5. **Maintain Immutable Audit Trails**: Track all high-impact actions (student additions, imports, credit changes, faculty invitations, permission edits, report exports) in a college-isolated audit log.

---

## 2. Multi-Tenant Architecture & Security Design

### 2.1 Zero-Trust Tenant Derivation
In multi-tenant SaaS environments, parameter tampering (such as altering `collegeId` in query strings or JSON payloads) is a primary attack vector. RedResumes eliminates this risk through **server-side tenant context derivation**:

- **No Client Overrides**: Endpoints under `/api/enterprise/*` never trust `collegeId` from `req.body`, `req.query`, or headers.
- **JWT Context**: Upon authentication, the server verifies the JWT signature and extracts the authenticated `user.collegeId` and `user.role`.
- **Enforced Tenant Binding**: All Prisma queries automatically inject `where: { collegeId: req.collegeId }`.

```
Client Request
      │
      ▼
[verifyJwt Middleware] ──► Validates cryptographic signature & extracts userId, role, collegeId
      │
      ▼
[requireEnterpriseFaculty] ──► Verifies user has 'college_main_faculty' or 'college_faculty' role
      │
      ▼
Controller / DB Query ──► db.studentProfile.findMany({ where: { collegeId: req.collegeId } })
```

### 2.2 Anti-IDOR (Insecure Direct Object Reference) Protection
- **Cross-Tenant Isolation**: Querying a resource by ID (e.g. `/api/enterprise/students/:id`) automatically includes `collegeId: req.collegeId`. If a faculty member from College A queries a student ID belonging to College B, the database returns `null`, resulting in a safe `404 Not Found`.
- **Student-to-Student Isolation**: Students can only view their own interview sessions and evaluations (`session.userId === req.user.id`). Any attempt by Student A to view Student B's data is rejected with `403 Forbidden`.
- **Enterprise Endpoint Guard**: Student or candidate tokens attempting to invoke `/api/enterprise/*` endpoints receive an immediate `403 Forbidden` from router-level middleware before controller execution.

### 2.3 Spreadsheet Formula Injection (CSV/Excel) Sanitization
When exporting student reports to CSV or Excel, malicious inputs (e.g. student names or enrollment numbers starting with `=`, `+`, `-`, `@`, `\t`, or `\r`) could trigger arbitrary command execution or DDE exploits in Microsoft Excel or Google Sheets.

RedResumes implements cell-level formula sanitization via `sanitizeSpreadsheetCell()`:
- Cells beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with a single quote (`'`), rendering them benign string literals in spreadsheet engines without data loss.

---

## 3. Role & Permission Hierarchy

| Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **`super_admin`** | Platform-Wide | Create & onboard colleges, assign institutional interview credits, monitor global audit logs, manage Super Admin accounts. |
| **`college_main_faculty`** | College Tenant | Full administrative control of college tenant: invite/edit/deactivate faculty, bulk import students via Excel, execute cohort credit distributions, view & export student reports, view audit logs. |
| **`college_faculty`** | College Tenant (Scoped) | Subordinate faculty: view assigned students and reports, evaluate student performance, access features based on granular permissions granted by Main Faculty. |
| **`student`** | Individual User | Practice AI mock interviews, review own performance reports, manage resume. Blocked from enterprise management and Super Admin routes. |

### Granular Faculty Permissions
Main Faculty can assign the following fine-grained permissions to subordinate faculty:
- `manageStudents`: Add, view, and edit student records.
- `distributeCredits`: Allocate interview credits to individual students or cohorts.
- `viewAnalytics`: View college-wide reporting dashboard and performance summaries.
- `exportReports`: Export student evaluation datasets to CSV/Excel.
- `manageFaculty`: Invite and manage other faculty members (Main Faculty only by default).

---

## 4. Bulk Student Import Engine (Excel & CSV)

The bulk import engine in `studentImportService.ts` supports `.xlsx`, `.xls`, and `.csv` files up to 15 MB and handles cohorts of 500+ students with chunked batch processing (50 rows per batch).

### 4.1 Expected Columns & Header Aliasing
The import parser accepts flexible header formats, automatically normalizing variations:

| Standard Field | Accepted Header Aliases | Required |
| :--- | :--- | :--- |
| **Full Name** | `name`, `full name`, `student_name`, `candidate name` | **Yes** |
| **Student Email** | `email`, `student email`, `email_id`, `institutional email` | **Yes** |
| **Enrollment Number** | `enrollmentNumber`, `roll no`, `roll number`, `registration_no`, `id_number` | **Yes** |
| **Degree Program** | `program`, `degree`, `stream`, `degree_program` | **Yes** |
| **Course / Branch** | `course`, `branch`, `department`, `specialization` | **Yes** |
| **Section** | `section`, `sec`, `division`, `class_section` | **Yes** |
| **Batch** | `batch`, `batch_year`, `graduation_year`, `passing_year` | **Yes** |
| **Contact Phone** | `phone`, `mobile`, `contact_number`, `phone_number` | Optional |
| **Initial Credits** | `credits`, `initial_credits`, `interview_credits` | Optional (default: 0) |
| **Semester** | `semester`, `sem`, `current_semester` | Optional (default: 1) |
| **Gender** | `gender`, `sex` | Optional |

### 4.2 Import Modes
- **Partial Import Mode (Default)**: Valid rows are created and committed. Invalid rows (e.g. malformed email or duplicate roll number) are skipped, and a detailed row-by-row error report is returned to the user.
- **Strict Rollback Mode (Atomic)**: If any row fails validation, the entire transaction is rolled back, ensuring 0 partial records are created.

### 4.3 Student Credential Generation & Delivery
Upon student record creation:
1. A cryptographically secure 15-character random temporary password is generated with guaranteed character complexity (uppercase, lowercase, digit, symbol).
2. The password is immediately hashed using `bcrypt` (10 rounds). Plaintext passwords are never stored in the database or written to disk.
3. An invitation token is recorded in the `invitations` table.
4. A welcome email is dispatched to the student's email with login instructions and the temporary credentials.
5. If SMTP delivery fails, the student record remains intact, the invitation is flagged as `failed`, and faculty can resend credentials with a freshly generated temporary password at any time via `POST /api/enterprise/students/:id/resend-invite`.

---

## 5. Interview Credit System & Ledger

The interview credit system operates on a dual-tier allocation model:

```
[Super Admin] ──(Allocates Credits)──► [College Credit Account]
                                                │
                                    (Distributes to Cohort)
                                                │
                                                ▼
                                    [Student User Credits]
```

### 5.1 Cohort Credit Distribution Workflow
1. **Pre-flight Quota Preview** (`POST /api/enterprise/credits/preview-distribution`):
   - Accepts cohort filters (`program`, `course`, `section`, `batch`) and `creditsPerStudent`.
   - Returns matched student count, required total credits, college available balance, and whether the college balance is sufficient.
2. **Confirmation & Execution** (`POST /api/enterprise/credits/distribute`):
   - Verifies college balance >= required credits.
   - Atomically deducts credits from `interview_credit_accounts`.
   - Increments `user.credits` for each student in the targeted cohort.
   - Appends an audit transaction record to `interview_credit_transactions` with `transactionType: "STUDENT_ASSIGNMENT"`.
   - Creates an enterprise audit log entry (`CREDITS_DISTRIBUTED`).

---

## 6. API Reference

All `/api/enterprise/*` routes require a `Bearer <token>` header with `college_main_faculty` or `college_faculty` role.

### 6.1 Faculty Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/enterprise/faculty` | List faculty members in the college tenant (supports pagination, search, department filter). |
| `POST` | `/api/enterprise/faculty` | Invite new subordinate faculty member; auto-binds to caller's `collegeId`. |
| `PATCH` | `/api/enterprise/faculty/:id` | Update faculty details, department, designation, permissions, or toggle active status. |
| `DELETE` | `/api/enterprise/faculty/:id` | Soft-deactivate faculty member and invalidate their user session. |

### 6.2 Student Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/enterprise/students` | List enrolled students with cohort filters (`program`, `course`, `section`, `batch`, `search`). |
| `POST` | `/api/enterprise/students` | Enroll single student manually; creates account & sends welcome email. |
| `POST` | `/api/enterprise/students/bulk-import` | Upload Excel/CSV spreadsheet for bulk student ingestion. |
| `POST` | `/api/enterprise/students/:id/resend-invite` | Regenerate credentials and resend invitation email to student. |

### 6.3 Credit Allocation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/enterprise/credits/ledger` | Fetch college credit transaction history and current balance. |
| `POST` | `/api/enterprise/credits/preview-distribution` | Pre-flight check calculating required credits for a filtered cohort. |
| `POST` | `/api/enterprise/credits/distribute` | Execute bulk credit distribution to filtered cohort. |
| `POST` | `/api/enterprise/credits/assign-student` | Assign credits to an individual student. |

### 6.4 Reporting & Analytics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/enterprise/reports` | List interview evaluation records with cohort filters and pagination. |
| `GET` | `/api/enterprise/reports/summary` | Aggregate analytics: total interviews, average overall score, and score distribution bands. |
| `GET` | `/api/enterprise/reports/export` | Download formula-sanitized report dataset (`format=csv` or `format=xlsx`). |

### 6.5 Enterprise Audit Logs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/enterprise/audit-logs` | Fetch immutable audit trail for the college tenant (supports action and actor search). |

---

## 7. Verification & Test Suites

The backend includes a comprehensive, multi-phase verification test suite verifying all enterprise features and tenant isolation guarantees without external database dependencies:

```bash
# Run all enterprise end-to-end tests (Phases 9 - 17)
npm run test:e2e

# Run bulk import engine unit tests (Phase 7)
npm run test:phase7

# Run student credential, password entropy & email resilience tests (Phases 8 & 9)
npm run test:phase8-9
```

### Test Suite Coverage
- **`npm run test:e2e`** (44 tests):
  - Mandatory Tenant Isolation: College A vs College B cross-tenant student directory, faculty list, credit ledger, and audit log isolation.
  - Anti-IDOR direct ID queries across tenant boundaries.
  - Student password login, JWT claims, and zero-trust blocking from enterprise and super admin endpoints.
  - Faculty management, permissions, and session-invalidating deactivation.
  - Formula injection mitigation across `= `, `+`, `-`, `@`, `\t`, `\r` prefixes.
  - Credit distribution quota calculations, insufficient balance protection, and atomic deductions.
  - College-scoped audit logging.
- **`npm run test:phase7`** (42 tests):
  - Header normalization across 20+ column name variations.
  - Excel binary workbook parsing (`.xlsx` and `.csv`).
  - Row validation, email regex verification, and in-file duplicate detection.
  - Atomic rollback vs partial import execution modes.
  - 500+ student cohort batch chunk slicing.
- **`npm run test:phase8-9`** (323 tests):
  - 100 unique random password samples tested for length (>= 12), character set complexity, and entropy.
  - Bcrypt hashing and plaintext exclusion verification.
  - SMTP delivery failure resilience and invitation status tracking.
  - Credential regeneration and old password invalidation upon resend.

---

## 8. Development & Setup

### Backend
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Frontend (`redresumes.com`)
```bash
cd redresumes.com
npm install
npm run dev
```

### Super Admin Portal (`admin-panel-redresumes`)
```bash
cd redresumeAdmin/admin-panel-redresumes
npm install
npm run dev
```
