# Architecture Guide

A structural layout mapping services and pipelines of the AI Placement Assistant.

---

## Technical Block Diagram

```
                 ┌────────────────────────────────┐
                 │       Scraper Providers        │
                 │ (Naukri, Foundit, Wellfound...)│
                 └───────────────┬────────────────┘
                                 │
                     (BaseScraper normalizations)
                                 │
                 ┌───────────────▼────────────────┐
                 │       Ingestion Pipeline       │
                 └───────────────┬────────────────┘
                                 │
                   (MatchingEngine evaluation)
                                 │
  ┌──────────────────────────────┼──────────────────────────────┐
  ▼                              ▼                              ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Supabase DB     │   │  Gmail Sync      │   │  Resume Matcher  │
│  (Pg Connection) │   │  (OAuth Scans)   │   │  (PDF / DOCX)    │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         ├──────────────────────┴──────────────────────┤
         │
┌────────▼─────────┐
│ Express Server   │
└────────┬─────────┘
         │
     (APIs routing)
         │
┌────────▼─────────┐
│ SPA Dashboard    │
│ (CSS / JS / HTML)│
└──────────────────┘
```

---

## Sub-Modules Mapping

### 1. Ingestion & Scrapers (`src/scrapers/` & `src/services/pipeline.js`)
- Exposes Crawler implementations verifying `robots.txt` compliance path selectors before requesting pages.
- Standardizes fields via normalizers (skills, salaries, deadlines, types).

### 2. AI Matching Engine (`src/services/matchingEngine.js`)
- Runs multi-criteria weighting to calculate similarity match ratings (0-100) based on targeted role skills.

### 3. Application Tracking System (`src/services/applicationService.js` / `calendarService.js`)
- Operates ATS stage transitions, records full transition logs audit lines, and schedules conflict-free calendar events.

### 4. Gmail Sync Engine (`src/services/gmailSyncService.js`)
- Fetches incoming mail threads matching keyword classifier rules, parsing recruiter details and auto-syncing Google Calendars.

### 5. Resume Intelligence (`src/services/resumeService.js`)
- Operates mammoth and pdf-parse extractions, stores version records history, and exposes suggestions list.

### 6. Notifications Queue (`src/services/notificationQueue.js`)
- Dequeues priorities alerts, filters duplicates, triggers retries with exponential backoffs, and targets Telegram bot integrations.
