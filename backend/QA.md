# RedResumes Backend QA Checklist

This checklist verifies the core candidate API flow using Postman.

## Pre-check

1. Start backend stack (Docker or local).
2. Confirm health endpoint:
   - `GET http://localhost/health`
   - Expected: `200` and `{"status":"ok",...}`
3. In Postman, select environment: `RedResumes Local`
4. Ensure:
   - `baseUrl = http://localhost`

## One-time Postman automation setup

### 1) Login Candidate -> `Post-response` script

```javascript
const res = pm.response.json();
pm.environment.set("accessToken", (res.accessToken || "").trim());
pm.environment.set("refreshToken", (res.refreshToken || "").trim());
pm.test("Login 200", () => pm.response.to.have.status(200));
```

### 2) List Jobs -> `Post-response` script

```javascript
const res = pm.response.json();
if (res.items && res.items.length > 0) {
  pm.environment.set("jobId", String(res.items[0].id).trim());
}
pm.test("List Jobs 200", () => pm.response.to.have.status(200));
```

### 3) Collection Authorization

- Collection -> `Authorization` -> `Bearer Token`
- Token value: `{{accessToken}}`
- Remove/disable manual `Authorization` headers from child requests.

## Happy path run order

1. `POST /api/auth/login` (Login Candidate)
   - Body:
   ```json
   {
     "email": "candidate@example.com",
     "password": "Password@123"
   }
   ```
   - Expected: `200`, returns `accessToken`, `refreshToken`

2. `GET /api/jobs?page=1&limit=1` (List Jobs)
   - Expected: `200`, at least one item
   - `jobId` auto-saved in environment

3. `POST /api/jobs/{{jobId}}/apply` (Apply to Job)
   - Body:
   ```json
   {
     "resumeUrl": "https://example.com/resume.pdf"
   }
   ```
   - Expected: `201`
   - Response contains `"status": "submitted"`

4. `GET /api/users/me/applications` (My Applications)
   - Expected: `200`
   - Response contains application with matching `jobId`

## Negative tests

1. Invalid token:
   - Clear token or send bad token
   - Protected endpoints expected: `401`

2. Invalid jobId:
   - Set `jobId` to fake value
   - Apply expected: `404` (`Job not found`)

3. Missing login:
   - Call apply without token
   - Expected: `401`

## Pass criteria

- All 4 happy path requests return expected status codes.
- Application appears in `My Applications`.
- Negative tests return expected errors (`401`/`404`).
