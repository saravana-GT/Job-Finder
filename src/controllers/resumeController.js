import { formatResponse, formatErrorResponse } from '../utils/formatter.js';
import { resumeService } from '../services/resumeService.js';

/**
 * POST /api/resumes
 * Upload and parse a new resume or update version of existing one.
 */
export async function uploadResume(req, res, next) {
  try {
    const { name, fileName, fileBase64, resumeId } = req.body;

    if (!fileName || !fileBase64) {
      return res.status(400).json(formatErrorResponse('Missing required parameters: fileName and fileBase64 (base64 string).', 400));
    }

    // Limit maximum upload size to 5MB (approx 7M base64 characters)
    if (fileBase64.length > 7000000) {
      return res.status(400).json(formatErrorResponse('File size exceeds the maximum limit of 5MB.', 400));
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');

    if (resumeId) {
      // Update version of existing profile
      const updated = await resumeService.updateResumeProfile(parseInt(resumeId, 10), fileBuffer, fileName);
      return res.json(formatResponse(updated, 'Resume updated successfully. New version registered.'));
    } else {
      // Create new profile
      if (!name) {
        return res.status(400).json(formatErrorResponse('Missing required parameter: name.', 400));
      }
      const resume = await resumeService.createResumeProfile(name, fileBuffer, fileName);
      return res.status(201).json(formatResponse(resume, 'Resume uploaded and parsed successfully.'));
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resumes/:id/rollback
 * Rollback to a specific target version.
 */
export async function rollbackResumeVersion(req, res, next) {
  try {
    const { id } = req.params;
    const { targetVersion } = req.body;

    const resumeId = parseInt(id, 10);
    const version = parseInt(targetVersion, 10);

    if (isNaN(resumeId) || isNaN(version)) {
      return res.status(400).json(formatErrorResponse('Invalid targetVersion or Resume ID.', 400));
    }

    const rolled = await resumeService.rollbackVersion(resumeId, version);
    res.json(formatResponse(rolled, `Resume successfully rolled back to version ${version}.`));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resumes
 * List all resume profiles.
 */
export async function listResumes(req, res, next) {
  try {
    const list = await resumeService.listResumes();
    res.json(formatResponse(list));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resumes/:id/versions
 * Get versions history list for a resume profile.
 */
export async function getResumeVersions(req, res, next) {
  try {
    const { id } = req.params;
    const resumeId = parseInt(id, 10);
    if (isNaN(resumeId)) {
      return res.status(400).json(formatErrorResponse('Invalid Resume ID.', 400));
    }

    const versions = await resumeService.getVersionsList(resumeId);
    res.json(formatResponse(versions));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/jobs/:jobId/resume-recommendation
 * Recommend the best resume profile matching the job requirements.
 */
export async function getBestResumeRecommendation(req, res, next) {
  try {
    const { jobId } = req.params;
    const parsedJobId = parseInt(jobId, 10);
    if (isNaN(parsedJobId)) {
      return res.status(400).json(formatErrorResponse('Invalid Job ID.', 400));
    }

    const recommendation = await resumeService.recommendBestResumeForJob(parsedJobId);
    res.json(formatResponse(recommendation));
  } catch (error) {
    next(error);
  }
}
