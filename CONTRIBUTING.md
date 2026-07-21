# Contributing Guidelines

We welcome contributions to the AI Placement Assistant! Please follow these development and testing workflows.

---

## 1. Development Standards
- Maintain strict parameterization for all SQL statements.
- Document any new REST API endpoints inside `API.md`.
- Keep modules clean and self-contained; avoid adding unnecessary external dependencies.

---

## 2. Code Style
We adhere to standard JavaScript conventions:
- Use ES modules (`import`/`export`).
- Enforce strict comparisons (`===`).
- Always handle async promises using `try-catch` structures with detailed structured logger context tags.

---

## 3. Running Test Suites
Before submitting pull requests, execute both unit and integration tests:
```bash
# Executing standard test suite
npm test

# Executing e2e workflow validation checks
node tests/e2e.test.js
```
Make sure all test cases are completely green before committing.
