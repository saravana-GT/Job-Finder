import fetch from 'node-fetch';
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

async function getProfile() {
  const profilePath = path.resolve(__dirname, '../src/database/profile.json');
  if (fs.existsSync(profilePath)) {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }
  return {
    skills: ["Java", "C", "DSA", "Prompt Engineering", "Spring", "Spring Boot", "SQL", "Problem Solving", "OOP"],
    preferred_roles: ["Software Engineer", "Backend Developer", "Full Stack Developer"]
  };
}

function calculateMatchScore(job, profile) {
  const jobSkills = (job.skills || []).map(s => s.toLowerCase());
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
  
  if (jobSkills.length === 0) return { totalScore: 50, matchedSkills: [], missingSkills: [] };

  const matched = jobSkills.filter(s => profileSkills.includes(s));
  const missing = jobSkills.filter(s => !profileSkills.includes(s));
  
  const skillScore = Math.round((matched.length / jobSkills.length) * 100);
  return {
    totalScore: skillScore,
    matchedSkills: matched,
    missingSkills: missing
  };
}

async function populateActiveJobs() {
  console.log('Connecting to Singapore database and fetching live active developer jobs...');
  try {
    const res = await fetch('https://arbeitnow.com/api/job-board-api');
    if (!res.ok) {
      throw new Error(`Failed to fetch from Arbeitnow: ${res.status}`);
    }
    const payload = await res.json();
    const rawJobs = payload.data || [];
    console.log(`Fetched ${rawJobs.length} live jobs. Filtering for developers/engineers...`);

    // Clear old listings first
    await pool.query('TRUNCATE TABLE jobs CASCADE');
    console.log('✓ Successfully cleared old jobs from database.');

    const profile = await getProfile();
    let savedCount = 0;

    for (const raw of rawJobs) {
      if (savedCount >= 8) break; // Limit to 8 matching jobs for clean display

      const title = raw.title || '';
      const isDev = title.toLowerCase().includes('developer') || 
                    title.toLowerCase().includes('engineer') || 
                    title.toLowerCase().includes('programmer') ||
                    title.toLowerCase().includes('backend') ||
                    title.toLowerCase().includes('tech lead');

      if (!isDev) continue;

      const skills = raw.tags || ['Java', 'SQL', 'Developer'];
      const job = {
        platform: 'Arbeitnow',
        company: (raw.company_name || 'Tech Company').slice(0, 99),
        role: title.slice(0, 99),
        location: raw.location || (raw.remote ? 'Remote' : 'Onsite'),
        employment_type: (raw.job_types?.[0] || 'Full Time').slice(0, 99),
        salary: 'Competitive',
        experience: 'Mid-Senior',
        skills: skills,
        description: raw.description ? raw.description.replace(/<[^>]*>/g, '').slice(0, 500) + '...' : '',
        apply_url: (raw.url || '').slice(0, 254),
        source_id: (raw.slug || '').slice(0, 99),
        deadline: null
      };

      // Calculate AI score
      const match = calculateMatchScore(job, profile);
      // Give a boost to jobs that are strongly related to Java, Spring, SQL, or C
      const matchesTargetSkills = skills.some(s => 
        ['java', 'spring', 'spring boot', 'sql', 'c', 'c++', 'dsa'].includes(s.toLowerCase())
      ) || title.toLowerCase().includes('java') || title.toLowerCase().includes('backend') || title.toLowerCase().includes('c++');

      const aiScore = matchesTargetSkills ? Math.min(100, 75 + match.totalScore) : Math.max(50, match.totalScore);

      // Save to database
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
        job.deadline,
        aiScore
      ]);
      savedCount++;
      console.log(`✓ Saved active job: "${job.role}" at ${job.company} (AI Score: ${aiScore}%)`);
    }

    console.log(`\nSuccess! Ingested ${savedCount} real active developer jobs.`);
    await pool.end();
  } catch (error) {
    console.error('Fetch and Ingest failed:', error.message);
    await pool.end();
  }
}

populateActiveJobs();
