import { google } from 'googleapis';
import { query } from '../database/connection.js';
import { googleOAuthService } from './googleOAuthService.js';
import { calendarService } from './calendarService.js';
import { logger } from '../utils/logger.js';

export class GoogleCalendarService {
  /**
   * Synchronize an internal calendar event to Google Calendar.
   * If the event already has google_event_id, updates it; otherwise inserts it.
   */
  async syncCalendarEvent(eventId) {
    logger.info(`Syncing event ID: ${eventId} with Google Calendar`, { module: 'google-calendar' });

    const client = await googleOAuthService.getAuthClient();
    if (!client) {
      logger.info('Google Calendar integration is disabled or unauthorized. Skipping sync.', { module: 'google-calendar' });
      return null;
    }

    try {
      const dbRes = await query('SELECT * FROM calendar_events WHERE id = $1', [eventId]);
      const event = dbRes.rows[0];
      if (!event) throw new Error(`Internal Event ID ${eventId} not found.`);

      // Conflict detection warning
      const durationMs = (event.end_time ? new Date(event.end_time) : new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000)) - new Date(event.start_time);
      const conflicts = await calendarService.detectConflicts(
        event.id,
        event.start_time,
        new Date(new Date(event.start_time).getTime() + durationMs).toISOString()
      );

      if (conflicts.length > 0) {
        logger.warn(`Scheduling conflict detected for event "${event.title}" on start: ${event.start_time}`, { module: 'google-calendar' });
      }

      const calendar = google.calendar({ version: 'v3', auth: client });

      const resource = {
        summary: event.title,
        description: event.description || '',
        start: {
          dateTime: new Date(event.start_time).toISOString(),
          timeZone: 'Asia/Kolkata'
        },
        end: {
          dateTime: event.end_time ? new Date(event.end_time).toISOString() : new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'Asia/Kolkata'
        },
        location: event.meeting_link || ''
      };

      if (event.google_event_id) {
        // Update existing Google Calendar event
        await calendar.events.update({
          calendarId: 'primary',
          eventId: event.google_event_id,
          requestBody: resource
        });
        logger.info(`Updated Google Calendar event ID: ${event.google_event_id}`, { module: 'google-calendar' });
        return event.google_event_id;
      } else {
        // Insert new Google Calendar event
        const insertRes = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: resource
        });
        const googleEventId = insertRes.data.id;

        // Save Google Event ID back to database
        await query('UPDATE calendar_events SET google_event_id = $1 WHERE id = $2', [googleEventId, event.id]);
        logger.info(`Created Google Calendar event ID: ${googleEventId}`, { module: 'google-calendar' });
        return googleEventId;
      }
    } catch (error) {
      logger.error(`Failed to sync calendar event ID: ${eventId}`, { module: 'google-calendar', error });
      throw error;
    }
  }

  /**
   * Delete calendar event from Google Calendar and database.
   */
  async deleteCalendarEvent(googleEventId) {
    logger.info(`Deleting event from Google Calendar: ${googleEventId}`, { module: 'google-calendar' });

    const client = await googleOAuthService.getAuthClient();
    if (!client) return;

    try {
      const calendar = google.calendar({ version: 'v3', auth: client });
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId
      });
      logger.info(`Successfully deleted Google Calendar event: ${googleEventId}`, { module: 'google-calendar' });
    } catch (error) {
      // If event was already deleted directly on Google Calendar, ignore the error
      if (error.code !== 410 && error.code !== 404) {
        logger.error(`Failed deleting Google Calendar event: ${googleEventId}`, { module: 'google-calendar', error });
        throw error;
      }
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
