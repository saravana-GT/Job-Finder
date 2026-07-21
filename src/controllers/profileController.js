import { formatResponse } from '../utils/formatter.js';
import { profileService } from '../services/profileService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

/**
 * GET /api/profile
 */
export async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile();
    res.json(formatResponse(profile));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/profile
 */
export async function updateProfile(req, res, next) {
  try {
    const updated = await profileService.updateProfile(
      req.body,
      // Trigger async batch database score updates when profile changes
      async (newProfile) => {
        await recommendationEngine.recalculateAllJobScores(newProfile);
      }
    );
    res.json(formatResponse(updated, 'Profile updated and background score updates started.'));
  } catch (error) {
    next(error);
  }
}
