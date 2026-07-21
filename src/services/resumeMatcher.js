import { logger } from '../utils/logger.js';

export class ResumeMatcher {
  /**
   * Compare a parsed resume against a job and calculate detailed match scores.
   * @param {object} resume Resume record from database
   * @param {object} job Job record from database
   */
  async compare(resume, job) {
    logger.info(`Comparing resume ID: ${resume.id} against job ID: ${job.id}`, { module: 'resume-matcher' });

    // Ensure fields exist
    const resumeSkills = new Set([
      ...(resume.primary_skills || []),
      ...(resume.secondary_skills || [])
    ].map(s => s.toLowerCase().trim()));

    const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim());
    const resumeKeywords = new Set((resume.keywords || []).map(k => k.toLowerCase().trim()));
    const jobKeywords = (job.keywords || []).length > 0
      ? (job.keywords || []).map(k => k.toLowerCase().trim())
      : jobSkills; // Fallback to job skills if keywords are empty

    // 1. Skill Match Score (percentage of job skills present in resume)
    let skillScore = 100;
    const missingSkills = [];
    if (jobSkills.length > 0) {
      let matched = 0;
      for (const skill of jobSkills) {
        if (resumeSkills.has(skill)) {
          matched++;
        } else {
          missingSkills.push(skill);
        }
      }
      skillScore = Math.round((matched / jobSkills.length) * 100);
    }

    // 2. Keyword Match Score
    let keywordScore = 100;
    const missingKeywords = [];
    if (jobKeywords.length > 0) {
      let matched = 0;
      for (const keyword of jobKeywords) {
        if (resumeKeywords.has(keyword)) {
          matched++;
        } else {
          missingKeywords.push(keyword);
        }
      }
      keywordScore = Math.round((matched / jobKeywords.length) * 100);
    }

    // 3. Role Match Score
    let roleScore = 0;
    const resumeRole = (resume.target_role || '').toLowerCase();
    const jobRole = (job.role || '').toLowerCase();
    if (resumeRole && jobRole) {
      if (jobRole.includes(resumeRole) || resumeRole.includes(jobRole)) {
        roleScore = 100;
      } else {
        // Token match
        const resumeTokens = resumeRole.split(/\s+/);
        const matchedTokens = resumeTokens.filter(t => t.length > 3 && jobRole.includes(t));
        roleScore = Math.round((matchedTokens.length / resumeTokens.length) * 100);
      }
    }

    // 4. Experience Match Score
    let expScore = 100;
    const resumeExpYears = resume.experience?.[0]?.years || 0;
    // Extract required years from job experience string (e.g. "0-2 years" or "3+ years")
    const match = (job.experience || '').match(/(\d+)/);
    const requiredYears = match ? parseInt(match[0], 10) : 0;
    if (resumeExpYears < requiredYears) {
      const diff = requiredYears - resumeExpYears;
      expScore = Math.max(0, 100 - diff * 20); // deduct 20% per missing year
    }

    // 5. Technology Match Score (checking databases, frameworks, languages)
    const techKeys = ['spring boot', 'react', 'next.js', 'node.js', 'mysql', 'postgresql', 'mongodb', 'docker', 'kubernetes', 'aws', 'git'];
    let techMatched = 0;
    let totalTechInJob = 0;
    for (const key of techKeys) {
      const jobHasTech = (job.skills || []).some(s => s.toLowerCase().includes(key)) || (job.description || '').toLowerCase().includes(key);
      if (jobHasTech) {
        totalTechInJob++;
        const resumeHasTech = resumeSkills.has(key) || (resume.keywords || []).some(k => k.toLowerCase().includes(key));
        if (resumeHasTech) {
          techMatched++;
        }
      }
    }
    const techScore = totalTechInJob > 0 ? Math.round((techMatched / totalTechInJob) * 100) : 100;

    // Overall match score (weighted)
    // Skills: 30%, Keywords: 20%, Role: 20%, Tech: 15%, Experience: 15%
    const overallScore = Math.round(
      skillScore * 0.3 +
      keywordScore * 0.2 +
      roleScore * 0.2 +
      techScore * 0.15 +
      expScore * 0.15
    );

    // Confidence Score
    const confidenceScore = Math.min(100, Math.round(overallScore * 0.95 + (resumeExpYears >= requiredYears ? 5 : 0)));

    // Match Reason
    let matchReason = `Strong match at ${overallScore}%. Resume contains key skills.`;
    if (overallScore < 50) {
      matchReason = `Weak match at ${overallScore}%. Missing critical role or skill requirements.`;
    } else if (overallScore < 75) {
      matchReason = `Moderate match at ${overallScore}%. Missing some tools or keywords.`;
    }

    // Suggested Improvements
    const suggestedImprovements = [];
    if (missingSkills.length > 0) {
      suggestedImprovements.push(`Add missing skills: ${missingSkills.slice(0, 4).join(', ')}`);
    }
    if (missingKeywords.length > 0) {
      suggestedImprovements.push(`Incorporate target keywords: ${missingKeywords.slice(0, 4).join(', ')}`);
    }
    if (resumeExpYears < requiredYears) {
      suggestedImprovements.push(`Highlight equivalent academic or personal project experience to offset missing ${requiredYears - resumeExpYears} years of experience.`);
    }

    return {
      skill_match_score: skillScore,
      keyword_match_score: keywordScore,
      role_match_score: roleScore,
      experience_match_score: expScore,
      tech_match_score: techScore,
      overall_match_score: overallScore,
      confidence_score: confidenceScore,
      match_reason: matchReason,
      missing_skills: missingSkills,
      missing_keywords: missingKeywords,
      suggested_improvements: suggestedImprovements
    };
  }
}

export const resumeMatcher = new ResumeMatcher();
export default resumeMatcher;
