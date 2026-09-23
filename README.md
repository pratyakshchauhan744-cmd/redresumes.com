<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bb66a99b-c93b-41e8-af15-0ce23865e40a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Quick Start: Enterprise SaaS Platform

### 1. Run the Database Seed (Populate Demo Colleges, Faculty & Cohorts)
```bash
cd backend
npm install
npm run seed      # Seeds Super Admin, Apex Institute, Stanford, Student Cohorts & Reports
npm run dev       # Starts Backend API on http://localhost:4000
```

### 2. Start the Frontend Platform
```bash
cd redresumes.com
npm install
npm run dev       # Starts Client App on http://localhost:5173
```

### 3. Start the Super Admin Portal
```bash
cd redresumeAdmin/admin-panel-redresumes
npm install
npm run dev       # Starts Super Admin Portal on http://localhost:3001
```

---

## Seeded Demo Accounts (Password: `Password@123`)

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@redresumes.com` | `Password@123` | Platform Administration |
| **Apex Main Faculty** | `faculty@apex.edu` | `Password@123` | Apex Institute of Technology |
| **Apex Evaluator** | `evaluator@apex.edu` | `Password@123` | Apex Institute of Technology |
| **Apex Student** | `student@apex.edu` | `Password@123` | Apex Institute of Technology |
| **Stanford Faculty** | `dean@stanford.edu` | `Password@123` | Stanford Engineering Institute |

---

## Complete Documentation & Testing Guide

For the full architecture breakdown, tenant security isolation models, Super Admin college onboarding with custom password, dedicated enterprise login flow, isolated campus dashboard, and step-by-step testing workflows, see **[ENTERPRISE_README.md](file:///d:/myProjects/redResumes/redresumes.com/ENTERPRISE_README.md)**.

