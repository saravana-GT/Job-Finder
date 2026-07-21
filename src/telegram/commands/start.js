export function startCommand() {
  let message = '🚀 *Welcome to AI Placement Assistant!*\n\n';
  message += 'I am your personal AI-powered assistant designed to help you track job applications, deadlines, and find relevant job postings.\n\n';
  message += '*Available Commands:*\n';
  message += '• /start - Welcome message and explanation\n';
  message += '• /help - Display this help message containing all commands\n';
  message += '• /status - Show the status of system components (DB, Scheduler, etc.)\n';
  message += '• /jobs - Retrieve the latest 10 job listings in the database\n';
  message += '• /summary - Show total jobs, companies, today\'s postings, and upcoming deadlines';
  return message;
}
