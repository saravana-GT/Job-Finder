export function helpCommand() {
  let message = 'ℹ️ *AI Placement Assistant Help*\n\n';
  message += 'Use the following commands to interact with the assistant:\n\n';
  message += '• /start - Welcome message and explanation\n';
  message += '• /help - Show all available commands\n';
  message += '• /status - Show system components health status\n';
  message += '• /jobs - Show latest 10 jobs found\n';
  message += '• /summary - Show total jobs, tracked companies, and upcoming deadlines\n';
  message += '• /notifications - Show notification channel logs and queue health\n';
  message += '• /settings - Show current AI matching and notification settings\n';
  message += '• /threshold <score> - Set minimum AI match score requirement\n';
  message += '• /today - View jobs discovered today sorted by AI score\n';
  message += '• /recommended - View top 10 recommended matches (>= 75% score)\n';
  message += '• /reject <company_name> - Reject and ignore jobs from a specific company (e.g. /reject Amazon)\n\n';
  message += '_All notifications and sync runs are automated via background schedulers._';
  return message;
}
