import { startCommand } from '../commands/start.js';
import { helpCommand } from '../commands/help.js';
import { statusCommand } from '../commands/status.js';
import { jobsCommand } from '../commands/jobs.js';
import { summaryCommand } from '../commands/summary.js';
import { notificationsCommand } from '../commands/notifications.js';
import { settingsCommand } from '../commands/settings.js';
import { thresholdCommand } from '../commands/threshold.js';
import { todayCommand } from '../commands/today.js';
import { recommendedCommand } from '../commands/recommended.js';
import { rejectCommand } from '../commands/reject.js';
import { logger } from '../../utils/logger.js';

export async function handleCommand(command, chatId) {
  const normalizedCommand = command.trim().split(' ')[0].toLowerCase();

  logger.debug(`Routing command: ${normalizedCommand} for chat: ${chatId}`, { module: 'telegram' });

  try {
    switch (normalizedCommand) {
      case '/start':
        return startCommand();
      case '/help':
        return helpCommand();
      case '/status':
        return statusCommand();
      case '/jobs':
        return jobsCommand();
      case '/summary':
        return summaryCommand();
      case '/notifications':
        return notificationsCommand();
      case '/settings':
        return settingsCommand();
      case '/threshold':
        return thresholdCommand(command);
      case '/today':
        return todayCommand();
      case '/recommended':
        return recommendedCommand();
      case '/reject':
        return rejectCommand(command);
      default:
        return `❌ *Unknown command: ${command}*\n\nType /help to see all available commands.`;
    }
  } catch (error) {
    logger.error(`Error executing command ${normalizedCommand}`, { module: 'telegram', error });
    return `⚠️ *Error:* An error occurred while executing the command. Please try again later.`;
  }
}
