import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function parseDatabaseUrl(url) {
  if (!url) return null;
  // Format: postgres://user:password@host:port/database
  const matches = url.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!matches) return null;
  return {
    user: matches[1],
    password: matches[2],
    host: matches[3],
    port: matches[4],
    database: matches[5].split('?')[0]
  };
}

async function runRestore() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('[RESTORE] Usage: node scripts/restore-db.js <path-to-sql-backup-file>');
    process.exit(1);
  }

  const filepath = path.resolve(backupFile);
  if (!fs.existsSync(filepath)) {
    console.error(`[RESTORE] Backup file not found at path: ${filepath}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[RESTORE] DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  const dbParams = parseDatabaseUrl(dbUrl);
  if (!dbParams) {
    console.error('[RESTORE] Failed to parse connection parameters from DATABASE_URL.');
    process.exit(1);
  }

  // Restore command using psql
  const command = `psql -h ${dbParams.host} -p ${dbParams.port} -U ${dbParams.user} -d ${dbParams.database} -f "${filepath}"`;

  console.log(`[RESTORE] Restoring database from: ${filepath}`);

  const options = {
    env: { ...process.env, PGPASSWORD: dbParams.password }
  };

  exec(command, options, (error, stdout, stderr) => {
    if (error) {
      console.error(`[RESTORE] psql failed: ${error.message}`);
      console.error(stderr);
      process.exit(1);
    }
    console.log('[RESTORE] Database restored successfully!');
    process.exit(0);
  });
}

runRestore();
