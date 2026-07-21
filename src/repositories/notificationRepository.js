import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class NotificationRepository {
  /**
   * Fetch user notification preferences.
   */
  async getSettings() {
    const sql = 'SELECT id, telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled, notification_threshold, digest_mode, last_digest_sent_at FROM settings LIMIT 1';
    const res = await query(sql);
    return res.rows[0] || null;
  }

  /**
   * Save user notification preferences.
   */
  async updateSettings(settingsData) {
    const {
      telegram_enabled,
      notification_threshold,
      digest_mode,
      calendar_enabled,
      gmail_enabled,
      ai_enabled
    } = settingsData;

    const sql = `
      INSERT INTO settings (id, telegram_enabled, notification_threshold, digest_mode, calendar_enabled, gmail_enabled, ai_enabled)
      VALUES (1, COALESCE($1, TRUE), COALESCE($2, 75), COALESCE($3, 'instant'), COALESCE($4, FALSE), COALESCE($5, FALSE), COALESCE($6, TRUE))
      ON CONFLICT (id) DO UPDATE SET
        telegram_enabled = COALESCE(EXCLUDED.telegram_enabled, settings.telegram_enabled),
        notification_threshold = COALESCE(EXCLUDED.notification_threshold, settings.notification_threshold),
        digest_mode = COALESCE(EXCLUDED.digest_mode, settings.digest_mode),
        calendar_enabled = COALESCE(EXCLUDED.calendar_enabled, settings.calendar_enabled),
        gmail_enabled = COALESCE(EXCLUDED.gmail_enabled, settings.gmail_enabled),
        ai_enabled = COALESCE(EXCLUDED.ai_enabled, settings.ai_enabled)
      RETURNING *
    `;

    const params = [
      telegram_enabled,
      notification_threshold,
      digest_mode,
      calendar_enabled,
      gmail_enabled,
      ai_enabled
    ];

    const res = await query(sql, params);
    return res.rows[0];
  }

  /**
   * Update the timestamp of the last sent digest.
   */
  async updateLastDigestTimestamp() {
    const sql = 'UPDATE settings SET last_digest_sent_at = CURRENT_TIMESTAMP WHERE id = 1';
    await query(sql);
  }

  /**
   * Enqueue a job match for notification.
   */
  async enqueueNotification(jobId, channel = 'telegram', priority = 0) {
    const sql = `
      INSERT INTO notification_queue (job_id, channel, priority, status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (job_id, channel) DO NOTHING
      RETURNING *
    `;
    const res = await query(sql, [jobId, channel, priority]);
    return res.rows[0] || null;
  }

  /**
   * Dequeue prioritized pending notifications due for execution.
   */
  async dequeuePendingNotifications(limit = 10) {
    const sql = `
      SELECT q.id, q.job_id, q.channel, q.priority, q.retry_count, q.max_retries, j.role, j.company, j.location, j.employment_type, j.salary, j.deadline, j.ai_score, j.skills, j.description, j.apply_url, j.platform
      FROM notification_queue q
      JOIN jobs j ON q.job_id = j.id
      WHERE q.status = 'pending' AND q.next_attempt <= CURRENT_TIMESTAMP
      ORDER BY q.priority DESC, q.created_at ASC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Update an item in the notification queue.
   */
  async updateQueueItem(id, status, retryCount, nextAttempt = null) {
    const sql = `
      UPDATE notification_queue
      SET status = $2, retry_count = $3, next_attempt = COALESCE($4, next_attempt)
      WHERE id = $1
      RETURNING *
    `;
    const res = await query(sql, [id, status, retryCount, nextAttempt ? new Date(nextAttempt) : null]);
    return res.rows[0];
  }

  /**
   * Remove a successfully processed item from the queue.
   */
  async removeQueueItem(id) {
    const sql = 'DELETE FROM notification_queue WHERE id = $1';
    await query(sql, [id]);
  }

  /**
   * Mark a queue item as permanently failed (DLQ).
   */
  async moveToDLQ(id) {
    const sql = 'UPDATE notification_queue SET status = \'dlq\' WHERE id = $1';
    await query(sql, [id]);
  }

  /**
   * Get all pending notifications for a digest summary.
   */
  async getPendingDigestNotifications(channel = 'telegram') {
    const sql = `
      SELECT q.id, q.job_id, j.role, j.company, j.location, j.employment_type, j.salary, j.deadline, j.ai_score, j.apply_url, j.platform
      FROM notification_queue q
      JOIN jobs j ON q.job_id = j.id
      WHERE q.channel = $1 AND q.status = 'pending'
      ORDER BY q.priority DESC, j.ai_score DESC
    `;
    const res = await query(sql, [channel]);
    return res.rows;
  }

  /**
   * Record historical trace of a notification delivery.
   */
  async recordHistory(jobId, status, channel = 'telegram', retryCount = 0, response = null) {
    const sql = `
      INSERT INTO notifications (job_id, status, channel, retry_count, response, sent_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (job_id, channel) DO UPDATE SET
        status = EXCLUDED.status,
        retry_count = EXCLUDED.retry_count,
        response = EXCLUDED.response,
        sent_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const res = await query(sql, [jobId, status, channel, retryCount, response]);
    return res.rows[0];
  }

  /**
   * Query if a job has already been notified on a given channel.
   */
  async checkIfAlreadyNotified(jobId, channel = 'telegram') {
    const sql = 'SELECT id FROM notifications WHERE job_id = $1 AND channel = $2 AND status IN (\'sent\', \'ignored\') LIMIT 1';
    const res = await query(sql, [jobId, channel]);
    return res.rows.length > 0;
  }

  /**
   * Get historical notification items.
   */
  async getHistory(limit = 100) {
    const sql = `
      SELECT n.id, n.job_id, n.sent_at, n.status, n.channel, n.retry_count, n.response, j.role, j.company
      FROM notifications n
      LEFT JOIN jobs j ON n.job_id = j.id
      ORDER BY n.sent_at DESC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Compile counts of status dispatches.
   */
  async getStats() {
    const sql = `
      SELECT 
        status, 
        COUNT(*) as count 
      FROM notifications 
      GROUP BY status
    `;
    const res = await query(sql);
    
    const stats = {
      sent: 0,
      failed: 0,
      retried: 0,
      ignored: 0,
      expired: 0,
      duplicate: 0
    };

    for (const row of res.rows) {
      if (row.status in stats) {
        stats[row.status] = parseInt(row.count, 10);
      }
    }

    return stats;
  }
}
