import test from 'node:test';
import assert from 'node:assert/strict';
import { query, mockDb } from '../src/database/connection.js';
import { resumeService } from '../src/services/resumeService.js';
import { providerManager } from '../src/scrapers/providerManager.js';
import { recommendationEngine } from '../src/services/recommendationEngine.js';
import { notificationQueue } from '../src/services/notificationQueue.js';
import { applicationService } from '../src/services/applicationService.js';
import { calendarService } from '../src/services/calendarService.js';
import { analyticsService } from '../src/services/analyticsService.js';
import { initTelegramBot } from '../src/telegram/bot.js';

process.env.NODE_ENV = 'test';

// Initialize telegram Bot test config
initTelegramBot();

test('End-to-End: Entire Candidate Placement Workflow Integration', async () => {
  console.log('[E2E TEST] Starting End-to-End Placement workflow audit...');

  // Reset database state tables
  mockDb.resumes = [];
  mockDb.jobs = [];
  mockDb.applications = [];
  mockDb.notifications = [];
  mockDb.notificationQueue = [];
  mockDb.calendarEvents = [];

  // ----------------------------------------------------
  // STEP 1: Resume Upload & Structured Parsing
  // ----------------------------------------------------
  console.log('[E2E STEP 1] Uploading resume profile...');
  // Setup valid PDF content stream containing matching skills/role
  const resumeName = 'E2E Full Stack Resume';
  const pdfContent = 
    '%PDF-1.4\n' +
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n' +
    '4 0 obj <</Length 120>> stream\n' +
    'BT\n' +
    '/F1 12 Tf\n' +
    '72 712 Td\n' +
    '(Skills: JavaScript, Node.js, React, PostgreSQL. Target Role: Full Stack Engineer. Experience: 3 years.) Tj\n' +
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
    '%%EOF';
  const fileContentBase64 = Buffer.from(pdfContent).toString('base64');
  
  const resume = await resumeService.createResumeProfile(resumeName, Buffer.from(fileContentBase64, 'base64'), 'resume.pdf');
  assert.ok(resume.id);
  assert.equal(resume.name, resumeName);
  console.log(`[E2E STEP 1 SUCCESS] Resume profile created with ID: ${resume.id}`);

  // ----------------------------------------------------
  // STEP 2: Job Discovery Ingest
  // ----------------------------------------------------
  console.log('[E2E STEP 2] Discovering and ingesting openings...');
  // Manually insert a newly scraped job matching profile skills
  await query(
    'INSERT INTO jobs (platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, posted_date, deadline, ai_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
    ['Internshala', 'Stripe', 'Full Stack Developer', 'Remote', 'Full Time', '12 LPA', '2 years', ['JavaScript', 'Node.js', 'React'], 'Description', 'https://stripe.com/careers/1', new Date().toISOString(), null, 90]
  );
  
  const jobsRes = await query('SELECT * FROM jobs');
  const job = jobsRes.rows[0];
  assert.ok(job);
  assert.equal(job.company, 'Stripe');
  console.log(`[E2E STEP 2 SUCCESS] Ingested job found with ID: ${job.id}`);

  // ----------------------------------------------------
  // STEP 3: AI Matching Scores Updates
  // ----------------------------------------------------
  console.log('[E2E STEP 3] Executing AI match calculations...');
  const { profileService } = await import('../src/services/profileService.js');
  const profile = await profileService.getProfile();
  await recommendationEngine.recalculateAllJobScores(profile);
  console.log('[E2E STEP 3 SUCCESS] AI matches updated.');

  // ----------------------------------------------------
  // STEP 4: Notification Dispatch Priority Enqueue
  // ----------------------------------------------------
  console.log('[E2E STEP 4] Enqueuing match score alerts...');
  // Trigger alert queue check
  await notificationQueue.enqueue(job.id, 'telegram', 0);
  
  // Verify alert is in queue
  const queueLength = mockDb.notificationQueue.length;
  assert.equal(queueLength, 1);
  assert.equal(mockDb.notificationQueue[0].job_id, job.id);
  
  // Process the queue alerts
  await notificationQueue.processQueue();
  console.log('[E2E STEP 4 SUCCESS] Priority dispatch completed.');

  // ----------------------------------------------------
  // STEP 5: Application Tracking Transitions (ATS)
  // ----------------------------------------------------
  console.log('[E2E STEP 5] Moving application pipeline stages...');
  // Create application card
  const app = await applicationService.createApplication(job.id, 'Interested', 'resume.pdf', 'Initial match');
  assert.ok(app.id);
  assert.equal(app.status, 'Interested');

  // Transition to Interview stage
  const updatedApp = await applicationService.updateApplicationStatus(app.id, 'Interview Scheduled', {
    interviewDate: '2026-07-28',
    interviewTime: '14:00:00',
    meetingLink: 'https://meet.google.com/xyz',
    recruiterName: 'John Recruiter',
    recruiterEmail: 'john@stripe.com'
  });
  assert.equal(updatedApp.status, 'Interview Scheduled');
  console.log(`[E2E STEP 5 SUCCESS] Transitioned application to Interview with ID: ${updatedApp.id}`);

  // ----------------------------------------------------
  // STEP 6: Calendar conflict validation
  // ----------------------------------------------------
  console.log('[E2E STEP 6] Reviewing calendar conflict schedules...');
  // Confirm calendar events are present for that date
  const events = await calendarService.getEventsForApplication(app.id);
  const matchedEvent = events[0];
  assert.ok(matchedEvent);
  assert.equal(matchedEvent.title, 'Interview for Application #1');
  console.log(`[E2E STEP 6 SUCCESS] Interview event confirmed on: ${matchedEvent.start_time}`);

  // ----------------------------------------------------
  // STEP 7: Dashboard & Analytics Compilation
  // ----------------------------------------------------
  console.log('[E2E STEP 7] Running aggregated analytics...');
  const analytics = await analyticsService.calculateAnalytics();
  assert.equal(analytics.totalApplications, 1);
  assert.equal(analytics.interviewCount, 1);
  assert.ok(analytics.jobsOverTime.length > 0);
  console.log('[E2E STEP 7 SUCCESS] Aggregated dashboard calculations match state logs.');

  console.log('[E2E SUCCESS] All 7 steps integrated and verified successfully!');
});
