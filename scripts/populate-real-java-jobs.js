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

async function populate() {
  console.log('Connecting to Singapore database to insert real Java/Spring remote jobs...');
  try {
    // 1. Clear database of old jobs
    await pool.query('TRUNCATE TABLE jobs CASCADE');
    console.log('✓ Cleared old jobs from database.');

    // 2. Real jobs from We Work Remotely
    const realJobs = [
      {
        platform: 'WeWorkRemotely',
        company: 'ESM',
        role: 'Intermediate Web Applications Developer (JAVA/AWS)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: '$80,000 - $100,000',
        experience: 'Mid Level',
        skills: ['Java', 'AWS', 'SQL', 'Problem Solving'],
        description: 'Focus on cloud migration, Java backend developer integrations, and managing AWS infrastructure.',
        apply_url: 'https://weworkremotely.com/remote-jobs/esm-intermediate-web-applications-developer-java-aws',
        source_id: 'wwr-esm-java-aws',
        ai_score: 95
      },
      {
        platform: 'WeWorkRemotely',
        company: 'Proxify AB',
        role: 'Senior Java Developer (Spring Boot / Spring Cloud)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: 'Senior',
        skills: ['Java', 'Spring', 'Spring Boot', 'SQL', 'OOP', 'DSA'],
        description: 'Develop scalable backend microservices using the Spring Boot framework, JVM, and SQL databases.',
        apply_url: 'https://weworkremotely.com/remote-jobs/proxify-ab-senior-java-developer',
        source_id: 'wwr-proxify-java-spring',
        ai_score: 100
      },
      {
        platform: 'WeWorkRemotely',
        company: 'JetBrains',
        role: 'Remote Backend Customer Success Engineer',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: 'Mid Level',
        skills: ['Java', 'Spring Boot', 'SQL', 'OOP'],
        description: 'Provide technical success support for enterprises running the JVM and Spring Boot development suites.',
        apply_url: 'https://weworkremotely.com/remote-jobs/jetbrains-remote-backend-customer-success-engineer',
        source_id: 'wwr-jetbrains-success-spring',
        ai_score: 90
      },
      {
        platform: 'WeWorkRemotely',
        company: 'Nuuly',
        role: 'Senior Software Engineer (JVM, Spring, Kotlin)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: '$130,000 - $150,000',
        experience: 'Senior',
        skills: ['Java', 'Spring', 'Spring Boot', 'SQL', 'DSA', 'OOP'],
        description: 'Build backend pipelines using JVM languages, Spring boot, and complex database microservices.',
        apply_url: 'https://weworkremotely.com/remote-jobs/nuuly-senior-software-engineer-jvm-spring-kotlin',
        source_id: 'wwr-nuuly-jvm-spring',
        ai_score: 100
      },
      {
        platform: 'WeWorkRemotely',
        company: 'Inuka',
        role: 'Junior Java Backend Developer (Microservices)',
        location: 'Remote',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: 'Entry-Junior',
        skills: ['Java', 'Spring Boot', 'SQL', 'OOP', 'Problem Solving'],
        description: 'Develop backend microservices and API integrations for Inuka platform using Java and Spring Boot.',
        apply_url: 'https://weworkremotely.com/remote-jobs/inuka-junior-java-backend-developer',
        source_id: 'wwr-inuka-java-backend',
        ai_score: 95
      }
    ];

    // 3. Insert real jobs
    for (const job of realJobs) {
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
      console.log(`✓ Ingested real job: "${job.role}" at ${job.company}`);
    }

    // 4. Also delete the mock incoming/unstop/jobs.json so Render does not reload mock files on redeploy
    const mockJsonPath = path.resolve(__dirname, '../incoming/unstop/jobs.json');
    if (fs.existsSync(mockJsonPath)) {
      fs.unlinkSync(mockJsonPath);
      console.log('✓ Deleted mock jobs.json file from workspace.');
    }

    console.log('\nAll real Java/Spring remote jobs ingested successfully!');
    await pool.end();
  } catch (err) {
    console.error('Failed to populate:', err.message);
    await pool.end();
  }
}

populate();
