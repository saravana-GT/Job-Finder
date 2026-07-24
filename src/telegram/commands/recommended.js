import { JobRepository } from '../../repositories/jobRepository.js';

const jobRepository = new JobRepository();

export async function recommendedCommand() {
  // Query jobs with score >= 75
  const jobs = await jobRepository.listJobsByMinScore(75, 10);

  if (jobs.length === 0) {
    return '🎯 <b>No recommended matches found yet.</b> Try adjusting your profile skills.';
  }

  const jobList = jobs.map((j, index) => {
    return `${index + 1}. <b>${j.company}</b> - <i>${j.role}</i> (<b>Score: ${j.ai_score}%</b>)\n   📍 ${j.location || 'Onsite'} | <a href="${j.apply_url}">Apply</a>`;
  }).join('\n\n');

  return `🎯 <b>Top Recommended Matches:</b>\n\n${jobList}`;
}
export default recommendedCommand;
