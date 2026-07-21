# Google Calendar Sync Architecture

The Google Calendar Sync engine coordinates two-way synchronization of events, detects scheduling conflicts, resolves double-booking, and programs reminder alerts.

---

## Sync Engine Orchestration

```
            ┌──────────────────────┐
            │  applicationService  │
            └──────────┬───────────┘
                       │ (Status Transition)
                       ▼
            ┌──────────────────────┐
            │   calendarService    │
            └──────────┬───────────┘
                       │
                       ├────────────────────────┐
                       ▼ (Conflict check)       ▼ (Sync Event)
            ┌──────────────────────┐  ┌────────────────────────┐
            │   hasConflict check  │  │ googleCalendarService  │
            │  (+/- 30m buffers)   │  ├────────────────────────┤
            └──────────────────────┘  │ - getAuthClient        │
                                      │ - calendar.events      │
                                      │   (insert/update/del)  │
                                      └────────────────────────┘
```

### 1. Conflict Detection Heuristic
- Before registering any meeting on Google Calendar, the system runs local overlaps screening.
- **Buffer Enforcements**: Standardizes a `+/- 30-minute` buffer boundary around any planned events. If an event is scheduled at `14:00`, any secondary booking overlapping within `13:30` to `15:00` raises a conflict warning.

### 2. Google Synchronization (`src/services/googleCalendarService.js`)
- Authenticates sessions using `googleOAuthService`.
- Formats local event records (titles, descriptions, start/end dates, location meeting links) to Google Calendar Event Resource models.
- **Creation (`calendar.events.insert`)**: Invoked if `google_event_id` is missing. Stores the generated Google Event ID back in the local DB.
- **Updates (`calendar.events.update`)**: Invoked on rescheduling updates. Re-syncs times and description changes.
- **Deletions (`calendar.events.delete`)**: Triggers removal from Google Calendar if an event is cancelled or deleted.

### 3. Alarm Dispatch Engine (`src/services/reminderService.js`)
- Scrapes the database for upcoming events matching offsets:
  - `7 days` before
  - `3 days` before
  - `1 day` before
  - `6 hours` before
  - `2 hours` before
  - `30 minutes` before
- Pushes Telegram Alerts when events are due to start.
