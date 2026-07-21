import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { NotificationRepository } from '../src/repositories/notificationRepository.js';
import { notificationQueue } from '../src/services/notificationQueue.js';
import { notificationService } from '../src/services/notificationService.js';
import { digestService } from '../src/services/digestService.js';
import { handleCommand } from '../src/telegram/handlers/commandHandler.js';

import { initTelegramBot } from '../src/telegram/bot.js';
import { config } from '../src/config/env.js';

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';

// Initialize mock bot configs
config.telegramChatId = '12345';
config.telegramBotToken = 'mock-token';
initTelegramBot();

const notificationRepo = new NotificationRepository();

// ----------------------------------------------------
// UNIT TESTS: Repository and Settings
// ----------------------------------------------------

test('Repository: Should read and write preference settings', async () => {
  const settings = await notificationRepo.getSettings();
  assert.ok(settings);
  assert.equal(settings.notification_threshold, 75);

  const updated = await notificationRepo.updateSettings({
    notification_threshold: 85,
    digest_mode: 'daily'
  });
  assert.equal(updated.notification_threshold, 85);
  assert.equal(updated.digest_mode, 'daily');

  // Reset settings back for subsequent tests
  await notificationRepo.updateSettings({
    notification_threshold: 75,
    digest_mode: 'instant'
  });
});

// ----------------------------------------------------
// UNIT TESTS: Rules & Filtering Checks
// ----------------------------------------------------

test('Rules: Should skip low score notification alerts', async () => {
  // Configured default threshold is 75
  const queueItem = {
    job_id: 99,
    channel: 'telegram',
    ai_score: 60, // Below 75
    deadline: null
  };

  const check = await notificationService.sendNotification(queueItem);
  assert.equal(check.success, false);
  assert.equal(check.status, 'ignored');
});

test('Rules: Should skip expired job match notifications', async () => {
  const queueItem = {
    job_id: 101,
    channel: 'telegram',
    ai_score: 95,
    deadline: new Date(Date.now() - 3600000).toISOString() // expired 1 hour ago
  };

  const check = await notificationService.sendNotification(queueItem);
  assert.equal(check.success, false);
  assert.equal(check.status, 'expired');
});

// ----------------------------------------------------
// TELEGRAM API MOCK TESTS
// ----------------------------------------------------

test('Telegram API Mock: Should format and send telegram payload', async () => {
  const queueItem = {
    job_id: 10,
    channel: 'telegram',
    ai_score: 90,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    role: 'Fullstack Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    apply_url: 'http://acme.com/apply'
  };

  const result = await notificationService.sendTelegramNotification(queueItem);
  assert.equal(result.success, true);
  assert.equal(result.status, 'sent');
});

// ----------------------------------------------------
// TELEGRAM COMMAND TESTS
// ----------------------------------------------------

test('Telegram Commands: Execute command handlers correctly', async () => {
  const statsResponse = await handleCommand('/notifications', 12345);
  console.log('statsResponse:', statsResponse);
  assert.ok(statsResponse.includes('Notification Statistics & Health'));

  const settingsResponse = await handleCommand('/settings', 12345);
  console.log('settingsResponse:', settingsResponse);
  assert.ok(settingsResponse.includes('Notification Settings'));

  const thresholdResponse = await handleCommand('/threshold 85', 12345);
  console.log('thresholdResponse:', thresholdResponse);
  assert.ok(thresholdResponse.includes('Score Threshold updated'));

  const todayResponse = await handleCommand('/today', 12345);
  console.log('todayResponse:', todayResponse);
  assert.ok(todayResponse.toLowerCase().includes('today'));

  const recResponse = await handleCommand('/recommended', 12345);
  console.log('recResponse:', recResponse);
  assert.ok(recResponse.includes('Top Recommended Matches'));
});

// ----------------------------------------------------
// QUEUE & BACKOFF TESTS
// ----------------------------------------------------

test('Queue: Persistent retry increment and DLQ routing', async () => {
  // Seed a fake queue item
  const queueItem = await notificationRepo.enqueueNotification(88, 'telegram', 2);
  assert.ok(queueItem);

  // Process a failure simulation
  const mockFailedItem = {
    id: queueItem.id,
    job_id: 88,
    channel: 'telegram',
    retry_count: 0,
    max_retries: 3
  };

  await notificationQueue.handleFailure(mockFailedItem, 'Simulated API failure');
  
  // Verify retry increment
  const items = await notificationRepo.dequeuePendingNotifications();
  const updatedItem = items.find(i => i.id === queueItem.id);
  assert.equal(updatedItem?.retry_count, 1);

  // Move to max retries simulation to trigger DLQ
  const mockMaxFailedItem = {
    id: queueItem.id,
    job_id: 88,
    channel: 'telegram',
    retry_count: 2,
    max_retries: 3
  };

  await notificationQueue.handleFailure(mockMaxFailedItem, 'Fatal Simulated failure');

  // Verify it was marked DLQ / removed from pending
  const postItems = await notificationRepo.dequeuePendingNotifications();
  const dlqItem = postItems.find(i => i.id === queueItem.id);
  assert.equal(dlqItem, undefined);
});

// ----------------------------------------------------
// INTEGRATION TESTS: APIs
// ----------------------------------------------------

test('Integration: GET notification summary, history, and settings updates', async () => {
  const getSummary = await request(app).get('/api/notifications');
  assert.equal(getSummary.status, 200);
  assert.equal(getSummary.body.success, true);
  assert.ok('stats' in getSummary.body.data);

  const getHistory = await request(app).get('/api/notifications/history');
  assert.equal(getHistory.status, 200);
  assert.equal(getHistory.body.success, true);
  assert.ok(Array.isArray(getHistory.body.data));

  const updateSettings = await request(app)
    .put('/api/settings')
    .send({ notification_threshold: 80, digest_mode: 'hourly' });
  assert.equal(updateSettings.status, 200);
  assert.equal(updateSettings.body.data.notification_threshold, 80);
});

// ----------------------------------------------------
// STRESS TESTS: Concurrent loads
// ----------------------------------------------------

test('Stress: Concurrently enqueue and process high volume of notification requests', async () => {
  const start = Date.now();
  
  const enqueuePromises = [];
  for (let i = 200; i < 220; i++) {
    enqueuePromises.push(notificationQueue.enqueue(i, 'telegram', i % 3));
  }
  await Promise.all(enqueuePromises);

  // Trigger processing cycle
  await notificationQueue.processQueue();

  const duration = Date.now() - start;
  console.log(`[STRESS] Enqueued and processed 20 notifications in ${duration}ms.`);
  assert.ok(duration < 2000); // Stress completion assertion
});
