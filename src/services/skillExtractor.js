import { logger } from '../utils/logger.js';

export class SkillExtractor {
  static get SkillsDictionary() {
    return [
      // Languages
      'javascript', 'typescript', 'python', 'java', 'kotlin', 'scala', 'go', 'golang',
      'rust', 'ruby', 'php', 'c++', 'c#', 'swift', 'objective-c', 'sql', 'html', 'css', 'sass', 'less',
      // Frameworks
      'react', 'angular', 'vue', 'next.js', 'nextjs', 'nuxt.js', 'express', 'nestjs', 'fastify', 'spring boot', 'spring',
      'django', 'flask', 'rails', 'laravel', 'asp.net', 'node.js', 'nodejs', 'svelte',
      // Databases
      'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'sqlite', 'cassandra', 'elasticsearch', 'dynamodb', 'mariadb', 'oracle',
      // Cloud & DevOps
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'gitlab ci', 'github actions', 'terraform', 'ansible',
      // Tools & Concepts
      'git', 'github', 'gitlab', 'bitbucket', 'jira', 'rest apis', 'restful apis', 'graphql', 'grpc', 'web sockets',
      'problem solving', 'dsa', 'oop', 'data structures', 'algorithms', 'object oriented programming',
      'agile', 'scrum', 'ci/cd', 'machine learning', 'artificial intelligence', 'data science', 'testing', 'jest', 'cypress', 'mocha', 'selenium'
    ];
  }

  /**
   * Extract skills from description and title by checking text against common skills dictionary.
   * @param {string} text Description, title, or combined text
   */
  static extractSkills(text) {
    if (!text || typeof text !== 'string') return [];
    
    const extracted = new Set();
    const lowerText = text.toLowerCase();

    for (const skill of this.SkillsDictionary) {
      // Escape special characters for regex matching
      const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // Match exact word boundary, or check for specific multi-word patterns like 'rest apis'
      let pattern;
      if (skill === 'c++') {
        pattern = new RegExp('c\\+\\+(?![a-zA-Z])', 'i');
      } else if (skill === 'c#') {
        pattern = new RegExp('c#(?![a-zA-Z])', 'i');
      } else if (skill.includes('.') || skill.includes('/') || skill.includes(' ')) {
        pattern = new RegExp(escapedSkill, 'i');
      } else {
        pattern = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      }

      if (pattern.test(lowerText)) {
        // Map alias representations to canonical forms
        let canonicalName = skill;
        if (skill === 'golang') canonicalName = 'go';
        if (skill === 'nodejs') canonicalName = 'node.js';
        if (skill === 'nextjs') canonicalName = 'next.js';
        if (skill === 'postgres') canonicalName = 'postgresql';
        if (skill === 'restful apis') canonicalName = 'rest apis';
        if (skill === 'data structures' || skill === 'algorithms') canonicalName = 'dsa';
        if (skill === 'object oriented programming') canonicalName = 'oop';

        extracted.add(canonicalName);
      }
    }

    return Array.from(extracted);
  }

  /**
   * Combine already defined job skills with extracted skills.
   * @param {Array<string>|null} existingSkills 
   * @param {string} description 
   * @param {string} title 
   */
  static getMergedSkills(existingSkills, description = '', title = '') {
    const finalSet = new Set();

    // Clean existing skills
    if (Array.isArray(existingSkills)) {
      for (const skill of existingSkills) {
        if (skill && typeof skill === 'string' && skill.trim() !== '') {
          finalSet.add(skill.trim());
        }
      }
    }

    // Extract additional skills
    const combinedText = `${title} ${description}`;
    const extracted = this.extractSkills(combinedText);
    for (const skill of extracted) {
      // Find case-insensitive duplicate before adding
      let exists = false;
      for (const existing of finalSet) {
        if (existing.toLowerCase() === skill.toLowerCase()) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        // Map to Title Case or standard notation
        const formattedName = this.formatSkillName(skill);
        finalSet.add(formattedName);
      }
    }

    return Array.from(finalSet);
  }

  /**
   * Helper to format skill names nicely.
   */
  static formatSkillName(name) {
    const lower = name.toLowerCase();
    
    // Exact mapping for known casing
    const casingMap = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'kotlin': 'Kotlin',
      'scala': 'Scala',
      'go': 'Go',
      'rust': 'Rust',
      'ruby': 'Ruby',
      'php': 'PHP',
      'c++': 'C++',
      'c#': 'C#',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'spring boot': 'Spring Boot',
      'spring': 'Spring',
      'express': 'Express',
      'nestjs': 'NestJS',
      'next.js': 'Next.js',
      'node.js': 'Node.js',
      'mongodb': 'MongoDB',
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'redis': 'Redis',
      'sqlite': 'SQLite',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'aws': 'AWS',
      'azure': 'Azure',
      'gcp': 'GCP',
      'git': 'Git',
      'github': 'GitHub',
      'gitlab': 'GitLab',
      'rest apis': 'REST APIs',
      'graphql': 'GraphQL',
      'dsa': 'DSA',
      'oop': 'OOP',
      'problem solving': 'Problem Solving',
      'machine learning': 'Machine Learning',
      'testing': 'Testing',
      'jest': 'Jest',
      'ci/cd': 'CI/CD'
    };

    if (casingMap[lower]) {
      return casingMap[lower];
    }

    // Capitalize words
    return name
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
export default SkillExtractor;
