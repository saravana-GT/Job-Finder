import { NotificationRepository } from '../../repositories/notificationRepository.js';

const notificationRepo = new NotificationRepository();

export async function thresholdCommand(commandText) {
  // Parse numeric score from command (e.g. "/threshold 80" -> 80)
  const parts = commandText.trim().split(/\s+/);
  if (parts.length < 2) {
    const currentSettings = await notificationRepo.getSettings();
    return `ℹ️ *Current Threshold:* ${currentSettings?.notification_threshold || 75}%\n\nUse \`/threshold <score>\` to update (e.g. \`/threshold 80\`).`;
  }

  const score = parseInt(parts[1], 10);
  if (isNaN(score) || score < 0 || score > 100) {
    return '❌ *Invalid threshold value.* Please specify a number between 0 and 100.';
  }

  await notificationRepo.updateSettings({ notification_threshold: score });
  return `✅ *Score Threshold updated to:* ${score}%`;
}
export default thresholdCommand;
