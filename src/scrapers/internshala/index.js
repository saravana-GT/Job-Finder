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

export class InternshalaScraper extends BaseScraper {
  constructor() {
    super('Internshala', '1.0.0');
  }

  async fetchJobs() {
    return await this.fetch('https://internshala.com/internships');
  }

  async parse(rawData) {
    if (!rawData) return [];

    const parsed = [];

    for (const item of rawData) {
      const { content, isJson, fileName } = item;
      logger.info(`[Internshala Parser] Parsing file: ${fileName}`, { module: 'scraper' });

      if (isJson) {
        try {
          const json = JSON.parse(content);
          const internships = json.internships || json.data || [];
          for (const shala of internships) {
            parsed.push({
              id: shala.id?.toString(),
              title: shala.title || shala.profile_name,
              company: shala.company_name || shala.company,
              location: shala.location_names?.join(', ') || shala.location || 'Remote',
              salary: shala.stipend?.stream || shala.stipend || 'Not Specified',
              skills: shala.skills || '',
              description: shala.job_description || '',
              url: shala.url || `https://internshala.com/internship/detail/${shala.id}`,
              logo: shala.company_logo,
              deadline: shala.application_deadline,
              postedDate: shala.posted_on
            });
          }
        } catch (err) {
          logger.error(`Failed to parse Internshala JSON file ${fileName}`, { module: 'scraper', error: err });
        }
      } else {
        // Parse HTML using Cheerio
        try {
          const $ = cheerio.load(content);
          $('.internship_meta, .individual_internship').each((index, element) => {
            const el = $(element);
            const title = el.find('.heading_3_5 a, .profile, .job-title').text().trim();
            const company = el.find('.heading_4_5 a, .company_name, .company').text().trim();
            const location = el.find('.location_link, .location').text().trim();
            const salary = el.find('.stipend, .salary').text().trim();
            const url = el.find('.heading_3_5 a, .profile-link').first().attr('href') || '';
            const skills = el.find('.skills, .skills-list').text().trim();
            const id = url.split('/').pop() || `is-${Date.now()}-${index}`;

            if (title && company) {
              parsed.push({
                id,
                title,
                company,
                location,
                salary,
                skills,
                description: `${title} internship opportunities at ${company}.`,
                url: url.startsWith('http') ? url : `https://internshala.com${url}`,
                logo: el.find('img').first().attr('src') || '',
                deadline: el.find('.apply_by, .deadline').text().trim(),
                postedDate: new Date().toISOString()
              });
            }
          });
        } catch (err) {
          logger.error(`Failed to parse Internshala HTML file ${fileName}`, { module: 'scraper', error: err });
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
      employment_type: normalizeEmploymentType('Internship'),
      salary: normalizeSalary(job.salary),
      experience: '0-1 years',
      skills: normalizeSkills(job.skills),
      description: job.description || `${job.title} internship at ${job.company}`,
      apply_url: job.url,
      posted_date: normalizeDate(job.postedDate),
      deadline: normalizeDate(job.deadline),
      logo: job.logo,
      category: 'Internship',
      ai_score: null
    }));
  }
}
export default InternshalaScraper;
