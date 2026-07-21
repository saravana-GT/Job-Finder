import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { SkillExtractor } from '../src/services/skillExtractor.js';
import { KeywordExtractor } from '../src/services/keywordExtractor.js';
import { MatchingEngine } from '../src/services/matchingEngine.js';
import { LearningSuggestionEngine } from '../src/services/learningSuggestionEngine.js';
import { recommendationEngine } from '../src/services/recommendationEngine.js';

// Setup test environment
process.env.NODE_ENV = 'test';

// ----------------------------------------------------
// UNIT TESTS: Skill Extractor
// ----------------------------------------------------

test('SkillExtractor: Extracts canonical skills correctly from text', () => {
  const text = 'Looking for a Senior Software Engineer with strong experience in Spring Boot, golang, and nextjs. Familiarity with redis and restful apis is a plus.';
  const extracted = SkillExtractor.extractSkills(text);

  assert.ok(extracted.includes('spring boot'));
  assert.ok(extracted.includes('go')); // mapped from golang
  assert.ok(extracted.includes('next.js')); // mapped from nextjs
  assert.ok(extracted.includes('redis'));
  assert.ok(extracted.includes('rest apis')); // mapped from restful apis
});

test('SkillExtractor: Merges and cleans existing skills', () => {
  const existing = ['React', 'NodeJS', 'Java'];
  const text = 'Knowledge of TypeScript, spring boot, and PostgreSQL.';
  const merged = SkillExtractor.getMergedSkills(existing, text, 'Full Stack Intern');

  const lowerMerged = merged.map(s => s.toLowerCase());
  assert.ok(lowerMerged.includes('react'));
  assert.ok(lowerMerged.includes('nodejs') || lowerMerged.includes('node.js'));
  assert.ok(lowerMerged.includes('java'));
  assert.ok(lowerMerged.includes('typescript'));
  assert.ok(lowerMerged.includes('spring boot'));
  assert.ok(lowerMerged.includes('postgresql'));
});

// ----------------------------------------------------
// UNIT TESTS: Keyword Extractor
// ----------------------------------------------------

test('KeywordExtractor: Parses experience strings correctly', () => {
  assert.deepEqual(KeywordExtractor.parseExperience('0-2 years'), { min: 0, max: 2 });
  assert.deepEqual(KeywordExtractor.parseExperience('2 to 5 years'), { min: 2, max: 5 });
  assert.deepEqual(KeywordExtractor.parseExperience('5+ yrs'), { min: 5, max: 99 });
  assert.deepEqual(KeywordExtractor.parseExperience('Fresher opportunity'), { min: 0, max: 1 });
  assert.deepEqual(KeywordExtractor.parseExperience('3 years'), { min: 3, max: 3 });
  assert.deepEqual(KeywordExtractor.parseExperience('Not Specified'), { min: 0, max: 99 });
});

test('KeywordExtractor: Parses salary ranges correctly', () => {
  assert.deepEqual(KeywordExtractor.parseSalary('10 - 15 LPA'), { min: 1000000, max: 1500000, isCompetitive: false });
  assert.deepEqual(KeywordExtractor.parseSalary('12 LPA'), { min: 1200000, max: 1200000, isCompetitive: false });
  assert.deepEqual(KeywordExtractor.parseSalary('15,000 /month'), { min: 180000, max: 180000, isCompetitive: false }); // note stipends normalized to lpa/annual (15k * 12 = 180k)
  assert.deepEqual(KeywordExtractor.parseSalary('$100k - $120k'), { min: 8000000, max: 9600000, isCompetitive: false }); // 100k usd * 80 conversion
  assert.deepEqual(KeywordExtractor.parseSalary('Competitive'), { min: null, max: null, isCompetitive: true });
});

// ----------------------------------------------------
// UNIT TESTS: Matching & Suggestions Engines
// ----------------------------------------------------

