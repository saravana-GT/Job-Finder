import { formatResponse, formatErrorResponse } from '../utils/formatter.js';
import { applicationService } from '../services/applicationService.js';
import { timelineService } from '../services/timelineService.js';
import { analyticsService } from '../services/analyticsService.js';
import { reportService } from '../services/reportService.js';

/**
 * POST /api/applications
 * Create a new job tracking card.
 */
export async function createApplicationCard(req, res, next) {
  try {
    const { jobId, status, resumeUsed, notes } = req.body;
    if (!jobId) {
      return res.status(400).json(formatErrorResponse('Missing required parameter: jobId.', 400));
    }
    const app = await applicationService.createApplication(jobId, status || 'Discovered', resumeUsed, notes);
    res.status(201).json(formatResponse(app, 'Application tracking card created.'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/applications/:id/status
 * Transition state and update recruiter, meeting links, or schedules.
 */
export async function transitionApplicationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const appId = parseInt(id, 10);
    if (isNaN(appId)) {
      return res.status(400).json(formatErrorResponse('Invalid Application ID.', 400));
    }

    const { status, ...updateFields } = req.body;
    if (!status) {
      return res.status(400).json(formatErrorResponse('Missing required parameter: status.', 400));
    }

    const updated = await applicationService.updateApplicationStatus(appId, status, updateFields);
    res.json(formatResponse(updated, 'Application status updated and timeline transition logged.'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/applications/:id/timeline
 * View the audit timeline history of status transitions.
 */
export async function getApplicationTimeline(req, res, next) {
  try {
    const { id } = req.params;
    const appId = parseInt(id, 10);
    if (isNaN(appId)) {
      return res.status(400).json(formatErrorResponse('Invalid Application ID.', 400));
    }

    const timeline = await timelineService.getApplicationTimeline(appId);
    res.json(formatResponse(timeline));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics
 * Retrieve current summaries and rates.
 */
export async function getAnalyticsSummary(req, res, next) {
  try {
    const analytics = await analyticsService.calculateAnalytics();
    res.json(formatResponse(analytics));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports
 * Retrieve generated Daily, Weekly, and Monthly reports list.
 */
export async function getReportsHistory(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const list = await reportService.getReportsList(limit);
    res.json(formatResponse(list));
  } catch (error) {
    next(error);
  }
}
