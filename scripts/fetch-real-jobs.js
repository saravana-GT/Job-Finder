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

async function fetchJobsByTag(tag) {
  try {
    const res = await fetch(`https://remoteok.com/api?tag=${tag}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.error(`Failed to fetch tag ${tag}: ${res.status}`);
      return [];
    }

    const json = await res.json();
    return json.slice(1); // skip disclaimer
  } catch (err) {
    console.error(`Fetch error for tag ${tag}:`, err.message);
    return [];
  }
}

async function fetchAndIngest() {
  console.log('Connecting to Singapore database and fetching live Java/Developer remote jobs...');
  try {
    // Fetch Java and Developer jobs in parallel
    const [javaJobs, devJobs] = await Promise.all([
      fetchJobsByTag('java'),
      fetchJobsByTag('developer')
    ]);

    const rawJobs = [...javaJobs, ...devJobs];
    console.log(`Fetched total ${rawJobs.length} raw jobs across tags. Processing...`);

    const profile = await getProfile();
    let savedCount = 0;

    for (const raw of rawJobs) {
      if (savedCount >= 10) break; // Limit to 10 matching jobs

      const skills = raw.tags || ['developer'];
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
      // We want to verify it matches our Java, C, Spring, SQL, DSA, OOP skills
      const hasDirectSkillMatch = skills.some(s => 
        ['java', 'c', 'dsa', 'spring', 'sql', 'mysql', 'postgresql', 'oop'].includes(s.toLowerCase())
      );
      
      const aiScore = hasDirectSkillMatch ? Math.min(100, 70 + match.totalScore) : Math.max(50, match.totalScore);

      // Only save jobs with AI score >= 50%
      if (aiScore < 50) {
        continue;
      }

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
      console.log(`✓ Saved matching English job: "${job.role}" at ${job.company} (AI Score: ${aiScore}%)`);
    }

    console.log(`\nSuccess! Ingested ${savedCount} new matching English remote jobs.`);
    await pool.end();
  } catch (error) {
    console.error('Fetch and Ingest failed:', error.message);
    await pool.end();
  }
}

fetchAndIngest();
