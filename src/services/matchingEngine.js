import { SkillExtractor } from './skillExtractor.js';
import { KeywordExtractor } from './keywordExtractor.js';
import { logger } from '../utils/logger.js';

export class MatchingEngine {
  /**
   * Calculate detailed scoring breakdown for a single job against user profile.
   * @param {Object} job Job listing object
   * @param {Object} profile User profile object
   */
  static calculateMatchScore(job, profile) {
    // Combine all user skills in lowercase
    const userSkills = new Set();
    const combineIntoUserSkills = (arr) => {
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item) userSkills.add(item.toLowerCase().trim());
        }
      }
    };
    combineIntoUserSkills(profile.skills);
    combineIntoUserSkills(profile.programming_languages);
    combineIntoUserSkills(profile.frameworks);
    combineIntoUserSkills(profile.databases);
    combineIntoUserSkills(profile.tools);

    // 1. Skills Match (40%)
    let skillsScore = 0;
    const jobSkills = SkillExtractor.getMergedSkills(job.skills, job.description || '', job.role || '');
    const matchedSkills = [];
    const missingSkills = [];

    if (jobSkills.length > 0) {
      for (const skill of jobSkills) {
        if (userSkills.has(skill.toLowerCase())) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      }
      skillsScore = (matchedSkills.length / jobSkills.length) * 40;
    } else {
      // Fallback: Check if description contains any user skills
      const detected = [];
      const userSkillsArr = Array.from(userSkills);
      for (const userSkill of userSkillsArr) {
        if ((job.description || '').toLowerCase().includes(userSkill)) {
          detected.push(userSkill);
        }
      }
      // If we match 5 or more user skills in description, full points
      skillsScore = Math.min((detected.length / 5) * 40, 40);
    }

    // 2. Role Match (20%)
    let roleScore = 0;
    const jobRole = (job.role || '').toLowerCase();
    const preferredRoles = (profile.preferred_roles || []).map(r => r.toLowerCase());

    let directRoleMatch = false;
    for (const pref of preferredRoles) {
      if (jobRole.includes(pref) || pref.includes(jobRole)) {
        directRoleMatch = true;
        break;
      }
    }

    if (directRoleMatch) {
      roleScore = 20;
    } else {
      // Partial role overlap (Developer/Engineer/Intern check)
      const commonKeywords = ['developer', 'engineer', 'analyst', 'programmer', 'intern', 'manager', 'lead'];
      let keywordOverlap = false;
      for (const kw of commonKeywords) {
        const userHasKw = preferredRoles.some(r => r.includes(kw));
        const jobHasKw = jobRole.includes(kw);
        if (userHasKw && jobHasKw) {
          keywordOverlap = true;
          break;
        }
      }
      roleScore = keywordOverlap ? 10 : 0;
    }

    // 3. Location Match (10%)
    let locationScore = 0;
    const jobLoc = (job.location || '').toLowerCase();
    const preferredLocs = (profile.preferred_locations || []).map(l => l.toLowerCase());

    const isRemotePref = preferredLocs.includes('remote');
    const isHybridPref = preferredLocs.includes('hybrid');

    const matchesPrefLoc = preferredLocs.some(loc => jobLoc.includes(loc));

    if (matchesPrefLoc) {
      locationScore = 10;
    } else if (isRemotePref && (jobLoc.includes('remote') || jobLoc.includes('work from home') || jobLoc.includes('wfh'))) {
      locationScore = 10;
    } else if (isHybridPref && jobLoc.includes('hybrid')) {
      locationScore = 10;
    } else if (preferredLocs.length === 0) {
      locationScore = 10; // no preference means matches all
    } else {
      locationScore = 0;
    }

    // 4. Experience Match (10%)
    let expScore = 0;
    const userExp = Number(profile.years_of_experience) || 0;
    const parsedExp = KeywordExtractor.parseExperience(job.experience);

    if (userExp >= parsedExp.min && userExp <= parsedExp.max) {
      expScore = 10;
    } else if (Math.abs(userExp - parsedExp.min) <= 1 || Math.abs(userExp - parsedExp.max) <= 1) {
      // Close match (within 1 year margin)
      expScore = 5;
    } else {
      expScore = 0;
    }

    // 5. Employment Type Match (10%)
    let empScore = 0;
    const jobEmp = (job.employment_type || '').toLowerCase();
    const prefEmp = (profile.preferred_employment_type || '').toLowerCase();

    if (prefEmp === '' || jobEmp === '') {
      empScore = 10; // Default match if unspecified
    } else if (jobEmp.includes(prefEmp) || prefEmp.includes(jobEmp)) {
      empScore = 10;
    } else {
      empScore = 0;
    }

    // 6. Salary Match (10%)
    let salaryScore = 0;
    const userExpectedSalary = KeywordExtractor.parseUserExpectedSalary(profile.expected_salary);
    const parsedJobSalary = KeywordExtractor.parseSalary(job.salary);

    if (parsedJobSalary.isCompetitive || parsedJobSalary.max === null) {
      salaryScore = 7; // Competitive / Unspecified gets default passing score
    } else if (parsedJobSalary.max >= userExpectedSalary) {
      salaryScore = 10;
    } else if (parsedJobSalary.max >= userExpectedSalary * 0.8) {
      // Within 20% margin
      salaryScore = 5;
    } else {
      salaryScore = 0;
    }

    // Calculate total score out of 100
    const totalScore = Math.round(skillsScore + roleScore + locationScore + expScore + empScore + salaryScore);

    return {
      totalScore,
      breakdown: {
        skillsScore: Math.round(skillsScore),
        roleScore: Math.round(roleScore),
        locationScore: Math.round(locationScore),
        experienceScore: Math.round(expScore),
        employmentTypeScore: Math.round(empScore),
        salaryScore: Math.round(salaryScore)
      },
      matchedSkills,
      missingSkills
    };
  }
}
export default MatchingEngine;
