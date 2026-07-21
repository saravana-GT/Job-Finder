import { query } from '../../database/connection.js';
import { JobRepository } from '../../repositories/jobRepository.js';
import { profileService } from '../../services/profileService.js';
import { recommendationEngine } from '../../services/recommendationEngine.js';
import { logger } from '../../utils/logger.js';

const jobRepository = new JobRepository();

/**
 * Register callback query listeners on the bot instance.
 * Allows handling of inline buttons: View Match, Ignore, Save Later.
 */
export function registerBotCallbacks(bot) {
  if (!bot) return;

  bot.on('callback_query', async (callbackQuery) => {
    const { id, data, message } = callbackQuery;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    logger.info(`Telegram Callback Query received: data="${data}" from chat=${chatId}`, { module: 'telegram' });

    try {
      const [action, jobIdStr] = data.split(':');
      const jobId = parseInt(jobIdStr, 10);

      if (isNaN(jobId)) {
        await bot.answerCallbackQuery(id, { text: '⚠️ Invalid Job ID.' });
        return;
      }

      // Fetch target job details
      const job = await jobRepository.getJobById(jobId);
      if (!job) {
        await bot.answerCallbackQuery(id, { text: '⚠️ Job not found.' });
        return;
      }

      if (action === 'view_match') {
        const profile = await profileService.getProfile();
        const report = recommendationEngine.generateMatchReport(job, profile);

        const reportMsg = `
🔍 *Match Report: ${job.role}*
🏢 *Company:* ${job.company}
📊 *Overall Score:* ${report.overallScore}% (${report.matchLevel})

🎯 *Matched Skills:*
${report.matchedSkills.length > 0 ? report.matchedSkills.map(s => `• ${s}`).join('\n') : 'None'}

⚠️ *Missing Skills:*
${report.missingSkills.length > 0 ? report.missingSkills.map(s => `• ${s}`).join('\n') : 'None'}

📚 *Suggested Learning:*
${report.suggestedLearningTopics.length > 0 ? report.suggestedLearningTopics.map(t => `• *${t.skill}:* [Doc](${t.resourceUrl})`).join('\n') : 'None'}
`;
        await bot.sendMessage(chatId, reportMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
        await bot.answerCallbackQuery(id);
      } 
      
      else if (action === 'ignore') {
        // Record ignored notification state in notifications history table to avoid notifying it again
        const updateSql = 'INSERT INTO notifications (job_id, status, channel, response) VALUES ($1, \'ignored\', \'telegram\', \'User ignored notification\') ON CONFLICT (job_id, channel) DO UPDATE SET status = \'ignored\'';
        await query(updateSql, [jobId]);

        // Edit message to replace inline buttons with ignored status message
        await bot.editMessageText(`🗑️ *Job Ignored:* _${job.role}_ at *${job.company}*`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        });
        await bot.answerCallbackQuery(id, { text: 'Job Ignored.' });
      } 
      
      else if (action === 'save_later') {
        // Insert into applications table with status = 'saved'
        const insertSql = 'INSERT INTO applications (job_id, status) VALUES ($1, \'saved\') ON CONFLICT DO NOTHING';
        await query(insertSql, [jobId]);

        await bot.editMessageText(`💾 *Job Saved:* _${job.role}_ at *${job.company}* (Saved for later)`, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        });
        await bot.answerCallbackQuery(id, { text: 'Saved for later.' });
      }

    } catch (err) {
      logger.error('Failed to handle Telegram bot callback query', { module: 'telegram', error: err });
      await bot.answerCallbackQuery(id, { text: '⚠️ Failed to process action.' });
    }
  });
}
export default registerBotCallbacks;
