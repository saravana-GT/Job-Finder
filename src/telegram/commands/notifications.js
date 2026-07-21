import { NotificationRepository } from '../../repositories/notificationRepository.js';
import { query } from '../../database/connection.js';

const notificationRepo = new NotificationRepository();

export async function notificationsCommand() {
  const stats = await notificationRepo.getStats();
  
  // Count items currently in queue
  const queueRes = await query("SELECT COUNT(*) FROM notification_queue WHERE status = 'pending'");
  const pendingCount = parseInt(queueRes.rows[0]?.count || '0', 10);

  const dlqRes = await query("SELECT COUNT(*) FROM notification_queue WHERE status = 'dlq'");
  const dlqCount = parseInt(dlqRes.rows[0]?.count || '0', 10);

  return `
📊 *Notification Statistics & Health*

• *Sent Successfully:* ${stats.sent}
• *Failed Delivery:* ${stats.failed}
• *Retried Attempts:* ${stats.retried}
• *Ignored by User:* ${stats.ignored}
• *Expired Matches:* ${stats.expired}
• *Duplicate Skips:* ${stats.duplicate}

🕒 *Queue Status:*
• *Pending Delivery:* ${pendingCount}
• *Dead Letter Queue (DLQ):* ${dlqCount}

_To update settings, use /settings or /threshold._
`;
}
export default notificationsCommand;
