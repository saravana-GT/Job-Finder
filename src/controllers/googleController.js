import { formatResponse, formatErrorResponse } from '../utils/formatter.js';
import { googleOAuthService } from '../services/googleOAuthService.js';
import { gmailSyncService } from '../services/gmailSyncService.js';

/**
 * GET /api/google/auth-url
 * Returns Google login auth redirect url.
 */
export async function getGoogleAuthUrl(req, res, next) {
  try {
    const url = googleOAuthService.generateAuthUrl();
    if (!url) {
      return res.status(501).json(formatErrorResponse('Google integration is disabled or credentials parameters are missing in the configuration.', 501));
    }
    res.json(formatResponse({ url }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/google/callback
 * Callback callback endpoint to register authorization code tokens.
 */
export async function handleGoogleCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json(formatErrorResponse('Missing authorization code in redirect callback URL query parameters.', 400));
    }

    const tokens = await googleOAuthService.exchangeCode(code);
    res.json(formatResponse(tokens, 'Google authentication setup successful. Tokens saved.'));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/google/sync
 * Manually force Google Gmail inbox scanning.
 */
export async function triggerGoogleSync(req, res, next) {
  try {
    const status = await googleOAuthService.checkConnectionStatus();
    if (!status.authenticated) {
      return res.status(401).json(formatErrorResponse('Google account is not authenticated or integration is disabled.', 401));
    }

    await gmailSyncService.syncEmails();
    res.json(formatResponse(null, 'Google synchronization run successfully completed.'));
  } catch (error) {
    next(error);
  }
}
