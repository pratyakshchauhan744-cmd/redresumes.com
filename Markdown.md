# 🚀 Job Platform Backend Architecture (Node.js + PostgreSQL)

## 📌 Tech Stack

* **Backend:** Node.js (NestJS recommended)
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Cache & Queue:** Redis + BullMQ
* **Search Engine:** Meilisearch
* **Storage:** AWS S3 (or compatible)
* **Auth:** JWT (Access + Refresh tokens)
* **Deployment:** Docker + Nginx

---

## 📁 Project Structure

```
src/
  main.ts
  app.module.ts

  common/
  config/

  modules/
    auth/
    users/
    companies/
    jobs/
    applications/
    saved-jobs/
    job-sources/
    ingestion/
    search/
    notifications/
    admin/

  prisma/
    schema.prisma
```

---

## 🗄️ Database Schema (Core Tables)

### Users

* id
* name
* email
* password_hash
* role (candidate, employer, admin)
* created_at

### Companies

* id
* name
* website
* logo_url
* description
* location

### Jobs

* id
* title
* description
* company_id
* city
* state
* country
* remote_type
* employment_type
* experience_level
* salary_min
* salary_max
* currency
* source_type (api/direct)
* external_id
* apply_url
* posted_at
* dedupe_hash

### Applications

* id
* user_id
* job_id
* resume_url
* status
* applied_at

### Saved Jobs

* id
* user_id
* job_id

---

## 🔌 API Endpoints

### Public

```
GET /api/jobs
GET /api/jobs/:id
GET /api/companies/:id
```

### Auth

```
POST /api/auth/register
POST /api/auth/login
```

### Candidate

```
POST /api/jobs/:id/apply
POST /api/jobs/:id/save
GET /api/users/me/applications
```

### Employer

```
POST /api/employer/jobs
GET /api/employer/jobs
GET /api/employer/applications
```

---

## 🔍 Search System

Use **Meilisearch** for:

* Fast keyword search
* Filters
* Typo tolerance

### Search Filters

* keyword
* location
* salary
* remote type
* job type
* experience

---

## ⚙️ Background Jobs (BullMQ)

Queues:

* job-ingestion
* job-deduplication
* job-indexing
* notifications

---

## 🔄 Job Ingestion Flow

1. Fetch jobs from APIs (Adzuna, Jooble)
2. Normalize data
3. Generate dedupe hash
4. Store in PostgreSQL
5. Index in Meilisearch

---

## 🧠 Deduplication Strategy

```
hash = sha256(title + company + city + description)
```

If hash matches → same job

---

## 🔐 Authentication

* JWT Access Token (short-lived)
* Refresh Token (long-lived)
* Roles:

  * candidate
  * employer
  * admin

---

## 📦 Deployment Setup

Services:

* API server
* PostgreSQL
* Redis
* Worker (BullMQ)
* Meilisearch
* Nginx

---

## 🌍 Environment Variables

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
MEILI_HOST=
S3_BUCKET=
EMAIL_FROM=
```

---

## 🚀 MVP Roadmap

### Phase 1

* Auth system
* Job posting
* Job search
* Apply to job

### Phase 2

* API job ingestion
* Deduplication
* Search engine

### Phase 3

* Job alerts
* Analytics
* Admin panel

---

## 💡 Key Advice

* Do NOT rely only on job APIs
* Always allow **direct employer posting**
* Normalize all API data
* Store everything in your own DB
* Use search engine early

---

## 🏁 Final Stack Recommendation

* NestJS
* Prisma
* PostgreSQL
* Redis + BullMQ
* Meilisearch

---

## 📌 Next Steps

* Build Prisma schema
* Setup NestJS project
* Implement Jobs module
* Add search integration
* Add API ingestion

---

🔥 You now have a production-ready backend blueprint.
