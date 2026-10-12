# RedResumes Enterprise Multi-Tenant SaaS Platform

Comprehensive technical documentation, architecture specification, security controls, seed instructions, and end-to-end testing guide.

---

## 1. Quick Start: Seeding Demo Data & Running Locally

### 1.1 Prerequisites
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** database (optional for local in-memory/demo verification)

### 1.2 Step 1: Start Backend API
```bash
cd backend
npm install
npm run seed     # Populates all demo colleges, faculty, student cohorts, reports, and audit logs
npm run dev      # Starts Express backend on http://localhost:4000
```

### 1.3 Step 2: Start Client Platform (`redresumes.com`)
```bash
cd redresumes.com
npm install
npm run dev      # Starts Vite React platform on http://localhost:5173
```

### 1.4 Step 3: Start Super Admin Portal (`admin-panel-redresumes`)
```bash
cd redresumeAdmin/admin-panel-redresumes
npm install
npm run dev      # Starts Next.js Super Admin portal on http://localhost:3001
```

---

## 2. Seeded Demo Accounts (Password: `Password@123`)

Running `npm run seed` in the backend provisions the following accounts:

| Portal | Email | Password | Role | Organization / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@redresumes.com` | `Password@123` | `admin` | Platform-Wide Super Admin |
| **Apex Main Faculty** | `faculty@apex.edu` | `Password@123` | `college_main_faculty` | Apex Institute of Technology |
| **Apex Evaluator** | `evaluator@apex.edu` | `Password@123` | `college_faculty` | Apex Institute of Technology |
| **Apex Student** | `student@apex.edu` | `Password@123` | `student` | Apex Institute of Technology |
| **Stanford Faculty** | `dean@stanford.edu` | `Password@123` | `college_main_faculty` | Stanford Engineering Institute |

> **Note:** The web frontend also includes built-in demo credentials for these accounts. You can test the full enterprise login and dashboard workflow immediately on `http://localhost:5173`, even in offline mode!

---

## 3. End-to-End Testing Walkthrough (Step-by-Step)

### Test Workflow 1: Super Admin Onboarding with Password & Email Dispatch
1. Open the Super Admin portal at `http://localhost:3001/login`.
2. Sign in with `admin@redresumes.com` and `Password@123`.
3. In the sidebar, navigate to **Colleges & Campuses** (`/admin/colleges`).
4. Click the **"+ Onboard College"** button.
5. In the onboarding modal, fill in:
   - **College Name**: e.g., `Massachusetts Institute of Technology`
   - **College Code**: e.g., `MIT`
   - **Domain**: e.g., `mit.edu`
   - **Initial Credits**: `250`
   - **Main Faculty Name**: e.g., `Dr. Robert Wilson`
   - **Official Email**: e.g., `faculty@mit.edu`
   - **Initial Login Password (Optional)**: Type a custom password (e.g., `CampusPass@2026`) or leave it empty to auto-generate a secure random password.
6. Click **"Complete Campus Onboarding"**.
7. **Verification**:
   - A success banner appears confirming onboarding.
   - An institutional welcome email is dispatched to the faculty email containing:
     - Institution Name & Code
     - Main Faculty Name
     - Official Login ID (Email)
     - Password (the password you set or the generated one)
     - Enterprise Login Link (`/login?portal=enterprise`)

---

### Test Workflow 2: Dedicated Enterprise Login Flow
1. Navigate to the main application at `http://localhost:5173`.
2. Locate the **"Enterprise"** button (with institutional building icon) situated **immediately before the "Create Resume" button** in the header.
3. Click **"Enterprise"**.
4. Observe:
   - You are navigated to `/login?portal=enterprise`.
   - The page displays **"Institutional Campus Access"** and **"Enterprise Faculty & Admin Login"**.
   - Consumer Google login and signup clutter are removed.
   - If you were previously logged in as a candidate, the Enterprise login form allows you to cleanly enter institutional credentials without being bounced to the student dashboard.
5. Enter:
   - **Email**: `faculty@apex.edu`
   - **Password**: `Password@123`
6. Click **"Sign in to Enterprise Dashboard"**.
7. **Verification**:
   - You are authenticated and navigated directly to `/enterprise`.

---

### Test Workflow 3: Isolated Enterprise Dashboard (Zero Student Clutter)
1. On `http://localhost:5173/enterprise`, inspect the page layout:
   - **Zero Student Elements**: The consumer student header (Templates, Resume Examples, Job Finder, Cover Letter, Create Resume) and consumer footer are **completely hidden**.
   - **Institutional Top Bar**: Displays:
     - Institution Brand & Name: **Apex Institute of Technology**
     - Role Badge: **Main Faculty Admin**
     - Code: `APEX` &bull; Domain: `apex.edu`
     - Live Balance Badge: `480 Credits`
     - Refresh Metrics button
     - Administrator Profile Chip: `Dr. Jane Smith (faculty@apex.edu)`
     - Native **"Sign Out"** button with `LogOut` icon.
2. Click **"Sign Out"** to verify it terminates the session and safely returns to `/login?portal=enterprise`. Log back in to continue testing.

---

### Test Workflow 4: Student Cohort Management & Excel Bulk Ingestion
1. On `/enterprise`, click the **"Students Directory"** tab.
2. Observe seeded student cohort (`aarav.sharma@apex.edu`, `diya.patel@apex.edu`, `rohan.gupta@apex.edu`, etc.).
3. Test filters: Select Program (`B.Tech`), Course (`Computer Science & Engineering`), Section (`A`), Batch (`2022-2026`).
4. Click **"Bulk Import Students"**:
   - A modal opens supporting `.xlsx`, `.xls`, and `.csv` files.
   - Click **"Download Template"** to download a pre-formatted Excel template.
   - Select between **Partial Import Mode** (commits valid rows, reports errors) and **Strict Rollback Mode** (aborts if any row fails).
