# AI Placement Assistant

A production-grade, autonomous job application monitoring, scraping, resume optimizing, and alert dispatch platform designed to coordinate candidates' search efforts.

---

## Key Features

1. **Job Scraping**: Dynamic crawlers tracking Naukri, Internshala, Wellfound, Foundit, and Unstop Opportunity directories.
2. **AI Match Score**: Evaluates compatibility matrices (Skills 40%, Roles 20%, Location 10%, Experience 10%, Salary 10%, Type 10%) using candidate preference profiles.
3. **Application Tracking**: Pipeline phases (Discovered, Interested, Applied, Assessment, Interview, Offer, Rejected) matching state transition history logs.
4. **Google & Gmail Sync**: Incremental inbox scan triggers classifier mappings and synchronization of interview dates to calendar events.
5. **Resume Intelligence**: Multi-profile extraction (PDF/DOCX), keyword density analysis, version rollback support, and optimizations recommendations.
6. **Smart Alerts**: Multi-channel notification queue processing Telegram messaging alerts with inline buttons.
7. **Frontend Dashboard**: Glassmorphic SPA tracking kanban pipelines, platform layouts, trends charts, calendar month blocks, and file exports.

---

## Technical Details

- **Backend**: Node.js & Express.
- **Database**: PostgreSQL (Pg pool & Supabase).
- **Security**: Rate limits, Helmet CORS, parameterized queries, and 5MB resume upload limits.
- **Testing**: Built-in test runner with 54+ functional test cases.
- **Logs**: Daily rotated JSON entries with 30-day purge routines and security audits log lines.
- **Deployment**: Docker & docker-compose configurations.

---

## Structure Guide

- `src/`: Backend logic.
- `public/`: HTML/CSS/JS frontend files.
- `migrations/`: DB schema layouts.
- `tests/`: Automated test runner scripts.
- `scripts/`: Manual tasks backups/restores.
- `docs/`: In-depth developer manuals.
