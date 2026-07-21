import { query, transaction } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class JobRepository {
  /**
   * List jobs with a limit.
   */
  async listJobs(limit = 10) {
    const sql = `
      SELECT id, platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, posted_date, deadline, ai_score, logo, source_id, category, status, created_at, updated_at
      FROM jobs
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Get jobs by platform.
   */
  async listJobsByPlatform(platform, limit = 100) {
    const sql = `
      SELECT * FROM jobs
      WHERE platform ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const res = await query(sql, [platform, limit]);
    return res.rows;
  }

  /**
   * Get jobs by company.
   */
  async listJobsByCompany(company, limit = 100) {
    const sql = `
      SELECT * FROM jobs
      WHERE company ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const res = await query(sql, [`%${company}%`, limit]);
    return res.rows;
  }

  /**
   * Get a job by ID.
   */
  async getJobById(id) {
    const sql = 'SELECT * FROM jobs WHERE id = $1';
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Create a single job. Prevents duplicate jobs by using apply_url UNIQUE constraint.
   */
  async createJob(jobData) {
    const {
      platform,
      company,
      role,
      location,
      employment_type,
      salary,
      experience,
      skills = [],
      description,
      apply_url,
      posted_date,
      deadline,
      ai_score,
      logo,
      source_id,
      category,
      status = 'active',
    } = jobData;

    const sql = `
      INSERT INTO jobs (
        platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, posted_date, deadline, ai_score, logo, source_id, category, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
      ON CONFLICT (apply_url) DO NOTHING
      RETURNING *
    `;

    const params = [
      platform,
      company,
      role,
      location,
      employment_type,
      salary,
      experience,
      skills,
      description,
      apply_url,
      posted_date ? new Date(posted_date) : null,
      deadline ? new Date(deadline) : null,
      ai_score,
      logo,
      source_id,
      category,
      status,
    ];

    const res = await query(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Insert multiple jobs inside a transaction.
   */
  async insertJobs(jobs) {
    return transaction(async (client) => {
      const inserted = [];
      for (const job of jobs) {
        const {
          platform, company, role, location, employment_type, salary, experience,
          skills = [], description, apply_url, posted_date, deadline, ai_score,
          logo, source_id, category, status = 'active'
        } = job;

        const sql = `
          INSERT INTO jobs (
            platform, company, role, location, employment_type, salary, experience, skills,
            description, apply_url, posted_date, deadline, ai_score, logo, source_id, category, status, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
          ON CONFLICT (apply_url) DO NOTHING
          RETURNING *
        `;

        const res = await client.query(sql, [
          platform, company, role, location, employment_type, salary, experience, skills,
          description, apply_url, posted_date ? new Date(posted_date) : null, deadline ? new Date(deadline) : null,
          ai_score, logo, source_id, category, status
        ]);

        if (res.rows[0]) {
          inserted.push(res.rows[0]);
        }
      }
      return inserted;
    });
  }

  /**
   * Update existing jobs inside a transaction.
   */
  async updateExistingJobs(jobs) {
    return transaction(async (client) => {
      const updated = [];
      for (const job of jobs) {
        const {
          platform, company, role, location, employment_type, salary, experience,
          skills = [], description, apply_url, posted_date, deadline, ai_score,
          logo, source_id, category, status = 'active'
        } = job;

        const sql = `
          UPDATE jobs
          SET
            company = $2,
            role = $3,
            location = $4,
            employment_type = $5,
            salary = $6,
            experience = $7,
            skills = $8,
            description = $9,
            posted_date = $10,
            deadline = $11,
            ai_score = $12,
            logo = $13,
            category = $14,
            status = $15,
            updated_at = CURRENT_TIMESTAMP
          WHERE platform = $1 AND source_id = $16
          RETURNING *
        `;

        const res = await client.query(sql, [
          platform, company, role, location, employment_type, salary, experience, skills,
          description, posted_date ? new Date(posted_date) : null, deadline ? new Date(deadline) : null,
          ai_score, logo, category, status, source_id
        ]);

        if (res.rows[0]) {
          updated.push(res.rows[0]);
        }
      }
      return updated;
    });
  }

  /**
   * Find duplicate job based on: platform, company, role, location, apply_url.
   */
  async findDuplicate({ platform, company, role, location, apply_url }) {
    const sql = `
      SELECT id FROM jobs 
      WHERE platform = $1 
        AND company = $2 
        AND role = $3 
        AND COALESCE(location, '') = COALESCE($4, '') 
        AND apply_url = $5
      LIMIT 1
    `;
    const res = await query(sql, [platform, company, role, location, apply_url]);
    return res.rows.length > 0;
  }

  /**
   * Find duplicate job based on platform and source_id.
   */
  async findDuplicateBySourceId(platform, source_id) {
    if (!source_id) return false;
    const sql = 'SELECT id FROM jobs WHERE platform = $1 AND source_id = $2 LIMIT 1';
    const res = await query(sql, [platform, source_id]);
    return res.rows.length > 0;
  }

  /**
   * Archive expired jobs by setting status to 'expired' if deadline is past.
   */
  async archiveExpiredJobs() {
    const sql = `
      UPDATE jobs
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE deadline < CURRENT_TIMESTAMP AND status != 'expired'
      RETURNING *
    `;
    const res = await query(sql);
    logger.info(`Archived ${res.rows.length} expired jobs`, { module: 'database' });
    return res.rows;
  }

  /**
   * Search jobs with rich filters and query parameters.
   */
  async searchJobs(filters = {}) {
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
    } = filters;

    let sql = 'SELECT * FROM jobs WHERE status = \'active\'';
    const params = [];
    let paramIndex = 1;

    if (company) {
      sql += ` AND company ILIKE $${paramIndex}`;
      params.push(`%${company}%`);
      paramIndex++;
    }
    if (role) {
      sql += ` AND role ILIKE $${paramIndex}`;
      params.push(`%${role}%`);
      paramIndex++;
    }
    if (location) {
      sql += ` AND location ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }
    if (skills) {
      // skills query: splits by comma and matches if any overlap
      const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
      sql += ` AND $${paramIndex}::text[] && skills`;
      params.push(skillsArray);
      paramIndex++;
    }
    if (platform) {
      sql += ` AND platform ILIKE $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }
    if (employment_type) {
      sql += ` AND employment_type = $${paramIndex}`;
      params.push(employment_type);
      paramIndex++;
    }
    if (remote === 'true' || remote === true) {
      sql += ` AND (location ILIKE '%remote%' OR employment_type ILIKE '%remote%')`;
    }
    if (internship === 'true' || internship === true) {
      sql += ` AND (employment_type ILIKE '%intern%' OR role ILIKE '%intern%')`;
    }
    if (full_time === 'true' || full_time === true) {
      sql += ` AND employment_type ILIKE '%full%time%'`;
    }
    if (experience) {
      sql += ` AND experience ILIKE $${paramIndex}`;
      params.push(`%${experience}%`);
      paramIndex++;
    }
    if (salary) {
      sql += ` AND salary ILIKE $${paramIndex}`;
      params.push(`%${salary}%`);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Collect statistics from the database.
   */
  async getStatistics() {
    const totalJobsRes = await query('SELECT COUNT(*) FROM jobs');
    const activeJobsRes = await query('SELECT COUNT(*) FROM jobs WHERE status = \'active\'');
    const jobsByPlatformRes = await query('SELECT platform, COUNT(*) FROM jobs GROUP BY platform');
    const jobsByLocationRes = await query('SELECT location, COUNT(*) FROM jobs GROUP BY location LIMIT 10');
    const jobsByEmpTypeRes = await query('SELECT employment_type, COUNT(*) FROM jobs GROUP BY employment_type');

    return {
      totalJobs: parseInt(totalJobsRes.rows[0].count, 10),
      activeJobs: parseInt(activeJobsRes.rows[0].count, 10),
      jobsByPlatform: jobsByPlatformRes.rows.map(r => ({ platform: r.platform, count: parseInt(r.count, 10) })),
      jobsByLocation: jobsByLocationRes.rows.map(r => ({ location: r.location, count: parseInt(r.count, 10) })),
      jobsByEmploymentType: jobsByEmpTypeRes.rows.map(r => ({ employmentType: r.employment_type, count: parseInt(r.count, 10) })),
    };
  }

  /**
   * Count total jobs in the database.
   */
  async countJobs() {
    const sql = 'SELECT COUNT(*) FROM jobs';
    const res = await query(sql);
    return parseInt(res.rows[0].count, 10);
  }

  /**
   * Count jobs posted today.
   */
  async countTodaysJobs() {
    const sql = `
      SELECT COUNT(*)
      FROM jobs
      WHERE posted_date >= CURRENT_DATE
    `;
    const res = await query(sql);
    return parseInt(res.rows[0].count, 10);
  }

  /**
   * Get active jobs with a minimum score, ordered by score descending.
   */
  async listJobsByMinScore(minScore, limit = 100) {
    const sql = `
      SELECT id, platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, posted_date, deadline, ai_score, logo, source_id, category, status, created_at, updated_at
      FROM jobs
      WHERE status = 'active' AND ai_score >= $1
      ORDER BY ai_score DESC, created_at DESC
      LIMIT $2
    `;
    const res = await query(sql, [minScore, limit]);
    return res.rows;
  }
}

