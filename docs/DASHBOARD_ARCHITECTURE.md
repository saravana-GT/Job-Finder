# Dashboard & Analytics Architecture

The Dashboard module serves as the central user interface of the Placement Assistant, allowing real-time visualization of pipelines, drag-and-drop status changes, resume match evaluations, event scheduling, and analytics trends.

---

## Architecture Flow

```
                      ┌──────────────────────┐
                      │    Web Browser       │
                      │  (index.html/js/css) │
                      └──────────┬───────────┘
                                 │
                         (AJAX / REST Calls)
                                 │
                      ┌──────────▼───────────┐
                      │    Express Router    │
                      │   (routes/index.js)  │
                      └──────────┬───────────┘
                                 │
                       (Service Invocations)
                                 │
         ┌───────────────────────┼──────────────────────┐
         ▼                       ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ analyticsService │   │ calendarService  │   │  resumeService   │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

### 1. Frontend SPA Core
- **Layout & Sidebar (`public/index.html`)**: Built with responsive semantic HTML5 elements. Handles view switches using hash routing (`window.location.hash`).
- **Styles & Theme (`public/index.css`)**: Implements glassmorphism dark-mode aesthetics using modern web typography, CSS grid layouts, hover transition micro-animations, and custom print directives.
- **Client Controller (`public/index.js`)**: Executes data fetch routines, updates DOM node content, renders interactive calendar grids, parses file uploads, and coordinates data exports.

### 2. State & Data Integrations
- **Ingestions / Application Trends**: Plotted via Chart.js showing monthly changes for both job discoveries and application track cards.
- **Kanban Stages Board**: Drag-and-drop operations utilize standard HTML5 Drag and Drop events. Drags communicate application IDs and trigger `PUT /api/applications/:id/status` to synchronize local memory transitions with the backend database.
- **Google Integrations Status**: Checks configurations and binds redirect authorize links from `/api/google/auth-url`.

### 3. File Exports
- **JSON**: Bundles all state datasets (jobs, applications, settings, calendar, alert logs) into a download anchor.
- **CSV**: Assembles application tracker items matching row header criteria.
- **PDF**: Uses print media queries (`@media print`) hiding sidebar controllers and compiling tabular summaries for browser print.

---

## API Registrations

### Calendar List APIs
- `GET /api/calendar/events`: Returns all scheduled interview sessions.
- `GET /api/calendar/reminders`: Returns reminder alarms statuses.

### Existing Endpoints Reused
- `GET /api/jobs`: Jobs catalog lists.
- `GET /api/applications`: Applications tracker cards.
- `GET /api/analytics`: Statistical datasets.
- `GET /api/resumes`: Resume profiles registry.
- `GET /api/profile` / `PUT /api/profile`: Matches preferences values.
