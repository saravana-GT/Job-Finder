import * as cheerio from 'cheerio';
import { BaseScraper } from '../baseScraper.js';
import {
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSalary,
  normalizeDate,
  normalizeSkills
} from '../utils/normalizer.js';
import { logger } from '../../utils/logger.js';

export class WellfoundScraper extends BaseScraper {
  constructor() {
    super('Wellfound', '1.0.0');
  }

  async fetchJobs() {
    return await this.fetch('https://wellfound.com/jobs');
  }

  async parse(rawData) {
    if (!rawData) return [];

    const parsed = [];

    for (const item of rawData) {
      const { content, isJson, fileName } = item;
      logger.info(`[Wellfound Parser] Parsing file: ${fileName}`, { module: 'scraper' });

      if (isJson) {
        try {
          const json = JSON.parse(content);
          const jobs = json.jobs || json.data || [];
          for (const job of jobs) {
            parsed.push({
              id: job.id?.toString() || job.jobId?.toString(),
              title: job.title || job.jobTitle,
              company: job.company?.name || job.companyName || job.company,
              location: job.locations?.join(', ') || job.location || 'Remote',
              salary: job.salary || job.salaryRange,
              skills: job.skillsRequired || job.skills || '',
              description: job.description || job.jd || '',
              url: job.url || job.applyUrl || `https://wellfound.com/jobs/${job.id}`,
              logo: job.logo || job.logoUrl,
              deadline: job.deadline,
              postedDate: job.postedAt || job.postedAtDate
            });
          }
        } catch (err) {
          logger.error(`Failed to parse Wellfound JSON file ${fileName}`, { module: 'scraper', error: err });
        }
      } else {
        try {
          const $ = cheerio.load(content);
          // Match common classes/data attributes for Wellfound job listings
          $('[data-test="JobCard"], .job-card, .styles_jobCard__').each((index, element) => {
            const el = $(element);
            const title = el.find('[data-test="JobCard-title"], h4, .job-title').text().trim();
            const company = el.find('[data-test="JobCard-company"], .companyName, .company-name').text().trim();
            const location = el.find('[data-test="JobCard-location"], .location, .locations').text().trim();
            const salary = el.find('[data-test="JobCard-salary"], .salary, .salary-range').text().trim();
            const url = el.find('a[href*="/jobs/"]').first().attr('href') || '';
            const skills = el.find('.skills, .skills-list, [data-test="JobCard-skills"]').text().trim();
            const id = url.split('/').pop() || `wf-${Date.now()}-${index}`;

            if (title && company) {
              parsed.push({
                id,
                title,
                company,
                location,
                salary,
                skills,
                description: `${title} role at ${company} (Wellfound startup).`,
                url: url.startsWith('http') ? url : `https://wellfound.com${url}`,
                logo: el.find('img').first().attr('src') || '',
                deadline: el.find('.deadline').text().trim(),
                postedDate: new Date().toISOString()
              });
            }
          });
        } catch (err) {
          logger.error(`Failed to parse Wellfound HTML file ${fileName}`, { module: 'scraper', error: err });
        }
      }
    }

    return parsed;
  }

  async normalize(parsedJobs) {
    return parsedJobs.map((job) => ({
      source_id: job.id,
      role: job.title,
      company: job.company,
      location: normalizeLocation(job.location),
      employment_type: normalizeEmploymentType(job.title),
      salary: normalizeSalary(job.salary),
      experience: '1-3 years',
      skills: normalizeSkills(job.skills),
      description: job.description || `${job.title} job at startup ${job.company}`,
      apply_url: job.url,
      posted_date: normalizeDate(job.postedDate),
      deadline: normalizeDate(job.deadline),
      logo: job.logo,
      category: 'Startup Jobs',
      ai_score: null
    }));
  }
}
export default WellfoundScraper;
