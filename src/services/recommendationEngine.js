import { MatchingEngine } from './matchingEngine.js';
import { LearningSuggestionEngine } from './learningSuggestionEngine.js';
import { JobRepository } from '../repositories/jobRepository.js';
import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class RecommendationEngine {
  constructor() {
    this.jobRepository = new JobRepository();
  }

  /**
   * Generate a complete match report for a single job.
   * @param {Object} job Job object
   * @param {Object} profile User profile object
   */
  generateMatchReport(job, profile) {
    const match = MatchingEngine.calculateMatchScore(job, profile);
    const score = match.totalScore;

    let matchLevel = 'Low Match';
    let reasonForScore = 'Skip';

    if (score >= 90) {
      matchLevel = 'Excellent Match';
      reasonForScore = 'Apply Immediately';
    } else if (score >= 75) {
      matchLevel = 'Strong Match';
      reasonForScore = 'Recommended';
    } else if (score >= 50) {
      matchLevel = 'Average Match';
      reasonForScore = 'Consider Applying';
    } else {
      matchLevel = 'Low Match';
      reasonForScore = 'Skip';
    }

    const suggestions = LearningSuggestionEngine.getSuggestions(match.missingSkills);

    return {
      overallScore: score,
      matchLevel,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      suggestedLearningTopics: suggestions,
      reasonForScore,
      breakdown: match.breakdown
    };
  }

  /**
   * Recalculate AI match score for all active jobs in the database.
   * This is triggered in the background when the user updates their profile.
   * @param {Object} profile New user profile data
   */
  async recalculateAllJobScores(profile) {
    logger.info('Starting batch recalculation of AI match scores for all jobs...', { module: 'recommendation-engine' });
    const startTime = Date.now();

    // 1. Fetch all jobs from database
    // We can execute a select query directly to pull jobs.
    const selectSql = 'SELECT id, platform, company, role, location, employment_type, salary, experience, skills, description FROM jobs WHERE status = \'active\'';
    const res = await query(selectSql);
    const jobs = res.rows;

    logger.info(`Found ${jobs.length} active jobs to score.`, { module: 'recommendation-engine' });

    let updatedCount = 0;
    
    // Calculate and update in batches (or individual queries under transaction)
    // To satisfy Supabase connection pools and test mocks, we execute individual updates.
    for (const job of jobs) {
      try {
        const report = this.generateMatchReport(job, profile);
        
        const updateSql = 'UPDATE jobs SET ai_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        await query(updateSql, [report.overallScore, job.id]);
        updatedCount++;
      } catch (err) {
        logger.error(`Failed to update score for job ID: ${job.id}`, { module: 'recommendation-engine', error: err });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Completed batch recalculation. Scored and updated ${updatedCount}/${jobs.length} jobs in ${duration}ms.`, { module: 'recommendation-engine' });
    return {
      totalJobs: jobs.length,
      updatedJobs: updatedCount,
      durationMs: duration
    };
  }
}

export const recommendationEngine = new RecommendationEngine();
export default recommendationEngine;
