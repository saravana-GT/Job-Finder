import { query } from '../../database/connection.js';

export async function todayCommand() {
  const sql = `
    SELECT platform, company, role, location, ai_score, apply_url
    FROM jobs
    WHERE created_at >= CURRENT_DATE AND status = 'active'
    ORDER BY ai_score DESC, created_at DESC
    LIMIT 10
  `;
  const res = await query(sql);
  const jobs = res.rows;

  if (jobs.length === 0) {
    return '📅 *No new jobs ingested today yet.*';
  }

  const jobList = jobs.map((j, index) => {
    const scoreText = j.ai_score !== null ? `(${j.ai_score}%)` : '';
    return `${index + 1}. *${j.company}* - _${j.role}_ ${scoreText}\n   📍 ${j.location || 'Onsite'} | [Apply](${j.apply_url})`;
  }).join('\n\n');

  return `
📅 *Jobs Discovered Today:*

${jobList}
`;
}
export default todayCommand;
