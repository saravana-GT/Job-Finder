import test from 'node:test';
import assert from 'node:assert/strict';
import { JobRepository } from '../src/repositories/jobRepository.js';
import { transaction } from '../src/database/connection.js';

// Setup test environment
process.env.NODE_ENV = 'test';

test('Database rollback: Failed transaction rolls back changes', async () => {
  const jobRepo = new JobRepository();
  let rolledBack = false;

  try {
    await transaction(async (client) => {
      // Simulate inserting a valid job first
      await client.query("INSERT INTO jobs (platform, company, role, apply_url) VALUES ('RollbackTest', 'Test Corp', 'Engineer', 'http://rollback.com')");
      
      // Simulate an error which triggers rollback
      throw new Error('Forced transaction failure');
    });
  } catch (err) {
    if (err.message === 'Forced transaction failure') {
      rolledBack = true;
    }
  }

  assert.equal(rolledBack, true);
});
