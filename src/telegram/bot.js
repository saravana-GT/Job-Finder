import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { handleCommand } from './handlers/commandHandler.js';

let bot = null;

export function initTelegramBot() {
  if (bot) return bot;

  const token = config.telegramBotToken;
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram Bot is disabled.', { module: 'telegram' });
    return null;
  }

  // Telegram bot polling shouldn't run in test environment to avoid hangs or polling conflicts
  if (process.env.NODE_ENV === 'test') {
    logger.info('Telegram Bot running in mock test mode.', { module: 'telegram' });
    bot = {
      sendMessage: async (chatId, text) => {
        logger.debug(`[TEST] Mock telegram bot sendMessage to ${chatId}: ${text}`, { module: 'telegram' });
        return { message_id: 1 };
      }
    };
    return bot;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    logger.info('Telegram Bot initialized and polling started.', { module: 'telegram' });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text || !text.startsWith('/')) {
        return; // ignore non-command messages
      }

      logger.info(`Telegram message received: "${text}" from Chat ID: ${chatId}`, { module: 'telegram' });

      try {
        const response = await handleCommand(text, chatId);
        if (Array.isArray(response)) {
          for (const item of response) {
            await bot.sendMessage(chatId, item.text, {
              parse_mode: 'HTML',
              reply_markup: item.reply_markup
            });
          }
        } else {
          const isHtml = response.includes('href=') || response.includes('<b>') || response.includes('</a>');
          const parseMode = isHtml ? 'HTML' : 'Markdown';
          await bot.sendMessage(chatId, response, { parse_mode: parseMode });
        }
      } catch (err) {
        logger.error(`Failed to handle telegram command "${text}"`, { module: 'telegram', error: err });
        await bot.sendMessage(chatId, '⚠️ *An error occurred while processing your command.*', { parse_mode: 'Markdown' });
      }
    });

    bot.on('callback_query', async (callbackQuery) => {
      const { data, message } = callbackQuery;
      const chatId = message.chat.id;
      const messageId = message.message_id;

      if (data.startsWith('reject_')) {
        const jobId = data.split('_')[1];
        try {
          const { query } = await import('../database/connection.js');
          const res = await query("UPDATE jobs SET status = 'inactive' WHERE id = $1 RETURNING company, role", [jobId]);
          if (res.rows.length > 0) {
            const job = res.rows[0];
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Job rejected!' });
            await bot.editMessageText(`❌ <b>Rejected: ${job.role} at ${job.company}</b>`, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML'
            });
          } else {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Job not found.' });
          }
        } catch (err) {
          logger.error('Failed to handle reject callback', { module: 'telegram', error: err });
          await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error rejecting job.' });
        }
      }
    });

    bot.on('polling_error', (error) => {
      logger.error('Telegram bot polling error', { module: 'telegram', error });
      if (error.message && (error.message.includes('404') || error.message.includes('401') || error.code === 'ETELEGRAM')) {
        logger.warn('Detected invalid Telegram Bot Token. Gracefully shutting down polling loop.', { module: 'telegram' });
        bot.stopPolling();
      }
    });

    return bot;
  } catch (error) {
    logger.error('Failed to initialize Telegram Bot', { module: 'telegram', error });
    return null;
  }
}

export function getTelegramBot() {
  return bot;
}

/**
 * Send a notification to the configured channel.
 */
export async function sendTelegramNotification(message) {
  const token = config.telegramBotToken;
  const chatId = config.telegramChatId;

  if (!token || !chatId) {
    logger.warn('Telegram notifications skipped: Bot token or chat ID is missing.', { module: 'telegram' });
    return;
  }

  try {
    const senderBot = bot || new TelegramBot(token, { polling: false });
    await senderBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    logger.info('Telegram notification sent successfully.', { module: 'telegram' });
  } catch (error) {
    logger.error('Failed to send Telegram notification', { module: 'telegram', error });
  }
}
