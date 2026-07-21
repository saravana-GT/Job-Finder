import { formatResponse, formatErrorResponse } from '../utils/formatter.js';
import { providerManager } from '../scrapers/providerManager.js';
import { ProviderRepository } from '../repositories/providerRepository.js';

const providerRepository = new ProviderRepository();

/**
 * GET /api/providers
 */
export async function getProviders(req, res, next) {
  try {
    const list = await providerManager.getProviders();
    res.json(formatResponse(list));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/providers/:name
 */
export async function getProviderByName(req, res, next) {
  try {
    const { name } = req.params;
    const provider = providerManager.getProvider(name);
    
    if (!provider) {
      return res.status(404).json(formatErrorResponse(`Provider "${name}" not found.`, 404));
    }

    const status = await providerRepository.getProviderStatus(provider.platformName);
    res.json(formatResponse({
      name: provider.platformName,
      version: provider.version,
      capabilities: provider.capabilities,
      dbStatus: status
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/providers/:name/health
 */
export async function getProviderHealth(req, res, next) {
  try {
    const { name } = req.params;
    const provider = providerManager.getProvider(name);

    if (!provider) {
      return res.status(404).json(formatErrorResponse(`Provider "${name}" not found.`, 404));
    }

    const status = await providerRepository.getProviderStatus(provider.platformName);
    res.json(formatResponse({
      provider: provider.platformName,
      healthStatus: status?.health_status || 'unknown',
      isEnabled: status?.is_enabled ?? true,
      consecutiveFailures: status?.consecutive_failures || 0,
      lastSuccessfulSync: status?.last_successful_sync || null
    }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/providers/statistics
 */
export async function getProviderStatistics(req, res, next) {
  try {
    const stats = await providerRepository.getStatistics();
    res.json(formatResponse(stats));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/providers/:name/sync
 * Manually trigger sync execution for verification.
 */
export async function triggerProviderSync(req, res, next) {
  try {
    const { name } = req.params;
    const provider = providerManager.getProvider(name);

    if (!provider) {
      return res.status(404).json(formatErrorResponse(`Provider "${name}" not found.`, 404));
    }

    const result = await providerManager.syncProvider(name);
    res.json(formatResponse(result));
  } catch (error) {
    next(error);
  }
}
