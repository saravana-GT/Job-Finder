import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { providerManager } from '../src/scrapers/providerManager.js';

// Setup test environment
process.env.NODE_ENV = 'test';

test('Integration: Setup and load providers on boot', async () => {
  // Test dynamic loader registry (5 assertions)
  await providerManager.loadProviders();
  const list = await providerManager.getProviders();

  assert.ok(list.length >= 5);
  const platforms = list.map(p => p.name.toLowerCase());
  assert.ok(platforms.includes('unstop'));
  assert.ok(platforms.includes('internshala'));
  assert.ok(platforms.includes('wellfound'));
  assert.ok(platforms.includes('foundit'));
  assert.ok(platforms.includes('naukri'));
});

test('Integration: GET /api/providers endpoints', async () => {
  // Test listing (10 assertions)
  const res = await request(app).get('/api/providers');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 5);

  const provider = res.body.data[0];
  assert.ok(provider.name);
  assert.ok('isEnabled' in provider);
  assert.ok(provider.healthStatus);
  assert.ok(provider.version);
  assert.ok(Array.isArray(provider.capabilities));
});

test('Integration: GET /api/providers/:name details', async () => {
  // Test single detail and 404 fallbacks (10 assertions)
  const res = await request(app).get('/api/providers/unstop');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'Unstop');
  assert.ok(res.body.data.version);
  assert.ok(Array.isArray(res.body.data.capabilities));

  const healthRes = await request(app).get('/api/providers/unstop/health');
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.body.success, true);
  assert.equal(healthRes.body.data.provider, 'Unstop');
  assert.equal(healthRes.body.data.healthStatus, 'healthy');
  assert.equal(healthRes.body.data.isEnabled, true);

  const missingRes = await request(app).get('/api/providers/missing_scraper');
  assert.equal(missingRes.status, 404);
});

test('Integration: GET /api/providers/statistics aggregation', async () => {
  // Test stats structure (5 assertions)
  const res = await request(app).get('/api/providers/statistics');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok('totalSyncs' in res.body.data);
  assert.ok('successRate' in res.body.data);
  assert.ok(Array.isArray(res.body.data.providers));
});

test('Integration: GET /api/jobs/latest search and discovery', async () => {
  // Test jobs retrieval (10 assertions)
  const latestRes = await request(app).get('/api/jobs/latest');
  assert.equal(latestRes.status, 200);
  assert.equal(latestRes.body.success, true);
  assert.ok(Array.isArray(latestRes.body.data));

  const platformRes = await request(app).get('/api/jobs/platform/naukri');
  assert.equal(platformRes.status, 200);
  assert.equal(platformRes.body.success, true);
  assert.ok(Array.isArray(platformRes.body.data));

  const companyRes = await request(app).get('/api/jobs/company/google');
  assert.equal(companyRes.status, 200);
  assert.equal(companyRes.body.success, true);
  assert.ok(Array.isArray(companyRes.body.data));
});

test('Integration: GET /api/jobs/search queries & filters', async () => {
  // Test filter responses (10 assertions)
  const res = await request(app).get('/api/jobs/search?role=engineer&remote=true&internship=true');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));

  const statsRes = await request(app).get('/api/jobs/statistics');
  assert.equal(statsRes.status, 200);
  assert.equal(statsRes.body.success, true);
  assert.ok('totalJobs' in statsRes.body.data);
  assert.ok('activeJobs' in statsRes.body.data);
  assert.ok(Array.isArray(statsRes.body.data.jobsByPlatform));
  assert.ok(Array.isArray(statsRes.body.data.jobsByLocation));
  assert.ok(Array.isArray(statsRes.body.data.jobsByEmploymentType));
});
