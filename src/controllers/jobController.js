import { formatResponse, formatErrorResponse } from '../utils/formatter.js';
import { JobRepository } from '../repositories/jobRepository.js';
import { profileService } from '../services/profileService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

const jobRepository = new JobRepository();

/**
 * GET /api/jobs/latest
 */
export async function getLatestJobs(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const jobs = await jobRepository.listJobs(limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/platform/:name
 */
export async function getJobsByPlatform(req, res, next) {
  try {
    const { name } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const jobs = await jobRepository.listJobsByPlatform(name, limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/company/:company
 */
export async function getJobsByCompany(req, res, next) {
  try {
    const { company } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const jobs = await jobRepository.listJobsByCompany(company, limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/search
 */
export async function searchJobs(req, res, next) {
  try {
    const {
      company,
      role,
      location,
      skills,
      platform,
      employment_type,
      remote,
      internship,
      full_time,
      experience,
      salary
    } = req.query;

    const filters = {
      company,
      role,
      location,
      skills,
      platform,
      employment_type,
      remote,
      internship,
      full_time,
      experience,
      salary
    };

    const jobs = await jobRepository.searchJobs(filters);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/statistics
 */
export async function getStatistics(req, res, next) {
  try {
    const stats = await jobRepository.getStatistics();
    res.json(formatResponse(stats));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/recommended
 */
export async function getRecommendedJobs(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    // Recommended jobs are defined as ai_score >= 75
    const jobs = await jobRepository.listJobsByMinScore(75, limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/high-score
 */
export async function getHighScoreJobs(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    // High score jobs are defined as ai_score >= 90
    const jobs = await jobRepository.listJobsByMinScore(90, limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/match/:id
 */
export async function getJobMatchReport(req, res, next) {
  try {
    const { id } = req.params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json(formatErrorResponse('Invalid job ID format.', 400));
    }

    const job = await jobRepository.getJobById(jobId);
    if (!job) {
      return res.status(404).json(formatErrorResponse(`Job with ID ${id} not found.`, 404));
    }

    const profile = await profileService.getProfile();
    const report = recommendationEngine.generateMatchReport(job, profile);
    res.json(formatResponse(report));
  } catch (error) {
    next(error);
  }
}

