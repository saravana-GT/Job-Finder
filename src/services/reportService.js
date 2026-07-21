import { query } from '../database/connection.js';
import { analyticsService } from './analyticsService.js';
import { logger } from '../utils/logger.js';

export class ReportService {
  /**
   * Compile and store a periodic analytics report in the reports table.
   * @param {string} reportType 'daily', 'weekly', or 'monthly'
   */
  async generateReport(reportType) {
    const type = reportType.toLowerCase();
    logger.info(`Compiling and storing internal [${type.toUpperCase()}] report...`, { module: 'report-service' });

    try {
      const analytics = await analyticsService.calculateAnalytics();

      const reportContent = {
        generatedAt: new Date().toISOString(),
        reportType: type,
        metrics: analytics
      };

      const sql = `
        INSERT INTO reports (report_type, content, generated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const res = await query(sql, [type, JSON.stringify(reportContent)]);
      return res.rows[0];
    } catch (error) {
      logger.error(`Failed to generate internal ${type} report`, { module: 'report-service', error });
      throw error;
    }
  }

  /**
   * Fetch stored reports list.
   */
  async getReportsList(limit = 100) {
    const sql = 'SELECT id, report_type, generated_at, content FROM reports ORDER BY generated_at DESC LIMIT $1';
    const res = await query(sql, [limit]);
    return res.rows;
  }
}

export const reportService = new ReportService();
export default reportService;
