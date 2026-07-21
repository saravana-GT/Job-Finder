import { query } from '../database/connection.js';

export class ApplicationRepository {
  /**
   * List applications with associated job details.
   */
  async listApplications(limit = 100) {
    const sql = `
      SELECT a.id, a.job_id, a.status, a.resume_used, a.applied_at, a.notes, j.company, j.role
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.applied_at DESC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Create an application record.
   */
  async createApplication(appData) {
    const { job_id, status = 'applied', resume_used, notes } = appData;
    const sql = `
      INSERT INTO applications (job_id, status, resume_used, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const res = await query(sql, [job_id, status, resume_used, notes]);
    return res.rows[0];
  }
}
