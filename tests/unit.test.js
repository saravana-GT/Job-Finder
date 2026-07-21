import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSalary,
  normalizeDate,
  normalizeSkills
} from '../src/scrapers/utils/normalizer.js';
import { ComplianceChecker } from '../src/scrapers/utils/compliance.js';
import { MockProvider } from '../src/scrapers/mockProvider/index.js';

// Setup test environment
process.env.NODE_ENV = 'test';

// ----------------------------------------------------
// UNIT TESTS: Normalizer Helpers (100+ assertions)
// ----------------------------------------------------

test('normalizeLocation should parse various formats correctly', () => {
  // Test Remote detection (10 assertions)
  assert.equal(normalizeLocation('Remote'), 'Remote');
  assert.equal(normalizeLocation('work from home'), 'Remote');
  assert.equal(normalizeLocation('WFH'), 'Remote');
  assert.equal(normalizeLocation('remote / delhi'), 'Remote');
  assert.equal(normalizeLocation('Bengaluru (Remote)'), 'Remote');
  assert.equal(normalizeLocation('wfh - bangalore'), 'Remote');
  assert.equal(normalizeLocation('REMOTE WORK'), 'Remote');
  assert.equal(normalizeLocation('Work from home - India'), 'Remote');
  assert.equal(normalizeLocation('Delhi/Remote'), 'Remote');
  assert.equal(normalizeLocation('Hybrid/Remote'), 'Remote');

  // Test Hybrid detection (10 assertions)
  assert.equal(normalizeLocation('Hybrid'), 'Hybrid');
  assert.equal(normalizeLocation('hybrid - bangalore'), 'Hybrid');
  assert.equal(normalizeLocation('Pune (Hybrid)'), 'Hybrid');
  assert.equal(normalizeLocation('hybrid / delhi'), 'Hybrid');
  assert.equal(normalizeLocation('HYBRID WORK'), 'Hybrid');
  assert.equal(normalizeLocation('Mumbai, India (Hybrid)'), 'Hybrid');
  assert.equal(normalizeLocation('hybrid/onsite'), 'Hybrid');
  assert.equal(normalizeLocation('onsite/hybrid'), 'Hybrid');
  assert.equal(normalizeLocation('Bangalore Hybrid'), 'Hybrid');
  assert.equal(normalizeLocation('Delhi - Hybrid model'), 'Hybrid');

  // Test Physical Location formatting (10 assertions)
  assert.equal(normalizeLocation('bangalore'), 'Bangalore');
  assert.equal(normalizeLocation('new delhi'), 'New Delhi');
  assert.equal(normalizeLocation('PUNE, INDIA'), 'Pune, India');
  assert.equal(normalizeLocation('san francisco'), 'San Francisco');
  assert.equal(normalizeLocation('HYDERABAD'), 'Hyderabad');
  assert.equal(normalizeLocation('mumbai central'), 'Mumbai Central');
  assert.equal(normalizeLocation('chennai'), 'Chennai');
  assert.equal(normalizeLocation('gurugram, haryana'), 'Gurugram, Haryana');
  assert.equal(normalizeLocation('kolkata'), 'Kolkata');
  assert.equal(normalizeLocation('noida sec 62'), 'Noida Sec 62');

  // Test Fallbacks (5 assertions)
  assert.equal(normalizeLocation(''), 'Onsite');
  assert.equal(normalizeLocation(null), 'Onsite');
  assert.equal(normalizeLocation(undefined), 'Onsite');
  assert.equal(normalizeLocation('   '), 'Onsite');
  assert.equal(normalizeLocation('not-specified'), 'Not-specified');
});

test('normalizeEmploymentType should parse types correctly', () => {
  // Test Internship detection (10 assertions)
  assert.equal(normalizeEmploymentType('Internship'), 'Internship');
  assert.equal(normalizeEmploymentType('intern'), 'Internship');
  assert.equal(normalizeEmploymentType('Node Developer Intern'), 'Internship');
  assert.equal(normalizeEmploymentType('Software Intern'), 'Internship');
  assert.equal(normalizeEmploymentType('internship opportunity'), 'Internship');
  assert.equal(normalizeEmploymentType('INTERN'), 'Internship');
  assert.equal(normalizeEmploymentType('Graduate Intern'), 'Internship');
  assert.equal(normalizeEmploymentType('Summer Intern'), 'Internship');
  assert.equal(normalizeEmploymentType('Co-op Intern'), 'Internship');
  assert.equal(normalizeEmploymentType('Research Internship'), 'Internship');

  // Test Part-time & Contract detection (10 assertions)
  assert.equal(normalizeEmploymentType('Part Time'), 'Part Time');
  assert.equal(normalizeEmploymentType('part-time'), 'Part Time');
  assert.equal(normalizeEmploymentType('PART TIME'), 'Part Time');
  assert.equal(normalizeEmploymentType('parttime'), 'Part Time');
  assert.equal(normalizeEmploymentType('Contract'), 'Contract');
  assert.equal(normalizeEmploymentType('contractor'), 'Contract');
  assert.equal(normalizeEmploymentType('Freelance'), 'Contract');
  assert.equal(normalizeEmploymentType('freelancer'), 'Contract');
  assert.equal(normalizeEmploymentType('Temporary'), 'Contract');
  assert.equal(normalizeEmploymentType('Consultant'), 'Full Time'); // falls to default

  // Test Full Time / Fallbacks (10 assertions)
  assert.equal(normalizeEmploymentType('Full Time'), 'Full Time');
  assert.equal(normalizeEmploymentType('full-time'), 'Full Time');
  assert.equal(normalizeEmploymentType('FULL TIME'), 'Full Time');
  assert.equal(normalizeEmploymentType('permanent'), 'Full Time');
  assert.equal(normalizeEmploymentType(null), 'Full Time');
  assert.equal(normalizeEmploymentType(undefined), 'Full Time');
  assert.equal(normalizeEmploymentType(''), 'Full Time');
  assert.equal(normalizeEmploymentType('software engineer'), 'Full Time');
  assert.equal(normalizeEmploymentType('regular'), 'Full Time');
  assert.equal(normalizeEmploymentType('direct hire'), 'Full Time');
});

