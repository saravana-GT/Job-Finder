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

export class UnstopScraper extends BaseScraper {
  constructor() {
    super('Unstop', '1.0.0');
    // Pre-seed capabilities for registry
    this.capabilities = ['fetch', 'parse', 'normalize', 'validate', 'save'];
  }

  async fetchJobs() {
    // Unstop robots.txt disallows automated scraping, so we attempt to read manual offline downloads
    return await this.fetch('https://unstop.com/opportunities/search');
  }

  async parse(rawData) {
    if (!rawData) return [];
    
    const parsed = [];
    
    for (const item of rawData) {
      const { content, isJson, fileName } = item;
      logger.info(`[Unstop Parser] Parsing file: ${fileName}`, { module: 'scraper' });

      if (isJson) {
        try {
          const json = JSON.parse(content);
          // Standard Unstop opportunity response parsing
          const opportunities = json.data?.opportunity?.data || json.opportunities || [];
          for (const opp of opportunities) {
            parsed.push({
              id: opp.id?.toString() || opp.opportunity_id?.toString(),
              title: opp.title || opp.opportunityTitle,
              company: opp.company?.name || opp.companyName,
              location: opp.jobLocation || opp.location || 'Onsite',
              salary: opp.stipend || opp.salary,
              skills: opp.skillsRequired || opp.skills || '',
              description: opp.description || opp.jobDescription || '',
              url: opp.link || `https://unstop.com/jobs/${opp.id}`,
              logo: opp.logo || opp.company?.logo,
              category: opp.category,
              deadline: opp.deadline || opp.applyBy,
              postedDate: opp.postedDate || opp.created_at
            });
          }
        } catch (err) {
          logger.error(`Failed to parse Unstop JSON file ${fileName}`, { module: 'scraper', error: err });
        }
      } else {
        // Parse HTML using Cheerio
        try {
          const $ = cheerio.load(content);
          $('.opportunity-card, app-opportunity-card, .job-card').each((index, element) => {
            const el = $(element);
            const title = el.find('h3, .title, .opportunity-title').text().trim();
            const company = el.find('.company-name, .company, h4').text().trim();
            const location = el.find('.location, .job-location').text().trim();
            const salary = el.find('.salary, .stipend, .salary-range').text().trim();
            const url = el.find('a').first().attr('href') || '';
            const skills = el.find('.skills, .skills-required').text().trim();
            const id = url.split('-').pop() || `html-${Date.now()}-${index}`;

            if (title && company) {
              parsed.push({
                id,
                title,
                company,
                location,
                salary,
                skills,
                description: el.find('.description, .card-desc').text().trim(),
                url: url.startsWith('http') ? url : `https://unstop.com${url}`,
                logo: el.find('img').first().attr('src') || '',
                category: 'Jobs',
                deadline: el.find('.deadline, .apply-by').text().trim(),
                postedDate: new Date().toISOString()
              });
            }
          });
        } catch (err) {
          logger.error(`Failed to parse Unstop HTML file ${fileName}`, { module: 'scraper', error: err });
        }
      }
    }

    return parsed;
  }

  /**
   * Normalize platform fields into standard Job Model.
   */
  async normalize(parsedJobs) {
    return parsedJobs.map((job) => ({
      source_id: job.id,
      role: job.title,
      company: job.company,
      location: normalizeLocation(job.location),
      employment_type: normalizeEmploymentType(job.title),
      salary: normalizeSalary(job.salary),
      experience: job.title.toLowerCase().includes('intern') ? '0-1 years' : '0-2 years',
      skills: normalizeSkills(job.skills),
      description: job.description || `${job.title} opportunity at ${job.company}`,
      apply_url: job.url,
      posted_date: normalizeDate(job.postedDate),
      deadline: normalizeDate(job.deadline),
      logo: job.logo,
      category: job.category || 'Jobs',
      ai_score: null
    }));
  }
}
export default UnstopScraper;
