import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically set NODE_ENV to test when running under npm test
if (process.env.npm_lifecycle_event === 'test') {
  process.env.NODE_ENV = 'test';
}

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnv = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID'
];

function applyDefaultEnv() {
  if (!process.env.PORT) process.env.PORT = '3000';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  if (!process.env.APP_NAME) process.env.APP_NAME = 'placement-assistant';
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';
  if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://mock.supabase.co';
  if (!process.env.SUPABASE_KEY) process.env.SUPABASE_KEY = 'mock-supabase-key';
  if (!process.env.TELEGRAM_BOT_TOKEN) process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';
  if (!process.env.TELEGRAM_CHAT_ID) process.env.TELEGRAM_CHAT_ID = 'mock-chat-id';
}

function requireEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'test') {
      applyDefaultEnv();
      return;
    }

    console.error(`❌ FATAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

applyDefaultEnv();
requireEnv();

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'placement-assistant',
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};

