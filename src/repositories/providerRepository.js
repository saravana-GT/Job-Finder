import { query } from '../database/connection.js';

export class ProviderRepository {
  /**
   * Get the status and metadata for a single provider.
   */
  async getProviderStatus(name) {
    const sql = 'SELECT provider_name, is_enabled, consecutive_failures, last_successful_sync, health_status, version, capabilities, updated_at FROM provider_status WHERE provider_name = $1';
    const res = await query(sql, [name]);
    return res.rows[0] || null;
  }

  /**
   * List statuses for all registered providers.
   */
  async listProviderStatuses() {
    const sql = 'SELECT provider_name, is_enabled, consecutive_failures, last_successful_sync, health_status, version, capabilities, updated_at FROM provider_status ORDER BY provider_name ASC';
    const res = await query(sql);
    return res.rows;
  }

  /**
   * Update status fields for a provider.
   */
  async updateProviderStatus(name, updateData) {
    const {
      is_enabled,
      consecutive_failures,
      last_successful_sync,
      health_status,
      version,
      capabilities
    } = updateData;

    const sql = `
      INSERT INTO provider_status (provider_name, is_enabled, consecutive_failures, last_successful_sync, health_status, version, capabilities, updated_at)
      VALUES ($1, COALESCE($2, TRUE), COALESCE($3, 0), $4, COALESCE($5, 'healthy'), COALESCE($6, '1.0.0'), COALESCE($7, '{}'::text[]), CURRENT_TIMESTAMP)
      ON CONFLICT (provider_name) DO UPDATE SET
        is_enabled = COALESCE(EXCLUDED.is_enabled, provider_status.is_enabled),
        consecutive_failures = COALESCE(EXCLUDED.consecutive_failures, provider_status.consecutive_failures),
        last_successful_sync = COALESCE(EXCLUDED.last_successful_sync, provider_status.last_successful_sync),
        health_status = COALESCE(EXCLUDED.health_status, provider_status.health_status),
        version = COALESCE(EXCLUDED.version, provider_status.version),
        capabilities = COALESCE(EXCLUDED.capabilities, provider_status.capabilities),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const params = [
      name,
      is_enabled,
      consecutive_failures,
      last_successful_sync ? new Date(last_successful_sync) : null,
      health_status,
      version,
      capabilities
    ];

    const res = await query(sql, params);
    return res.rows[0];
  }

  /**
   * Increment failure count. If consecutive_failures exceeds failureThreshold, set status to 'down' and optionally disable.
   */
  async incrementProviderFailures(name, failureThreshold = 3) {
    // We update inside the DB directly using atomic increment
    const sql = `
      UPDATE provider_status
      SET 
        consecutive_failures = consecutive_failures + 1,
        health_status = CASE 
          WHEN consecutive_failures + 1 >= $2 THEN 'down' 
          ELSE 'degraded' 
        END,
        is_enabled = CASE 
          WHEN consecutive_failures + 1 >= $2 THEN FALSE 
          ELSE is_enabled 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_name = $1
      RETURNING *
    `;
    const res = await query(sql, [name, failureThreshold]);
    return res.rows[0];
  }

  /**
   * Reset failure count on success and mark as healthy/enabled.
   */
  async resetProviderFailures(name) {
    const sql = `
      UPDATE provider_status
      SET 
        consecutive_failures = 0,
        health_status = 'healthy',
        is_enabled = TRUE,
        last_successful_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_name = $1
      RETURNING *
    `;
    const res = await query(sql, [name]);
    return res.rows[0];
  }

  /**
   * Add a record to the provider sync history log.
   */
  async addSyncHistory(historyData) {
    const {
      provider_name,
      status,
      execution_duration,
      jobs_fetched = 0,
      jobs_parsed = 0,
      jobs_saved = 0,
      jobs_skipped = 0,
      error_message = null
    } = historyData;

    const sql = `
      INSERT INTO provider_sync_history (
        provider_name, status, execution_duration, jobs_fetched, jobs_parsed, jobs_saved, jobs_skipped, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const params = [
      provider_name,
      status,
      execution_duration,
      jobs_fetched,
      jobs_parsed,
      jobs_saved,
      jobs_skipped,
      error_message
    ];

    const res = await query(sql, params);
    return res.rows[0];
  }

  /**
   * Get sync logs for a provider.
   */
  async getLatestSyncHistory(providerName, limit = 50) {
    const sql = `
      SELECT id, provider_name, status, execution_duration, jobs_fetched, jobs_parsed, jobs_saved, jobs_skipped, error_message, created_at
      FROM provider_sync_history
      WHERE provider_name = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const res = await query(sql, [providerName, limit]);
    return res.rows;
  }

  /**
   * Compile statistics across all providers.
   */
  async getStatistics() {
    const totalSyncsRes = await query('SELECT COUNT(*) FROM provider_sync_history');
    const successfulSyncsRes = await query("SELECT COUNT(*) FROM provider_sync_history WHERE status = 'success'");
    const totalJobsScrapedRes = await query('SELECT SUM(jobs_saved) FROM provider_sync_history');
    const avgDurationRes = await query('SELECT AVG(execution_duration) FROM provider_sync_history');

    // Aggregate statistics group by provider
    const sql = `
      SELECT 
        provider_name,
        COUNT(*) as total_syncs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_syncs,
        SUM(jobs_fetched) as total_fetched,
        SUM(jobs_parsed) as total_parsed,
        SUM(jobs_saved) as total_saved,
        SUM(jobs_skipped) as total_skipped,
        AVG(execution_duration) as avg_duration_ms
      FROM provider_sync_history
      GROUP BY provider_name
    `;
    const providerStatsRes = await query(sql);

    return {
      totalSyncs: parseInt(totalSyncsRes.rows[0].count, 10) || 0,
      successRate: totalSyncsRes.rows[0].count > 0 
        ? (parseInt(successfulSyncsRes.rows[0].count, 10) / parseInt(totalSyncsRes.rows[0].count, 10)) * 100 
        : 0,
      totalJobsScraped: parseInt(totalJobsScrapedRes.rows[0].sum, 10) || 0,
      avgDurationMs: parseFloat(avgDurationRes.rows[0].avg) || 0,
      providers: providerStatsRes.rows.map(r => ({
        provider: r.provider_name,
        totalSyncs: parseInt(r.total_syncs, 10),
        successRate: r.total_syncs > 0 ? (parseInt(r.success_syncs, 10) / parseInt(r.total_syncs, 10)) * 100 : 0,
        totalFetched: parseInt(r.total_fetched, 10) || 0,
        totalParsed: parseInt(r.total_parsed, 10) || 0,
        totalSaved: parseInt(r.total_saved, 10) || 0,
        totalSkipped: parseInt(r.total_skipped, 10) || 0,
        avgDurationMs: parseFloat(r.avg_duration_ms) || 0
      }))
    };
  }
}
