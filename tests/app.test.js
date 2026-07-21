import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';

test('GET / returns HTTP 200 Backend Running', async () => {
  const response = await request(app).get('/');
  assert.equal(response.status, 200);
  assert.equal(response.text, 'Backend Running');
});

test('GET /health returns HTTP 200 UP status', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'UP');
});

test('GET /api/health returns running status', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'running');
});

test('GET /api/jobs returns sample data', async () => {
  const response = await request(app).get('/api/jobs');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data));
});
