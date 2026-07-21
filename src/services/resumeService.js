import { query } from '../database/connection.js';
import { resumeParser } from './resumeParser.js';
import { resumeMatcher } from './resumeMatcher.js';
import { resumeOptimizer } from './resumeOptimizer.js';
import { logger } from '../utils/logger.js';

export class ResumeService {
  /**
   * Upload and parse a new resume profile.
   */
  async createResumeProfile(name, fileBuffer, fileName) {
    logger.info(`Creating new resume profile: "${name}" from file: ${fileName}`, { module: 'resume-service' });

    try {
      const rawText = await resumeParser.extractText(fileBuffer, fileName);
      const parsed = resumeParser.parseStructuredContent(rawText);

      // Insert profile record
      const resumeSql = `
        INSERT INTO resumes (name, target_role, version, primary_skills, secondary_skills, projects, experience, education, certifications, keywords)
        VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const resumeRes = await query(resumeSql, [
        name,
        parsed.targetRole,
        parsed.primarySkills,
        parsed.secondarySkills,
        JSON.stringify(parsed.projects),
        JSON.stringify(parsed.experience),
        JSON.stringify(parsed.education),
        parsed.certifications,
        parsed.keywords
      ]);
      const resume = resumeRes.rows[0];

      // Save initial version record
      const versionSql = `
        INSERT INTO resume_versions (resume_id, version, parsed_content, metadata, file_name)
        VALUES ($1, 1, $2, $3, $4)
        RETURNING *
      `;
      await query(versionSql, [
        resume.id,
        rawText,
        JSON.stringify(parsed),
        fileName
      ]);

      return resume;
    } catch (error) {
      logger.error('Failed to create resume profile', { module: 'resume-service', error });
      throw error;
    }
  }

  /**
   * Upload an update to an existing resume profile, creating a new version.
   */
  async updateResumeProfile(id, fileBuffer, fileName) {
    logger.info(`Uploading update for resume ID: ${id} from file: ${fileName}`, { module: 'resume-service' });

    try {
      // 1. Fetch current profile version
      const fetchSql = 'SELECT version FROM resumes WHERE id = $1';
      const fetchRes = await query(fetchSql, [id]);
      const current = fetchRes.rows[0];

      if (!current) throw new Error(`Resume profile ID ${id} not found.`);

      const nextVersion = current.version + 1;

      // 2. Parse new file
      const rawText = await resumeParser.extractText(fileBuffer, fileName);
      const parsed = resumeParser.parseStructuredContent(rawText);

      // 3. Update profile record
      const updateSql = `
        UPDATE resumes
        SET target_role = $2,
            version = $3,
            primary_skills = $4,
            secondary_skills = $5,
            projects = $6,
            experience = $7,
            education = $8,
            certifications = $9,
            keywords = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const updateRes = await query(updateSql, [
        id,
        parsed.targetRole,
        nextVersion,
        parsed.primarySkills,
        parsed.secondarySkills,
        JSON.stringify(parsed.projects),
        JSON.stringify(parsed.experience),
        JSON.stringify(parsed.education),
        parsed.certifications,
        parsed.keywords
      ]);
      const updatedResume = updateRes.rows[0];

      // 4. Save new version history
      const versionSql = `
        INSERT INTO resume_versions (resume_id, version, parsed_content, metadata, file_name)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await query(versionSql, [
        id,
        nextVersion,
        rawText,
        JSON.stringify(parsed),
        fileName
      ]);

      return updatedResume;
    } catch (error) {
      logger.error(`Failed to update resume profile ID: ${id}`, { module: 'resume-service', error });
      throw error;
    }
  }

  /**
   * Rollback a resume profile to a previous version record.
   */
  async rollbackVersion(resumeId, targetVersion) {
    logger.info(`Rolling back resume ID: ${resumeId} to version: ${targetVersion}`, { module: 'resume-service' });

    try {
      // 1. Fetch target version details
      const versionSql = 'SELECT * FROM resume_versions WHERE resume_id = $1 AND version = $2';
      const versionRes = await query(versionSql, [resumeId, targetVersion]);
      const versionRecord = versionRes.rows[0];

      if (!versionRecord) {
        throw new Error(`Target version ${targetVersion} not found for resume ID ${resumeId}.`);
      }

      const parsed = typeof versionRecord.metadata === 'string' ? JSON.parse(versionRecord.metadata) : versionRecord.metadata;

      // 2. Update profile state
      const updateSql = `
        UPDATE resumes
        SET target_role = $2,
            version = $3,
            primary_skills = $4,
            secondary_skills = $5,
            projects = $6,
            experience = $7,
            education = $8,
            certifications = $9,
            keywords = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const updateRes = await query(updateSql, [
        resumeId,
        parsed.targetRole,
        targetVersion,
        parsed.primarySkills,
        parsed.secondarySkills,
        JSON.stringify(parsed.projects),
        JSON.stringify(parsed.experience),
        JSON.stringify(parsed.education),
        parsed.certifications,
        parsed.keywords
      ]);

      return updateRes.rows[0];
    } catch (error) {
      logger.error(`Failed rolling back resume ID: ${resumeId}`, { module: 'resume-service', error });
      throw error;
    }
  }

