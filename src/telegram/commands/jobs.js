import { JobRepository } from '../../repositories/jobRepository.js';

export async function jobsCommand() {
  const jobRepo = new JobRepository();
  const jobs = await jobRepo.listJobs(10);

  if (jobs.length === 0) {
    return '❌ <b>No jobs found in the database.</b>';
  }

  return jobs.map(job => {
    const text = `🏢 <b>Company:</b> ${job.company}\n` +
                 `💼 <b>Role:</b> ${job.role}\n` +
                 `🌐 <b>Platform:</b> ${job.platform || 'N/A'}\n` +
                 `📍 <b>Location:</b> ${job.location || 'N/A'}\n` +
                 `⭐ <b>AI Score:</b> ${job.ai_score !== null ? `${job.ai_score}%` : 'N/A'}`;

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
