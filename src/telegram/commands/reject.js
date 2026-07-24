import { query } from '../../database/connection.js';

export async function rejectCommand(commandText) {
  const parts = commandText.trim().split(/\s+/);
  if (parts.length < 2) {
    return '⚠️ <b>Usage:</b> /reject &lt;company_name&gt;\n(e.g., <code>/reject Amazon</code>)';
  }

  const company = parts.slice(1).join(' ').trim();
  try {
    const res = await query(
      "UPDATE jobs SET status = 'inactive' WHERE company ILIKE $1 RETURNING *",
      [`%${company}%`]
    );

    if (res.rows.length === 0) {
      return `❌ No active jobs found for company: <b>${company}</b>`;
    }

    return `✅ Successfully rejected <b>${res.rows.length}</b> job(s) from <b>${company}</b>. They will no longer appear in your active listings.`;
  } catch (error) {
    return `⚠️ Error rejecting company: ${error.message}`;
  }
}
export default rejectCommand;