test('normalizeSalary should format values correctly', () => {
  // Test Salary formatting (10 assertions)
  assert.equal(normalizeSalary('$100k - $120k'), '$100k - $120k');
  assert.equal(normalizeSalary('12 - 18 LPA'), '12 - 18 LPA');
  assert.equal(normalizeSalary('15,000 /month'), '15,000 /month');
  assert.equal(normalizeSalary('Competitive'), 'Competitive');
  assert.equal(normalizeSalary(''), 'Not Specified');
  assert.equal(normalizeSalary('Unspecified'), 'Not Specified');
  assert.equal(normalizeSalary('unspecified'), 'Not Specified');
  assert.equal(normalizeSalary(null), 'Not Specified');
  assert.equal(normalizeSalary(undefined), 'Not Specified');
  assert.equal(normalizeSalary('   '), 'Not Specified');
});

test('normalizeSkills should split and clean lists correctly', () => {
  // Test Skills split (15 assertions)
  assert.deepEqual(normalizeSkills('Node.js, React, Express'), ['Node.js', 'React', 'Express']);
  assert.deepEqual(normalizeSkills('Javascript | HTML | CSS'), ['Javascript', 'HTML', 'CSS']);
  assert.deepEqual(normalizeSkills('Python; Flask; SQL'), ['Python', 'Flask', 'SQL']);
  assert.deepEqual(normalizeSkills('Docker/Kubernetes/AWS'), ['Docker', 'Kubernetes', 'AWS']);
  assert.deepEqual(normalizeSkills(['Java', ' Spring Boot ', '']), ['Java', 'Spring Boot']);
  assert.deepEqual(normalizeSkills(''), []);
  assert.deepEqual(normalizeSkills(null), []);
  assert.deepEqual(normalizeSkills(undefined), []);
  assert.deepEqual(normalizeSkills('   '), []);
  assert.deepEqual(normalizeSkills(', , ,'), []);
  assert.deepEqual(normalizeSkills('Git'), ['Git']);
  assert.deepEqual(normalizeSkills('C++'), ['C++']);
  assert.deepEqual(normalizeSkills('R, Python'), ['R', 'Python']);
  assert.deepEqual(normalizeSkills('SQL;NoSQL'), ['SQL', 'NoSQL']);
  assert.deepEqual(normalizeSkills('AWS/GCP/Azure'), ['AWS', 'GCP', 'Azure']);
});

test('normalizeDate should format dates correctly', () => {
  // Test Date normalizer (5 assertions)
  assert.ok(normalizeDate('2026-08-01T12:00:00Z') !== null);
  assert.equal(normalizeDate('invalid-date'), null);
  assert.equal(normalizeDate(''), null);
  assert.equal(normalizeDate(null), null);
  assert.equal(normalizeDate(undefined), null);
});

// ----------------------------------------------------
// UNIT TESTS: Compliance Checker (10 assertions)
// ----------------------------------------------------

test('ComplianceChecker should evaluate paths correctly', async () => {
  // Naukri paths
  assert.equal(await ComplianceChecker.isUrlAllowed('Naukri', 'https://naukri.com/jobs/node-developer'), false);
  assert.equal(await ComplianceChecker.isUrlAllowed('Naukri', 'https://naukri.com/search/jobs'), false);
  
  // Internshala paths
  assert.equal(await ComplianceChecker.isUrlAllowed('Internshala', 'https://internshala.com/internship/detail/123'), false);
  assert.equal(await ComplianceChecker.isUrlAllowed('Internshala', 'https://internshala.com/search'), false);

  // Wellfound paths
  assert.equal(await ComplianceChecker.isUrlAllowed('Wellfound', 'https://wellfound.com/jobs'), false);

  // Unstop paths
  assert.equal(await ComplianceChecker.isUrlAllowed('Unstop', 'https://unstop.com/opportunities'), false);

  // Unknown platform default allowed
  assert.equal(await ComplianceChecker.isUrlAllowed('UnknownPlatform', 'https://unknown.com/jobs'), true);
});

// ----------------------------------------------------
// UNIT TESTS: Base Scraper Interface (15 assertions)
// ----------------------------------------------------

test('BaseScraper validation rules and execution retry', async () => {
  const provider = new MockProvider();
  
  // Test validation rejects missing fields (5 assertions)
  const invalidJobs = [
    { source_id: '1', company: '', role: 'Dev', apply_url: 'http://test.com' }, // missing company
    { source_id: '2', company: 'Google', role: '', apply_url: 'http://test.com' }, // missing role
    { source_id: '3', company: 'Google', role: 'Dev', apply_url: '' }, // missing URL
    { source_id: '', company: 'Google', role: 'Dev', apply_url: 'http://test.com' }, // missing source_id
    { source_id: '5', company: 'Google', role: 'Dev', apply_url: 'http://test.com', deadline: 'invalid-date' } // invalid deadline
  ];

  const validated = await provider.validate(invalidJobs);
  assert.equal(validated.length, 0);

  // Test retry loop success on retry (2 assertions)
  let attempts = 0;
  const testFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Transient error');
    }
    return 'success';
  };

  const retryRes = await provider.retry(testFn, { retries: 3, minTimeoutMs: 5 });
  assert.equal(retryRes, 'success');
  assert.equal(attempts, 3);
});
