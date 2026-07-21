import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIngestionPipeline } from '../src/scrapers/pipeline.js';
import { MockProvider } from '../src/scrapers/mockProvider/index.js';
import { JobRepository } from '../src/repositories/jobRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure test environment is active
process.env.NODE_ENV = 'test';

test('Job validation rejects invalid records', async () => {
  const provider = new MockProvider();
  
  const mockBatch = [
    {
      source_id: 'mock-1',
      company: '', // Rejected: Empty company
      role: 'Node Developer',
      apply_url: 'https://mock.com/1',
    },
    {
      source_id: 'mock-2',
      company: 'Test Company',
      role: '', // Rejected: Empty role
      apply_url: 'https://mock.com/2',
    },
    {
      source_id: 'mock-3',
      company: 'Test Company',
      role: 'Node Developer',
      apply_url: '', // Rejected: Empty URL
    },
    {
      source_id: '', // Rejected: Empty source ID
      company: 'Test Company',
      role: 'Node Developer',
      apply_url: 'https://mock.com/4',
    },
    {
      source_id: 'mock-5',
      company: 'Test Company',
      role: 'Node Developer',
      apply_url: 'https://mock.com/5',
      deadline: 'invalid-deadline-date', // Rejected: Invalid deadline format
    },
    {
      source_id: 'mock-6', // Valid
      company: 'Test Company',
      role: 'Node Developer',
      apply_url: 'https://mock.com/6',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      source_id: 'mock-6', // Rejected: duplicate source ID in same batch
      company: 'Another Company',
      role: 'React Developer',
      apply_url: 'https://mock.com/7',
    }
  ];

  const validated = await provider.validate(mockBatch);

  assert.equal(validated.length, 1);
  assert.equal(validated[0].source_id, 'mock-6');
});

test('Job saving performs deduplication check', async () => {
  const provider = new MockProvider();

  // In test mode, our database connection mocks query returns false for duplicate checks,
  // meaning jobs are treated as new.
  const jobs = [
    {
      source_id: 'mock-id-unique',
      company: 'Google',
      role: 'Intern',
      location: 'Remote',
      apply_url: 'https://google.com/intern',
    }
  ];

  const results = await provider.save(jobs);
  assert.equal(results.saved, 1);
  assert.equal(results.duplicates, 0);
});

test('Ingestion pipeline coordinator runs successfully', async () => {
  // Pre-seed a temporary offline file in incoming/unstop to test compliant offline loading
  const tempDir = path.resolve(__dirname, '../incoming/unstop');
  const tempFile = path.join(tempDir, 'test_opportunity.json');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const mockPayload = {
    opportunities: [
      {
        id: 'unstop-test-999',
        opportunityTitle: 'QA Intern',
        companyName: 'Test Inc',
        jobLocation: 'Bangalore, India (Onsite)',
        stipend: '10,000 INR /month',
        skillsRequired: 'Jest, Selenium',
        description: 'Verify backend pipelines.',
        link: 'https://unstop.com/jobs/qa-intern-test-999',
        postedDate: new Date().toISOString(),
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }
    ]
  };

  fs.writeFileSync(tempFile, JSON.stringify(mockPayload), 'utf8');

  try {
    const results = await runIngestionPipeline('unstop');

    assert.ok(results.unstop);
    assert.equal(results.unstop.success, true);
    assert.ok(results.unstop.metrics.fetched > 0);
    assert.ok(results.unstop.metrics.saved > 0);
  } finally {
    // Teardown temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test('JobRepository statistics query executes successfully', async () => {
  const jobRepo = new JobRepository();
  const stats = await jobRepo.getStatistics();

  assert.ok(stats.totalJobs > 0);
  assert.ok(Array.isArray(stats.jobsByPlatform));
});
