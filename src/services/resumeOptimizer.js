import { logger } from '../utils/logger.js';

export class ResumeOptimizer {
  /**
   * Compare resume keywords against job requirements.
   * @param {string[]} resumeKeywords
   * @param {string[]} jobKeywords
   */
  analyzeKeywords(resumeKeywords = [], jobKeywords = []) {
    logger.debug('Running keyword analysis...', { module: 'resume-optimizer' });

    const resumeSet = new Set(resumeKeywords.map(k => k.toLowerCase().trim()));
    const jobSet = new Set(jobKeywords.map(k => k.toLowerCase().trim()));

    const strongKeywords = [];
    const missingKeywords = [];
    const weakKeywords = [];

    // Find strong and missing
    for (const key of jobSet) {
      if (resumeSet.has(key)) {
        strongKeywords.push(key);
      } else {
        missingKeywords.push(key);
      }
    }

    // Weak keywords check (e.g. secondary skills or keywords that appear in resume but not in target role profile)
    for (const key of resumeSet) {
      if (!jobSet.has(key)) {
        weakKeywords.push(key);
      }
    }

    // Repeated keywords simulation (keywords appearing in resume metadata multiple times)
    const repeatedKeywords = [];
    const counts = {};
    for (const key of resumeKeywords) {
      const k = key.toLowerCase().trim();
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > 2 && !repeatedKeywords.includes(k)) {
        repeatedKeywords.push(k);
      }
    }

    return {
      strongKeywords,
      missingKeywords,
      weakKeywords: weakKeywords.slice(0, 10),
      repeatedKeywords
    };
  }

  /**
   * Suggest optimizations to maximize resume fit against a job description.
   * @param {object} resume Resume record
   * @param {object} job Job record
   */
  generateSuggestions(resume, job) {
    logger.info(`Generating optimization suggestions for resume ID: ${resume.id}`, { module: 'resume-optimizer' });

    const resumeSkills = new Set([
      ...(resume.primary_skills || []),
      ...(resume.secondary_skills || [])
    ].map(s => s.toLowerCase().trim()));

    const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim());
    const missingSkills = jobSkills.filter(s => !resumeSkills.has(s));

    // Keyword Analysis
    const keywordAnalysis = this.analyzeKeywords(resume.keywords, job.keywords || job.skills);

    // Project Suggestions
    const projectImprovements = [];
    if (missingSkills.includes('spring boot')) {
      projectImprovements.push('Build and document a Spring Boot REST API project demonstrating MVC, JPA, and security configurations.');
    }
    if (missingSkills.includes('react') || missingSkills.includes('next.js')) {
      projectImprovements.push('Add a modern frontend application project built with React/Next.js and styled with responsive components.');
    }
    if (projectImprovements.length === 0) {
      projectImprovements.push('Enhance project descriptions using the STAR method (Situation, Task, Action, Result) highlighting metrics.');
    }

    // Certifications suggestions
    const certificationSuggestions = [];
    if (resume.target_role?.toLowerCase().includes('backend') || missingSkills.includes('java')) {
      certificationSuggestions.push('Oracle Certified Professional: Java SE Developer.');
    }
    if (missingSkills.includes('aws') || missingSkills.includes('docker')) {
      certificationSuggestions.push('AWS Certified Developer - Associate.');
    }
    if (certificationSuggestions.length === 0) {
      certificationSuggestions.push('Certified Kubernetes Application Developer (CKAD).');
    }

    // Portfolio suggestions
    const portfolioSuggestions = [
      'Host your personal portfolio page on Vercel or GitHub Pages.',
      'Ensure contact details and links (LinkedIn, GitHub) are clickable and updated.'
    ];

    // GitHub suggestions
    const githubSuggestions = [
      'Pin top 3 coding repositories on your GitHub profile.',
      'Write clean README.md documentation for all listed repositories including screenshots and setup commands.'
    ];

    return {
      missingSkills,
      missingKeywords: keywordAnalysis.missingKeywords,
      projectImprovements,
      certificationSuggestions,
      portfolioSuggestions,
      githubSuggestions
    };
  }
}

export const resumeOptimizer = new ResumeOptimizer();
export default resumeOptimizer;
