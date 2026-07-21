import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';
import {
  getApplications,
  getCompanies,
  getDeadlines,
  getJobs,
  getSummary,
} from '../controllers/placeholderController.js';
import {
  getLatestJobs,
  getJobsByPlatform,
  getJobsByCompany,
  searchJobs,
  getStatistics,
  getRecommendedJobs,
  getHighScoreJobs,
  getJobMatchReport,
} from '../controllers/jobController.js';
import {
  getProviders,
  getProviderByName,
  getProviderHealth,
  getProviderStatistics,
  triggerProviderSync,
} from '../controllers/providerController.js';
import {
  getProfile,
  updateProfile,
} from '../controllers/profileController.js';
import {
  getNotificationsSummary,
  getNotificationsHistory,
  updateNotificationSettings,
} from '../controllers/notificationController.js';
import {
  createApplicationCard,
  transitionApplicationStatus,
  getApplicationTimeline,
  getAnalyticsSummary,
  getReportsHistory,
} from '../controllers/atsController.js';
import {
  uploadResume,
  rollbackResumeVersion,
  listResumes,
  getResumeVersions,
  getBestResumeRecommendation,
} from '../controllers/resumeController.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  triggerGoogleSync,
} from '../controllers/googleController.js';
import {
  getCalendarEvents,
  getCalendarReminders
} from '../controllers/calendarController.js';

const router = Router();

// General Health Check
router.get('/health', healthController);

// Phase 1 Routes
router.get('/jobs', getJobs);
router.get('/summary', getSummary);
router.get('/companies', getCompanies);
router.get('/applications', getApplications);
router.get('/deadlines', getDeadlines);

// Phase 2 Job Ingestion & Discovery Routes
router.get('/jobs/latest', getLatestJobs);
router.get('/jobs/platform/:name', getJobsByPlatform);
router.get('/jobs/company/:company', getJobsByCompany);
router.get('/jobs/search', searchJobs);
router.get('/jobs/statistics', getStatistics);

// Phase 3 Provider Management & Health Routes
router.get('/providers', getProviders);
router.get('/providers/statistics', getProviderStatistics);
router.get('/providers/:name', getProviderByName);
router.get('/providers/:name/health', getProviderHealth);
router.post('/providers/:name/sync', triggerProviderSync);

// Phase 5 AI Matching & Recommendation Routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/jobs/recommended', getRecommendedJobs);
router.get('/jobs/high-score', getHighScoreJobs);
router.get('/jobs/match/:id', getJobMatchReport);

// Phase 5 Smart Notification Routes
router.get('/notifications', getNotificationsSummary);
router.get('/notifications/history', getNotificationsHistory);
router.put('/settings', updateNotificationSettings);

// Phase 6 ATS Routes
router.post('/applications', createApplicationCard);
router.put('/applications/:id/status', transitionApplicationStatus);
router.get('/applications/:id/timeline', getApplicationTimeline);
router.get('/analytics', getAnalyticsSummary);
router.get('/reports', getReportsHistory);

// Phase 7 Resume Engine Routes
router.post('/resumes', uploadResume);
router.post('/resumes/:id/rollback', rollbackResumeVersion);
router.get('/resumes', listResumes);
router.get('/resumes/:id/versions', getResumeVersions);
router.get('/jobs/:jobId/resume-recommendation', getBestResumeRecommendation);

// Phase 8 Google Sync Routes
router.get('/google/auth-url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.post('/google/sync', triggerGoogleSync);

// Phase 9 Calendar & Reminders Routes
router.get('/calendar/events', getCalendarEvents);
router.get('/calendar/reminders', getCalendarReminders);

export default router;
