import { query } from '../../database/connection.js';
import { scheduler } from '../../scheduler/scheduler.js';

export async function statusCommand() {
  let dbStatus = '🟢 Connected';
  try {
    await query('SELECT 1');
  } catch (error) {
    dbStatus = '🔴 Disconnected';
  }

  // We check if cron tasks are registered in scheduler
  const schedulerStatus = scheduler.cronTasks && scheduler.cronTasks.length > 0 ? '🟢 Active' : '🟡 Idle (Wait for start)';
  const telegramStatus = '🟢 Active';
  const githubStatus = '🟢 Configured (Runs every 30 minutes)';
  const systemTime = new Date().toISOString();

  let message = '⚙️ *Placement Assistant Status*\n\n';
  message += `🗄️ *Database:* ${dbStatus}\n`;
  message += `⏱️ *Scheduler:* ${schedulerStatus}\n`;
  message += `🤖 *Telegram Bot:* ${telegramStatus}\n`;
  message += `🐙 *GitHub Actions:* ${githubStatus}\n`;
  message += `🕒 *System Time:* \`${systemTime}\`\n`;

  return message;
}
