import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { query } from '../src/database/connection.js';
import { analyticsService } from '../src/services/analyticsService.js';
import { initTelegramBot } from '../src/telegram/bot.js';
import fs from 'fs';
import path from 'path';

// Setup test configs
process.env.NODE_ENV = 'test';
initTelegramBot();

// ----------------------------------------------------
// UNIT & FUNCTIONAL TESTS: Backend API Additions
// ----------------------------------------------------

test('Backend: Serves static assets correctly', async () => {
  // 1. Root route serves index.html
  const rootRes = await request(app).get('/');
  assert.equal(rootRes.status, 200);
  assert.match(rootRes.headers['content-type'], /html/);

  // 2. Static CSS file is loaded
  const cssRes = await request(app).get('/index.css');
  assert.equal(cssRes.status, 200);
  assert.match(cssRes.headers['content-type'], /css/);
});

test('Backend: Calendar list endpoints return event listings', async () => {
  // Setup sample events in mock DB
  await query(
    'INSERT INTO calendar_events (application_id, title, event_type, start_time, meeting_link) VALUES ($1, $2, $3, $4, $5)',
    [10, 'Onsite System Design', 'interview', '2026-07-25T11:30:00Z', 'https://meet.google.com/abc']
  );

  // 1. Get Events
  const eventsRes = await request(app).get('/api/calendar/events');
  assert.equal(eventsRes.status, 200);
  assert.ok(Array.isArray(eventsRes.body.data));
  const found = eventsRes.body.data.some(e => e.title === 'Onsite System Design');
  assert.ok(found);

  // 2. Get Reminders
  const remindersRes = await request(app).get('/api/calendar/reminders');
  assert.equal(remindersRes.status, 200);
  assert.ok(Array.isArray(remindersRes.body.data));
});

test('Backend: calculateAnalytics calculates extended chart datasets', async () => {
  // Inject mock jobs and applications to trigger calculations
  await query(
    'INSERT INTO jobs (id, platform, company, role, apply_url, ai_score, posted_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [20, 'Naukri', 'Google', 'Developer', 'http://google.com/jobs/1', 95, '2026-07-18T10:00:00Z']
  );
  await query(
    'INSERT INTO applications (job_id, status, resume_used, notes) VALUES ($1, $2, $3, $4)',
    [20, 'Applied', 'Java Developer Profile', 'notes']
  );

  const metrics = await analyticsService.calculateAnalytics();
  
  assert.ok(metrics.jobsOverTime.length > 0);
  assert.ok(metrics.applicationsOverTime.length > 0);
  assert.ok(metrics.resumeUsage.length > 0);
  assert.ok(metrics.aiScoreDistribution.length > 0);
  
  // Verify score distribution groupings
  const dist = metrics.aiScoreDistribution;
  const highDist = dist.find(d => d.range === '85-100');
  assert.ok(highDist.count > 0);
});

// ----------------------------------------------------
// ACCESSIBILITY & PERFORMANCE AUDITS
// ----------------------------------------------------

test('Frontend: index.html satisfies accessibility guidelines (ARIA, Labels, Semantic Landmarks)', () => {
  const htmlPath = path.resolve('public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 1. Check for semantic landmarks
  assert.ok(htmlContent.includes('<aside'), 'Missing <aside> navigation sidebar landmark');
  assert.ok(htmlContent.includes('<main'), 'Missing <main> principal view section landmark');
  assert.ok(htmlContent.includes('<header'), 'Missing <header> layout title section landmark');

  // 2. Check for unique element ID tags
  assert.ok(htmlContent.includes('id="panel-overview"'), 'Missing overview view id descriptor');
  assert.ok(htmlContent.includes('id="panel-jobs"'), 'Missing catalog view id descriptor');
  assert.ok(htmlContent.includes('id="panel-kanban"'), 'Missing ATS view id descriptor');

  // 3. Check for form inputs accessibility labelling
  assert.ok(htmlContent.includes('for="profile-name"'), 'Missing name input field description label mapping');
  assert.ok(htmlContent.includes('for="settings-threshold"'), 'Missing score threshold description label mapping');
});

test('Performance: Analytics compilation runs in less than 200ms', async () => {
  const start = Date.now();
  await analyticsService.calculateAnalytics();
  const duration = Date.now() - start;

  console.log(`[PERFORMANCE] Analytics calculations executed in ${duration}ms.`);
  assert.ok(duration < 200, `Analytics calculation exceeded budget: ${duration}ms`);
});
