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

// Force the Singapore pooler URL for direct script runs
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.yrateqolerkxbyaipruc:zqM89&39mQkaLRT@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function getProfile() {
  const profilePath = path.resolve(__dirname, '../src/database/profile.json');
  if (fs.existsSync(profilePath)) {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }
  return {
    skills: ["Java", "C", "DSA", "SQL", "Problem Solving", "OOP"],
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

async function fetchAndIngest() {
  console.log('Connecting to Singapore database and fetching live English remote jobs...');
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch from RemoteOK: ${res.status}`);
    }

    const json = await res.json();
    // The first item in RemoteOK response is always a legal disclaimer, skip it
    const rawJobs = json.slice(1);
    console.log(`Fetched ${rawJobs.length} live English remote jobs. Processing...`);

    const profile = await getProfile();
    let savedCount = 0;

    for (const raw of rawJobs.slice(0, 10)) {
      const skills = raw.tags || ['software', 'developer'];
      const job = {
        platform: 'RemoteOK',
        company: (raw.company || 'Remote Company').slice(0, 99),
        role: (raw.position || 'Software Developer').slice(0, 99),
        location: 'Remote',
        employment_type: 'Full Time',
        salary: raw.salary || 'Competitive',
        experience: 'Entry-Mid',
        skills: skills,
        description: raw.description ? raw.description.replace(/<[^>]*>/g, '').slice(0, 500) + '...' : '',
        apply_url: (raw.url || '').slice(0, 254),
        source_id: (raw.id || '').toString().slice(0, 99),
        deadline: null
      };

      // Deduplicate check
      const checkRes = await pool.query('SELECT id FROM jobs WHERE platform = $1 AND source_id = $2', [job.platform, job.source_id]);
      if (checkRes.rows.length > 0) {
        continue;
      }

      // Calculate AI score
      const match = calculateMatchScore(job, profile);
      const aiScore = Math.max(50, match.totalScore); // Baseline 50% for relevance

      // Save
      await pool.query(`
        INSERT INTO jobs (platform, company, role, location, employment_type, salary, experience, skills, description, apply_url, source_id, deadline, ai_score, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
      console.log(`✓ Saved real English job: "${job.role}" at ${job.company} (AI Score: ${aiScore}%)`);
    }

    console.log(`\nSuccess! Ingested ${savedCount} new English remote jobs.`);
    await pool.end();
  } catch (error) {
    console.error('Fetch and Ingest failed:', error.message);
    await pool.end();
  }
}

fetchAndIngest();
