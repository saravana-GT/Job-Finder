import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JobRepository } from '../repositories/jobRepository.js';
import { ComplianceChecker } from './utils/compliance.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BaseScraper {
  /**
   * @param {string} platformName Name of the platform (e.g. Unstop, Internshala)
   * @param {string} version Provider version
   */
  constructor(platformName, version = '1.0.0') {
    this.platformName = platformName;
    this.version = version;
    this.jobRepository = new JobRepository();
    this.healthStatus = 'healthy'; // 'healthy', 'degraded', 'down', 'disabled'
    this.stats = {
      totalRuns: 0,
      totalJobsFetched: 0,
      totalJobsSaved: 0,
      lastRunDurationMs: 0,
      lastSuccessfulSync: null,
      errors: []
    };
    this.capabilities = ['fetch', 'parse', 'normalize', 'validate', 'save'];
  }

  async initialize() {
    logger.debug(`Initializing scraper for platform: ${this.platformName}`, { module: 'scraper' });
    this.healthStatus = 'healthy';
  }

  /**
   * Execute task with exponential backoff retry.
   */
  async retry(fn, options = {}) {
    const { retries = 3, minTimeoutMs = 1000, factor = 2 } = options;
    let attempt = 0;
    let delay = minTimeoutMs;

    while (attempt < retries) {
      try {
        attempt++;
        return await fn();
      } catch (err) {
        if (err.isPermanent || attempt >= retries) {
          logger.error(`Retry aborted or failed after ${attempt} attempts for platform: ${this.platformName}`, { module: 'scraper', error: err });
          throw err;
        }
        logger.warn(`Attempt ${attempt} failed for platform: ${this.platformName}. Retrying in ${delay}ms. Error: ${err.message}`, { module: 'scraper' });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= factor;
      }
    }
  }

  /**
   * Fetch raw data.
   * Performs robots.txt compliance checks. If blocked, falls back to manual offline files in incoming/<platformName>/.
   * @param {string|null} url Target crawling URL (if direct crawl attempted)
   */
  async fetch(url = null) {
    this.stats.totalRuns++;
    const startTime = Date.now();

    // 1. Compliance verification
    let isAllowed = false;
    if (url) {
      isAllowed = await ComplianceChecker.isUrlAllowed(this.platformName, url);
    }

    if (!isAllowed) {
      logger.info(`[Compliance Fallback] Direct automated fetch disallowed for platform: ${this.platformName}. Checking offline ingestion folder...`, { module: 'scraper' });
      
      // 2. Load manual offline files from incoming/
      const incomingDir = path.resolve(__dirname, `../../incoming/${this.platformName.toLowerCase()}`);
      
      if (!fs.existsSync(incomingDir)) {
        fs.mkdirSync(incomingDir, { recursive: true });
        logger.info(`Created offline ingestion folder: ${incomingDir}. Place target HTML/JSON search downloads here.`, { module: 'scraper' });
      }

      const files = fs.readdirSync(incomingDir).filter(f => f.endsWith('.html') || f.endsWith('.json'));

      if (files.length === 0) {
        const complMessage = `Compliance limits direct scraping for "${this.platformName}" and no manual download files were found in "${incomingDir}".`;
        logger.warn(complMessage, { module: 'scraper' });
        this.healthStatus = 'degraded';
        this.stats.errors.push(complMessage);
        return null;
      }

      logger.info(`[Offline Loader] Found ${files.length} offline ingestion files for platform: ${this.platformName}. Loading...`, { module: 'scraper' });
      
      const fileData = [];
      for (const file of files) {
        const filePath = path.join(incomingDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        fileData.push({
          fileName: file,
          content,
          isJson: file.endsWith('.json')
        });
      }

      this.stats.lastRunDurationMs = Date.now() - startTime;
      return fileData;
    }

    // Direct crawling logic using fetch (if allowed by robots.txt)
    logger.info(`[Direct Crawl] Starting compliance-cleared fetch from URL: ${url}`, { module: 'scraper' });
    try {
      const response = await this.retry(async () => {
        const res = await globalThis.fetch(url, {
          headers: {
            'User-Agent': 'PlacementAssistantBot/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/json'
          },
          signal: AbortSignal.timeout(10000) // 10s Timeout
        });
        if (!res.ok) {
          const isPermanent = res.status >= 400 && res.status < 500;
          const error = new Error(`HTTP fetch failed with status: ${res.status}`);
          error.isPermanent = isPermanent;
          throw error;
        }
        return res;
      });

      const contentType = response.headers.get('content-type') || '';
      let content;
      if (contentType.includes('application/json')) {
        content = await response.json();
      } else {
        content = await response.text();
      }

      this.stats.lastRunDurationMs = Date.now() - startTime;
      return [{ fileName: 'live_fetch_payload', content, isJson: contentType.includes('application/json') }];
    } catch (err) {
      this.healthStatus = 'degraded';
      this.stats.errors.push(err.message);
      throw err;
    }
  }

  /**
   * Parse raw content from fetch into objects array.
   */
  async parse(rawData) {
    throw new Error(`parse() must be implemented by the subclass.`);
  }

  /**
   * Normalize platform specific structures into standard Job Model.
   */
  async normalize(parsedJobs) {
    throw new Error(`normalize() must be implemented by the subclass.`);
  }

  /**
   * Validate jobs.
   */
  async validate(normalizedJobs) {
    const validated = [];
    const seenSourceIdsInBatch = new Set();

    for (const job of normalizedJobs) {
      const { company, role, apply_url, source_id, deadline } = job;

      if (!company || company.trim() === '') {
        logger.warn(`[Validation Reject] Missing company name. Platform: ${this.platformName}`, { module: 'scraper', job });
        continue;
      }

      if (!role || role.trim() === '') {
        logger.warn(`[Validation Reject] Missing job title/role. Platform: ${this.platformName}`, { module: 'scraper', job });
        continue;
      }

      if (!apply_url || apply_url.trim() === '') {
        logger.warn(`[Validation Reject] Missing apply URL. Platform: ${this.platformName}, Role: "${role}"`, { module: 'scraper', job });
        continue;
      }

      if (!source_id || source_id.trim() === '') {
        logger.warn(`[Validation Reject] Missing source_id. Platform: ${this.platformName}, Role: "${role}"`, { module: 'scraper', job });
        continue;
      }

      if (seenSourceIdsInBatch.has(source_id)) {
        logger.warn(`[Validation Reject] Duplicate source_id "${source_id}" in current batch. Platform: ${this.platformName}`, { module: 'scraper', job });
        continue;
      }

      if (deadline) {
        const parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) {
          logger.warn(`[Validation Reject] Invalid deadline format "${deadline}". Platform: ${this.platformName}`, { module: 'scraper', job });
          continue;
        }
      }

      seenSourceIdsInBatch.add(source_id);
      validated.push(job);
    }

    return validated;
  }

  /**
   * Save jobs, performing database-level deduplication.
   */
  async save(validatedJobs) {
    let saved = 0;
    let duplicates = 0;

    for (const job of validatedJobs) {
      try {
        const fullJobData = {
          ...job,
          platform: this.platformName,
        };

        // 1. Deduplicate by source_id
        const isSourceIdDup = await this.jobRepository.findDuplicateBySourceId(this.platformName, job.source_id);
        if (isSourceIdDup) {
          logger.debug(`[Deduplication Skip] source_id duplicate found: "${job.role}" at ${job.company} (${this.platformName} ID: ${job.source_id})`, { module: 'scraper' });
          duplicates++;
          continue;
        }

        // 2. Deduplicate by platform, company, role, location, apply_url
        const isDetailsDup = await this.jobRepository.findDuplicate({
          platform: this.platformName,
          company: job.company,
          role: job.role,
          location: job.location,
          apply_url: job.apply_url,
        });

        if (isDetailsDup) {
          logger.debug(`[Deduplication Skip] Details duplicate found: "${job.role}" at ${job.company} (Apply URL: ${job.apply_url})`, { module: 'scraper' });
          duplicates++;
          continue;
        }

        // 3. Store Job
        const savedJob = await this.jobRepository.createJob(fullJobData);
        if (savedJob) {
          saved++;
          try {
            const { notificationQueue } = await import('../services/notificationQueue.js');
            await notificationQueue.enqueue(savedJob.id, 'telegram', 0);
          } catch (queueErr) {
            logger.error(`Failed to enqueue notification for job: ${job.role}`, { module: 'scraper', error: queueErr });
          }
        }
      } catch (error) {
        logger.error(`[Ingestion Error] Failed to save job "${job.role}" at ${job.company}`, { module: 'scraper', error, job });
      }
    }

    this.stats.totalJobsFetched += validatedJobs.length;
    this.stats.totalJobsSaved += saved;
    if (saved > 0) {
      this.stats.lastSuccessfulSync = new Date();
    }

    return { saved, duplicates };
  }

  async shutdown() {
    logger.debug(`Shutting down scraper for platform: ${this.platformName}`, { module: 'scraper' });
  }

  /**
   * Return statistics and capabilities.
   */
  getMetadata() {
    return {
      name: this.platformName,
      version: this.version,
      healthStatus: this.healthStatus,
      capabilities: this.capabilities,
      statistics: this.stats
    };
  }
}
export default BaseScraper;
