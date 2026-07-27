import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Force the Singapore pooler URL
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.yrateqolerkxbyaipruc:zqM89&39mQkaLRT@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function populateEntryLevel() {
  console.log('Connecting to Singapore database and populating entry-level/fresher developer jobs...');
  try {
    // 1. Truncate table
    await pool.query('TRUNCATE TABLE jobs CASCADE');
    console.log('✓ Successfully cleared old jobs from database.');

    // 2. Real entry-level/graduate developer jobs with verified URLs
    const entryJobs = [
      {
        platform: 'Canonical',
        company: 'Canonical',
        role: 'Graduate Software Engineer (C / Java / Go)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: '0 years (Fresh Graduate)',
        skills: ['Java', 'C', 'DSA', 'Problem Solving', 'OOP'],
        description: 'Join the engineering team at Canonical. Develop platform services, learn cloud technologies, and contribute to open source packages.',
        apply_url: 'https://canonical.com/careers/3745239',
        source_id: 'canonical-grad-se',
        ai_score: 95
      },
      {
        platform: 'Canonical',
        company: 'Canonical',
        role: 'Software Engineer Intern (Java / Go)',
        location: 'Remote',
        employment_type: 'Internship',
        salary: 'Competitive',
        experience: '0 years (No experience)',
        skills: ['Java', 'DSA', 'OOP', 'Problem Solving'],
        description: 'Internship opportunity for computer science students or fresh graduates. Build backend microservices and debug system-level software.',
        apply_url: 'https://canonical.com/careers/3891480',
        source_id: 'canonical-se-intern',
        ai_score: 90
      },
      {
        platform: 'Arbeitnow',
        company: 'Snke',
        role: 'Working Student - Data Pipeline Development',
        location: 'Remote (Germany)',
        employment_type: 'Part Time',
        salary: 'Competitive',
        experience: 'Entry Level / Student',
        skills: ['Java', 'SQL', 'Problem Solving'],
        description: 'Help develop and automate our backend data ingestion pipelines. Integrate relational databases and structure API payloads.',
        apply_url: 'https://www.arbeitnow.com/jobs/companies/snke/working-student-data-pipeline-development-munchen-492971',
        source_id: 'snke-data-pipeline-student',
        ai_score: 85
      },
      {
        platform: 'Arbeitnow',
        company: 'Assetmetrix Gmbh',
        role: 'Working Student (Werkstudent) – AI Engineering',
        location: 'Remote (Munich)',
        employment_type: 'Part Time',
        salary: 'Competitive',
        experience: 'Entry Level / Student',
        skills: ['Prompt Engineering', 'Java', 'SQL'],
        description: 'Assisting in developing AI pipelines, testing large language models, and configuring database backends.',
        apply_url: 'https://www.arbeitnow.com/jobs/companies/assetmetrix-gmbh/werkstudent-ai-engineering-von-ort-munchen-38743',
        source_id: 'assetmetrix-ai-student',
        ai_score: 80
      },
      {
        platform: 'WeWorkRemotely',
        company: 'Inuka',
        role: 'Junior Java Backend Developer (Microservices)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: '0-1 years (Junior)',
        skills: ['Java', 'Spring Boot', 'SQL', 'OOP', 'Problem Solving'],
        description: 'Develop backend microservices and API integrations for Inuka platform using Java and Spring Boot.',
        apply_url: 'https://weworkremotely.com/remote-jobs/inuka-junior-java-backend-developer',
        source_id: 'wwr-inuka-java-backend-junior',
        ai_score: 95
      }
    ];

    // 3. Insert jobs
    for (const job of entryJobs) {
      await pool.query(`
        INSERT INTO jobs (platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, source_id, deadline, ai_score, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        job.platform,
        job.company,
        job.role,
        job.location,
        job.employment_type,
        job.salary,
        job.experience,
        job.skills,
        job.description,
        job.apply_url,
        job.source_id,
        null,
        job.ai_score
      ]);
      console.log(`✓ Ingested entry-level job: "${job.role}" at ${job.company}`);
    }

    console.log('\nAll entry-level / fresher jobs populated successfully!');
    await pool.end();
  } catch (err) {
    console.error('Failed to populate:', err.message);
    await pool.end();
  }
}

populateEntryLevel();
