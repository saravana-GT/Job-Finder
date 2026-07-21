import { query } from '../database/connection.js';

export class DeadlineRepository {
  /**
   * Get upcoming deadlines with associated job and company details.
   */
  async getUpcomingDeadlines(limit = 10) {
    const sql = `
      SELECT d.id, d.title, d.deadline, d.reminder_sent, j.company, j.role
      FROM deadlines d
      JOIN jobs j ON d.job_id = j.id
      WHERE d.deadline >= CURRENT_TIMESTAMP
      ORDER BY d.deadline ASC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Create a deadline for a job.
   */
  async createDeadline(deadlineData) {
    const { job_id, title, deadline } = deadlineData;
    const sql = `
      INSERT INTO deadlines (job_id, title, deadline)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await query(sql, [job_id, title, new Date(deadline)]);
    return res.rows[0];
  }
}
