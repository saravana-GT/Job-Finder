import { query } from '../../database/connection.js';

export async function todayCommand() {
  const sql = `
    SELECT id, platform, company, role, location, ai_score, apply_url
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

  return jobs.map(job => {
    const text = `📅 <b>Discovered Today</b>\n\n` +
                 `🏢 <b>Company:</b> ${job.company}\n` +
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
export default todayCommand;
