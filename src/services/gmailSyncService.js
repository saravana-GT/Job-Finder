import { google } from 'googleapis';
import { query } from '../database/connection.js';
import { googleOAuthService } from './googleOAuthService.js';
import { emailClassifier } from './emailClassifier.js';
import { gmailParser } from './gmailParser.js';
import { applicationService } from './applicationService.js';
import { googleCalendarService } from './googleCalendarService.js';
import { sendTelegramNotification } from '../telegram/bot.js';
import { logger } from '../utils/logger.js';

export class GmailSyncService {
  /**
   * Sync latest emails incrementally.
   */
  async syncEmails() {
    logger.info('Starting incremental Gmail sync...', { module: 'gmail-sync' });

    const client = await googleOAuthService.getAuthClient();
    if (!client) {
      logger.info('Gmail synchronization is disabled or unauthorized. Skipping sync.', { module: 'gmail-sync' });
      return;
    }

    try {
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Fetch last history ID/sync token
      const syncRes = await query("SELECT sync_token FROM google_sync_state WHERE service_name = 'gmail'");
      const lastHistoryId = syncRes.rows[0]?.sync_token;

      let messages = [];
      let newHistoryId = null;

      if (lastHistoryId) {
        logger.info(`Fetching history modifications starting from historyId: ${lastHistoryId}`, { module: 'gmail-sync' });
        try {
          const historyRes = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastHistoryId,
            maxResults: 100
          });
          
          newHistoryId = historyRes.data.historyId;
          const historyRecords = historyRes.data.history || [];
          for (const record of historyRecords) {
            if (record.messagesAdded) {
              for (const added of record.messagesAdded) {
                if (added.message) {
                  messages.push(added.message);
                }
              }
            }
          }
        } catch (err) {
          // If history ID is expired, fallback to full listing
          if (err.code === 404 || err.code === 410) {
            logger.warn('History ID expired. Falling back to default message listing.', { module: 'gmail-sync' });
            const listRes = await gmail.users.messages.list({
              userId: 'me',
              maxResults: 20
            });
            messages = listRes.data.messages || [];
            newHistoryId = listRes.data.messages?.[0]?.id; // simple fallback
          } else {
            throw err;
          }
        }
      } else {
        logger.info('No sync token found. Performing initial Gmail fetch.', { module: 'gmail-sync' });
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 20
        });
        messages = listRes.data.messages || [];
        if (messages.length > 0) {
          // Fetch full info of first message to get an approximate historyId
          const firstMsg = await gmail.users.messages.get({
            userId: 'me',
            id: messages[0].id
          });
          newHistoryId = firstMsg.data.historyId;
        }
      }

      // Deduplicate messages list
      const uniqueMsgIds = [...new Set(messages.map(m => m.id))];

      for (const msgId of uniqueMsgIds) {
        // Check if already processed
        const dupCheck = await query('SELECT 1 FROM processed_emails WHERE id = $1', [msgId]);
        if (dupCheck.rows.length > 0) continue;

        // Fetch full message details
        const msgDetails = await gmail.users.messages.get({
          userId: 'me',
          id: msgId
        });

        const headers = msgDetails.data.payload?.headers || [];
        const subject = (headers.find(h => h.name.toLowerCase() === 'subject')?.value || '');
        const sender = (headers.find(h => h.name.toLowerCase() === 'from')?.value || '');
        const bodyText = gmailParser.extractBodyText(msgDetails.data.payload);

        // Classification
        const classification = emailClassifier.classify(subject, bodyText);
        if (classification.category === 'Unrelated') {
          // Log unrelated emails and skip
          await query(
            `INSERT INTO processed_emails (id, thread_id, subject, sender, category, confidence_score, ats_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [msgId, msgDetails.data.threadId, subject, sender, 'Unrelated', 0, false]
          );
          continue;
        }

        // Extract metadata
        const metadata = gmailParser.parseMessage(msgDetails.data);

        // Store email details
        await query(
          `INSERT INTO processed_emails (id, thread_id, subject, sender, received_at, category, confidence_score, extracted_metadata, ats_updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            msgId,
            msgDetails.data.threadId,
            subject,
            sender,
            metadata.receivedAt,
            classification.category,
            classification.confidenceScore,
            JSON.stringify(metadata),
            true
          ]
        );

        // Trigger ATS progressions
        await this.progressApplicationState(metadata, classification.category);
      }

      // Update sync state historyId
      if (newHistoryId) {
        await query(
          `INSERT INTO google_sync_state (service_name, sync_token, last_synced_at)
           VALUES ('gmail', $1, CURRENT_TIMESTAMP)
           ON CONFLICT (service_name) DO UPDATE SET sync_token = EXCLUDED.sync_token, last_synced_at = CURRENT_TIMESTAMP`,
          [newHistoryId.toString()]
        );
      }

      logger.info('Gmail incremental sync successfully processed.', { module: 'gmail-sync' });
    } catch (error) {
      logger.error('Failed processing Gmail sync', { module: 'gmail-sync', error });
      throw error;
    }
  }

  /**
   * Transition ATS status based on email category and metadata.
   */
  async progressApplicationState(metadata, category) {
    const { company, role, date, time, timezone, meetingLink, recruiterName, recruiterEmail, recruiterPhone } = metadata;

    logger.info(`Transitioning ATS state for company: "${company}" and role: "${role}" on category: "${category}"`, { module: 'gmail-sync' });

    // Map email classification to target ATS state
    const categoryToStatusMap = {
      'Job Application Confirmation': 'Applied',
      'Online Assessment': 'Assessment Scheduled',
      'Interview Invitation': 'Interview Scheduled',
      'HR Discussion': 'HR Round',
      'Offer Letter': 'Offer Received',
      'Rejection': 'Rejected',
      'Shortlisting': 'Interested',
      'Registration Confirmation': 'Discovered'
    };

    const targetStatus = categoryToStatusMap[category];
    if (!targetStatus) return;

    try {
      // 1. Search for matching application
      const searchSql = `
        SELECT a.* FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.company ILIKE $1 AND j.role ILIKE $2
        LIMIT 1
      `;
      const searchRes = await query(searchSql, [`%${company}%`, `%${role}%`]);
      let app = searchRes.rows[0];

      // 2. If no application exists, create job and application records
      if (!app) {
        logger.info(`No matching application found. Auto-creating job and application card for "${company}" - "${role}"`, { module: 'gmail-sync' });
        const jobSql = `
          INSERT INTO jobs (platform, company, role, apply_url, description)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;
        const jobRes = await query(jobSql, [
          metadata.platform || 'Gmail Sync',
          company,
          role,
          meetingLink || 'http://localhost:3000',
          `Auto-created from synced email: ${metadata.subject}`
        ]);
        const jobId = jobRes.rows[0].id;

        const appSql = `
          INSERT INTO applications (job_id, status)
          VALUES ($1, 'Discovered')
          RETURNING *
        `;
        const appRes = await query(appSql, [jobId]);
        app = appRes.rows[0];
      }

      // 3. Transition application status
      const previousStatus = app.status;
      await applicationService.updateApplicationStatus(
        app.id,
        targetStatus,
        {
          notes: `Status auto-updated by Gmail Sync on receiving email classified as "${category}".`
        }
      );

      // Save Recruiter contact details if extracted
      if (recruiterEmail || recruiterPhone) {
        await query(
          `UPDATE applications
           SET recruiter_name = COALESCE(recruiter_name, $2),
               recruiter_email = COALESCE(recruiter_email, $3),
               recruiter_phone = COALESCE(recruiter_phone, $4),
               meeting_link = COALESCE(meeting_link, $5)
           WHERE id = $1`,
          [app.id, recruiterName, recruiterEmail, recruiterPhone, meetingLink]
        );
      }

      // 4. Handle calendar scheduling for interviews/assessments
      let eventStartTime = null;
      if (date) {
        // Construct start date time
        const timeStr = time || '10:00 AM';
        const parsedDate = new Date(`${date} ${timeStr}`);
        if (!isNaN(parsedDate.getTime())) {
          eventStartTime = parsedDate.toISOString();
        }
      }

      if (eventStartTime) {
        let eventType = 'interview';
        let eventTitle = `Interview with ${company} (${role})`;
        if (category === 'Online Assessment') {
          eventType = 'assessment';
          eventTitle = `Online Assessment for ${company} (${role})`;
        }

        // Insert local calendar event
        const insertEventSql = `
          INSERT INTO calendar_events (application_id, title, description, event_type, start_time, end_time, meeting_link)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;
        const eventRes = await query(insertEventSql, [
          app.id,
          eventTitle,
          `Recruiter: ${recruiterName} (${recruiterEmail}). Event auto-scheduled by Gmail parser.`,
          eventType,
          eventStartTime,
          new Date(new Date(eventStartTime).getTime() + 60 * 60 * 1000).toISOString(), // default 1 hr duration
          meetingLink || ''
        ]);
        const newEventId = eventRes.rows[0].id;

        // Sync to Google Calendar
        try {
          await googleCalendarService.syncCalendarEvent(newEventId);
        } catch (calErr) {
          logger.error('Failed syncing calendar event to Google, skipping.', { module: 'gmail-sync', error: calErr });
        }
      }

      // 5. Send Telegram alert
      let alertMsg = '';
      if (targetStatus === 'Interview Scheduled') {
        alertMsg = `📅 *Interview Scheduled*\n\n🏢 *Company*: ${company}\n💼 *Role*: ${role}\n🕒 *Time*: ${date || ''} ${time || ''} (${timezone})\n🔗 *Meeting Link*: ${meetingLink || 'None'}\n👤 *Recruiter*: ${recruiterName} (${recruiterEmail})`;
      } else if (category === 'Online Assessment') {
        alertMsg = `📝 *Online Assessment Scheduled*\n\n🏢 *Company*: ${company}\n💼 *Role*: ${role}\n⏳ *Deadline/Time*: ${date || ''} ${time || ''}`;
      } else if (targetStatus === 'Offer Received') {
        alertMsg = `🎉 *Offer Received!*\n\n🏢 *Company*: ${company}\n💼 *Role*: ${role}\nExpiry Date: ${metadata.offerExpiry || 'Not specified'}`;
      } else if (targetStatus === 'Rejected') {
        alertMsg = `😔 *Application Status Update*\n\nUnfortunately, your application with *${company}* for the *${role}* role is not moving forward. Keep head high and stay motivated!`;
      } else if (previousStatus !== targetStatus) {
        alertMsg = `🔄 *ATS Status Progression*\n\n🏢 *Company*: ${company}\n💼 *Role*: ${role}\nTransitioned: \`${previousStatus}\` ➔ \`${targetStatus}\``;
      }

      if (alertMsg) {
        await sendTelegramNotification(alertMsg);
      }
    } catch (error) {
      logger.error(`Failed to progress application state for email ID: ${metadata.subject}`, { module: 'gmail-sync', error });
    }
  }
}

export const gmailSyncService = new GmailSyncService();
export default gmailSyncService;
