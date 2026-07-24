import { JobRepository } from '../../repositories/jobRepository.js';

const jobRepository = new JobRepository();

export async function recommendedCommand() {
  // Query jobs with score >= 75
  const jobs = await jobRepository.listJobsByMinScore(75, 10);

  if (jobs.length === 0) {
    return '🎯 <b>No recommended matches found yet.</b> Try adjusting your profile skills.';
  }

  return jobs.map(job => {
    const text = `🎯 <b>Recommended Match</b>\n\n` +
                 `🏢 <b>Company:</b> ${job.company}\n` +
                 `💼 <b>Role:</b> ${job.role}\n` +
                 `🌐 <b>Platform:</b> ${job.platform || 'N/A'}\n` +
                 `📍 <b>Location:</b> ${job.location || 'N/A'}\n` +
                 `⭐ <b>AI Score:</b> ${job.ai_score}%`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔗 Apply', url: job.apply_url || '#' },
            { text: '❌ Reject', callback_data: `reject_${job.id}` }
          ]
        ]
      }
    };
  });
}
export default recommendedCommand;
