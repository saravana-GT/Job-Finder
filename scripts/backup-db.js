import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.resolve(__dirname, '../backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

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

async function runBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[BACKUP] DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  const dbParams = parseDatabaseUrl(dbUrl);
  if (!dbParams) {
    console.error('[BACKUP] Failed to parse connection parameters from DATABASE_URL.');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `db_backup_${timestamp}.sql`;
  const filepath = path.join(backupDir, filename);

  const command = `pg_dump -h ${dbParams.host} -p ${dbParams.port} -U ${dbParams.user} -F p -f "${filepath}" ${dbParams.database}`;

  console.log(`[BACKUP] Starting database dump to: ${filepath}`);
  
  const options = {
    env: { ...process.env, PGPASSWORD: dbParams.password }
  };

  exec(command, options, (error, stdout, stderr) => {
    if (error) {
      console.error(`[BACKUP] pg_dump failed: ${error.message}`);
      console.error(stderr);
      process.exit(1);
    }
    console.log(`[BACKUP] Database dump completed successfully. File: ${filename}`);
    
    // Purge backups older than 7 days
    try {
      const files = fs.readdirSync(backupDir);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      files.forEach(file => {
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`[BACKUP] Purged old backup file: ${file}`);
        }
      });
    } catch (err) {
      console.error('[BACKUP] Failed to purge old backups', err);
    }
    process.exit(0);
  });
}

runBackup();