  /**
   * Recommend the best matched resume for a given job.
   */
  async recommendBestResumeForJob(jobId) {
    logger.info(`Recommending best resume for job ID: ${jobId}`, { module: 'resume-service' });

    try {
      // 1. Fetch job details
      const jobSql = 'SELECT * FROM jobs WHERE id = $1';
      const jobRes = await query(jobSql, [jobId]);
      const job = jobRes.rows[0];

      if (!job) throw new Error(`Job ID ${jobId} not found.`);

      // 2. Fetch all resumes
      const resumesSql = 'SELECT * FROM resumes';
      const resumesRes = await query(resumesSql);
      const resumes = resumesRes.rows;

      if (resumes.length === 0) {
        return {
          message: 'No resume profiles uploaded yet. Please upload a resume first.',
          bestResume: null,
          secondBestResume: null
        };
      }

      const results = [];
      for (const resume of resumes) {
        const compareResult = await resumeMatcher.compare(resume, job);
        results.push({
          resume,
          match: compareResult
        });
      }

      // Sort descending by match score
      results.sort((a, b) => b.match.overall_match_score - a.match.overall_match_score);

      const best = results[0];
      const secondBest = results.length > 1 ? results[1] : null;

      // Run keyword optimization checklist for the best match
      const suggestions = resumeOptimizer.generateSuggestions(best.resume, job);

      // Cache matching score in DB
      const cacheSql = `
        INSERT INTO resume_scores (
          resume_id, job_id, skill_match_score, keyword_match_score, role_match_score,
          experience_match_score, tech_match_score, overall_match_score, confidence_score,
          match_reason, missing_skills, missing_keywords, suggested_improvements
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (resume_id, job_id) DO UPDATE SET
          skill_match_score = EXCLUDED.skill_match_score,
          keyword_match_score = EXCLUDED.keyword_match_score,
          role_match_score = EXCLUDED.role_match_score,
          experience_match_score = EXCLUDED.experience_match_score,
          tech_match_score = EXCLUDED.tech_match_score,
          overall_match_score = EXCLUDED.overall_match_score,
          confidence_score = EXCLUDED.confidence_score,
          match_reason = EXCLUDED.match_reason,
          missing_skills = EXCLUDED.missing_skills,
          missing_keywords = EXCLUDED.missing_keywords,
          suggested_improvements = EXCLUDED.suggested_improvements,
          created_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      await query(cacheSql, [
        best.resume.id,
        jobId,
        best.match.skill_match_score,
        best.match.keyword_match_score,
        best.match.role_match_score,
        best.match.experience_match_score,
        best.match.tech_match_score,
        best.match.overall_match_score,
        best.match.confidence_score,
        best.match.match_reason,
        best.match.missing_skills,
        best.match.missing_keywords,
        best.match.suggested_improvements
      ]);

      return {
        bestResume: {
          id: best.resume.id,
          name: best.resume.name,
          targetRole: best.resume.target_role,
          overallMatchScore: best.match.overall_match_score,
          confidenceScore: best.match.confidence_score,
          reason: best.match.match_reason,
          missingKeywords: best.match.missing_keywords,
          missingSkills: best.match.missing_skills,
          suggestedImprovements: suggestions
        },
        secondBestResume: secondBest ? {
          id: secondBest.resume.id,
          name: secondBest.resume.name,
          overallMatchScore: secondBest.match.overall_match_score
        } : null
      };
    } catch (error) {
      logger.error(`Failed to recommend resume for job ID: ${jobId}`, { module: 'resume-service', error });
      throw error;
    }
  }

  /**
   * Fetch all resumes.
   */
  async listResumes() {
    const res = await query('SELECT * FROM resumes ORDER BY updated_at DESC');
    return res.rows;
  }

  /**
   * Fetch version history list for a resume profile.
   */
  async getVersionsList(resumeId) {
    const res = await query('SELECT id, version, file_name, created_at FROM resume_versions WHERE resume_id = $1 ORDER BY version DESC', [resumeId]);
    return res.rows;
  }
}

export const resumeService = new ResumeService();
export default resumeService;
