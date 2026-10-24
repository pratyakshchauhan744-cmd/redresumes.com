# RedResumes Backend (Node.js + PostgreSQL)

Production-ready backend for a job platform with:

- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- Redis + BullMQ workers
- Meilisearch keyword/filtered search
- JWT access + refresh auth
- Docker Compose + Nginx reverse proxy

## 1) Quick start (Docker only)

1. Copy env:

```bash
cp .env.example .env
```

2. Start all services:

```bash
docker compose up --build -d
```

3. Check health:

```bash
curl http://localhost/health
```

4. Seed demo data (optional but recommended):

```bash
docker compose exec api npm run prisma:seed
```

## 2) Services included

- `api` -> Node API on internal port `4000`
- `worker` -> BullMQ workers (ingestion, dedupe, indexing, notifications)
- `postgres` -> PostgreSQL
- `redis` -> Redis
- `meilisearch` -> Search index engine
- `nginx` -> Public gateway on port `80`

## 3) API base URL

Use:

```bash
http://localhost
```

Endpoints are under `/api`.

## 4) Main endpoints

### Public

- `GET /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/companies/:id`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Candidate

- `POST /api/jobs/:id/apply`
- `POST /api/jobs/:id/save`
- `GET /api/users/me/applications`
- `GET /api/users/me/saved-jobs`

### Employer

- `POST /api/employer/jobs`
- `GET /api/employer/jobs`
- `GET /api/employer/applications`

### Admin

- `POST /api/ingestion/trigger`
- `GET /api/admin/stats`

## 5) Demo users after seed

Password for all: `Password@123`

- `candidate@example.com`
- `employer@example.com`
- `admin@example.com`

## 6) Minimal API flow example

```bash
# login as employer
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employer@example.com","password":"Password@123"}'
```

Copy `accessToken`, then:

```bash
curl -X POST http://localhost/api/employer/jobs \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Node.js Backend Engineer",
    "description":"Build backend APIs and queue workers for a job platform.",
    "companyId":"demo-company-id",
    "city":"Bengaluru",
    "state":"Karnataka",
    "country":"India",
    "remoteType":"hybrid",
    "employmentType":"full_time",
    "experienceLevel":"mid",
    "salaryMin":1200000,
    "salaryMax":2400000,
    "currency":"INR"
  }'
```

## 7) Postman files

Import these into Postman:

- `backend/postman/RedResumes-Backend.postman_collection.json`
- `backend/postman/RedResumes-Local.postman_environment.json`

Then select the `RedResumes Local` environment and run requests.

## 8) QA checklist

For a step-by-step Postman validation flow (happy path + negative tests), see:

- `backend/QA.md`

## 9) Local dev without Docker (optional)

If needed:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

In another terminal:

```bash
npm run worker
```

## Notes

### Production student interview history returns "Route not found"

The frontend calls `GET /api/enterprise/students/:studentId/interviews`.
This endpoint and the individual report/PDF/ZIP endpoints are implemented in
`src/modules/enterprise/student-interview-routes.ts` and mounted by the enterprise
router. A response containing `"Route not found"` is the API's unmatched-route
handler; it is different from a student having no interviews or being outside
the faculty's reporting scope.

Deploy the backend from the same commit as the frontend. Deploying only the
frontend does not update the Railway API. For the backend service, use `backend`
as the project directory and the build/start commands in `railway.toml`.
`npm run build` now clears old compiled output and verifies that the compiled
enterprise router includes all four interview reporting endpoints before the
build can succeed. The production entry point is `dist/src/main.js`.

After deploying, check `/health`: its `revision` should match the deployed commit
when Railway supplies `RAILWAY_GIT_COMMIT_SHA`. A response without the `revision`
field is from an older backend. Then sign in as faculty and open a student's
interview history. An unauthenticated request returning 401 alone does not prove
the route exists, because authentication runs for every enterprise URL.

No database reseed is needed for a missing route. The browser's `[WebVitals]`
messages are performance measurements and are unrelated to this 404.

- Dedupe hash strategy: `sha256(title + company + city + description)`
- Ingestion adapters included for Adzuna + Jooble (keys required in `.env`)
- Resume upload is represented by `resumeUrl` in apply API; S3 integration hooks are prepared via env vars.
- Frontend endpoint mapping is documented in `docs/frontend-api-integration.md`
