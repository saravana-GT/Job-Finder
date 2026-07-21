import test from 'node:test';
import assert from 'node:assert/strict';
import { providerManager } from '../src/scrapers/providerManager.js';
import { ProviderRepository } from '../src/repositories/providerRepository.js';
import { MockProvider } from '../src/scrapers/mockProvider/index.js';

// Setup test environment
process.env.NODE_ENV = 'test';

test('Provider failure: consecutive failures trigger auto-disable and cooldown recovery', async () => {
  const providerRepo = new ProviderRepository();
  const providerName = 'MockProvider';

  // Seed / Reset status to start fresh
  await providerRepo.updateProviderStatus(providerName, {
    is_enabled: true,
    consecutive_failures: 0,
    health_status: 'healthy',
    version: '1.0.0',
    capabilities: ['fetch']
  });

  // Verify initial state
  let status = await providerRepo.getProviderStatus(providerName);
  assert.equal(status.is_enabled, true);
  assert.equal(status.consecutive_failures, 0);

  // 1. Trigger failure 1
  status = await providerRepo.incrementProviderFailures(providerName, 3);
  assert.equal(status.consecutive_failures, 1);
  assert.equal(status.health_status, 'degraded');
  assert.equal(status.is_enabled, true);

  // 2. Trigger failure 2
  status = await providerRepo.incrementProviderFailures(providerName, 3);
  assert.equal(status.consecutive_failures, 2);
  assert.equal(status.health_status, 'degraded');
  assert.equal(status.is_enabled, true);

  // 3. Trigger failure 3 (reaches threshold of 3)
  status = await providerRepo.incrementProviderFailures(providerName, 3);
  assert.equal(status.consecutive_failures, 3);
  assert.equal(status.health_status, 'down');
  assert.equal(status.is_enabled, false); // Auto disabled

  // 4. Test recovery reset
  status = await providerRepo.resetProviderFailures(providerName);
  assert.equal(status.consecutive_failures, 0);
  assert.equal(status.health_status, 'healthy');
  assert.equal(status.is_enabled, true);
});
