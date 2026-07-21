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

export class FounditScraper extends BaseScraper {
  constructor() {
    super('Foundit', '1.0.0');
  }

  async fetchJobs() {
    return await this.fetch('https://foundit.in/jobs');
  }

  async parse(rawData) {
    if (!rawData) return [];

    const parsed = [];

    for (const item of rawData) {
      const { content, isJson, fileName } = item;
      logger.info(`[Foundit Parser] Parsing file: ${fileName}`, { module: 'scraper' });

      if (isJson) {
        try {
          const json = JSON.parse(content);
          const listings = json.jobs || json.data || [];
          for (const listing of listings) {
            parsed.push({
              id: listing.id?.toString() || listing.jobId?.toString(),
              title: listing.title || listing.jobTitle || listing.job_title,
              company: listing.company?.name || listing.companyName || listing.company_name || listing.company,
              location: listing.location || listing.locations || 'Onsite',
              salary: listing.salary || listing.salaryRange || listing.salary_range,
              skills: listing.skills || listing.skills_tags || '',
              description: listing.description || listing.jd || listing.job_desc || '',
              url: listing.url || listing.applyUrl || listing.apply_url || `https://foundit.in/jobs/${listing.id}`,
              logo: listing.logo || listing.logoUrl || listing.logo_url,
              deadline: listing.deadline || listing.expire_on,
              postedDate: listing.postedDate || listing.created_on
            });
          }
        } catch (err) {
          logger.error(`Failed to parse Foundit JSON file ${fileName}`, { module: 'scraper', error: err });
        }
      } else {
        try {
          const $ = cheerio.load(content);
          // Match common classes on Foundit listing cards
          $('.job-description-card, .card-container, .job-card').each((index, element) => {
            const el = $(element);
            const title = el.find('.job-title, h3, .title').text().trim();
            const company = el.find('.company-name, .company, h4').text().trim();
            const location = el.find('.location, .locations').text().trim();
            const salary = el.find('.salary, .salary-range').text().trim();
            const url = el.find('a').first().attr('href') || '';
            const skills = el.find('.skills, .skills-list, .tags').text().trim();
            const id = url.split('-').pop() || `fi-${Date.now()}-${index}`;

            if (title && company) {
              parsed.push({
                id,
                title,
                company,
                location,
                salary,
                skills,
                description: `${title} role at ${company} (Foundit).`,
                url: url.startsWith('http') ? url : `https://foundit.in${url}`,
                logo: el.find('img').first().attr('src') || '',
                deadline: el.find('.deadline, .expire-date').text().trim(),
                postedDate: new Date().toISOString()
              });
            }
          });
        } catch (err) {
          logger.error(`Failed to parse Foundit HTML file ${fileName}`, { module: 'scraper', error: err });
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
      description: job.description || `${job.title} at ${job.company}`,
      apply_url: job.url,
      posted_date: normalizeDate(job.postedDate),
      deadline: normalizeDate(job.deadline),
      logo: job.logo,
      category: 'General Jobs',
      ai_score: null
    }));
  }
}
export default FounditScraper;
