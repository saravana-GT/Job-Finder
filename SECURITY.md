# Security Guidelines

A description of threat mitigations and security rules enforced in the AI Placement Assistant.

---

## 1. Vulnerability Disclosures
Please report any discovered security vulnerabilities to `security@placement-assistant.org`. Do not open public github issues.

---

## 2. Core Protection Controls

### Parameterized SQL Queries
To protect against SQL Injection vulnerabilities, all database communications must use parameterized inputs via Pg query bindings (`$1`, `$2`, etc.). String interpolation or raw variable concat in SQL statements is strictly forbidden.

### Rate Limiting & Helmet headers
- Helmet configuration in `src/app.js` automatically registers standard HTTP response headers (preventing clickjacking, content type sniffing, and XSS issues).
- `express-rate-limit` blocks malicious client flooding, capping requests to `100` calls per 15-minute window per IP.

### File Upload Constraints
- Resume document uploads are constrained:
  - Enforced file type restrictions (accepting `.pdf` and `.docx` only, evaluated via file extension match).
  - Enforced size limit validation (payload string content length checked to reject files larger than `5MB`).

### Secret Management
- Secrets must never be committed to source repositories. Use the `.env` template properties.
- Dedicated database connection credentialing should be restricted to isolated container networks.
