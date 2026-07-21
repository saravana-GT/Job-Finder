import { NotificationRepository } from '../repositories/notificationRepository.js';
import { getTelegramBot } from '../telegram/bot.js';
import { config } from '../config/env.js';
import { SkillExtractor } from './skillExtractor.js';
import { profileService } from './profileService.js';
import { recommendationEngine } from './recommendationEngine.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  constructor() {
    this.notificationRepo = new NotificationRepository();
  }

  /**
   * Evaluates rules and routes notification dispatch to the chosen channel.
   * @param {Object} job Job object
   * @param {string} channel Notification channel name ('telegram', 'email', etc.)
   */
  async sendNotification(queueItem) {
    const { job_id, channel } = queueItem;
    logger.info(`Evaluating notification rules for job ID: ${job_id} on channel: ${channel}`, { module: 'notification-service' });

    try {
      // 1. Fetch settings
      const settings = await this.notificationRepo.getSettings();
      const threshold = settings?.notification_threshold || 75;

      // 2. Perform duplicate check
      const isDuplicate = await this.notificationRepo.checkIfAlreadyNotified(job_id, channel);
      if (isDuplicate) {
        logger.info(`Job ID: ${job_id} has already been notified on channel: ${channel}. Skipping.`, { module: 'notification-service' });
        return { success: false, status: 'duplicate', response: 'Skipped: already notified' };
      }

      // 3. Perform expiration check
      if (queueItem.deadline) {
        const deadlineDate = new Date(queueItem.deadline);
        if (deadlineDate < new Date()) {
          logger.info(`Job ID: ${job_id} has expired (deadline: ${queueItem.deadline}). Skipping.`, { module: 'notification-service' });
          return { success: false, status: 'expired', response: 'Skipped: job expired' };
        }
      }

      // 4. Perform score threshold check
      const score = queueItem.ai_score !== null ? queueItem.ai_score : 0;
      if (score < threshold) {
        logger.info(`Job ID: ${job_id} match score (${score}%) is below user threshold (${threshold}%). Skipping.`, { module: 'notification-service' });
        return { success: false, status: 'ignored', response: `Skipped: score ${score}% is below threshold ${threshold}%` };
      }

      // 5. Route to specific channel
      switch (channel.toLowerCase()) {
        case 'telegram':
          return await this.sendTelegramNotification(queueItem);
        case 'email':
          return await this.sendEmailPlaceholder(queueItem);
        case 'discord':
          return await this.sendDiscordPlaceholder(queueItem);
        case 'slack':
          return await this.sendSlackPlaceholder(queueItem);
        default:
          return { success: false, status: 'failed', response: `Unsupported channel: ${channel}` };
      }

    } catch (error) {
      logger.error(`Failed to process notification rules check for job ID: ${job_id}`, { module: 'notification-service', error });
      return { success: false, status: 'failed', response: error.message };
    }
  }

  /**
   * Dispatch notification via Telegram Bot.
   */
  async sendTelegramNotification(job) {
    const bot = getTelegramBot();
    const chatId = config.telegramChatId;

    if (!bot || !chatId) {
      logger.warn('Telegram Bot or Chat ID is not configured. Skipping dispatch.', { module: 'notification-service' });
      return { success: false, status: 'failed', response: 'Telegram bot/chatId is not configured' };
    }

    try {
      // Calculate report
      const profile = await profileService.getProfile();
      const report = recommendationEngine.generateMatchReport(job, profile);

      const messageText = `
🚀 *New Job Match*

🏢 *Company:* ${job.company}
💼 *Role:* ${job.role}
💻 *Platform:* ${job.platform || 'Direct'}
📍 *Location:* ${job.location || 'Remote'}
🕒 *Employment Type:* ${job.employment_type || 'Full Time'}
💰 *Salary:* ${job.salary || 'Competitive'}
📅 *Deadline:* ${job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Not specified'}

🎯 *AI Score:* ${report.overallScore}% (${report.matchLevel})
🎯 *Matched Skills:* ${report.matchedSkills.join(', ') || 'None'}
⚠️ *Missing Skills:* ${report.missingSkills.join(', ') || 'None'}
📝 *Reason:* ${report.reasonForScore}

🔗 *Direct Apply Link:* [Apply now](${job.apply_url})
`;

      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚀 Apply Now', url: job.apply_url },
              { text: '🔍 View Match', callback_data: `view_match:${job.job_id || job.id}` }
            ],
            [
              { text: '🗑️ Ignore', callback_data: `ignore:${job.job_id || job.id}` },
              { text: '💾 Save Later', callback_data: `save_later:${job.job_id || job.id}` }
            ]
          ]
        }
      });

      return { success: true, status: 'sent', response: 'Telegram message sent successfully' };
    } catch (err) {
      logger.error('Telegram API transmission error', { module: 'notification-service', error: err });
      return { success: false, status: 'failed', response: err.message };
    }
  }

  /**
   * Future channel placeholders.
   */
  async sendEmailPlaceholder(job) {
    logger.info(`[FUTURE CHANNEL] Dispatching email alert for job: ${job.role}`, { module: 'notification-service' });
    return { success: true, status: 'sent', response: 'Email queued (placeholder)' };
  }

  async sendDiscordPlaceholder(job) {
    logger.info(`[FUTURE CHANNEL] Dispatching discord webhook alert for job: ${job.role}`, { module: 'notification-service' });
    return { success: true, status: 'sent', response: 'Discord webhook executed (placeholder)' };
  }

  async sendSlackPlaceholder(job) {
    logger.info(`[FUTURE CHANNEL] Dispatching slack webhook alert for job: ${job.role}`, { module: 'notification-service' });
    return { success: true, status: 'sent', response: 'Slack webhook executed (placeholder)' };
  }
}

export const notificationService = new NotificationService();
export default notificationService;
