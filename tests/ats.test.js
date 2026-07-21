import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { applicationService } from '../src/services/applicationService.js';
import { timelineService } from '../src/services/timelineService.js';
import { calendarService } from '../src/services/calendarService.js';
import { reminderService } from '../src/services/reminderService.js';
import { analyticsService } from '../src/services/analyticsService.js';
import { reportService } from '../src/services/reportService.js';
import { initTelegramBot } from '../src/telegram/bot.js';
import { config } from '../src/config/env.js';

// Setup test configs
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';
config.telegramChatId = '12345';
config.telegramBotToken = 'mock-token';
initTelegramBot();

// ----------------------------------------------------
// UNIT TESTS: Application Status Transitions & Timeline
// ----------------------------------------------------

test('ATS Workflow: Should create tracking card and trace timeline workflow shifts', async () => {
  // Create application card
  const appCard = await applicationService.createApplication(1, 'Interested', 'Resume_2026.pdf', 'Interested in Google role');
  assert.ok(appCard);
  assert.equal(appCard.status, 'Interested');
  assert.equal(appCard.resume_used, 'Resume_2026.pdf');

  // Verify transition is logged
  const history = await timelineService.getApplicationTimeline(appCard.id);
  assert.equal(history.timeline.length, 1);
  assert.equal(history.timeline[0].status, 'Interested');

  // Transition status to Applied
  const updated = await applicationService.updateApplicationStatus(appCard.id, 'Applied', {
    notes: 'Submitted application on careers portal',
    coverLetterUsed: 'CL_Google.pdf'
  });
  assert.equal(updated.status, 'Applied');
  assert.equal(updated.cover_letter_used, 'CL_Google.pdf');

  // Verify timeline logs second transition step
  const updatedHistory = await timelineService.getApplicationTimeline(appCard.id);
  assert.equal(updatedHistory.timeline.length, 2);
  assert.equal(updatedHistory.timeline[1].status, 'Applied');
});

// ----------------------------------------------------
// UNIT TESTS: Calendar Event Scheduling & Conflicts
// ----------------------------------------------------

test('Calendar: Should schedule event, check conflicts, and handle rescheduling', async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const startTime = tomorrow.toISOString();
  const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

  // Create an assessment event
  const { event, conflicts } = await calendarService.createEvent(1, {
    title: 'HackerRank OA',
    description: 'HackerRank test link',
    eventType: 'assessment',
    startTime,
    endTime,
    meetingLink: 'https://hackerrank.com/test'
  });

  assert.ok(event);
  assert.equal(event.title, 'HackerRank OA');
  assert.equal(conflicts.length, 0);

  // Attempt to schedule an overlapping event (+/- 15 minutes difference)
  const overlapStart = new Date(tomorrow.getTime() + 15 * 60 * 1000).toISOString();
  const overlapConflicts = await calendarService.detectConflicts(null, overlapStart, null);
  assert.ok(overlapConflicts.length > 0);
  assert.equal(overlapConflicts[0].title, 'HackerRank OA');

  // Reschedule event to next week
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const rescheduled = await calendarService.rescheduleEvent(event.id, nextWeek);
  assert.equal(new Date(rescheduled.event.start_time).toISOString(), nextWeek);

  // Clean delete
  const deleted = await calendarService.deleteEvent(event.id);
  assert.equal(deleted.id, event.id);
});

// ----------------------------------------------------
// UNIT TESTS: Reminder Scheduling & Offset Processing
// ----------------------------------------------------

test('Reminders: Automatically schedules future reminder alarms and processes due items', async () => {
  // Create an event scheduled in 2 days (48 hours)
  // Should trigger: '1 day', '6 hours', '2 hours', '30 minutes' reminders (all future)
  // Should NOT trigger: '7 days', '3 days' (these fall in the past relative to the event start)
  const targetTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  
  const { event } = await calendarService.createEvent(1, {
    title: 'System Design Round',
    eventType: 'interview',
    startTime: targetTime.toISOString()
  });

  // Verify reminders count
  const allEvents = await calendarService.getEventsForApplication(1);
  assert.ok(allEvents.length > 0);

  // Process reminders due (none should be due since they are configured for tomorrow/next week)
  await reminderService.processDueReminders();
  
  // Clean delete event
  await calendarService.deleteEvent(event.id);
});

// ----------------------------------------------------
// INTEGRATION TESTS: APIs & Analytics Reports
// ----------------------------------------------------

test('Integration: POST tracking cards, fetch timeline steps, calculate analytics & reports', async () => {
  // 1. Post new card
  const postRes = await request(app)
    .post('/api/applications')
    .send({ jobId: 1, status: 'Applied', resumeUsed: 'Resume.pdf' });
  assert.equal(postRes.status, 201);
  const appId = postRes.body.data.id;

  // 2. Put status update
  const putRes = await request(app)
    .put(`/api/applications/${appId}/status`)
    .send({ status: 'Interview Scheduled', interviewDate: '2026-07-20', recruiterName: 'John Doe' });
  assert.equal(putRes.status, 200);

  // 3. Get Application Timeline
  const timelineRes = await request(app).get(`/api/applications/${appId}/timeline`);
  assert.equal(timelineRes.status, 200);
  assert.ok(timelineRes.body.data.timeline.length >= 2);

  // 4. Get Analytics Summary
  const analyticsRes = await request(app).get('/api/analytics');
  assert.equal(analyticsRes.status, 200);
  assert.ok('totalApplications' in analyticsRes.body.data);

  // 5. Generate and retrieve reports list
  const generatedReport = await reportService.generateReport('daily');
  assert.ok(generatedReport);
  assert.equal(generatedReport.report_type, 'daily');

  const getReportsRes = await request(app).get('/api/reports');
  assert.equal(getReportsRes.status, 200);
  assert.ok(getReportsRes.body.data.length > 0);
});
