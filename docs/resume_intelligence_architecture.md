# Resume Intelligence Engine Architecture

Phase 7 implements a production-grade Resume Intelligence Engine designed to manage multiple resume profiles, extract text from real PDF and DOCX files, index skills/keywords, calculate match scores against job postings, and rollback profile versions.

---

## Architectural Components

```
                    ┌───────────────────────────────┐
                    │      resumeController.js      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       resumeService.js        │
                    └───────┬───────────────┬───────┘
                            │               │
                            ▼               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│        resumeParser.js        │       │       resumeMatcher.js        │
├───────────────────────────────┤       ├───────────────────────────────┤
│ - pdf-parse & mammoth extract │       │ - skill_match_score           │
│ - skillExtractor parsing      │       │ - tech_match_score            │
│ - targetRole classification   │       │ - keyword_match_score         │
└───────────────────────────────┘       │ - role_match_score            │
                                        │ - experience_match_score      │
                                        └───────────────┬───────────────┘
                                                        │
                                                        ▼
                                        ┌───────────────────────────────┐
                                        │       resumeOptimizer.js      │
                                        ├───────────────────────────────┤
                                        │ - analyzeKeywords(R, J)       │
                                        │ - generateSuggestions(R, J)   │
                                        └───────────────────────────────┘
```

### 1. Resume Parser (`src/services/resumeParser.js`)
- **Text Extraction**: Uses `pdf-parse` (a pure TS rewrite) for PDF text extraction and `mammoth` for docx XML text extraction.
- **Skill Mapping**: Uses `SkillExtractor` to parse and normalize skills from raw text and classifies them into frameworks, languages, databases, and tools.
- **Keywords/Experience**: Extracts keywords and experience details (years) from parsed text.

### 2. Resume Matcher (`src/services/resumeMatcher.js`)
- Runs a multi-criteria scoring algorithm matching the resume against a target job:
  - **Skill Match Score (30%)**: Matches primary & secondary resume skills against job skills.
  - **Keyword Match Score (20%)**: Matches resume keyword index against job keywords.
  - **Role Match Score (20%)**: Performs token overlaps between target role and job title.
  - **Tech Match Score (15%)**: Assesses specific libraries, databases, and DevOps tools.
  - **Experience Match Score (15%)**: Evaluates candidate experience duration relative to job specifications.
- Combines metrics into an overall match score and computes a confidence indicator.

### 3. Resume Optimizer (`src/services/resumeOptimizer.js`)
- **Keyword Analyzer**: Categorizes keywords into strong (overlap), missing, and weak (off-topic) lists.
- **Actionable Optimization Checklist**: Recommends missing skills, missing keywords, project improvements (STAR method configurations), certification suggestion paths, portfolio ideas, and pinned GitHub highlights.

### 4. Version Control System (`src/services/resumeService.js`)
- When a resume profile is created or updated, a new record is saved in the `resumes` table and a corresponding history record containing the raw extracted text and metadata is logged in `resume_versions`.
- **Rollbacks**: The system supports rolling back to previous versions. When a rollback is requested, the system retrieves the target version record, updates the active resume fields with the version's metadata, and updates the active version code.

---

## REST API Contracts

### 1. Upload Resume Profile
- **Route**: `POST /api/resumes`
- **Body (JSON)**:
  ```json
  {
    "name": "Backend Engineer Profile",
    "fileName": "resume.pdf",
    "fileBase64": "..."
  }
  ```

### 2. Update Resume Version
- **Route**: `POST /api/resumes`
- **Body (JSON)**:
  ```json
  {
    "resumeId": 1,
    "fileName": "resume_v2.pdf",
    "fileBase64": "..."
  }
  ```

### 3. Rollback Version
- **Route**: `POST /api/resumes/:id/rollback`
- **Body (JSON)**:
  ```json
  {
    "targetVersion": 1
  }
  ```

### 4. Get Best Recommendation
- **Route**: `GET /api/jobs/:jobId/resume-recommendation`
- **Response**: Recommends the best matched resume profile, overall match percentage, missing keywords, confidence score, and optimization checklist.
