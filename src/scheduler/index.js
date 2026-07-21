import { scheduler } from './scheduler.js';
import { logger } from '../utils/logger.js';

export function startScheduler() {
  // Register recurring background jobs

  // 1. Job scraping job - Runs every 30 minutes
  scheduler.registerJob(
    'job-scraper',
    '*/30 * * * *',
    async () => {
      logger.info('Scheduled Job Scraper task started.', { module: 'scraper' });
      const { providerManager } = await import('../services/providerManager.js');
      await providerManager.runSync();
    },
    { retries: 3, retryDelayMs: 5000 }
  );

  // 2. AI Matching job - Runs every hour
  scheduler.registerJob(
    'ai-matcher',
    '0 * * * *',
    async () => {
      logger.info('Scheduled AI Matcher task started.', { module: 'ai' });
      const { recommendationEngine } = await import('../services/recommendationEngine.js');
      const { profileService } = await import('../services/profileService.js');
      const profile = await profileService.getProfile();
      await recommendationEngine.recalculateAllJobScores(profile);
    },
    { retries: 2, retryDelayMs: 10000 }
  );

  // 3. Notification Dispatcher job - Runs every 5 minutes
  scheduler.registerJob(
    'notification-dispatcher',
    '*/5 * * * *',
    async () => {
      logger.info('Scheduled Notification Dispatcher task started.', { module: 'notification' });
      const { notificationQueue } = await import('../services/notificationQueue.js');
      const { digestService } = await import('../services/digestService.js');
      await notificationQueue.processQueue();
      await digestService.checkAndSendDigest();
    },
    { retries: 2, retryDelayMs: 5000 }
  );

  // 4. Calendar Reminder Processor - Runs every 5 minutes
  scheduler.registerJob(
    'reminder-processor',
    '*/5 * * * *',
    async () => {
      logger.info('Scheduled Calendar Reminder Processor task started.', { module: 'scheduler' });
      const { reminderService } = await import('../services/reminderService.js');
      await reminderService.processDueReminders();
    },
    { retries: 2, retryDelayMs: 5000 }
  );

  // 5. Daily Reports Generator - Runs daily at midnight
  scheduler.registerJob(
    'daily-report-generator',
    '0 0 * * *',
    async () => {
      logger.info('Scheduled Daily Report Generator task started.', { module: 'scheduler' });
      const { reportService } = await import('../services/reportService.js');
      await reportService.generateReport('daily');
    },
    { retries: 1, retryDelayMs: 10000 }
  );

  // Start cron scheduling
  scheduler.start();
  logger.info('Scheduler started and recurring tasks registered.', { module: 'scheduler' });
  return true;
}
