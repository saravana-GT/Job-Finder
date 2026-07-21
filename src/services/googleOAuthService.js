import { google } from 'googleapis';
import { query } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class GoogleOAuthService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Check connection status.
   */
  async checkConnectionStatus() {
    if (!this.isConfigured()) return { configured: false, authenticated: false };

    try {
      const client = await this.getAuthClient();
      if (!client || !client.credentials.access_token) {
        return { configured: true, authenticated: false };
      }
      return { configured: true, authenticated: true };
    } catch (error) {
      logger.error('Failed to verify Google Auth connection status', { module: 'google-oauth', error });
      return { configured: true, authenticated: false };
    }
  }

  /**
   * Generate authentication URL.
   */
  generateAuthUrl() {
    if (!this.isConfigured()) return '';

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar'
      ]
    });
  }

  /**
   * Get authorized client. Automatically refreshes access tokens if expired.
   */
  async getAuthClient() {
    if (!this.isConfigured()) {
      logger.info('Google OAuth Client is not configured. Service gracefully disabled.', { module: 'google-oauth' });
      return null;
    }

    try {
      const res = await query('SELECT * FROM google_credentials ORDER BY id DESC LIMIT 1');
      const creds = res.rows[0];

      if (!creds) {
        logger.info('No active google credentials found in database.', { module: 'google-oauth' });
        return null;
      }

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      oauth2Client.setCredentials({
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
        expiry_date: creds.expiry_date
      });

      // Check if token expired
      const isExpired = creds.expiry_date ? Date.now() >= Number(creds.expiry_date) - 60000 : true;
      if (isExpired && creds.refresh_token) {
        logger.info('Google access token expired. Refreshing...', { module: 'google-oauth' });
        const { credentials } = await oauth2Client.refreshAccessToken();

        // Save new credentials
        const nextExpiry = credentials.expiry_date || (Date.now() + 3600 * 1000);
        await query(
          `INSERT INTO google_credentials (access_token, refresh_token, expiry_date, client_id, client_secret)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            credentials.access_token,
            credentials.refresh_token || creds.refresh_token,
            nextExpiry,
            this.clientId,
            this.clientSecret
          ]
        );

        oauth2Client.setCredentials(credentials);
      }

      return oauth2Client;
    } catch (error) {
      logger.error('Failed to resolve Google auth client', { module: 'google-oauth', error });
      return null;
    }
  }

  /**
   * Exchange redirect authorization code for access/refresh tokens.
   */
  async exchangeCode(code) {
    if (!this.isConfigured()) throw new Error('Google OAuth is not configured.');

    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      const expiryDate = tokens.expiry_date || (Date.now() + 3600 * 1000);

      // Save tokens
      await query(
        `INSERT INTO google_credentials (access_token, refresh_token, expiry_date, client_id, client_secret)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tokens.access_token,
          tokens.refresh_token || null,
          expiryDate,
          this.clientId,
          this.clientSecret
        ]
      );

      logger.info('Successfully exchanged code and registered Google tokens.', { module: 'google-oauth' });
      return tokens;
    } catch (error) {
      logger.error('Code exchange failed', { module: 'google-oauth', error });
      throw error;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();
export default googleOAuthService;
