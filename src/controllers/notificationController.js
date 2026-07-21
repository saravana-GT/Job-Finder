import { formatResponse } from '../utils/formatter.js';
import { NotificationRepository } from '../repositories/notificationRepository.js';
import { query } from '../database/connection.js';

const notificationRepo = new NotificationRepository();

/**
 * GET /api/notifications
 * Returns stats and preference settings.
 */
export async function getNotificationsSummary(req, res, next) {
  try {
    const settings = await notificationRepo.getSettings();
    const stats = await notificationRepo.getStats();

    const queueRes = await query("SELECT COUNT(*) FROM notification_queue WHERE status = 'pending'");
    const pendingQueueCount = parseInt(queueRes.rows[0]?.count || '0', 10);

    const summary = {
      settings,
      stats,
      queue: {
        pendingCount: pendingQueueCount
      }
    };

    res.json(formatResponse(summary));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/notifications/history
 * Returns the trace history of sent alerts.
 */
export async function getNotificationsHistory(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const history = await notificationRepo.getHistory(limit);
    res.json(formatResponse(history));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/settings
 * Updates preferences (threshold, digest mode, channels toggles).
 */
export async function updateNotificationSettings(req, res, next) {
  try {
    const updated = await notificationRepo.updateSettings(req.body);
    res.json(formatResponse(updated, 'Notification preferences updated successfully.'));
  } catch (error) {
    next(error);
  }
}
