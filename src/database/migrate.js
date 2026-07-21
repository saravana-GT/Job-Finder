import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './connection.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    logger.info('Running database migrations...', { module: 'database' });

    // Execute the SQL schema script
    await query(schemaSql);

    logger.info('Database migrations executed successfully', { module: 'database' });
    return true;
  } catch (error) {
    logger.error('Failed to run database migrations', { module: 'database', error });
    throw error;
  }
}
