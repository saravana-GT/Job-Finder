import { JobRepository } from '../../repositories/jobRepository.js';

const jobRepository = new JobRepository();

export async function recommendedCommand() {
  // Query jobs with score >= 75
  const jobs = await jobRepository.listJobsByMinScore(75, 10);

  if (jobs.length === 0) {
    return '🎯 *No recommended matches found yet.* Try adjusting your profile skills.';
  }

  const jobList = jobs.map((j, index) => {
    return `${index + 1}. *${j.company}* - _${j.role}_ (*Score: ${j.ai_score}%*)\n   📍 ${j.location || 'Onsite'} | [Apply](${j.apply_url})`;
  }).join('\n\n');

  return `
🎯 *Top Recommended Matches:*

${jobList}
`;
}
export default recommendedCommand;
