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

export class NaukriScraper extends BaseScraper {
  constructor() {
    super('Naukri', '1.0.0');
  }

  async fetchJobs() {
    return await this.fetch('https://naukri.com/jobs');
  }

  async parse(rawData) {
    if (!rawData) return [];

    const parsed = [];

    for (const item of rawData) {
      const { content, isJson, fileName } = item;
      logger.info(`[Naukri Parser] Parsing file: ${fileName}`, { module: 'scraper' });

      if (isJson) {
        try {
          const json = JSON.parse(content);
          // Naukri search API response parsing (standard JSON format)
          const jobs = json.jobDetails || json.jobs || json.data || [];
          for (const job of jobs) {
            parsed.push({
              id: job.jobId?.toString() || job.id?.toString(),
              title: job.title,
              company: job.companyName || job.company?.name || job.company,
              location: job.place || job.location || 'Onsite',
              salary: job.salary || job.ctc,
              skills: job.keySkills || job.skills || '',
              description: job.jobDescription || job.jd || '',
              url: job.jdUrl || job.url || `https://naukri.com/job-${job.jobId}`,
              logo: job.logo || job.companyLogo,
              deadline: job.deadlineDate || job.deadline,
              postedDate: job.postedDate || job.created_at
            });
          }
        } catch (err) {
          logger.error(`Failed to parse Naukri JSON file ${fileName}`, { module: 'scraper', error: err });
        }
      } else {
        try {
          const $ = cheerio.load(content);
          // Match standard Naukri search tuple card classes
          $('.jobTuple, .srp-jobtuple, .job-tuple').each((index, element) => {
            const el = $(element);
            const title = el.find('a.title, a.role, .job-title').text().trim();
            const company = el.find('a.subTitle, .companyName, .company-name').text().trim();
            const location = el.find('.loc, .location, .locations').text().trim();
            const salary = el.find('.sal, .salary, .salary-range').text().trim();
            const url = el.find('a.title, a.role, .job-link').first().attr('href') || '';
            const skills = el.find('.keySkills, .skills, .skills-list').text().trim();
            const id = url.split('-').pop() || `nk-${Date.now()}-${index}`;

            if (title && company) {
              parsed.push({
                id,
                title,
                company,
                location,
                salary,
                skills,
                description: `${title} role at ${company} (Naukri).`,
                url: url.startsWith('http') ? url : `https://naukri.com${url}`,
                logo: el.find('img').first().attr('src') || '',
                deadline: el.find('.deadline').text().trim(),
                postedDate: new Date().toISOString()
              });
            }
          });
        } catch (err) {
          logger.error(`Failed to parse Naukri HTML file ${fileName}`, { module: 'scraper', error: err });
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
      experience: '2-5 years',
      skills: normalizeSkills(job.skills),
      description: job.description || `${job.title} job at ${job.company}`,
      apply_url: job.url,
      posted_date: normalizeDate(job.postedDate),
      deadline: normalizeDate(job.deadline),
      logo: job.logo,
      category: 'General Jobs',
      ai_score: null
    }));
  }
}
export default NaukriScraper;
