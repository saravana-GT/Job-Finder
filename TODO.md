# Project Roadmap & Remaining Features

This file outlines the tasks, features, and integrations remaining for the subsequent phases of the AI Placement Assistant.

## Phase 5: Notification Dispatcher & Alerts (Completed)
- [x] **Scraper Alerts**:
  - [x] Connect the job ingestion pipeline results to the notification service.
  - [x] Trigger daily or instant alerts to `TELEGRAM_BOT_TOKEN` for newly ingested jobs with `ai_score` >= 70.
- [x] **Reminder Alerts**:
  - [x] Alert user on upcoming application deadlines and interview calendars.

## Phase 6: Application Tracking System & Calendar (Completed)
- [x] **ATS Stages Manager**:
  - [x] Created `ApplicationService`, `HistoryService`, and `TimelineService` to manage status changes and transitions.
  - [x] Integrated automated history recording and chronological timeline fetching.
- [x] **Internal Calendar & Reminders**:
  - [x] Built internal calendar event manager with conflict checks.
  - [x] Implemented `ReminderService` scheduling alarms at lead time offsets (7d, 3d, 1d, 6h, 2h, 30m) and dispatching them via Telegram.
- [x] **Reports & Analytics**:
  - [x] Setup `AnalyticsService` and `ReportService` summarizing rates, average AI scores, and company/platform metrics daily, weekly, or monthly.

## Phase 7: Resume Intelligence Engine (Completed)
- [x] **Text Extractors & Parsers**:
  - [x] Programmed `PDFParse` and `mammoth` document extractions.
  - [x] Integrated `SkillExtractor` class classifiers and keywords token mappings.
- [x] **Match Score Comparer**:
  - [x] Developed `ResumeMatcher` measuring skill, tech, role, keyword, and experience duration similarities.
  - [x] Created `ResumeOptimizer` doing keyword analysis and suggestion checklists.
- [x] **Versioning & rollbacks**:
  - [x] Setup service and REST controllers for resume profiles creation, rollback transitions, and job recommendation requests.

## Phase 8: Google API OAuth & Gmail parsing (Completed)
- [x] **Google API Setup**:
  - [x] Configure OAuth 2.0 flow for Google API access.
- [x] **Google Calendar Sync**:
  - [x] Sync internal calendar events to user's real Google Calendar.
- [x] **Gmail Parser**:
  - [x] Scan inbox for interview confirmation templates and call `autoUpdateJobStatus` automatically.

## Phase 9: Kanban Dashboard Frontend (Completed)
- [x] **Sleek Kanban Board**:
  - [x] Build an HTML5/CSS/JS responsive UI to track application columns (Applied, Interview, Offer, Rejected).
- [x] **Log Monitoring**:
  - [x] Track pipeline runs, provider health statuses, and sync statistics.
- [x] **Developer Settings Manager**:
  - [x] GUI forms to edit the user profile (`profile.json`) and configure crawling priorities.

## Phase 10: Multi-User Tenant Support & Deployments
- [ ] **Multi-Tenant Credentials**:
  - [ ] Support secure multi-user logins and session cookies storage.
- [ ] **Deployment scripts**:
  - [ ] Docker configuration scripts for production deployment.
