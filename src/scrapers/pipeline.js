import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';
import { LogRepository } from '../repositories/logRepository.js';
import { profileService } from '../services/profileService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scan the scrapers directory and execute the ingestion pipeline for active providers.
 * @param {string|null} singleProvider Run specifically for one provider (e.g. 'unstop') or null for all
 */
export async function runIngestionPipeline(singleProvider = null) {
  const scrapersDir = __dirname;
  const items = fs.readdirSync(scrapersDir);
  const logRepository = new LogRepository();

  const providersToRun = [];

  for (const item of items) {
    const fullPath = path.join(scrapersDir, item);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    
    // Skip helper directories
    if (['utils', 'common', 'scratch'].includes(item.toLowerCase())) {
      continue;
    }

    if (singleProvider && item.toLowerCase() !== singleProvider.toLowerCase()) {
      continue;
    }

    providersToRun.push(item);
  }

  logger.info(`Found ${providersToRun.length} scraper provider(s) to execute: [${providersToRun.join(', ')}]`, { module: 'pipeline' });

  const results = {};

  for (const provider of providersToRun) {
    const startTime = Date.now();
    logger.info(`🚀 Starting Ingestion Pipeline for provider: "${provider}"`, { module: 'pipeline' });

    let step = 'initialize';
    const metrics = {
      fetched: 0,
      parsed: 0,
      saved: 0,
      skipped: 0,
      duplicates: 0,
    };

    let scraperInstance = null;

    try {
      // 1. Dynamic import
      const modulePath = `./${provider}/index.js`;
      const providerModule = await import(modulePath);
      
      const ScraperClass = providerModule.default || providerModule.Scraper;
      if (!ScraperClass) {
        throw new Error(`Provider "${provider}" does not export a default class or "Scraper" class.`);
      }

      scraperInstance = new ScraperClass();

      // 2. Initialize
      await scraperInstance.initialize();

      // 3. Fetch
      step = 'fetchJobs';
      logger.debug(`[Pipeline] Fetching jobs for "${provider}"...`, { module: 'pipeline' });
      const rawData = await scraperInstance.fetchJobs();
      metrics.fetched = Array.isArray(rawData) ? rawData.length : (rawData ? 1 : 0);

      // 4. Parse
      step = 'parseJobs';
      logger.debug(`[Pipeline] Parsing jobs for "${provider}"...`, { module: 'pipeline' });
      const parsedJobs = await scraperInstance.parse(rawData);
      metrics.parsed = parsedJobs.length;

      // 5. Normalize
      step = 'normalizeJobs';
      logger.debug(`[Pipeline] Normalizing jobs for "${provider}"...`, { module: 'pipeline' });
      const normalizedJobs = await scraperInstance.normalize(parsedJobs);

      // 6. Validate
      step = 'validateJobs';
      logger.debug(`[Pipeline] Validating jobs for "${provider}"...`, { module: 'pipeline' });
      const validatedJobs = await scraperInstance.validate(normalizedJobs);
      metrics.skipped = normalizedJobs.length - validatedJobs.length;

      // 6.5. Calculate AI Scores
      logger.debug(`[Pipeline] Calculating AI match scores for "${provider}"...`, { module: 'pipeline' });
      const profile = await profileService.getProfile();
      for (const job of validatedJobs) {
        try {
          const report = recommendationEngine.generateMatchReport(job, profile);
          job.ai_score = report.overallScore;
        } catch (err) {
          logger.error(`Failed to calculate score for job "${job.role}" during ingestion pipeline`, { module: 'pipeline', error: err });
          job.ai_score = 0;
        }
      }

      // 7. Deduplicate & Store
      step = 'saveJobs';
      logger.debug(`[Pipeline] Storing jobs for "${provider}"...`, { module: 'pipeline' });
      const saveStats = await scraperInstance.save(validatedJobs);
      metrics.saved = saveStats.saved;
      metrics.duplicates = saveStats.duplicates;

      // 8. Shutdown
      step = 'shutdown';
      await scraperInstance.shutdown();

      const durationMs = Date.now() - startTime;
      
      const logMessage = `Pipeline completed for provider "${provider}" in ${durationMs}ms. [Fetched: ${metrics.fetched}, Parsed: ${metrics.parsed}, Saved: ${metrics.saved}, Skipped (Validation): ${metrics.skipped}, Duplicates: ${metrics.duplicates}]`;
      logger.info(logMessage, { module: 'pipeline' });

      // Save pipeline statistics in logs table
      await logRepository.createLog({
        module: `pipeline:${provider}`,
        level: 'INFO',
        message: {
          provider,
          status: 'success',
          metrics,
          durationMs,
          completedAt: new Date().toISOString()
        }
      });

      results[provider] = {
        success: true,
        metrics,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error(`❌ Pipeline failed for provider "${provider}" at step "${step}" in ${durationMs}ms`, { module: 'pipeline', error });

      // Shutdown gracefully if initialized
      if (scraperInstance && typeof scraperInstance.shutdown === 'function') {
        try {
          await scraperInstance.shutdown();
        } catch (shutErr) {
          logger.error(`Failed to shutdown scraper "${provider}" after exception`, { module: 'pipeline', error: shutErr });
        }
      }

      // Save failure details in logs table
      try {
        await logRepository.createLog({
          module: `pipeline:${provider}`,
          level: 'ERROR',
          message: {
            provider,
            status: 'failed',
            failedStep: step,
            metrics,
            durationMs,
            error: error.message,
            stack: error.stack,
            completedAt: new Date().toISOString()
          }
        });
      } catch (dbLogErr) {
        logger.error(`Failed to write database pipeline failure log for "${provider}"`, { module: 'pipeline', error: dbLogErr });
      }

      results[provider] = {
        success: false,
        failedStep: step,
        metrics,
        durationMs,
        error: error.message,
      };
    }
  }

  return results;
}
export default runIngestionPipeline;
