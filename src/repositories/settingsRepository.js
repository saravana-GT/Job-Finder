import { query } from '../database/connection.js';

export class SettingsRepository {
  /**
   * Get application settings.
   */
  async getSettings() {
    const sql = 'SELECT id, telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled FROM settings WHERE id = 1';
    const res = await query(sql);
    if (res.rows.length === 0) {
      // Fallback in case settings row is missing
      return {
        telegram_enabled: true,
        calendar_enabled: false,
        gmail_enabled: false,
        ai_enabled: true
      };
    }
    return res.rows[0];
  }

  /**
   * Update settings.
   */
  async updateSettings(settingsData) {
    const { telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled } = settingsData;
    const sql = `
      INSERT INTO settings (id, telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled)
      VALUES (1, $1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        telegram_enabled = EXCLUDED.telegram_enabled,
        calendar_enabled = EXCLUDED.calendar_enabled,
        gmail_enabled = EXCLUDED.gmail_enabled,
        ai_enabled = EXCLUDED.ai_enabled
      RETURNING *
    `;
    const res = await query(sql, [telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled]);
    return res.rows[0];
  }
}
