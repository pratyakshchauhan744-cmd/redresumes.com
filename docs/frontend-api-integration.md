# Frontend API Integration Mapping

This maps your current frontend (`src/App.tsx`) to the new backend APIs.

## Base URL

- Local Docker: `http://localhost`
- API prefix: `/api`

Recommended frontend env var (Vite):

```bash
VITE_API_BASE_URL=http://localhost
```

## Current vs New Source

- Current job finder uses external APIs at [App.tsx](/Users/mac/Desktop/redresumes.com/src/App.tsx:2469) and [App.tsx](/Users/mac/Desktop/redresumes.com/src/App.tsx:2470)
- New source should be your backend: `GET /api/jobs`

## Endpoint Mapping

| Frontend feature | HTTP | Backend endpoint | Notes |
|---|---|---|---|
| Job search/list | GET | `/api/jobs` | Supports `keyword`, `location`, `remoteType`, `employmentType`, `experienceLevel`, `salaryMin`, `salaryMax`, `page`, `limit` |
| Job detail modal/page | GET | `/api/jobs/:id` | Use selected job ID |
| Company profile | GET | `/api/companies/:id` | Returns company + latest jobs |
| Register | POST | `/api/auth/register` | Body: `name,email,password,role` |
| Login | POST | `/api/auth/login` | Save `accessToken` + `refreshToken` |
| Refresh token | POST | `/api/auth/refresh` | Body: `refreshToken` |
| Logout | POST | `/api/auth/logout` | Body: `refreshToken` |
| Save job | POST | `/api/jobs/:id/save` | Candidate only, auth required |
| Apply job | POST | `/api/jobs/:id/apply` | Candidate only, body optional `resumeUrl` |
| My applications | GET | `/api/users/me/applications` | Candidate only |
| My saved jobs | GET | `/api/users/me/saved-jobs` | Candidate only |
| Employer create job | POST | `/api/employer/jobs` | Employer/admin only |
| Employer jobs list | GET | `/api/employer/jobs` | Employer/admin only |
| Employer applications | GET | `/api/employer/applications` | Employer/admin only |
| Admin ingestion trigger | POST | `/api/ingestion/trigger` | Admin only |
| Admin stats | GET | `/api/admin/stats` | Admin only |

## Auth Header

For protected routes:

```http
Authorization: Bearer <accessToken>
```

## Quick Migration Steps (Job Finder)

1. Replace external fetch calls in `searchJobs()` with `backendApi.listJobs(...)` from [backendApi.ts](/Users/mac/Desktop/redresumes.com/src/lib/backendApi.ts).
2. Map backend result items to UI shape via `mapBackendJobToUiJob(...)`.
3. Keep your curated fallback list as secondary fallback only.

## Example Query Mapping

Frontend filters -> API query params:

- `query` -> `keyword`
- `location` -> `location`
- `remoteOnly` -> `remoteType=remote`
- `level` -> `experienceLevel` (map your UI level values)

