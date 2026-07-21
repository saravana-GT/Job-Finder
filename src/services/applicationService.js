import { query } from '../database/connection.js';
import { historyService } from './historyService.js';
import { calendarService } from './calendarService.js';
import { logger } from '../utils/logger.js';

export class ApplicationService {
  /**
   * Create a new tracking card for a job match.
   */
  async createApplication(jobId, initialStatus = 'Discovered', resumeUsed = null, notes = null) {
    logger.info(`Creating application for job ID: ${jobId} [Status: ${initialStatus}]`, { module: 'application-service' });

    try {
      const sql = `
        INSERT INTO applications (job_id, status, resume_used, notes, applied_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const res = await query(sql, [jobId, initialStatus, resumeUsed, notes]);
      const app = res.rows[0];

      // Record initial history transition
      await historyService.recordTransition(app.id, null, initialStatus, 'Initial card creation');

      return app;
    } catch (error) {
      logger.error(`Failed to create application for job ID: ${jobId}`, { module: 'application-service', error });
      throw error;
    }
  }

  /**
   * Transition tracking card status and schedule automated calendar event mappings.
   */
  async updateApplicationStatus(id, newStatus, updateFields = {}) {
    logger.info(`Transitioning Application ID: ${id} to status: ${newStatus}`, { module: 'application-service' });

    try {
      // 1. Fetch current application state
      const fetchSql = 'SELECT * FROM applications WHERE id = $1';
      const fetchRes = await query(fetchSql, [id]);
      const currentApp = fetchRes.rows[0];

      if (!currentApp) {
        throw new Error(`Application with ID ${id} not found.`);
      }

      const prevStatus = currentApp.status;

      // 2. Perform DB update
      const {
        resumeUsed,
        coverLetterUsed,
        notes,
        interviewDate,
        interviewTime,
        assessmentDate,
        offerDeadline,
        salaryOffered,
        recruiterName,
        recruiterEmail,
        recruiterPhone,
        meetingLink
      } = updateFields;

      const updateSql = `
        UPDATE applications
        SET status = $2,
            resume_used = COALESCE($3, resume_used),
            cover_letter_used = COALESCE($4, cover_letter_used),
            notes = COALESCE($5, notes),
            interview_date = COALESCE($6, interview_date),
            interview_time = COALESCE($7, interview_time),
            assessment_date = COALESCE($8, assessment_date),
            offer_deadline = COALESCE($9, offer_deadline),
            salary_offered = COALESCE($10, salary_offered),
            recruiter_name = COALESCE($11, recruiter_name),
            recruiter_email = COALESCE($12, recruiter_email),
            recruiter_phone = COALESCE($13, recruiter_phone),
            meeting_link = COALESCE($14, meeting_link),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const params = [
        id,
        newStatus,
        resumeUsed,
        coverLetterUsed,
        notes,
        interviewDate,
        interviewTime,
        assessmentDate ? new Date(assessmentDate) : null,
        offerDeadline ? new Date(offerDeadline) : null,
        salaryOffered ? Number(salaryOffered) : null,
        recruiterName,
        recruiterEmail,
        recruiterPhone,
        meetingLink
      ];

      const res = await query(updateSql, params);
      const updatedApp = res.rows[0];

      // 3. Record history log
      if (prevStatus !== newStatus) {
        await historyService.recordTransition(id, prevStatus, newStatus, notes || 'Status updated');
      }

      // 4. Automated Calendar Mapping
      // If Assessment Scheduled
      if (newStatus === 'Assessment Scheduled' && assessmentDate) {
        await calendarService.createEvent(id, {
          title: `Assessment for Application #${id}`,
          description: `Assessment scheduled for job application. Notes: ${notes || ''}`,
          eventType: 'assessment',
          startTime: assessmentDate,
          meetingLink: meetingLink || ''
        });
      }

      // If Interview Scheduled
      if (newStatus === 'Interview Scheduled' && interviewDate) {
        // Construct start timestamp from date and time
        const timeStr = interviewTime || '10:00:00';
        const startTimestamp = new Date(`${interviewDate}T${timeStr}`);
        await calendarService.createEvent(id, {
          title: `Interview for Application #${id}`,
          description: `Interview scheduled with recruiter ${recruiterName || ''}. Notes: ${notes || ''}`,
          eventType: 'interview',
          startTime: startTimestamp,
          meetingLink: meetingLink || ''
        });
      }

      // If Offer Received
      if (newStatus === 'Offer Received' && offerDeadline) {
        await calendarService.createEvent(id, {
          title: `Offer Deadline for Application #${id}`,
          description: `Offer response deadline. Salary: ${salaryOffered || 'Competitive'}`,
          eventType: 'offer_deadline',
          startTime: offerDeadline
        });
      }

      return updatedApp;
    } catch (error) {
      logger.error(`Failed to update application ID: ${id}`, { module: 'application-service', error });
      throw error;
    }
  }

  /**
   * Automatically update tracking status for jobs when sync provider or integration updates.
   * Satisfies requirement: "When provider updates a job or Gmail integration is added later, status should update automatically. Architecture must already support this."
   */
  async autoUpdateJobStatus(jobId, newStatus, notes = 'Automated system update') {
    logger.info(`Automated status trigger called for Job ID: ${jobId} to status: ${newStatus}`, { module: 'application-service' });

    try {
      const sql = 'SELECT id FROM applications WHERE job_id = $1';
      const res = await query(sql, [jobId]);
      const app = res.rows[0];

      if (app) {
        // App exists, update it
        return await this.updateApplicationStatus(app.id, newStatus, { notes });
      } else {
        // Create new application in the new status
        return await this.createApplication(jobId, newStatus, null, notes);
      }
    } catch (error) {
      logger.error(`Failed auto updating job status for Job ID: ${jobId}`, { module: 'application-service', error });
    }
  }

  /**
   * Fetch all application cards.
   */
  async listApplications(limit = 100) {
    const sql = `
      SELECT a.*, j.company, j.role, j.apply_url, j.ai_score, j.platform
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.applied_at DESC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Alias for listApplications to satisfy getApplications controllers.
   */
  async getApplications(limit = 100) {
    return this.listApplications(limit);
  }
}

export const applicationService = new ApplicationService();
export default applicationService;