test('MatchingEngine: Calculates match score correctly', () => {
  const profile = {
    skills: ['Java', 'Spring Boot', 'SQL', 'Git', 'Spring'],
    programming_languages: ['Java'],
    frameworks: ['Spring Boot'],
    databases: ['SQL'],
    tools: ['Git'],
    preferred_roles: ['Backend Developer', 'Software Engineer'],
    preferred_locations: ['Remote', 'Bangalore'],
    expected_salary: '10 LPA',
    preferred_employment_type: 'Full Time',
    years_of_experience: 2
  };

  const job = {
    role: 'Spring Boot Developer',
    company: 'Tech Corp',
    location: 'Remote',
    employment_type: 'Full Time',
    salary: '12 - 18 LPA',
    experience: '1-3 years',
    skills: ['Java', 'Spring Boot', 'SQL']
  };

  const match = MatchingEngine.calculateMatchScore(job, profile);
  console.log('[DEBUG TEST] Calculated match score breakdown:', JSON.stringify(match));
  assert.ok(match.totalScore >= 90); // Should be an excellent match
  assert.deepEqual(match.matchedSkills, ['Java', 'Spring Boot', 'SQL', 'Spring']);
  assert.equal(match.missingSkills.length, 0);
});

test('LearningSuggestionEngine: Returns docs for missing skills', () => {
  const suggestions = LearningSuggestionEngine.getSuggestions(['TypeScript', 'Docker']);
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].skill, 'TypeScript');
  assert.ok(suggestions[0].resourceUrl.includes('typescriptlang.org'));
  assert.equal(suggestions[1].skill, 'Docker');
  assert.ok(suggestions[1].resourceUrl.includes('docker.com'));
});

// ----------------------------------------------------
// INTEGRATION TESTS: APIs
// ----------------------------------------------------

test('Integration: GET and PUT user profile', async () => {
  const getRes = await request(app).get('/api/profile');
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.success, true);
  assert.ok(Array.isArray(getRes.body.data.skills));

  const updatedProfile = {
    ...getRes.body.data,
    years_of_experience: 3,
    expected_salary: '12 LPA'
  };

  const putRes = await request(app).put('/api/profile').send(updatedProfile);
  assert.equal(putRes.status, 200);
  assert.equal(putRes.body.success, true);
  assert.equal(putRes.body.data.years_of_experience, 3);
});

test('Integration: Job matching endpoints list recommendations', async () => {
  const recommendedRes = await request(app).get('/api/jobs/recommended');
  assert.equal(recommendedRes.status, 200);
  assert.equal(recommendedRes.body.success, true);
  assert.ok(Array.isArray(recommendedRes.body.data));

  const highScoreRes = await request(app).get('/api/jobs/high-score');
  assert.equal(highScoreRes.status, 200);
  assert.equal(highScoreRes.body.success, true);
  assert.ok(Array.isArray(highScoreRes.body.data));

  const matchReportRes = await request(app).get('/api/jobs/match/1');
  assert.equal(matchReportRes.status, 200);
  assert.equal(matchReportRes.body.success, true);
  assert.ok('overallScore' in matchReportRes.body.data);
  assert.ok('matchLevel' in matchReportRes.body.data);
});

// ----------------------------------------------------
// PERFORMANCE TEST: Scoring speed
// ----------------------------------------------------

test('Performance: Scoring 1000 jobs runs efficiently', () => {
  const profile = {
    skills: ['Java', 'Spring Boot', 'SQL', 'Git', 'JavaScript', 'Node.js', 'MySQL', 'HTML', 'CSS', 'REST APIs', 'DSA', 'OOP'],
    preferred_roles: ['Software Engineer', 'Backend Developer'],
    preferred_locations: ['Remote', 'Bangalore'],
    expected_salary: '10 LPA',
    preferred_employment_type: 'Full Time',
    years_of_experience: 2
  };

  const jobs = [];
  for (let i = 0; i < 1000; i++) {
    jobs.push({
      role: `Engineer Level ${i}`,
      company: `Enterprise ${i}`,
      location: i % 2 === 0 ? 'Remote' : 'Bangalore',
      employment_type: 'Full Time',
      salary: '8 - 12 LPA',
      experience: '2-4 years',
      skills: ['Java', 'Spring Boot', 'SQL', 'Docker', 'Git']
    });
  }

  const start = Date.now();
  for (const job of jobs) {
    MatchingEngine.calculateMatchScore(job, profile);
  }
  const duration = Date.now() - start;

  console.log(`[PERFORMANCE] Scored 1000 jobs in ${duration}ms.`);
  assert.ok(duration < 1000); // Adjusted for virtual CI/CD environments
});