5. Click **"Resend Invite"** on any student record to regenerate their credentials and dispatch a fresh welcome email.

---

### Test Workflow 5: Interview Credit Allocation & Cohort Distribution
1. Click the **"Interview Credits & Allocation"** tab.
2. View the institutional balance (`480 Credits`) and the historical credit ledger.
3. Under **Bulk Distribute Credits to Student Cohort**:
   - Set Credits per Student: `2`
   - Select Program: `B.Tech`
   - Select Course: `Computer Science & Engineering`
   - Select Section: `A`
4. Click **"Calculate Distribution Preview"**:
   - The pre-flight quota engine calculates matched students, total required credits, and checks balance sufficiency.
5. Click **"Confirm & Distribute Credits"**:
   - Credits are deducted from college balance and credited to each student's balance.
   - A transaction of type `STUDENT_ASSIGNMENT` is recorded in the ledger.

---

### Test Workflow 6: Cohort Performance Reports & Formula-Safe Export
1. Click the **"Cohort Reports & Analytics"** tab.
2. View the aggregate metrics card: total evaluated interviews, average overall score, and score distribution bands.
3. Inspect student interview rows (Overall Score, Target Role, Speaking Pace, Filler Words).
4. Click **"Full Report"** on any student row to view the detailed question-by-question AI evaluation.
5. Test Exports:
   - Click **"Export CSV"** &rarr; downloads sanitized CSV file.
   - Click **"Export Excel (.xlsx)"** &rarr; downloads formatted Excel spreadsheet.
   - **Formula Injection Defense**: All exported cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are safely escaped with a single quote (`'`), neutralizing spreadsheet execution vulnerabilities.

---

### Test Workflow 7: Institutional Audit Trail
1. Click the **"Audit Logs"** tab.
2. View the immutable audit trail displaying:
   - Timestamp
   - Action badge (`STUDENT_CREATED`, `STUDENTS_IMPORTED`, `CREDITS_ALLOCATED`, `CREDITS_DISTRIBUTED`, `FACULTY_INVITED`, `REPORTS_EXPORTED`)
   - Actor name, email, and role
   - Target entity and details payload
   - Client IP and device
3. Filter by Action Type or search by actor/details.

---

### Test Workflow 8: Multi-Tenant Zero-Trust Isolation (Apex vs Stanford)
1. Sign out of Apex (`faculty@apex.edu`).
2. On `/login?portal=enterprise`, sign in as Stanford Main Faculty:
   - **Email**: `dean@stanford.edu`
   - **Password**: `Password@123`
3. In the Stanford Enterprise Dashboard:
   - Verify College Name is **Stanford Engineering Institute** with Code `STANFORD` and balance `250 Credits`.
   - In Students Directory: Verify **only** Stanford students appear (`lucas.brown@stanford.edu`). **Zero** Apex students appear.
   - In Credit Ledger: Verify **only** Stanford transactions appear.
   - In Audit Logs: Verify **only** Stanford audit entries appear.

---

### Test Workflow 9: Student Access Guard & Anti-IDOR Isolation
1. Sign in as a student: `student@apex.edu` / `Password@123`.
2. Notice the student lands on `/dashboard` (Candidate Dashboard).
3. Try typing `http://localhost:5173/enterprise` in the browser address bar.
4. **Verification**:
   - The `EnterpriseRoute` guard detects the student role and immediately redirects to `/dashboard`.
   - Any API request to `/api/enterprise/*` receives `403 Forbidden`.

---

## 4. Automated Test Suites

Run the automated test suites in the `backend` directory:

```bash
cd backend

# Run complete Enterprise End-to-End verification suite (Phases 9 - 17)
npm run test:e2e

# Run bulk import engine unit tests (Phase 7)
npm run test:phase7

# Run student credential, password complexity & email resilience tests (Phases 8 & 9)
npm run test:phase8-9
```

### Test Suite Summary (409 Tests Total):
- **`npm run test:e2e`** (44 Tests):
  - Mandatory Tenant Isolation: College A vs College B cross-tenant student directory, faculty list, credit ledger, and audit log isolation.
  - Anti-IDOR direct ID queries across tenant boundaries.
  - Student password login, JWT claims, and zero-trust blocking from enterprise and super admin endpoints.
  - Faculty management, permissions, and session-invalidating deactivation.
  - Formula injection mitigation across `= `, `+`, `-`, `@`, `\t`, `\r` prefixes.
  - Credit distribution quota calculations, insufficient balance protection, and atomic deductions.
  - College-scoped audit logging.
- **`npm run test:phase7`** (42 Tests):
  - Header normalization across 20+ column name variations.
  - Excel binary workbook parsing (`.xlsx` and `.csv`).
  - Row validation, email regex verification, and in-file duplicate detection.
  - Atomic rollback vs partial import execution modes.
  - 500+ student cohort batch chunk slicing.
- **`npm run test:phase8-9`** (323 Tests):
  - 100 unique random password samples tested for length (>= 12), character set complexity, and entropy.
  - Bcrypt hashing and plaintext exclusion verification.
  - SMTP delivery failure resilience and invitation status tracking.
  - Credential regeneration and old password invalidation upon resend.

---

## 5. TypeScript Compilation Check

Run type checks to confirm 0 compilation errors across all projects:

```bash
# Frontend typecheck
cd redresumes.com && npx tsc --noEmit

# Backend typecheck
cd backend && npx tsc --noEmit

# Admin panel typecheck
cd redresumeAdmin/admin-panel-redresumes && npx tsc --noEmit
```
