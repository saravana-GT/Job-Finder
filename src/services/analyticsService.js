import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class AnalyticsService {
  /**
   * Calculate summary placement performance analytics from database states.
   */
  async calculateAnalytics() {
    logger.info('Calculating application tracking analytics...', { module: 'analytics-service' });

    try {
      // 1. Total applications count
      const totalRes = await query('SELECT COUNT(*) FROM applications');
      const totalCount = parseInt(totalRes.rows[0]?.count || '0', 10);

      if (totalCount === 0) {
        return {
          totalApplications: 0,
          appliedCount: 0,
          interviewCount: 0,
          offerCount: 0,
          rejectionRate: 0,
          successRate: 0,
          averageAiScore: 0,
          platformWise: [],
          companyWise: []
        };
      }

      // 2. Applied Count (status = 'Applied' or status = 'applied')
      const appliedRes = await query('SELECT COUNT(*) FROM applications WHERE status ILIKE \'applied\'');
      const appliedCount = parseInt(appliedRes.rows[0]?.count || '0', 10);

      // 3. Interview Count (Scheduled, Completed, HR Round)
      const interviewRes = await query(`
        SELECT COUNT(*) FROM applications 
        WHERE status ILIKE 'Interview Scheduled' 
           OR status ILIKE 'Interview Completed' 
           OR status ILIKE 'HR Round'
      `);
      const interviewCount = parseInt(interviewRes.rows[0]?.count || '0', 10);

      // 4. Offer Count (Received, Accepted, Selected)
      const offerRes = await query(`
        SELECT COUNT(*) FROM applications 
        WHERE status ILIKE 'Offer Received' 
           OR status ILIKE 'Offer Accepted' 
           OR status ILIKE 'Selected'
      `);
      const offerCount = parseInt(offerRes.rows[0]?.count || '0', 10);

      // 5. Rejection Count (Rejected)
      const rejectRes = await query('SELECT COUNT(*) FROM applications WHERE status ILIKE \'rejected\'');
      const rejectCount = parseInt(rejectRes.rows[0]?.count || '0', 10);

      // 6. Rates calculations
      const rejectionRate = Math.round((rejectCount / totalCount) * 100);
      const successRate = Math.round((offerCount / totalCount) * 100);

      // 7. Average AI Score
      const avgScoreRes = await query(`
        SELECT AVG(j.ai_score) as average
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.ai_score IS NOT NULL
      `);
      const averageAiScore = Math.round(parseFloat(avgScoreRes.rows[0]?.average || '0'));

      // 8. Platform Wise Applications
      const platformRes = await query(`
        SELECT j.platform, COUNT(*) as count
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        GROUP BY j.platform
        ORDER BY count DESC
      `);
      const platformWise = platformRes.rows.map(r => ({ platform: r.platform, count: parseInt(r.count, 10) }));

      // 9. Company Wise Applications
      const companyRes = await query(`
        SELECT j.company, COUNT(*) as count
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        GROUP BY j.company
        ORDER BY count DESC
        LIMIT 10
      `);
      const companyWise = companyRes.rows.map(r => ({ company: r.company, count: parseInt(r.count, 10) }));

      // Fetch all jobs for daily ingestion counts and AI score distribution
      const jobsRes = await query('SELECT * FROM jobs');
      const allJobs = jobsRes.rows;

      // Fetch all applications with job details for daily application counts, resume usage, and conversions
      const appsRes = await query(`
        SELECT a.*, j.company, j.role, j.apply_url, j.ai_score, j.platform
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
      `);
      const allApps = appsRes.rows;

      // 10. Jobs Over Time
      const jobsOverTimeMap = {};
      allJobs.forEach(job => {
        const dateStr = new Date(job.posted_date || job.created_at).toISOString().split('T')[0];
        jobsOverTimeMap[dateStr] = (jobsOverTimeMap[dateStr] || 0) + 1;
      });
      const jobsOverTime = Object.entries(jobsOverTimeMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 11. Applications Over Time
      const appsOverTimeMap = {};
      allApps.forEach(app => {
        const dateStr = new Date(app.applied_at).toISOString().split('T')[0];
        appsOverTimeMap[dateStr] = (appsOverTimeMap[dateStr] || 0) + 1;
      });
      const applicationsOverTime = Object.entries(appsOverTimeMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 12. Resume Usage
      const resumeUsageMap = {};
      allApps.forEach(app => {
        const resume = app.resume_used || 'General Resume';
        resumeUsageMap[resume] = (resumeUsageMap[resume] || 0) + 1;
      });
      const resumeUsage = Object.entries(resumeUsageMap)
        .map(([resume, count]) => ({ resume, count }))
        .sort((a, b) => b.count - a.count);

      // 13. AI Score Distribution
      const scoreDist = { '<50': 0, '50-70': 0, '70-85': 0, '85-100': 0 };
      allJobs.forEach(job => {
        const score = job.ai_score || 0;
        if (score < 50) scoreDist['<50']++;
        else if (score < 70) scoreDist['50-70']++;
        else if (score < 85) scoreDist['70-85']++;
        else scoreDist['85-100']++;
      });
      const aiScoreDistribution = Object.entries(scoreDist).map(([range, count]) => ({ range, count }));

      // 14. Conversions
      const totalAppsCount = allApps.length;
      const interviewAppsCount = allApps.filter(app => 
        ['Interview Scheduled', 'Interview Completed', 'HR Round', 'Offer Received', 'Offer Accepted', 'Selected'].some(st => app.status.toLowerCase() === st.toLowerCase())
      ).length;
      const offerAppsCount = allApps.filter(app => 
        ['Offer Received', 'Offer Accepted', 'Selected'].some(st => app.status.toLowerCase() === st.toLowerCase())
      ).length;

      const interviewConversion = totalAppsCount > 0 ? Math.round((interviewAppsCount / totalAppsCount) * 100) : 0;
      const offerConversion = interviewAppsCount > 0 ? Math.round((offerAppsCount / interviewAppsCount) * 100) : 0;

      return {
        totalApplications: totalCount,
        appliedCount,
        interviewCount,
        offerCount,
        rejectionRate,
        successRate,
        averageAiScore,
        platformWise,
        companyWise,
        jobsOverTime,
        applicationsOverTime,
        resumeUsage,
        aiScoreDistribution,
        interviewConversion,
        offerConversion
      };
    } catch (error) {
      logger.error('Failed to calculate analytics metrics', { module: 'analytics-service', error });
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
