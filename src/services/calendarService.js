import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class CalendarService {
  /**
   * Check if a calendar event has scheduled overlaps within +/- 30 minutes.
   * @param {number|null} eventId Event ID (to ignore self on updates)
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   */
  async detectConflicts(eventId, startTime, endTime) {
    const start = new Date(startTime);
    // Default end time to start + 1 hour if not specified
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);

    const safeEventId = eventId || -1;

    // Check +/- 30 minutes buffer overlap
    const checkStart = new Date(start.getTime() - 30 * 60 * 1000);
    const checkEnd = new Date(end.getTime() + 30 * 60 * 1000);

    try {
      const sql = `
        SELECT id, title, event_type, start_time, end_time
        FROM calendar_events
        WHERE id != $1 AND (
          (start_time < $3 AND COALESCE(end_time, start_time + INTERVAL '1 hour') > $2)
        )
      `;
      const res = await query(sql, [safeEventId, checkStart, checkEnd]);
      return res.rows;
    } catch (error) {
      logger.error('Failed checking event conflicts', { module: 'calendar-service', error });
      return [];
    }
  }

  /**
   * Create an internal calendar event and schedule its reminders.
   */
  async createEvent(applicationId, eventData) {
    const { title, description, eventType, startTime, endTime, meetingLink } = eventData;
    logger.info(`Creating calendar event: "${title}" [Type: ${eventType}] for App ID: ${applicationId}`, { module: 'calendar-service' });

    // Conflict detection
    const conflicts = await this.detectConflicts(null, startTime, endTime);
    if (conflicts.length > 0) {
      logger.warn(`Scheduling conflict detected for event "${title}". Conflicting count: ${conflicts.length}`, { module: 'calendar-service', conflicts });
    }

    try {
      const sql = `
        INSERT INTO calendar_events (application_id, title, description, event_type, start_time, end_time, meeting_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const res = await query(sql, [
        applicationId,
        title,
        description,
        eventType,
        new Date(startTime),
        endTime ? new Date(endTime) : null,
        meetingLink
      ]);
      const event = res.rows[0];

      // Automatically register reminders via ReminderService
      try {
        const { reminderService } = await import('./reminderService.js');
        await reminderService.scheduleRemindersForEvent(event);
      } catch (remErr) {
        logger.error('Failed to trigger automatic reminders creation for event', { module: 'calendar-service', error: remErr });
      }

      return { event, conflicts };
    } catch (error) {
      logger.error('Failed to create calendar event', { module: 'calendar-service', error });
      throw error;
    }
  }

  /**
   * Update calendar event details and re-evaluate reminder dates.
   */
  async updateEvent(id, updateData) {
    logger.info(`Updating calendar event ID: ${id}`, { module: 'calendar-service' });

    // If start/end times change, check conflicts
    let conflicts = [];
    if (updateData.startTime) {
      conflicts = await this.detectConflicts(id, updateData.startTime, updateData.endTime);
      if (conflicts.length > 0) {
        logger.warn(`Scheduling conflict detected during update for event ID: ${id}. Conflicting count: ${conflicts.length}`, { module: 'calendar-service', conflicts });
      }
    }

    try {
      const sql = `
        UPDATE calendar_events
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            event_type = COALESCE($4, event_type),
            start_time = COALESCE($5, start_time),
            end_time = COALESCE($6, end_time),
            meeting_link = COALESCE($7, meeting_link),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const res = await query(sql, [
        id,
        updateData.title,
        updateData.description,
        updateData.eventType,
        updateData.startTime ? new Date(updateData.startTime) : null,
        updateData.endTime ? new Date(updateData.endTime) : null,
        updateData.meetingLink
      ]);
      const event = res.rows[0];

      if (!event) throw new Error(`Event with ID ${id} not found.`);

      // Update reminders
      try {
        const { reminderService } = await import('./reminderService.js');
        await reminderService.scheduleRemindersForEvent(event);
      } catch (remErr) {
        logger.error('Failed to update scheduled reminders for event', { module: 'calendar-service', error: remErr });
      }

      return { event, conflicts };
    } catch (error) {
      logger.error(`Failed to update calendar event ID: ${id}`, { module: 'calendar-service', error });
      throw error;
    }
  }

  /**
   * Reschedule an event to new times.
   */
  async rescheduleEvent(id, startTime, endTime = null) {
    return await this.updateEvent(id, { startTime, endTime });
  }

  /**
   * Delete calendar event and associated reminders.
   */
  async deleteEvent(id) {
    logger.info(`Deleting calendar event ID: ${id}`, { module: 'calendar-service' });
    try {
      // Cascade delete is handled by database foreign keys ON DELETE CASCADE
      const sql = 'DELETE FROM calendar_events WHERE id = $1 RETURNING *';
      const res = await query(sql, [id]);
      return res.rows[0] || null;
    } catch (error) {
      logger.error(`Failed to delete calendar event ID: ${id}`, { module: 'calendar-service', error });
      throw error;
    }
  }

  /**
   * Fetch calendar events for an application.
   */
  async getEventsForApplication(applicationId) {
    const sql = 'SELECT * FROM calendar_events WHERE application_id = $1 ORDER BY start_time ASC';
    const res = await query(sql, [applicationId]);
    return res.rows;
  }
}

export const calendarService = new CalendarService();
export default calendarService;
