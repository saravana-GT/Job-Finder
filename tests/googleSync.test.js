import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'file:///d:/Work/node_modules/supertest/index.js';
import { app } from '../src/app.js';
import { google } from 'googleapis';
import { googleOAuthService } from '../src/services/googleOAuthService.js';
import { emailClassifier } from '../src/services/emailClassifier.js';
import { gmailParser } from '../src/services/gmailParser.js';
import { googleCalendarService } from '../src/services/googleCalendarService.js';
import { gmailSyncService } from '../src/services/gmailSyncService.js';
import { query } from '../src/database/connection.js';
import { initTelegramBot } from '../src/telegram/bot.js';
import { config } from '../src/config/env.js';

// Setup test configs
process.env.NODE_ENV = 'test';
config.telegramChatId = '12345';
config.telegramBotToken = 'mock-token';
initTelegramBot();

// Override Google OAuth Client properties directly
googleOAuthService.clientId = 'test-client-id';
googleOAuthService.clientSecret = 'test-client-secret';

// Mock Google Calendar API
google.calendar = () => ({
  events: {
    insert: async ({ requestBody }) => {
      return { data: { id: 'mock-google-event-id' } };
    },
    update: async ({ eventId, requestBody }) => {
      return { data: { id: eventId } };
    },
    delete: async ({ eventId }) => {
      return { data: {} };
    }
  }
});

// Mock Google Gmail API
google.gmail = () => ({
  users: {
    history: {
      list: async () => {
        return {
          data: {
            historyId: '12345',
            history: [
              {
                messagesAdded: [
                  { message: { id: 'msg-123' } }
                ]
              }
            ]
          }
        };
      }
    },
    messages: {
      list: async () => {
        return {
          data: {
            messages: [{ id: 'msg-123' }]
          }
        };
      },
      get: async ({ id }) => {
        return {
          data: {
            id,
            threadId: 'thread-123',
            historyId: '12345',
            payload: {
              headers: [
                { name: 'Subject', value: 'Interview Invitation: Software Engineer at Stripe' },
                { name: 'From', value: 'Stripe HR <hr@stripe.com>' },
                { name: 'Date', value: new Date().toUTCString() }
              ],
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('Hi, we would like to invite you for an interview on July 25, 2026 at 11:30 AM IST. Meeting Link: https://meet.google.com/abc-defg-hij').toString('base64')
              }
            }
          }
        };
      }
    }
  }
});

// Mock getAuthClient and exchangeCode
googleOAuthService.getAuthClient = async () => {
  return {
    credentials: { access_token: 'mock-access-token' }
  };
};

googleOAuthService.exchangeCode = async (code) => {
  return { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' };
};

// ----------------------------------------------------
// UNIT TESTS: Email Classification & Parsing
// ----------------------------------------------------

test('Email Classifier: Identifies categories and calculates confidence', () => {
  const interviewRes = emailClassifier.classify('Interview scheduled tomorrow', 'Please attend meeting scheduled.');
  assert.equal(interviewRes.category, 'Interview Invitation');
  assert.ok(interviewRes.confidenceScore >= 40);

  const rejectionRes = emailClassifier.classify('Status update on application', 'Unfortunately we are not moving forward with you.');
  assert.equal(rejectionRes.category, 'Rejection');

  const unrelatedRes = emailClassifier.classify('Weekly newsletter', 'Here are some blogs to read this week.');
  assert.equal(unrelatedRes.category, 'Unrelated');
});

test('Gmail Parser: Extracts dates, recruiters, and meeting links', () => {
  const message = {
    id: 'msg-123',
    payload: {
      headers: [
        { name: 'Subject', value: 'Interview Invitation: Backend developer at Microsoft' },
        { name: 'From', value: 'Microsoft Talent <hr@microsoft.com>' },
        { name: 'Date', value: 'Sat, 18 Jul 2026 12:00:00 GMT' }
      ],
      mimeType: 'text/plain',
      body: {
        data: Buffer.from('Hi Candidate, please schedule coding round on 25/07/2026 at 11:30 AM IST. Zoom link: https://zoom.us/j/12345').toString('base64')
      }
    }
  };

  const parsed = gmailParser.parseMessage(message);
  assert.equal(parsed.company, 'Microsoft');
  assert.equal(parsed.role, 'Backend Engineer');
  assert.equal(parsed.recruiterEmail, 'hr@microsoft.com');
  assert.equal(parsed.meetingLink, 'https://zoom.us/j/12345');
});

// ----------------------------------------------------
// INTEGRATION TESTS: Google OAuth & Gmail Sync Flow
// ----------------------------------------------------

test('Integration: OAuth generation, token callbacks, and sync endpoints', async () => {
  // 1. Get Auth URL
  const urlRes = await request(app).get('/api/google/auth-url');
  assert.equal(urlRes.status, 200);
  assert.ok(urlRes.body.data.url.includes('accounts.google.com'));

  // 2. Handle exchange callback code
  const callbackRes = await request(app).get('/api/google/callback?code=mock-code');
  assert.equal(callbackRes.status, 200);
  assert.ok(callbackRes.body.data.access_token);

  // Setup sample job in DB first
  await query(`INSERT INTO jobs (id, platform, company, role, apply_url) VALUES (10, 'Wellfound', 'Stripe', 'Software Engineer', 'http://stripe.com')`);
  await query(`INSERT INTO applications (id, job_id, status) VALUES (10, 10, 'Interested')`);

  // 3. Trigger manual Gmail Synchronization
  const syncRes = await request(app).post('/api/google/sync');
  assert.equal(syncRes.status, 200);

  // Verify processed email is stored
  const emailRes = await query(`SELECT * FROM processed_emails WHERE id = $1`, ['msg-123']);
  assert.equal(emailRes.rows.length, 1);
  assert.equal(emailRes.rows[0].category, 'Interview Invitation');

  // Verify ATS application status transitioned to Interview Scheduled
  const appRes = await query(`SELECT * FROM applications WHERE id = $1`, [10]);
  assert.equal(appRes.rows[0].status, 'Interview Scheduled');

  // Verify local calendar event created
  const calRes = await query(`SELECT * FROM calendar_events WHERE application_id = $1`, [10]);
  assert.equal(calRes.rows.length, 1);
  // Verify it synced to Google Calendar (i.e. google_event_id is set)
  assert.equal(calRes.rows[0].google_event_id, 'mock-google-event-id');
});
