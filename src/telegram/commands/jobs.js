import { JobRepository } from '../../repositories/jobRepository.js';

export async function jobsCommand() {
  const jobRepo = new JobRepository();
  const jobs = await jobRepo.listJobs(10);

  if (jobs.length === 0) {
    return '❌ *No jobs found in the database.*';
  }

  let message = '🚀 *AI Placement Assistant - Latest Jobs*\n\n';
  for (const job of jobs) {
    message += `🏢 *Company:* ${job.company}\n`;
    message += `💼 *Role:* ${job.role}\n`;
    message += `🌐 *Platform:* ${job.platform || 'N/A'}\n`;
    message += `📍 *Location:* ${job.location || 'N/A'}\n`;
    message += `⭐ *AI Score:* ${job.ai_score || 'N/A'}\n`;
    message += `🔗 *Apply Link:* [Click Here](${job.apply_url || '#'}) \n`;
    message += `───────────────────\n`;
  }
  return message;
}
