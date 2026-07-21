import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';

// Setup test environment
process.env.NODE_ENV = 'test';

test('Load Test: API handles high volume search requests', async () => {
  const concurrentRequests = 100;
  const requests = [];

  const start = Date.now();
  for (let i = 0; i < concurrentRequests; i++) {
    requests.push(request(app).get('/api/jobs/search?role=engineer&location=bangalore'));
  }

  const responses = await Promise.all(requests);
  const duration = Date.now() - start;

  logger.info(`Load test completed. Concurrency: ${concurrentRequests}, Duration: ${duration}ms`, { module: 'load-test' });

  // Assertions
  assert.equal(responses.length, concurrentRequests);
  for (const res of responses) {
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  }
});

// Mock logger in case it's not defined globally in test
const logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, JSON.stringify(meta))
};
