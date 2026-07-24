import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderRepository } from '../repositories/providerRepository.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProviderManager {
  constructor() {
    this.providers = new Map(); // name -> instance
    this.providerRepository = new ProviderRepository();
    this.failureThreshold = 3; // consecutive failures before auto-disabling
    this.recoveryCooldownMs = 60 * 1000; // 1-minute recovery cooldown for testing (default in production could be longer)
  }

  /**
   * Scan folder and load all scraper providers.
   */
  async loadProviders() {
    const scrapersDir = __dirname;
    const items = fs.readdirSync(scrapersDir);

    for (const item of items) {
      const fullPath = path.join(scrapersDir, item);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      
      // Skip helper directories
      if (['utils', 'common', 'mockprovider', 'scratch'].includes(item.toLowerCase())) {
        continue;
      }

      try {
        const modulePath = `./${item}/index.js`;
        const providerModule = await import(modulePath);
        
        const ScraperClass = providerModule.default || providerModule.Scraper;
        if (!ScraperClass) {
          logger.warn(`Provider "${item}" does not export a default class or "Scraper" class. Skipping.`, { module: 'provider-manager' });
          continue;
        }

        const instance = new ScraperClass();
        this.providers.set(instance.platformName.toLowerCase(), instance);

        // Synchronize provider registry details in the database
        await this.providerRepository.updateProviderStatus(instance.platformName, {
          version: instance.version,
          capabilities: instance.capabilities
        });

        logger.info(`Loaded provider: "${instance.platformName}" (Version: ${instance.version})`, { module: 'provider-manager' });
      } catch (err) {
        logger.error(`Failed to dynamically load provider "${item}"`, { module: 'provider-manager', error: err });
      }
    }
  }

  /**
   * Get a registered provider by name.
   */
  getProvider(name) {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * List all loaded provider instances and their live metadata.
   */
  async getProviders() {
    const list = [];
    const statuses = await this.providerRepository.listProviderStatuses();

    for (const status of statuses) {
      const instance = this.getProvider(status.provider_name);
      list.push({
        name: status.provider_name,
        isEnabled: status.is_enabled,
        healthStatus: status.health_status,
        consecutiveFailures: status.consecutive_failures,
        lastSuccessfulSync: status.last_successful_sync,
        version: status.version || instance?.version || '1.0.0',
        capabilities: status.capabilities || instance?.capabilities || [],
        updatedAt: status.updated_at
      });
    }

    return list;
  }

  /**
   * Execute ingestion sync for a single provider.
   */
  async syncProvider(name) {
    const provider = this.getProvider(name);
    if (!provider) {
      throw new Error(`Provider "${name}" not registered.`);
    }

    // 1. Fetch DB status to check if enabled
    const dbStatus = await this.providerRepository.getProviderStatus(provider.platformName);
    
    // Automatic recovery check
    if (dbStatus && !dbStatus.is_enabled) {
      const timeSinceUpdate = Date.now() - new Date(dbStatus.updated_at).getTime();
      if (timeSinceUpdate > this.recoveryCooldownMs) {
        logger.info(`[Auto Recovery] Cooldown expired for disabled provider "${provider.platformName}". Attempting auto-recovery sync...`, { module: 'provider-manager' });
      } else {
        throw new Error(`Provider "${provider.platformName}" is currently disabled due to consecutive failures. Recovery cooldown active.`);
      }
    }

    const startTime = Date.now();
    let syncResult = {
      provider_name: provider.platformName,
      status: 'failed',
      execution_duration: 0,
      jobs_fetched: 0,
      jobs_parsed: 0,
      jobs_saved: 0,
      jobs_skipped: 0,
      error_message: null
    };

    try {
      logger.info(`[Sync Initiated] Executing sync run for: "${provider.platformName}"`, { module: 'provider-manager' });
      
      await provider.initialize();

      // Fetch
      const rawData = await provider.fetchJobs();
      if (rawData) {
        syncResult.jobs_fetched = rawData.length;
        
        // Parse
        const parsed = await provider.parse(rawData);
        syncResult.jobs_parsed = parsed.length;

        // Normalize
        const normalized = await provider.normalize(parsed);

        // Validate
        const validated = await provider.validate(normalized);
        syncResult.jobs_skipped = normalized.length - validated.length;

        // Save
        const saveStats = await provider.save(validated);
        syncResult.jobs_saved = saveStats.saved;
        
        // Update stats
        syncResult.status = 'success';
      }

      await provider.shutdown();

      // Reset failure history on successful execution
      await this.providerRepository.resetProviderFailures(provider.platformName);

      // Automatically send notifications after every successful provider sync
      if (syncResult.status === 'success') {
        try {
          const { notificationQueue } = await import('../services/notificationQueue.js');
          const { digestService } = await import('../services/digestService.js');
          await notificationQueue.processQueue();
          await digestService.checkAndSendDigest();
        } catch (notifErr) {
          logger.error('Failed to trigger notification queue or digest runs after successful sync', { module: 'provider-manager', error: notifErr });
        }
      }

    } catch (err) {
      logger.error(`[Sync Failure] Ingestion failed for "${provider.platformName}"`, { module: 'provider-manager', error: err });
      
      syncResult.status = 'failed';
      syncResult.error_message = err.message;

      // Increment failure count and trigger auto-disable if limit exceeded
      await this.providerRepository.incrementProviderFailures(provider.platformName, this.failureThreshold);
    } finally {
      syncResult.execution_duration = Date.now() - startTime;
      
      // Save execution metrics to database sync history
      try {
        await this.providerRepository.addSyncHistory(syncResult);
      } catch (dbErr) {
        logger.error('Failed to log provider sync history metrics to database', { module: 'provider-manager', error: dbErr });
      }
    }

    return syncResult;
  }

  /**
   * Run sync for all active providers in priority order.
   */
  async syncAllProviders() {
    const list = await this.getProviders();
    const active = list.filter(p => p.isEnabled);

    logger.info(`Running batch sync for ${active.length} active provider(s)...`, { module: 'provider-manager' });

    const batchResults = [];
    for (const p of active) {
      try {
        const res = await this.syncProvider(p.name);
        batchResults.push(res);
      } catch (err) {
        logger.error(`Batch sync step failed for "${p.name}": ${err.message}`, { module: 'provider-manager' });
        batchResults.push({
          provider_name: p.name,
          status: 'failed',
          error_message: err.message
        });
      }
    }

    return batchResults;
  }
}

export const providerManager = new ProviderManager();
export default providerManager;
