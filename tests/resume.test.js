import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { resumeParser } from '../src/services/resumeParser.js';
import { resumeMatcher } from '../src/services/resumeMatcher.js';
import { resumeOptimizer } from '../src/services/resumeOptimizer.js';
import { resumeService } from '../src/services/resumeService.js';
import { initTelegramBot } from '../src/telegram/bot.js';
import { config } from '../src/config/env.js';

// Setup test configs
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';
config.telegramChatId = '12345';
config.telegramBotToken = 'mock-token';
initTelegramBot();

// Construct a valid minimal PDF buffer containing resume text
const pdfBuffer = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
  '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
  '3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n' +
  '4 0 obj <</Length 100>> stream\n' +
  'BT\n' +
  '/F1 12 Tf\n' +
  '72 712 Td\n' +
  '(Skills: Java, Spring Boot, MySQL. Target Role: Backend Developer. Experience: 3 years.) Tj\n' +
  'ET\n' +
  'endstream\n' +
  'endobj\n' +
  'xref\n' +
  '0 5\n' +
  '0000000000 65535 f\n' +
  '0000000009 00000 n\n' +
  '0000000056 00000 n\n' +
  '0000000111 00000 n\n' +
  '0000000212 00000 n\n' +
  'trailer <</Size 5 /Root 1 0 R>>\n' +
  'startxref\n' +
  '360\n' +
  '%%EOF'
);

// ----------------------------------------------------
// UNIT TESTS: Real PDF Text Parser
// ----------------------------------------------------

test('Resume Parser: Extracts text and parses structures from PDF binary', async () => {
  const text = await resumeParser.extractText(pdfBuffer, 'resume.pdf');
  assert.ok(text.includes('Java') || text.includes('Skills'));

  const parsed = resumeParser.parseStructuredContent(text);
  assert.ok(parsed.primarySkills.length > 0);
  assert.equal(parsed.targetRole, 'Backend Developer');
});

// ----------------------------------------------------
// UNIT TESTS: Similarity Matcher & Density Analyzer
// ----------------------------------------------------

test('Resume Matcher: Evaluates scores, keyword intersections, and optimizer suggestions', async () => {
  const resume = {
    id: 1,
    target_role: 'Backend Developer',
    primary_skills: ['Java', 'Spring Boot'],
    secondary_skills: ['MySQL'],
    keywords: ['java', 'spring boot', 'sql', 'rest api'],
    experience: [{ years: 3 }]
  };

  const job = {
    id: 10,
    role: 'Backend Engineer',
    skills: ['Java', 'Spring Boot', 'PostgreSQL'],
    keywords: ['java', 'spring boot', 'postgres', 'microservices'],
    experience: '2 years',
    description: 'Looking for a Spring Boot and Java developer.'
  };

  // 1. Similarity Check
  const result = await resumeMatcher.compare(resume, job);
  assert.ok(result.overall_match_score > 50);
  assert.ok(result.skill_match_score > 0);

  // 2. Keyword density
  const keywordsReport = resumeOptimizer.analyzeKeywords(resume.keywords, job.keywords);
  assert.ok(keywordsReport.strongKeywords.includes('java'));
  assert.ok(keywordsReport.missingKeywords.includes('postgres'));

  // 3. Suggestions checklist
  const suggestions = resumeOptimizer.generateSuggestions(resume, job);
  assert.ok(suggestions.missingSkills.includes('postgresql'));
});

// ----------------------------------------------------
// INTEGRATION TESTS: API Handlers & Versions Rollback
// ----------------------------------------------------

test('Integration: Uploads resume profiles, rolls back versions, and queries recommendations', async () => {
  const base64Content = pdfBuffer.toString('base64');

  // 1. Post new resume profile
  const postRes = await request(app)
    .post('/api/resumes')
    .send({
      name: 'Backend Profile',
      fileName: 'resume.pdf',
      fileBase64: base64Content
    });
  assert.equal(postRes.status, 201);
  const resumeId = postRes.body.data.id;

  // 2. Update version of the profile
  const updateRes = await request(app)
    .post('/api/resumes')
    .send({
      resumeId,
      fileName: 'resume_v2.pdf',
      fileBase64: base64Content
    });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.version, 2);

  // 3. Rollback profile version
  const rollbackRes = await request(app)
    .post(`/api/resumes/${resumeId}/rollback`)
    .send({ targetVersion: 1 });
  assert.equal(rollbackRes.status, 200);
  assert.equal(rollbackRes.body.data.version, 1);

  // 4. Get Recommended Resume for Job ID: 1
  const recRes = await request(app).get('/api/jobs/1/resume-recommendation');
  assert.equal(recRes.status, 200);
  assert.ok(recRes.body.data.bestResume);
  assert.equal(recRes.body.data.bestResume.id, resumeId);
});
