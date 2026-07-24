import { JobRepository } from '../../repositories/jobRepository.js';

export async function jobsCommand() {
  const jobRepo = new JobRepository();
  const jobs = await jobRepo.listJobs(10);

  if (jobs.length === 0) {
    return '❌ <b>No jobs found in the database.</b>';
  }

  let message = '🚀 <b>AI Placement Assistant - Latest Jobs</b>\n\n';
  for (const job of jobs) {
    message += `🏢 <b>Company:</b> ${job.company}\n`;
    message += `💼 <b>Role:</b> ${job.role}\n`;
    message += `🌐 <b>Platform:</b> ${job.platform || 'N/A'}\n`;
    message += `📍 <b>Location:</b> ${job.location || 'N/A'}\n`;
    message += `⭐ <b>AI Score:</b> ${job.ai_score !== null ? `${job.ai_score}%` : 'N/A'}\n`;
    message += `🔗 <b>Apply Link:</b> <a href="${job.apply_url || '#'}">Click Here</a>\n`;
    message += `───────────────────\n`;
  }
  return message;
}
