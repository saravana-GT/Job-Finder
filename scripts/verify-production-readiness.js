import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

// Force reading the real .env file
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: path.resolve(__dirname, '../.env.example') });
}

const { Pool } = pg;

async function testTelegram(token, chatId) {
  if (!token || token.includes('mock') || !chatId || chatId.includes('mock')) {
    return { success: false, reason: 'Using default mock credentials.' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      return { success: false, reason: `Telegram API returned error: ${data.description}` };
    }
    // Attempt sending a message
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✓ Production readiness test alert from Placement Assistant! Your Telegram Bot is successfully configured.'
      })
    });
    const sendData = await sendRes.json();
    if (!sendData.ok) {
      return { success: false, reason: `Failed to send test message: ${sendData.description}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

async function testDatabase(dbUrl) {
  if (!dbUrl || dbUrl.includes('mock') || (dbUrl.includes('localhost') && !process.env.DATABASE_URL)) {
    return { success: false, reason: 'No connection string or using default host config.' };
  }
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const res = await pool.query('SELECT NOW()');
    await pool.end();
    return { success: true, time: res.rows[0].now };
  } catch (error) {
    await pool.end();
    return { success: false, reason: error.message };
  }
}

async function testSupabaseConnection(url, key) {
  if (!url || url.includes('your-project') || !key || key.includes('your-service-role')) {
    return { success: false, reason: 'Using template placeholders.' };
  }
  try {
    const res = await fetch(`${url}/rest/v1/jobs?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (!res.ok) {
      return { success: false, reason: `Supabase status code: ${res.status}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

async function runDiagnostics() {
  const results = [];
  let score = 100;
  const issues = [];

  console.log('[DIAGNOSTICS] Commencing Production Readiness Audit...');

  // 1. Check all environment variables
  const required = ['PORT', 'DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length === 0) {
    results.push({ name: 'Environment variables loaded successfully', status: 'Passed' });
  } else {
    results.push({ name: 'Environment variables loaded successfully', status: 'Failed', reason: `Missing: ${missing.join(', ')}` });
    score -= 15;
    issues.push(`Add missing environment variables: ${missing.join(', ')}`);
  }

  // 2. Validate Telegram token and send message
  console.log('[DIAGNOSTICS] Checking Telegram config...');
  const teleTest = await testTelegram(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);
  if (teleTest.success) {
    results.push({ name: 'Telegram Bot token verification & send test message', status: 'Passed' });
  } else {
    results.push({ name: 'Telegram Bot token verification & send test message', status: 'Failed', reason: teleTest.reason });
    score -= 20;
    issues.push(`Telegram Configuration: ${teleTest.reason}`);
  }

  // 3. Supabase verification
  console.log('[DIAGNOSTICS] Testing Supabase Client Connection...');
  const sbaTest = await testSupabaseConnection(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  if (sbaTest.success) {
    results.push({ name: 'Supabase URL & API service role key connectivity', status: 'Passed' });
  } else {
    results.push({ name: 'Supabase URL & API service role key connectivity', status: 'Warning', reason: sbaTest.reason });
    score -= 5;
    issues.push(`Supabase Integration: ${sbaTest.reason}`);
  }

  // 4. DB connectivity
  console.log('[DIAGNOSTICS] Accessing database pool...');
  const dbTest = await testDatabase(process.env.DATABASE_URL);
  if (dbTest.success) {
    results.push({ name: 'Database client SELECT NOW() check', status: 'Passed' });
  } else {
    results.push({ name: 'Database client SELECT NOW() check', status: 'Failed', reason: dbTest.reason });
    score -= 25;
    issues.push(`Database Connectivity: ${dbTest.reason}`);
  }

  // 5. Google Credentials verification
  const gId = process.env.GOOGLE_CLIENT_ID;
  const gSec = process.env.GOOGLE_CLIENT_SECRET;
  const gRed = process.env.GOOGLE_REDIRECT_URI;
  if (gId && gSec && gRed && !gId.includes('your-google')) {
    results.push({ name: 'Google OAuth Client ID & Secrets present', status: 'Passed' });
    
    // 6. Check Google OAuth URL generation
    try {
      const { googleOAuthService } = await import('../src/services/googleOAuthService.js');
      const url = googleOAuthService.generateAuthUrl();
      if (url) {
        results.push({ name: 'Google OAuth Auth URL generation', status: 'Passed' });
      } else {
        results.push({ name: 'Google OAuth Auth URL generation', status: 'Failed', reason: 'Returned empty URL' });
        score -= 10;
        issues.push('Google Auth: URL generation returned null.');
      }
    } catch (e) {
      results.push({ name: 'Google OAuth Auth URL generation', status: 'Failed', reason: e.message });
      score -= 10;
      issues.push(`Google Auth Module: ${e.message}`);
    }
  } else {
    results.push({ name: 'Google OAuth Client ID & Secrets present', status: 'Warning', reason: 'Missing or using template values. Google integrations will be deactivated gracefully.' });
    results.push({ name: 'Google OAuth Auth URL generation', status: 'Warning', reason: 'OAuth client credentials missing.' });
    score -= 10;
    issues.push('Google credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) not set. Google sync features will be disabled.');
  }

  // Final logs output
  console.log('\n=======================================');
  console.log('       PRODUCTION DIAGNOSTIC REPORT     ');
  console.log('=======================================');
  results.forEach(r => {
    let symbol = '✓';
    if (r.status === 'Failed') symbol = '✗';
    if (r.status === 'Warning') symbol = '⚠';
    console.log(`${symbol} [${r.status}] ${r.name} ${r.reason ? `(${r.reason})` : ''}`);
  });
  console.log(`\nPRODUCTION READINESS SCORE: ${Math.max(0, score)}/100`);
  if (issues.length > 0) {
    console.log('\nREMAINING ACTIONS REQUIRED BEFORE DEPLOYMENT:');
    issues.forEach((iss, idx) => console.log(`${idx + 1}. ${iss}`));
  }
}

runDiagnostics();
