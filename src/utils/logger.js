import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const moduleName = meta.module || 'app';
  const payload = {
    timestamp,
    level,
    module: moduleName,
    message,
    ...(meta.error ? { stack: meta.error.stack || null } : {}),
  };

  return JSON.stringify(payload);
}

function writeToFile(entry) {
  const fileName = `${new Date().toISOString().split('T')[0]}.log`;
  const filePath = path.join(logDir, fileName);
  fs.appendFileSync(filePath, `${entry}\n`, 'utf8');
}

function writeAuditLog(entry) {
  const filePath = path.join(logDir, 'audit.log');
  fs.appendFileSync(filePath, `${entry}\n`, 'utf8');
}

function log(level, message, meta = {}) {
  const entry = formatMessage(level, message, meta);
  console.log(entry);
  writeToFile(entry);
}

export function cleanOldLogs() {
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      if (file === 'audit.log') return;
      const filePath = path.join(logDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Failed to purge old log files', error);
  }
}

// Run cleanup sweep once on logger import initialization
cleanOldLogs();

export const logger = {
  info(message, meta) {
    log('INFO', message, meta);
  },
  warn(message, meta) {
    log('WARNING', message, meta);
  },
  error(message, meta) {
    log('ERROR', message, meta);
  },
  debug(message, meta) {
    log('DEBUG', message, meta);
  },
  audit(action, details, meta = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: 'AUDIT',
      action,
      details,
      module: meta.module || 'security'
    };
    const entry = JSON.stringify(payload);
    console.log(entry);
    writeAuditLog(entry);
  }
};
