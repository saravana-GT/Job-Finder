import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class ReminderService {
  static get LeadOffsets() {
    return {
      '7 days': 7 * 24 * 60 * 60 * 1000,
      '3 days': 3 * 24 * 60 * 60 * 1000,
      '1 day': 24 * 60 * 60 * 1000,
      '6 hours': 6 * 60 * 60 * 1000,
      '2 hours': 2 * 60 * 60 * 1000,
      '30 minutes': 30 * 60 * 1000
    };
  }

  /**
   * Automatically generate and save reminder alarms for an event based on lead times.
   */
  async scheduleRemindersForEvent(event) {
    logger.info(`Scheduling reminders for event ID: ${event.id} ("${event.title}")`, { module: 'reminder-service' });

    try {
      // 1. Delete existing pending reminders for this event (to prevent duplicate spam on updates/reschedules)
      await query('DELETE FROM reminders WHERE event_id = $1 AND status = \'pending\'', [event.id]);

      const startTimeMs = new Date(event.start_time).getTime();
      const nowMs = Date.now();

      const insertSql = `
        INSERT INTO reminders (event_id, reminder_time, lead_time, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (event_id, lead_time) DO UPDATE SET
          reminder_time = EXCLUDED.reminder_time,
          status = 'pending'
      `;

      for (const [lead, offsetMs] of Object.entries(ReminderService.LeadOffsets)) {
        const reminderTimeMs = startTimeMs - offsetMs;

        // Only register if reminder is in the future
        if (reminderTimeMs > nowMs) {
          const reminderDate = new Date(reminderTimeMs);
          await query(insertSql, [event.id, reminderDate, lead]);
          logger.debug(`Registered "${lead}" reminder for event ID: ${event.id} scheduled at ${reminderDate.toISOString()}`, { module: 'reminder-service' });
        }
      }
    } catch (error) {
      logger.error(`Failed scheduling reminders for event ID: ${event.id}`, { module: 'reminder-service', error });
      throw error;
    }
  }

  /**
   * Process all reminders that are due and send them via the Notification Engine.
   */
  async processDueReminders() {
    logger.info('Processing due event reminders...', { module: 'reminder-service' });

    try {
      // Select pending reminders due
      const sql = `
        SELECT r.id, r.event_id, r.lead_time, e.title, e.description, e.start_time, e.meeting_link, e.application_id, a.job_id
        FROM reminders r
        JOIN calendar_events e ON r.event_id = e.id
        LEFT JOIN applications a ON e.application_id = a.id
        WHERE r.status = 'pending' AND r.reminder_time <= CURRENT_TIMESTAMP
      `;
      const res = await query(sql);
      const due = res.rows;

      logger.debug(`Found ${due.length} due reminders to dispatch.`, { module: 'reminder-service' });

      for (const item of due) {
        await this.dispatchReminder(item);
      }
    } catch (error) {
      logger.error('Failed processing due reminders cycle', { module: 'reminder-service', error });
    }
  }

  /**
   * Dispatch a single reminder notification.
   */
  async dispatchReminder(reminderItem) {
    logger.info(`Dispatching reminder ID: ${reminderItem.id} ("${reminderItem.title}")`, { module: 'reminder-service' });

    try {
      const { notificationService } = await import('./notificationService.js');
      
      const startTimeFormatted = new Date(reminderItem.start_time).toLocaleString();
      const reminderMessage = `
⏰ *Upcoming Event Reminder [${reminderItem.lead_time.toUpperCase()}]*

📅 *Event:* ${reminderItem.title}
📝 *Details:* ${reminderItem.description || 'No description provided.'}
🕒 *Time:* ${startTimeFormatted}
🔗 *Link:* ${reminderItem.meeting_link ? `[Join Meeting](${reminderItem.meeting_link})` : 'No link provided.'}
`;

      // Enqueue / send Telegram notification directly
      const result = await notificationService.sendTelegramNotification({
        role: `Reminder: ${reminderItem.title}`,
        company: 'Calendar Service',
        apply_url: reminderItem.meeting_link || 'https://calendar.google.com',
        deadline: reminderItem.start_time,
        ai_score: 99, // Bypass threshold constraints
        job_id: reminderItem.job_id || 1
      });

      // Override the text payload using custom message directly
      const bot = (await import('../telegram/bot.js')).getTelegramBot();
      const chatId = (await import('../config/env.js')).config.telegramChatId;
      if (bot && chatId) {
        await bot.sendMessage(chatId, reminderMessage, { parse_mode: 'Markdown' });
      }

      await query('UPDATE reminders SET status = \'sent\' WHERE id = $1', [reminderItem.id]);
      logger.info(`Reminder ID: ${reminderItem.id} dispatched successfully.`, { module: 'reminder-service' });
    } catch (error) {
      logger.error(`Failed to dispatch reminder ID: ${reminderItem.id}`, { module: 'reminder-service', error });
      await query('UPDATE reminders SET status = \'failed\' WHERE id = $1', [reminderItem.id]);
    }
  }
}

export const reminderService = new ReminderService();
export default reminderService;
