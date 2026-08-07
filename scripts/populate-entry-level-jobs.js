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

async function populateTrustedJobs() {
  console.log('Connecting to Singapore database and populating highly trusted developer jobs...');
  try {
    // 1. Truncate table
    await pool.query('TRUNCATE TABLE jobs CASCADE');
    console.log('✓ Successfully cleared old jobs from database.');

    // 2. Official direct career boards for top-tier companies
    const trustedJobs = [
      {
        platform: 'Google',
        company: 'Google India',
        role: 'Software Engineering Graduate / Fresher Roles',
        location: 'Bangalore / Hyderabad',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: '0-2 years (Entry Level)',
        skills: ['Java', 'C', 'DSA', 'Problem Solving', 'OOP'],
        description: 'Official Google India careers page for Software Engineer openings. Freshers and university graduates can apply directly.',
        apply_url: 'https://www.google.com/about/careers/applications/jobs/results/?q=Software%20Engineer&location=India',
        source_id: 'google-india-se',
        ai_score: 95
      },
      {
        platform: 'Amazon',
        company: 'Amazon India',
        role: 'Software Development Engineer (SDE I / Intern)',
        location: 'Bangalore / Pune / Chennai',
        employment_type: 'Full Time / Intern',
        salary: 'Competitive',
        experience: '0-1 years (Fresher)',
        skills: ['Java', 'C', 'DSA', 'SQL', 'OOP'],
        description: 'Official Amazon India careers page for Software Development Engineer (SDE-I) and Developer Internship positions.',
        apply_url: 'https://www.amazon.jobs/en/search?base_query=Software+Development+Engineer&loc_query=India',
        source_id: 'amazon-india-sde',
        ai_score: 95
      },
      {
        platform: 'Microsoft',
        company: 'Microsoft India',
        role: 'Software Engineer / Graduate Trainee',
        location: 'Hyderabad / Bangalore',
        employment_type: 'Full Time',
        salary: 'Competitive',
        experience: '0-2 years (Fresher)',
        skills: ['Java', 'C', 'DSA', 'OOP', 'Problem Solving'],
        description: 'Official Microsoft India careers page for Software Engineer and Graduate developer positions.',
        apply_url: 'https://careers.microsoft.com/us/en/search-results?rt=professional&keywords=Software%20Engineer&location=India',
        source_id: 'microsoft-india-se',
        ai_score: 95
      },
      {
        platform: 'TCS',
        company: 'Tata Consultancy Services (TCS)',
        role: 'TCS Ninja & Digital Programmer (Fresher)',
        location: 'PAN India (Remote/Onsite)',
        employment_type: 'Full Time',
        salary: '3.6 - 7.0 LPA',
        experience: '0 years (Fresh Graduate)',
        skills: ['Java', 'C', 'SQL', 'DSA', 'OOP'],
        description: 'Official TCS careers page for Ninja and Digital entry-level hiring programs. Open to all engineering and science graduates.',
        apply_url: 'https://www.tcs.com/careers/india',
        source_id: 'tcs-india-fresher',
        ai_score: 90
      },
      {
        platform: 'Infosys',
        company: 'Infosys Limited',
        role: 'System Engineer / Specialist Programmer (Fresher)',
        location: 'PAN India',
        employment_type: 'Full Time',
        salary: '3.6 - 6.2 LPA',
        experience: '0 years (Fresh Graduate)',
        skills: ['Java', 'C', 'SQL', 'DSA', 'OOP'],
        description: 'Official Infosys career portal for System Engineer and Specialist Programmer hiring campaigns.',
        apply_url: 'https://career.infosys.com',
        source_id: 'infosys-india-se',
        ai_score: 90
      }
    ];

    // 3. Insert jobs
    for (const job of trustedJobs) {
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
      console.log(`✓ Ingested highly trusted job: "${job.role}" at ${job.company}`);
    }

    console.log('\nAll highly trusted fresher jobs populated successfully!');
    await pool.end();
  } catch (err) {
    console.error('Failed to populate:', err.message);
    await pool.end();
  }
}

populateTrustedJobs();
