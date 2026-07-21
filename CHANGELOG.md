# Changelog

All notable changes to the AI Placement Assistant project will be documented in this file.

## [1.6.0] - 2026-07-19
### Added
- **Dashboard & Analytics (Phase 9)**:
  - Configured static folder middleware serving `public` directory assets.
  - Implemented `/api/calendar/events` and `/api/calendar/reminders` endpoint lists controllers.
  - Extended `/api/analytics` endpoint compiling jobs/applications daily lists, resume usages, and AI score ranges.
  - Created responsive frontend Single Page Application (SPA) dashboard containing layout sidebar tabs routing.
  - Built HTML5 drag-and-drop Kanban Board columns syncing state changes directly to the database.
  - Integrated 6 dynamic Chart.js canvases plotting ingestion trends, platform distribution, company engagement, resume counts, match scores, and funnels.
  - Coded client file exporters downloading metadata arrays to JSON, CSV, or printing to PDF.
  - Added test suite in `tests/dashboard.test.js` validating static assets serving, calendar routes, analytics compiles, landmarks accessibility compliance, and performance budgets.

## [1.5.0] - 2026-07-19
### Added
- **Gmail Intelligence and Google Calendar Sync Engine (Phase 8)**:
  - Database schema columns `google_event_id` in `calendar_events` and tables `google_credentials`, `google_sync_state`, and `processed_emails`.
  - Implemented `googleOAuthService` for OAuth2 client generation, token code exchanges, credentials storage, and automated token refreshes.
  - Developed `emailClassifier` utilizing keyword scoring rules to map categorizations (Confirmation, Assessment, Interview, HR, Offer, Rejection) with confidence ratings.
  - Coded `gmailParser` parsing recruiter contacts (emails, names, phone numbers), dates/times, and interview meeting URLs.
  - Implemented `googleCalendarService` syncing local event changes to Google Calendar (CRUD operations) and checking +/- 30-minute buffers.
  - Created `gmailSyncService` coordinating history token sweeps, auto-creation of application cards, status transitions, scheduling calendar events, and pushing Telegram notification reminders.
  - Registered controller routes `/api/google/auth-url`, `/api/google/callback`, and `/api/google/sync`.
  - Added comprehensive test suites in `tests/googleSync.test.js` verifying classification, parsed details, and full workflow integrations.

## [1.4.0] - 2026-07-19
### Added
- **Resume Intelligence Engine (Phase 7)**:
  - Database schema tables `resumes`, `resume_versions`, and `resume_scores`.
  - Programmed text extraction from real PDF and DOCX documents using `pdf-parse` and `mammoth`.
  - Added skill segment classifiers, experience parsing logic, target role heuristics, and keyword indices.
  - Built `ResumeMatcher` calculating skill, keyword, role, experience, and tech scores.
  - Setup `ResumeOptimizer` compiling keyword density analysis (missing, repeated, strong, and weak keywords) and recommendations checklists.
  - Implemented `ResumeService` coordinating base64 uploads, version rollback records, and caching recommendations.
  - Registered controller endpoints `POST /api/resumes`, `POST /api/resumes/:id/rollback`, `GET /api/resumes`, `GET /api/resumes/:id/versions`, and `GET /api/jobs/:jobId/resume-recommendation`.
  - Added full test suite in `tests/resume.test.js` validating text parsers, matching formulas, and version rollbacks.

## [1.3.0] - 2026-07-19
### Added
- **Application Tracking System (Phase 6)**:
  - Database schema tables `application_history`, `calendar_events`, `reminders`, and `reports`.
  - Added contact, meeting link, and scheduler dates columns on `applications` table.
  - Implemented `ApplicationService` managing pipeline lifecycle changes.
  - Setup `HistoryService` and `TimelineService` compiling tracking chronological audits.
  - Built `CalendarService` detecting calendar overlaps (+/- 30 mins) and registering schedule dates.
  - Created `ReminderService` scheduling future reminders at offsets (7d, 3d, 1d, 6h, 2h, 30m).
  - Built `AnalyticsService` compiling company, platforms, average scores, and rates.
  - Built `ReportService` generating daily, weekly, or monthly report logs.
  - Registered controller endpoints `POST /api/applications`, `PUT /api/applications/:id/status`, `GET /api/applications/:id/timeline`, `GET /api/analytics`, and `GET /api/reports`.
  - Integrated reminder-processing and report-compilation cron jobs.
  - Added full unit and integration tests in `tests/ats.test.js`.

## [1.2.0] - 2026-07-19
### Added
- **Smart Notification Engine (Phase 5)**:
  - Database schema migrations for settings alterations, `notifications` history logs, and `notification_queue` tasks tracking.
  - Persistent queue manager (`src/services/notificationQueue.js`) with priority sorting, exponential backoffs, and dead letter queue (DLQ) support.
  - Rules evaluator (`src/services/notificationService.js`) filtering duplicates, expired, or low-scoring matches.
  - Telegram formatting template dispatches with inline keyboards (Apply, View Match, Ignore, Save Later).
  - Dynamic button click callback listeners (`src/telegram/handlers/botCallbacks.js`).
  - Bot commands: `/notifications`, `/settings`, `/threshold`, `/today`, and `/recommended`.
  - Background cron triggers executing dispatcher sweeps every 5 minutes.
  - API endpoints: `GET /api/notifications`, `GET /api/notifications/history`, `PUT /api/settings`.
  - Comprehensive unit, integration, and queue stress tests in `tests/notification.test.js`.

## [1.1.0] - 2026-07-19
### Added
- **AI Matching Engine (Phase 4)**:
  - Configurable JSON profile `src/database/profile.json`.
  - Skill and keyword standardizers (`src/services/skillExtractor.js` and `src/services/keywordExtractor.js`).
  - Weighted matching scoring engine (`src/services/matchingEngine.js` and `src/services/recommendationEngine.js`).
  - Ingestion pipeline scoring triggers in `pipeline.js`.
  - recommended, high-score, and match report API endpoints.
  - Matching test suite in `tests/matching.test.js`.

## [1.0.0] - 2026-07-18
### Added
- **Foundations, Ingestion & Scrapers (Phases 1-3)**:
  - Database pool connection with Pg client pooling.
  - Compliance validations checking path rules against `robots.txt`.
  - Scraper extractors for Unstop, Internshala, Wellfound, Foundit, and Naukri.
  - ProviderManager monitoring consecutive failures and cool-down states.
  - Unit and integration tests for crawler engines.
