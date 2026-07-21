import { NotificationRepository } from '../repositories/notificationRepository.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';

export class NotificationQueue {
  constructor() {
    this.notificationRepo = new NotificationRepository();
    this.isProcessing = false;
  }

  /**
   * Enqueue a new notification task for a job.
   */
  async enqueue(jobId, channel = 'telegram', priority = 0) {
    logger.debug(`Enqueueing notification for job ID: ${jobId} on channel: ${channel}`, { module: 'notification-queue' });
    return await this.notificationRepo.enqueueNotification(jobId, channel, priority);
  }

  /**
   * Process a single batch of pending notifications in the queue.
   */
  async processQueue() {
    if (this.isProcessing) {
      logger.debug('Queue processing is already in progress, skipping start.', { module: 'notification-queue' });
      return;
    }

    this.isProcessing = true;
    logger.info('Starting notification queue processing cycle...', { module: 'notification-queue' });

    try {
      const items = await this.notificationRepo.dequeuePendingNotifications(10);
      logger.debug(`Found ${items.length} pending notification queue items to process.`, { module: 'notification-queue' });

      for (const item of items) {
        await this.processQueueItem(item);
      }
    } catch (error) {
      logger.error('Failed processing notification queue batch', { module: 'notification-queue', error });
    } finally {
      this.isProcessing = false;
      logger.info('Notification queue processing cycle finished.', { module: 'notification-queue' });
    }
  }

  /**
   * Process a single queue item.
   */
  async processQueueItem(item) {
    logger.info(`Processing queue item ID: ${item.id} for job ID: ${item.job_id} on channel: ${item.channel}`, { module: 'notification-queue' });

    try {
      // Defer to NotificationService to check rules and send message
      const result = await notificationService.sendNotification(item);

      if (result.success) {
        // Enforce duplicate prevention constraints on success
        await this.notificationRepo.recordHistory(item.job_id, 'sent', item.channel, item.retry_count, result.response);
        await this.notificationRepo.removeQueueItem(item.id);
        logger.info(`Notification sent successfully. Removed item ID: ${item.id} from queue.`, { module: 'notification-queue' });
      } else if (result.status === 'ignored' || result.status === 'expired' || result.status === 'duplicate') {
        // If ignored, expired, or duplicate, record history and delete from queue
        await this.notificationRepo.recordHistory(item.job_id, result.status, item.channel, item.retry_count, result.response);
        await this.notificationRepo.removeQueueItem(item.id);
        logger.info(`Notification filtered out [${result.status}]. Removed item ID: ${item.id} from queue.`, { module: 'notification-queue' });
      } else {
        // General dispatch failure - handle retry/backoff
        await this.handleFailure(item, result.response || 'Unknown transmission error');
      }
    } catch (err) {
      logger.error(`Unhandled error processing queue item ID: ${item.id}`, { module: 'notification-queue', error: err });
      await this.handleFailure(item, err.message || 'Fatal execution error');
    }
  }

  /**
   * Handle failure of queue item: schedule retry or route to DLQ.
   */
  async handleFailure(item, errorMessage) {
    const nextRetry = item.retry_count + 1;

    if (nextRetry >= item.max_retries) {
      logger.warn(`Queue item ID: ${item.id} has exceeded max retries (${item.max_retries}). Routing to DLQ.`, { module: 'notification-queue' });
      await this.notificationRepo.moveToDLQ(item.id);
      await this.notificationRepo.recordHistory(item.job_id, 'failed', item.channel, nextRetry, `DLQ: ${errorMessage}`);
    } else {
      // Calculate exponential backoff (e.g. 2, 4, 8, 16 seconds...)
      const backoffSec = Math.pow(2, nextRetry);
      const nextAttempt = new Date(Date.now() + backoffSec * 1000);

      logger.info(`Queue item ID: ${item.id} failed. Scheduling retry #${nextRetry} in ${backoffSec} seconds at ${nextAttempt.toISOString()}`, { module: 'notification-queue' });
      await this.notificationRepo.updateQueueItem(item.id, 'pending', nextRetry, nextAttempt);
      await this.notificationRepo.recordHistory(item.job_id, 'retried', item.channel, nextRetry, errorMessage);
    }
  }
}

export const notificationQueue = new NotificationQueue();
export default notificationQueue;
