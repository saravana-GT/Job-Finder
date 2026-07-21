import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class HistoryService {
  /**
   * Log an application status transition in the history database table.
   * @param {number} applicationId ID of the application card
   * @param {string|null} previousStatus Previous tracking status
   * @param {string} currentStatus New tracking status
   * @param {string|null} notes Transition details or user remarks
   */
  async recordTransition(applicationId, previousStatus, currentStatus, notes = null) {
    logger.info(`Recording transition for App ID: ${applicationId} [${previousStatus || 'INIT'} -> ${currentStatus}]`, { module: 'history-service' });

    try {
      const sql = `
        INSERT INTO application_history (application_id, previous_status, current_status, notes, changed_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const res = await query(sql, [applicationId, previousStatus, currentStatus, notes]);
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to record application history log for App ID: ${applicationId}`, { module: 'history-service', error });
      throw error;
    }
  }

  /**
   * Fetch all history transition logs for a given application card.
   * @param {number} applicationId ID of the application card
   */
  async getHistoryForApplication(applicationId) {
    const sql = `
      SELECT id, previous_status, current_status, notes, changed_at
      FROM application_history
      WHERE application_id = $1
      ORDER BY changed_at ASC
    `;
    const res = await query(sql, [applicationId]);
    return res.rows;
  }
}

export const historyService = new HistoryService();
export default historyService;
