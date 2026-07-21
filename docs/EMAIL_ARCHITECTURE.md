# Gmail Intelligence Engine Architecture

The Gmail Intelligence module synchronizes inbox messages incrementally, parses them for recruitment metadata, classifies the event category, and automatically transitions ATS application cards.

---

## Processing Workflow

```
                        ┌───────────────────┐
                        │     Gmail API     │
                        └─────────┬─────────┘
                                  │
                                  ▼ (Incremental Fetch)
                        ┌───────────────────┐
                        │ gmailSyncService  │
                        └─────────┬─────────┘
                                  │
                                  ├──────────────────────────────┐
                                  ▼ (Heuristics)                 ▼ (Regex Rules)
                        ┌───────────────────┐          ┌───────────────────┐
                        │  emailClassifier  │          │    gmailParser    │
                        ├───────────────────┤          ├───────────────────┤
                        │ - Category Match  │          │ - Dates & Times   │
                        │ - Weighted Score  │          │ - Meeting Links   │
                        │ - Unrelated check │          │ - Recruiter Info  │
                        └─────────┬─────────┘          └─────────┬─────────┘
                                  │                              │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                     ┌──────────────────────┐
                                     │  applicationService  │
                                     ├──────────────────────┤
                                     │ - Transition Status  │
                                     │ - History Audits     │
                                     └──────────────────────┘
```

### 1. Incremental Syncing (`src/services/gmailSyncService.js`)
- Authenticates using `googleOAuthService`.
- Resolves sync token state using `google_sync_state` containing `historyId`.
- Fetches incremental modifications starting from the last cached token. If missing or expired, executes a default fallback scan on the latest 20 messages.
- Skips already-processed messages by checking against the `processed_emails` registry.

### 2. Semantic Classification (`src/services/emailClassifier.js`)
- Runs rule weights against combined subject and body text.
- Standardizes categorizations:
  - `Job Application Confirmation`
  - `Online Assessment`
  - `Interview Invitation`
  - `HR Discussion`
  - `Offer Letter`
  - `Rejection`
  - `Shortlisting`
  - `Registration Confirmation`
- Marks emails scoring below a 40% confidence threshold as `Unrelated` to prevent false positive updates.

### 3. Metadata Extraction (`src/services/gmailParser.js`)
- **Recruiter Contact**: Parsed from headers `From: "Name" <email>` and body phone numbers.
- **Company Name Heuristic**: Checks the domain of the sender's email address (filtering out public domains like gmail.com). If it's public, falls back to common phrasing extractors (e.g. "at [Company]").
- **Scheduling Details**: Extracts date formats (e.g., `July 25, 2026` or `25/07/2026`) and times (e.g. `11:30 AM` or `15:00`) for interview and assessment events.

---

## Database Schema Integration

- **`google_credentials`**: Stores active access, refresh, and expiry tokens securely.
- **`google_sync_state`**: Stores token sequence details.
- **`processed_emails`**: Caches parsed logs and prevents duplicate syncing sweeps.
