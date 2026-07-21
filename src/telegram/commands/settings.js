import { NotificationRepository } from '../../repositories/notificationRepository.js';

const notificationRepo = new NotificationRepository();

export async function settingsCommand() {
  const settings = await notificationRepo.getSettings();
  if (!settings) {
    return '⚠️ *Failed to retrieve notification settings.*';
  }

  return `
⚙️ *Notification Settings*

• *Telegram Alerts:* ${settings.telegram_enabled ? '✅ Enabled' : '❌ Disabled'}
• *Score Threshold:* ${settings.notification_threshold}%
• *Digest Mode:* \`${settings.digest_mode.toUpperCase()}\`
• *AI Matching:* ${settings.ai_enabled ? '✅ Enabled' : '❌ Disabled'}
• *Google Calendar Sync:* ${settings.calendar_enabled ? '✅ Enabled' : '❌ Disabled'}
• *Gmail Integration:* ${settings.gmail_enabled ? '✅ Enabled' : '❌ Disabled'}

✍️ *How to change:*
• Change threshold score: Use \`/threshold <score>\` (e.g. \`/threshold 80\`).
• Change digest mode: Use the API or settings forms. Current modes are: \`instant\`, \`hourly\`, \`daily\`, \`weekly\`.
`;
}
export default settingsCommand;
