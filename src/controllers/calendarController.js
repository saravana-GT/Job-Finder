import { query } from '../database/connection.js';
import { formatResponse } from '../utils/formatter.js';

/**
 * GET /api/calendar/events
 * Retrieve calendar event entries.
 */
export async function getCalendarEvents(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const dbRes = await query('SELECT * FROM calendar_events ORDER BY start_time ASC LIMIT $1', [limit]);
    res.json(formatResponse(dbRes.rows));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/calendar/reminders
 * Retrieve event reminders list.
 */
export async function getCalendarReminders(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const dbRes = await query('SELECT * FROM reminders ORDER BY reminder_time ASC LIMIT $1', [limit]);
    res.json(formatResponse(dbRes.rows));
  } catch (error) {
    next(error);
  }
}
