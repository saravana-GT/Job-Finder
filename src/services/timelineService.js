import { historyService } from './historyService.js';
import { logger } from '../utils/logger.js';

export class TimelineService {
  /**
   * Returns a list of sequential transitions representing the timeline of the application.
   * @param {number} applicationId ID of the application card
   */
  async getApplicationTimeline(applicationId) {
    logger.debug(`Generating timeline tree for App ID: ${applicationId}`, { module: 'timeline-service' });

    try {
      const historyRows = await historyService.getHistoryForApplication(applicationId);

      // Build sequential steps
      const timeline = historyRows.map((entry) => ({
        status: entry.current_status,
        changedAt: entry.changed_at,
        notes: entry.notes || ''
      }));

      return {
        applicationId,
        timeline,
        currentStep: timeline[timeline.length - 1] || null
      };
    } catch (error) {
      logger.error(`Failed to compile timeline for App ID: ${applicationId}`, { module: 'timeline-service', error });
      throw error;
    }
  }
}

export const timelineService = new TimelineService();
export default timelineService;
