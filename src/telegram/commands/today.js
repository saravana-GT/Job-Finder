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
    return '📅 <b>No new jobs ingested today yet.</b>';
  }

  const jobList = jobs.map((j, index) => {
    const scoreText = j.ai_score !== null ? `(${j.ai_score}%)` : '';
    return `${index + 1}. <b>${j.company}</b> - <i>${j.role}</i> ${scoreText}\n   📍 ${j.location || 'Onsite'} | <a href="${j.apply_url}">Apply</a>`;
  }).join('\n\n');

  return `📅 <b>Jobs Discovered Today:</b>\n\n${jobList}`;
}
export default todayCommand;
