# API Reference Catalog

A listing of REST controller endpoints registered in the Express Router (`src/routes/index.js`).

---

## 1. Jobs endpoints
- `GET /api/jobs`: Fetch all ingested jobs catalog.
- `GET /api/jobs/recommended`: Fetch jobs matching preferences scoring high.
- `POST /api/jobs/recalculate-matches`: Trigger matching calculations for all records.

---

## 2. Applications (ATS) endpoints
- `GET /api/applications`: List all tracking application cards.
- `POST /api/applications`: Start tracking application for a job ID.
- `PUT /api/applications/:id/status`: Transition stage status (updates recruiter details, interview schedules, meeting URLs, and deadlines).
- `GET /api/applications/:id/timeline`: Chronological audit logs history.

---

## 3. Resume Intelligence endpoints
- `GET /api/resumes`: List registered resumes.
- `POST /api/resumes`: Upload base64 resume and run text parsing extractors.
- `GET /api/resumes/:id/versions`: List versions logs.
- `POST /api/resumes/:id/rollback`: Rollback profile metadata to target version.
- `GET /api/jobs/:jobId/resume-recommendation`: Recommend best resume match details and optimizer checklists.

---

## 4. Google OAuth & Gmail Sync endpoints
- `GET /api/google/auth-url`: Retrieve Google Client OAuth URL.
- `GET /api/google/callback`: Handle Google authorization callback redirects.
- `POST /api/google/sync`: Manually trigger inbox Gmail scan classifications and calendar syncs.

---

## 5. System Config & Settings
- `GET /api/profile` / `PUT /api/profile`: Get/Update user preference configurations.
- `PUT /api/settings`: Save notification thresholds and sync options.
- `GET /api/analytics`: Retrieve aggregated dashboard statistics charts parameters.
- `GET /api/calendar/events`: Retrieve list of scheduled interview slots.
- `GET /api/calendar/reminders`: Retrieve list of reminder alarms.
