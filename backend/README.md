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

- Dedupe hash strategy: `sha256(title + company + city + description)`
- Ingestion adapters included for Adzuna + Jooble (keys required in `.env`)
- Resume upload is represented by `resumeUrl` in apply API; S3 integration hooks are prepared via env vars.
- Frontend endpoint mapping is documented in `docs/frontend-api-integration.md`
