import { query } from '../database/connection.js';

export class LogRepository {
  /**
   * Log an event to the database.
   */
  async createLog({ module, level, message }) {
    const sql = `
      INSERT INTO logs (module, level, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await query(sql, [module, level, typeof message === 'object' ? JSON.stringify(message) : message]);
    return res.rows[0];
  }

  /**
   * Fetch the latest logs.
   */
  async getLatestLogs(limit = 50) {
    const sql = 'SELECT id, module, level, message, created_at FROM logs ORDER BY created_at DESC LIMIT $1';
    const res = await query(sql, [limit]);
    return res.rows;
  }
}
