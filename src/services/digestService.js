import { NotificationRepository } from '../repositories/notificationRepository.js';
import { getTelegramBot } from '../telegram/bot.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class DigestService {
  constructor() {
    this.notificationRepo = new NotificationRepository();
    this.isProcessing = false;
  }

  /**
   * Evaluates if a digest cycle is due based on settings and elapsed time, and dispatches it.
   * @param {boolean} force Force execution regardless of elapsed time
   */
  async checkAndSendDigest(force = false) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const settings = await this.notificationRepo.getSettings();
      if (!settings) {
        logger.warn('Failed to retrieve settings for digest check.', { module: 'digest-service' });
        return;
      }

      const mode = (settings.digest_mode || 'instant').toLowerCase();
      if (mode === 'instant' && !force) {
        // Instant alerts are processed by the regular queue processor directly
        return;
      }

      // Check elapsed time
      const lastSent = settings.last_digest_sent_at ? new Date(settings.last_digest_sent_at) : new Date(0);
      const elapsedMs = Date.now() - lastSent.getTime();

      let intervalMs = 0;
      if (mode === 'hourly') intervalMs = 60 * 60 * 1000;
      else if (mode === 'daily') intervalMs = 24 * 60 * 60 * 1000;
      else if (mode === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;

      if (elapsedMs < intervalMs && !force) {
        logger.debug(`Digest cycle [${mode}] not due yet. Elapsed: ${Math.round(elapsedMs / 1000)}s, Required: ${Math.round(intervalMs / 1000)}s`, { module: 'digest-service' });
        return;
      }

      logger.info(`Triggering [${mode.toUpperCase()}] digest compilation...`, { module: 'digest-service' });
      await this.sendDigest(mode, settings);

    } catch (error) {
      logger.error('Failed checking/sending digest cycle', { module: 'digest-service', error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Compile and send the actual digest summary.
   */
  async sendDigest(mode, settings) {
    const channel = 'telegram'; // Primary default channel
    const bot = getTelegramBot();
    const chatId = config.telegramChatId;

    if (!bot || !chatId) {
      logger.warn('Telegram bot is disabled or Chat ID is missing. Cannot send digest.', { module: 'digest-service' });
      return;
    }

    // 1. Get pending queue items for the digest
    const items = await this.notificationRepo.getPendingDigestNotifications(channel);
    if (items.length === 0) {
      logger.info('No pending notifications found to aggregate for digest.', { module: 'digest-service' });
      await this.notificationRepo.updateLastDigestTimestamp();
      return;
    }

    // 2. Filter items according to compliance rules
    const threshold = settings.notification_threshold || 75;
    const compliantItems = [];

    for (const item of items) {
      try {
        // Expiration check
        if (item.deadline) {
          if (new Date(item.deadline) < new Date()) {
            await this.notificationRepo.recordHistory(item.job_id, 'expired', channel, 0, 'Digest: expired');
            await this.notificationRepo.removeQueueItem(item.id);
            continue;
          }
        }

        // Duplicate check
        const isDup = await this.notificationRepo.checkIfAlreadyNotified(item.job_id, channel);
        if (isDup) {
          await this.notificationRepo.recordHistory(item.job_id, 'duplicate', channel, 0, 'Digest: duplicate');
          await this.notificationRepo.removeQueueItem(item.id);
          continue;
        }

        // Threshold check
        const score = item.ai_score !== null ? item.ai_score : 0;
        if (score < threshold) {
          await this.notificationRepo.recordHistory(item.job_id, 'ignored', channel, 0, `Digest: score ${score}% below ${threshold}%`);
          await this.notificationRepo.removeQueueItem(item.id);
          continue;
        }

        compliantItems.push(item);
      } catch (err) {
        logger.error(`Error filtering digest item ID: ${item.id}`, { module: 'digest-service', error: err });
      }
    }

    if (compliantItems.length === 0) {
      logger.info('All pending notifications filtered out during digest compliance checks.', { module: 'digest-service' });
      await this.notificationRepo.updateLastDigestTimestamp();
      return;
    }

    // 3. Construct digest Markdown
    const titleMap = {
      'hourly': '🕒 Hourly Job Matches Digest',
      'daily': '📅 Daily Job Matches Digest',
      'weekly': '🗓️ Weekly Job Matches Digest'
    };
    
    let digestMsg = `*${titleMap[mode] || '📅 Job Matches Digest'}*\n`;
    digestMsg += `Found *${compliantItems.length}* new relevant matching positions:\n\n`;

    compliantItems.forEach((job, index) => {
      digestMsg += `${index + 1}. *${job.company}* - _${job.role}_\n`;
      digestMsg += `   🎯 *Score:* ${job.ai_score}% | 📍 ${job.location || 'Remote'}\n`;
      digestMsg += `   🔗 [Apply Now](${job.apply_url}) | Platform: ${job.platform || 'Direct'}\n\n`;
    });

    digestMsg += `_Adjust configurations using /settings command._`;

    // 4. Send Message
    await bot.sendMessage(chatId, digestMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    logger.info(`Digest [${mode}] sent successfully to Chat ID: ${chatId}`, { module: 'digest-service' });

    // 5. Clean queue and record history
    for (const item of compliantItems) {
      await this.notificationRepo.recordHistory(item.job_id, 'sent', channel, 0, `Digest: sent inside ${mode} compilation`);
      await this.notificationRepo.removeQueueItem(item.id);
    }

    // 6. Update last sent timestamp
    await this.notificationRepo.updateLastDigestTimestamp();
  }
}

export const digestService = new DigestService();
export default digestService;
