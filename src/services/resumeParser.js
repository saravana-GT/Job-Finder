import { createRequire } from 'module';
import SkillExtractor from './skillExtractor.js';
import KeywordExtractor from './keywordExtractor.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

export class ResumeParser {
  /**
   * Extract raw text from file buffer.
   * @param {Buffer} fileBuffer
   * @param {string} fileName
   */
  async extractText(fileBuffer, fileName) {
    logger.info(`Extracting text from resume file: ${fileName}`, { module: 'resume-parser' });
    const extension = fileName.split('.').pop().toLowerCase();

    try {
      if (extension === 'pdf') {
        const instance = new PDFParse({ data: fileBuffer });
        const result = await instance.getText();
        return result.text || '';
      } else if (extension === 'docx') {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value || '';
      } else {
        throw new Error(`Unsupported file type: .${extension}. Only PDF and DOCX are supported.`);
      }
    } catch (error) {
      logger.error(`Failed to extract text from resume: ${fileName}`, { module: 'resume-parser', error });
      throw error;
    }
  }

  /**
   * Parse extracted raw text into structured resume metadata.
   * @param {string} text
   */
  parseStructuredContent(text) {
    logger.info('Parsing structured resume contents...', { module: 'resume-parser' });

    // 1. Extract skills using canonical SkillExtractor
    const allSkills = SkillExtractor.extractSkills(text);

    // Classify skills into types based on dictionaries
    const languagesDict = ['java', 'python', 'c++', 'javascript', 'typescript', 'sql', 'html', 'css', 'go', 'rust', 'ruby', 'php', 'kotlin', 'swift'];
    const frameworksDict = ['spring boot', 'react', 'next.js', 'node.js', 'express', 'angular', 'vue', 'django', 'flask', 'fastapi', 'spring', 'hibernate'];
    const databasesDict = ['mysql', 'postgresql', 'oracle', 'mongodb', 'redis', 'sqlite', 'dynamodb', 'cassandra', 'supabase'];
    const toolsDict = ['git', 'github', 'docker', 'kubernetes', 'aws', 'jenkins', 'jira', 'ci/cd', 'webpack', 'babel', 'maven'];

    const languages = [];
    const frameworks = [];
    const databases = [];
    const tools = [];
    const otherSkills = [];

    for (const skill of allSkills) {
      const lowerSkill = skill.toLowerCase();
      if (languagesDict.includes(lowerSkill)) {
        languages.push(skill);
      } else if (frameworksDict.includes(lowerSkill)) {
        frameworks.push(skill);
      } else if (databasesDict.includes(lowerSkill)) {
        databases.push(skill);
      } else if (toolsDict.includes(lowerSkill)) {
        tools.push(skill);
      } else {
        otherSkills.push(skill);
      }
    }

    // 2. Parse Years of Experience using KeywordExtractor
    const expObj = KeywordExtractor.parseExperience(text);
    const yearsOfExperience = expObj.min || 0;

    // 3. Extract Education details
    const education = [];
    const degrees = ['B.Tech', 'B.S.', 'M.S.', 'B.E.', 'M.Tech', 'MCA', 'MBA', 'Bachelor', 'Master', 'Ph.D'];
    for (const degree of degrees) {
      const regex = new RegExp(`([^\\n]*${degree}[^\\n]*)`, 'i');
      const match = text.match(regex);
      if (match) {
        education.push({ degree, detail: match[0].trim() });
      }
    }

    // 4. Extract Certifications
    const certifications = [];
    const certPatterns = ['AWS', 'Google Cloud', 'Azure', 'Oracle', 'Scrum', 'Certified', 'Cisco', 'CCNA', 'Java SE'];
    for (const pattern of certPatterns) {
      const regex = new RegExp(`([^\\n]*${pattern}[^\\n]*(?:Certification|Certified)[^\\n]*)`, 'i');
      const match = text.match(regex);
      if (match) {
        certifications.push(match[0].trim());
      }
    }

    // 5. Extract Projects
    const projects = [];
    const projRegex = /(?:project|portfolio|personal project)s?\b[\s\S]*?(?=\n\n|\n[A-Z][a-z]+:?|$)/gi;
    const projectMatches = text.match(projRegex) || [];
    projectMatches.forEach((projText, index) => {
      if (index < 5) {
        projects.push({ name: `Project ${index + 1}`, description: projText.trim().substring(0, 300) });
      }
    });

    // 6. Keywords
    const words = text.toLowerCase().split(/[^\w+-]+/).filter(w => w.length > 3);
    const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'your', 'about', 'their', 'there', 'which', 'skills', 'experience', 'projects', 'education']);
    const keywords = [...new Set(words.filter(w => !stopWords.has(w)))].slice(0, 30);

    // Target role heuristic: check first 3 lines or match popular roles
    const rolesDict = ['Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Fullstack Engineer', 'Frontend Developer', 'Backend Developer', 'Fullstack Developer', 'Data Scientist', 'DevOps Engineer', 'Android Developer', 'Intern'];
    let targetRole = 'Software Engineer';
    for (const role of rolesDict) {
      if (text.toLowerCase().includes(role.toLowerCase())) {
        targetRole = role;
        break;
      }
    }

    return {
      targetRole,
      primarySkills: allSkills.slice(0, 10),
      secondarySkills: allSkills.slice(10),
      projects,
      experience: [{ years: yearsOfExperience, description: 'Extracted history' }],
      education,
      certifications,
      keywords,
      tools,
      frameworks,
      languages,
      databases,
      achievements: []
    };
  }
}

export const resumeParser = new ResumeParser();
export default resumeParser;
