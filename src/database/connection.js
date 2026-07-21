import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

// Dynamic In-Memory Mock database for unit & integration testing
export const mockDb = {
  providerStatus: new Map(),
  providerSyncHistory: [],
  settings: {
    id: 1,
    telegram_enabled: true,
    calendar_enabled: false,
    gmail_enabled: false,
    ai_enabled: true,
    notification_threshold: 75,
    digest_mode: 'instant',
    last_digest_sent_at: null
  },
  notifications: [],
  notificationQueue: [],
  
  // Phase 6 ATS State Mock Arrays
  applications: [],
  applicationHistory: [],
  calendarEvents: [],
  reminders: [],
  reports: [],
  resumes: [],
  resumeVersions: [],
  resumeScores: [],
  googleCredentials: [],
  googleSyncState: [],
  processedEmails: [],
  jobs: [
    {
      id: 1,
      platform: 'Naukri',
      company: 'Google',
      role: 'Software Engineer',
      location: 'Bangalore',
      employment_type: 'Full-time',
      salary: '25 LPA',
      experience: '0-2 years',
      skills: ['Javascript', 'Node.js'],
      description: 'Role description',
      apply_url: 'http://careers.google.com/jobs/1',
      posted_date: new Date().toISOString(),
      deadline: new Date(Date.now() + 864000000).toISOString(),
      ai_score: 85
    }
  ]
};

// Seed mock status database
const defaultProviders = ['Unstop', 'Internshala', 'Wellfound', 'Foundit', 'Naukri', 'MockProvider'];
for (const name of defaultProviders) {
  mockDb.providerStatus.set(name.toLowerCase(), {
    provider_name: name,
    is_enabled: true,
    consecutive_failures: 0,
    last_successful_sync: new Date().toISOString(),
    health_status: 'healthy',
    version: '1.0.0',
    capabilities: ['fetch', 'parse', 'normalize', 'validate', 'save'],
    updated_at: new Date().toISOString()
  });
}

export async function connect() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (pool) {
    return pool;
  }

  try {
    const connectionString = config.databaseUrl;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    pool = new Pool({
      connectionString,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      max: 10, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the database connection
    const client = await pool.connect();
    client.release();

    logger.info('Database connection pool initialized', { module: 'database' });
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database', { module: 'database', error });
    throw error;
  }
}

export async function disconnect() {
  if (process.env.NODE_ENV === 'test' || !pool) {
    return;
  }

  try {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed', { module: 'database' });
  } catch (error) {
    logger.error('Failed to disconnect from database', { module: 'database', error });
    throw error;
  }
}

export async function query(statement, params = []) {
  if (process.env.NODE_ENV === 'test') {
    logger.debug(`[TEST] Mocked query executed: ${statement}`, { module: 'database', params });
    
    const statementNormalized = statement.toLowerCase().replace(/\s+/g, ' ').trim();

    // ----------------------------------------------------
    // Phase 8: Google Sync Query Mocks
    // ----------------------------------------------------
    if (statementNormalized.includes('from google_credentials') && statementNormalized.includes('order by id desc limit 1')) {
      const creds = mockDb.googleCredentials || [];
      return { rows: creds.length > 0 ? [creds[creds.length - 1]] : [] };
    }

    if (statementNormalized.includes('insert into google_credentials')) {
      const cred = {
        id: (mockDb.googleCredentials || []).length + 1,
        access_token: params[0],
        refresh_token: params[1],
        expiry_date: params[2],
        client_id: params[3],
        client_secret: params[4],
        created_at: new Date().toISOString()
      };
      if (!mockDb.googleCredentials) mockDb.googleCredentials = [];
      mockDb.googleCredentials.push(cred);
      return { rows: [cred] };
    }

    if (statementNormalized.includes('from google_sync_state') && statementNormalized.includes('where service_name =')) {
      const state = (mockDb.googleSyncState || []).find(s => s.service_name === params[0]);
      return { rows: state ? [state] : [] };
    }

    if (statementNormalized.includes('insert into google_sync_state')) {
      const state = {
        service_name: params[0],
        sync_token: params[1],
        last_synced_at: new Date().toISOString()
      };
      if (!mockDb.googleSyncState) mockDb.googleSyncState = [];
      const idx = mockDb.googleSyncState.findIndex(s => s.service_name === params[0]);
      if (idx !== -1) {
        mockDb.googleSyncState[idx] = state;
      } else {
        mockDb.googleSyncState.push(state);
      }
      return { rows: [state] };
    }

    if (statementNormalized.includes('from processed_emails') && statementNormalized.includes('where id =')) {
      const email = (mockDb.processedEmails || []).find(e => e.id === params[0]);
      return { rows: email ? [email] : [] };
    }

    if (statementNormalized.includes('insert into processed_emails')) {
      const email = {
        id: params[0],
        thread_id: params[1],
        subject: params[2],
        sender: params[3],
        received_at: params.length > 7 ? params[4] : new Date().toISOString(),
        category: params.length > 7 ? params[5] : params[4],
        confidence_score: params.length > 7 ? params[6] : params[5],
        extracted_metadata: params.length > 7 ? (typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7]) : {},
        ats_updated: params.length > 7 ? params[8] : params[6],
        created_at: new Date().toISOString()
      };
      if (!mockDb.processedEmails) mockDb.processedEmails = [];
      mockDb.processedEmails.push(email);
      return { rows: [email] };
    }

    if (statementNormalized.includes('from applications a join jobs j') && statementNormalized.includes('where j.company ilike')) {
      const cleanComp = params[0].replace(/%/g, '').toLowerCase();
      const cleanRole = params[1].replace(/%/g, '').toLowerCase();
      const app = mockDb.applications.find(a => {
        const job = mockDb.jobs.find(j => j.id === a.job_id);
        return job && job.company.toLowerCase().includes(cleanComp) && job.role.toLowerCase().includes(cleanRole);
      });
      return { rows: app ? [app] : [] };
    }

    if (statementNormalized.includes('update applications') && statementNormalized.includes('set recruiter_name =')) {
      const app = mockDb.applications.find(a => a.id === params[0]);
      if (app) {
        app.recruiter_name = params[1];
        app.recruiter_email = params[2];
        app.recruiter_phone = params[3];
        app.meeting_link = params[4];
      }
      return { rows: app ? [app] : [] };
    }

    // ----------------------------------------------------
    // Phase 7: Resume Engine Query Mocks
    // ----------------------------------------------------
    if (statementNormalized.includes('insert into resumes')) {
      const resume = {
        id: mockDb.resumes.length + 1,
        name: params[0],
        target_role: params[1] || 'Software Engineer',
        version: 1,
        primary_skills: params[2] || [],
        secondary_skills: params[3] || [],
        projects: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        experience: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
        education: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
        certifications: params[7] || [],
        keywords: params[8] || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.resumes.push(resume);
      return { rows: [resume] };
    }

    if (statementNormalized.includes('insert into resume_versions')) {
      const isCreate = params.length === 4;
      const resume_id = params[0];
      const version = isCreate ? 1 : params[1];
      const parsed_content = isCreate ? params[1] : params[2];
      const metadataRaw = isCreate ? params[2] : params[3];
      const file_name = isCreate ? params[3] : params[4];
      
      const metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;

      const ver = {
        id: mockDb.resumeVersions.length + 1,
        resume_id,
        version,
        parsed_content,
        metadata,
        file_name,
        created_at: new Date().toISOString()
      };
      mockDb.resumeVersions.push(ver);
      return { rows: [ver] };
    }

    if (statementNormalized.includes('select version from resumes') && statementNormalized.includes('where id =')) {
      const resume = mockDb.resumes.find(r => r.id === params[0]);
      return { rows: resume ? [{ version: resume.version }] : [] };
    }

    if (statementNormalized.includes('update resumes') && statementNormalized.includes('set target_role =')) {
      const resume = mockDb.resumes.find(r => r.id === params[0]);
      if (resume) {
        resume.target_role = params[1];
        resume.version = params[2];
        resume.primary_skills = params[3] || [];
        resume.secondary_skills = params[4] || [];
        resume.projects = typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5];
        resume.experience = typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6];
        resume.education = typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7];
        resume.certifications = params[8] || [];
        resume.keywords = params[9] || [];
        resume.updated_at = new Date().toISOString();
        return { rows: [resume] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('from resume_versions') && statementNormalized.includes('where resume_id =') && statementNormalized.includes('version =')) {
      const ver = mockDb.resumeVersions.find(v => v.resume_id === params[0] && v.version === params[1]);
      return { rows: ver ? [ver] : [] };
    }

    if (statementNormalized.includes('from resumes') && !statementNormalized.includes('where')) {
      return { rows: mockDb.resumes };
    }

    if (statementNormalized.includes('insert into resume_scores')) {
      const score = {
        id: mockDb.resumeScores.length + 1,
        resume_id: params[0],
        job_id: params[1],
        skill_match_score: params[2],
        keyword_match_score: params[3],
        role_match_score: params[4],
        experience_match_score: params[5],
        tech_match_score: params[6],
        overall_match_score: params[7],
        confidence_score: params[8],
        match_reason: params[9],
        missing_skills: params[10],
        missing_keywords: params[11],
        suggested_improvements: params[12],
        created_at: new Date().toISOString()
      };
      const idx = mockDb.resumeScores.findIndex(s => s.resume_id === params[0] && s.job_id === params[1]);
      if (idx !== -1) {
        mockDb.resumeScores[idx] = score;
      } else {
        mockDb.resumeScores.push(score);
      }
      return { rows: [score] };
    }

    if (statementNormalized.includes('from resume_versions') && statementNormalized.includes('where resume_id =') && !statementNormalized.includes('version =')) {
      const rows = mockDb.resumeVersions.filter(v => v.resume_id === params[0]).sort((a, b) => b.version - a.version);
      return { rows };
    }

    // ----------------------------------------------------
    // Phase 6: ATS Query Mocks
    // ----------------------------------------------------
    if (statementNormalized.includes('insert into applications')) {
      let appId = mockDb.applications.length + 1;
      let jobId = params[0];
      let status = params[1] || 'Discovered';
      let resumeUsed = params[2] || null;
      let coverLetterUsed = params[3] || null;
      let notes = params[4] || null;

      if (params.length === 0) {
        const valuesMatch = statement.match(/values\s*\(([^)]+)\)/i);
        if (valuesMatch) {
          const parts = valuesMatch[1].split(',').map(s => s.trim().replace(/'/g, ''));
          const parsedId = parseInt(parts[0], 10);
          if (!isNaN(parsedId)) {
            appId = parsedId;
            jobId = parseInt(parts[1], 10);
            status = parts[2] || 'Discovered';
          }
        }
      }

      const newApp = {
        id: appId,
        job_id: jobId,
        status,
        resume_used: resumeUsed,
        cover_letter_used: coverLetterUsed,
        notes,
        applied_at: new Date().toISOString(),
        interview_date: null,
        interview_time: null,
        assessment_date: null,
        offer_deadline: null,
        salary_offered: null,
        recruiter_name: null,
        recruiter_email: null,
        recruiter_phone: null,
        meeting_link: null,
        updated_at: new Date().toISOString()
      };
      mockDb.applications.push(newApp);
      return { rows: [newApp] };
    }

    if (statementNormalized.includes('select * from applications') && statementNormalized.includes('where id =')) {
      const app = mockDb.applications.find(a => a.id === params[0]);
      return { rows: app ? [app] : [] };
    }

    if (statementNormalized.includes('update applications') && statementNormalized.includes('set status =')) {
      const app = mockDb.applications.find(a => a.id === params[0]);
      if (app) {
        app.status = params[1];
        if (params[2] !== undefined && params[2] !== null) app.resume_used = params[2];
        if (params[3] !== undefined && params[3] !== null) app.cover_letter_used = params[3];
        if (params[4] !== undefined && params[4] !== null) app.notes = params[4];
        if (params[5] !== undefined && params[5] !== null) app.interview_date = params[5];
        if (params[6] !== undefined && params[6] !== null) app.interview_time = params[6];
        if (params[7] !== undefined && params[7] !== null) app.assessment_date = params[7];
        if (params[8] !== undefined && params[8] !== null) app.offer_deadline = params[8];
        if (params[9] !== undefined && params[9] !== null) app.salary_offered = params[9];
        if (params[10] !== undefined && params[10] !== null) app.recruiter_name = params[10];
        if (params[11] !== undefined && params[11] !== null) app.recruiter_email = params[11];
        if (params[12] !== undefined && params[12] !== null) app.recruiter_phone = params[12];
        if (params[13] !== undefined && params[13] !== null) app.meeting_link = params[13];
        app.updated_at = new Date().toISOString();
        return { rows: [app] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('insert into application_history')) {
      const historyEntry = {
        id: mockDb.applicationHistory.length + 1,
        application_id: params[0],
        previous_status: params[1],
        current_status: params[2],
        notes: params[3],
        changed_at: new Date().toISOString()
      };
      mockDb.applicationHistory.push(historyEntry);
      return { rows: [historyEntry] };
    }

    if (statementNormalized.includes('from application_history') && statementNormalized.includes('where application_id =')) {
      const rows = mockDb.applicationHistory.filter(h => h.application_id === params[0]);
      return { rows };
    }

    if (statementNormalized.includes('insert into calendar_events')) {
      const event = {
        id: mockDb.calendarEvents.length + 1,
        application_id: params[0],
        title: params[1],
        description: params[2] || null,
        event_type: params[3],
        start_time: params[4],
        end_time: params[5] || null,
        meeting_link: params[6] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.calendarEvents.push(event);
      return { rows: [event] };
    }

    if (statementNormalized.includes('from calendar_events')) {
      if (statementNormalized.includes('where id != $1')) {
        const safeId = params[0] || -1;
        const startLimit = new Date(params[1]);
        const endLimit = new Date(params[2]);
        const rows = mockDb.calendarEvents.filter(e => {
          if (e.id === safeId) return false;
          const eStart = new Date(e.start_time).getTime();
          const eEnd = e.end_time ? new Date(e.end_time).getTime() : eStart + 60 * 60 * 1000;
          return (eStart < endLimit.getTime() && eEnd > startLimit.getTime());
        });
        return { rows };
      }
      if (statementNormalized.includes('where application_id =')) {
        const rows = mockDb.calendarEvents.filter(e => e.application_id === params[0]);
        return { rows };
      }
      return { rows: mockDb.calendarEvents };
    }

    if (statementNormalized.includes('update calendar_events') && statementNormalized.includes('set google_event_id =')) {
      const googleEventId = params[0];
      const id = params[1];
      const event = mockDb.calendarEvents.find(e => e.id === id);
      if (event) {
        event.google_event_id = googleEventId;
        return { rows: [event] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('update calendar_events')) {
      const event = mockDb.calendarEvents.find(e => e.id === params[0]);
      if (event) {
        if (params[1] !== undefined && params[1] !== null) event.title = params[1];
        if (params[2] !== undefined && params[2] !== null) event.description = params[2];
        if (params[3] !== undefined && params[3] !== null) event.event_type = params[3];
        if (params[4] !== undefined && params[4] !== null) event.start_time = params[4];
        if (params[5] !== undefined && params[5] !== null) event.end_time = params[5];
        if (params[6] !== undefined && params[6] !== null) event.meeting_link = params[6];
        event.updated_at = new Date().toISOString();
        return { rows: [event] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('delete from calendar_events')) {
      const idx = mockDb.calendarEvents.findIndex(e => e.id === params[0]);
      if (idx !== -1) {
        const deleted = mockDb.calendarEvents.splice(idx, 1)[0];
        return { rows: [deleted] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('delete from reminders') && statementNormalized.includes('event_id =')) {
      mockDb.reminders = mockDb.reminders.filter(r => !(r.event_id === params[0] && r.status === 'pending'));
      return { rows: [] };
    }

    if (statementNormalized.includes('insert into reminders')) {
      const newReminder = {
        id: mockDb.reminders.length + 1,
        event_id: params[0],
        reminder_time: params[1],
        lead_time: params[2],
        status: params[3] || 'pending',
        created_at: new Date().toISOString()
      };
      const existingIdx = mockDb.reminders.findIndex(r => r.event_id === params[0] && r.lead_time === params[2]);
      if (existingIdx !== -1) {
        mockDb.reminders[existingIdx].reminder_time = params[1];
        mockDb.reminders[existingIdx].status = 'pending';
        return { rows: [mockDb.reminders[existingIdx]] };
      }
      mockDb.reminders.push(newReminder);
      return { rows: [newReminder] };
    }

    if (statementNormalized.includes('from reminders r') && statementNormalized.includes('join calendar_events e')) {
      const now = new Date().getTime();
      const rows = mockDb.reminders
        .filter(r => r.status === 'pending' && new Date(r.reminder_time).getTime() <= now)
        .map(r => {
          const ev = mockDb.calendarEvents.find(e => e.id === r.event_id) || {};
          const app = mockDb.applications.find(a => a.id === ev.application_id) || {};
          return {
            id: r.id,
            event_id: r.event_id,
            lead_time: r.lead_time,
            title: ev.title || 'Event',
            description: ev.description || '',
            start_time: ev.start_time || new Date().toISOString(),
            meeting_link: ev.meeting_link || '',
            application_id: ev.application_id,
            job_id: app.job_id
          };
        });
      return { rows };
    }

    if (statementNormalized.includes('update reminders set status =')) {
      const r = mockDb.reminders.find(rem => rem.id === params[0]);
      if (r) {
        r.status = params[1] || 'sent';
        return { rows: [r] };
      }
      return { rows: [] };
    }

    if (statementNormalized.includes('select a.*, j.company, j.role') || (statementNormalized.includes('from applications a') && statementNormalized.includes('join jobs j'))) {
      const rows = mockDb.applications.map(a => {
        const job = mockDb.jobs?.find(j => j.id === a.job_id) || {
          company: 'Google',
          role: 'Software Engineer',
          apply_url: 'http://careers.google.com/jobs/1',
          ai_score: 85,
          platform: 'Naukri'
        };
        return {
          ...a,
          company: job.company,
          role: job.role,
          apply_url: job.apply_url,
          ai_score: job.ai_score,
          platform: job.platform
        };
      });
      return { rows };
    }

    if (statementNormalized.includes('from applications') || statementNormalized.includes('from applications a')) {
      if (statementNormalized.includes('avg(j.ai_score)')) {
        const sum = mockDb.applications.reduce((acc, a) => {
          const job = mockDb.jobs?.find(j => j.id === a.job_id);
          return acc + (job ? (job.ai_score || 0) : 85);
        }, 0);
        const avg = mockDb.applications.length > 0 ? (sum / mockDb.applications.length) : 0;
        return { rows: [{ average: avg.toString() }] };
      }
      if (statementNormalized.includes('group by j.platform')) {
        const platforms = {};
        mockDb.applications.forEach(a => {
          const job = mockDb.jobs?.find(j => j.id === a.job_id) || { platform: 'Naukri' };
          platforms[job.platform] = (platforms[job.platform] || 0) + 1;
        });
        const rows = Object.entries(platforms).map(([platform, count]) => ({ platform, count: count.toString() }));
        return { rows };
      }
      if (statementNormalized.includes('group by j.company')) {
        const companies = {};
        mockDb.applications.forEach(a => {
          const job = mockDb.jobs?.find(j => j.id === a.job_id) || { company: 'Google' };
          companies[job.company] = (companies[job.company] || 0) + 1;
        });
        const rows = Object.entries(companies).map(([company, count]) => ({ company, count: count.toString() }));
        return { rows };
      }
      if (statementNormalized.includes('status ilike')) {
        let statusTerm = 'applied';
        if (statementNormalized.includes('interview scheduled') || statementNormalized.includes('hr round')) {
          statusTerm = 'interview';
        } else if (statementNormalized.includes('offer received') || statementNormalized.includes('selected')) {
          statusTerm = 'offer';
        } else if (statementNormalized.includes('rejected')) {
          statusTerm = 'rejected';
        }
        
        let count = 0;
        if (statusTerm === 'applied') {
          count = mockDb.applications.filter(a => a.status.toLowerCase() === 'applied').length;
        } else if (statusTerm === 'interview') {
          count = mockDb.applications.filter(a => ['interview scheduled', 'interview completed', 'hr round'].includes(a.status.toLowerCase())).length;
        } else if (statusTerm === 'offer') {
          count = mockDb.applications.filter(a => ['offer received', 'offer accepted', 'selected'].includes(a.status.toLowerCase())).length;
        } else if (statusTerm === 'rejected') {
          count = mockDb.applications.filter(a => a.status.toLowerCase() === 'rejected').length;
        }
        return { rows: [{ count: count.toString() }] };
      }
      return { rows: [{ count: mockDb.applications.length.toString() }] };
    }

    if (statementNormalized.includes('insert into reports')) {
      const r = {
        id: mockDb.reports.length + 1,
        report_type: params[0],
        content: typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1],
        generated_at: new Date().toISOString()
      };
      mockDb.reports.push(r);
      return { rows: [r] };
    }

    if (statementNormalized.includes('from reports')) {
      return { rows: mockDb.reports };
    }

    // Mock response for jobs query
    if (statementNormalized.includes('select * from jobs') || statementNormalized.includes('select id, platform, company')) {
      if (mockDb.jobs && mockDb.jobs.length > 0) {
        return { rows: mockDb.jobs };
      }
      return {
        rows: [
          {
            id: 1,
            platform: 'Naukri',
            company: 'Google',
            role: 'Software Engineer',
            location: 'Bangalore',
            employment_type: 'Full-time',
            salary: '25 LPA',
            experience: '0-2 years',
            skills: ['Javascript', 'Node.js', 'PostgreSQL'],
            description: 'Develop awesome backend services.',
            apply_url: 'https://careers.google.com/jobs/1',
            posted_date: new Date().toISOString(),
            deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
            ai_score: 95,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }

    // Mock count / stats queries for /summary command
    if (statementNormalized.includes('select count(*) from jobs') && statementNormalized.includes('posted_date')) {
      return { rows: [{ count: '1' }] };
    }
    if (statementNormalized.includes('select count(*) from jobs')) {
      return { rows: [{ count: '12' }] };
    }
    if (statementNormalized.includes('select count(*) from companies')) {
      return { rows: [{ count: '8' }] };
    }

    // Mock deadlines query
    if (statementNormalized.includes('select d.id, d.title, d.deadline')) {
      return {
        rows: [
          {
            id: 1,
            title: 'Google Apply Deadline',
            deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
            company: 'Google',
            role: 'Software Engineer'
          }
        ]
      };
    }

    // Mock settings query
    if (statementNormalized.includes('from settings')) {
      return { rows: [mockDb.settings] };
    }

    // Mock settings insert/update
    if (statementNormalized.includes('insert into settings') || (statementNormalized.includes('update settings') && !statementNormalized.includes('last_digest_sent_at'))) {
      if (params.length > 0) {
        if (params[0] !== undefined && params[0] !== null) mockDb.settings.telegram_enabled = params[0];
        if (params[1] !== undefined && params[1] !== null) mockDb.settings.notification_threshold = params[1];
        if (params[2] !== undefined && params[2] !== null) mockDb.settings.digest_mode = params[2];
        if (params[3] !== undefined && params[3] !== null) mockDb.settings.calendar_enabled = params[3];
        if (params[4] !== undefined && params[4] !== null) mockDb.settings.gmail_enabled = params[4];
        if (params[5] !== undefined && params[5] !== null) mockDb.settings.ai_enabled = params[5];
      }
      return { rows: [mockDb.settings] };
    }

    // Mock settings last_digest_sent_at update
    if (statementNormalized.includes('update settings set last_digest_sent_at')) {
      mockDb.settings.last_digest_sent_at = new Date().toISOString();
      return { rows: [mockDb.settings] };
    }

    // Mock notification queue insert (enqueue)
    if (statementNormalized.includes('insert into notification_queue')) {
      const jobId = params[0];
      const channel = params[1] || 'telegram';
      const priority = params[2] || 0;
      const exists = mockDb.notificationQueue.some(q => q.job_id === jobId && q.channel === channel);
      if (exists) return { rows: [] };

      const queueItem = {
        id: mockDb.notificationQueue.length + 1,
        job_id: jobId,
        channel,
        priority,
        retry_count: 0,
        max_retries: 3,
        next_attempt: new Date().toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      };
      mockDb.notificationQueue.push(queueItem);
      return { rows: [queueItem] };
    }

    // Mock notification queue select (dequeue / digest select)
    if (statementNormalized.includes('select q.id, q.job_id') || statementNormalized.includes('from notification_queue q')) {
      const pending = mockDb.notificationQueue.filter(q => q.status === 'pending');
      const rows = pending.map(q => ({
        id: q.id,
        job_id: q.job_id,
        channel: q.channel,
        priority: q.priority,
        retry_count: q.retry_count,
        max_retries: q.max_retries,
        next_attempt: q.next_attempt,
        status: q.status,
        role: 'Software Engineer',
        company: 'Google',
        location: 'Bangalore',
        employment_type: 'Full-time',
        salary: '25 LPA',
        experience: '0-2 years',
        skills: ['Javascript', 'Node.js'],
        description: 'Build awesome code.',
        apply_url: 'https://careers.google.com/jobs/1',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        ai_score: 95,
        platform: 'Naukri'
      }));
      return { rows };
    }

    // Mock notification queue update
    if (statementNormalized.includes('update notification_queue')) {
      const id = params[0];
      const status = params[1];
      const retry_count = params[2];
      const next_attempt = params[3];
      const item = mockDb.notificationQueue.find(q => q.id === id);
      if (item) {
        item.status = status;
        item.retry_count = retry_count;
        if (next_attempt) item.next_attempt = next_attempt;
      }
      return { rows: [item || {}] };
    }

    // Mock notification queue delete
    if (statementNormalized.includes('delete from notification_queue')) {
      const id = params[0];
      const index = mockDb.notificationQueue.findIndex(q => q.id === id);
      if (index !== -1) {
        mockDb.notificationQueue.splice(index, 1);
      }
      return { rows: [] };
    }

    // Mock notifications history insert / update (recordHistory / ignore)
    if (statementNormalized.includes('insert into notifications') || statementNormalized.includes('conflict (job_id, channel) do update')) {
      const jobId = params[0];
      const status = params[1];
      const channel = params[2] || 'telegram';
      const retryCount = params[3] || 0;
      const response = params[4];

      let item = mockDb.notifications.find(n => n.job_id === jobId && n.channel === channel);
      if (item) {
        item.status = status;
        item.retry_count = retryCount;
        item.response = response;
        item.sent_at = new Date().toISOString();
      } else {
        item = {
          id: mockDb.notifications.length + 1,
          job_id: jobId,
          status,
          channel,
          retry_count: retryCount,
          response,
          sent_at: new Date().toISOString()
        };
        mockDb.notifications.push(item);
      }
      return { rows: [item] };
    }

    // Mock notifications duplicate check query
    if (statementNormalized.includes('from notifications') && statementNormalized.includes('job_id = $1') && statementNormalized.includes('channel = $2')) {
      const jobId = params[0];
      const channel = params[1];
      const exists = mockDb.notifications.some(n => n.job_id === jobId && n.channel === channel && (n.status === 'sent' || n.status === 'ignored'));
      return { rows: exists ? [{ id: 1 }] : [] };
    }

    // Mock notifications stats query
    if (statementNormalized.includes('select status, count(*)') && statementNormalized.includes('from notifications')) {
      const counts = {};
      for (const n of mockDb.notifications) {
        counts[n.status] = (counts[n.status] || 0) + 1;
      }
      const rows = Object.entries(counts).map(([status, count]) => ({ status, count: count.toString() }));
      return { rows };
    }

    // Mock notifications list history
    if (statementNormalized.includes('select n.id, n.job_id') || (statementNormalized.includes('from notifications n') && !statementNormalized.includes('where'))) {
      const rows = mockDb.notifications.map(n => ({
        id: n.id,
        job_id: n.job_id,
        sent_at: n.sent_at,
        status: n.status,
        channel: n.channel,
        retry_count: n.retry_count,
        response: n.response,
        role: 'Software Engineer',
        company: 'Google'
      }));
      return { rows };
    }

    if (statementNormalized.includes('insert into jobs')) {
      let jobId = (mockDb.jobs || []).length + 1;
      let platform = params[0] || 'Unstop';
      let company = params[1] || 'Acme';
      let role = params[2] || 'Engineer';
      let applyUrl = params[9] || 'http://example.com';

      if (params.length === 0) {
        const valuesMatch = statement.match(/values\s*\(([^)]+)\)/i);
        if (valuesMatch) {
          const parts = valuesMatch[1].split(',').map(s => s.trim().replace(/'/g, ''));
          const parsedId = parseInt(parts[0], 10);
          if (!isNaN(parsedId)) {
            jobId = parsedId;
            platform = parts[1];
            company = parts[2];
            role = parts[3];
            applyUrl = parts[4];
          } else {
            platform = parts[0];
            company = parts[1];
            role = parts[2];
            applyUrl = parts[3];
          }
        }
      }

      const mockJob = {
        id: jobId,
        platform,
        company,
        role,
        location: params[3] || 'Remote',
        employment_type: params[4] || 'Full Time',
        salary: params[5] || null,
        experience: params[6] || null,
        skills: params[7] || [],
        description: params[8] || '',
        apply_url: applyUrl,
        posted_date: params[10] || new Date().toISOString(),
        deadline: params[11] || null,
        ai_score: params[12] || 85,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (!mockDb.jobs) mockDb.jobs = [];
      mockDb.jobs.push(mockJob);
      return { rows: [mockJob] };
    }

    // Mock updates to provider status (incrementing failures)
    if (statementNormalized.includes('update provider_status') && statementNormalized.includes('consecutive_failures + 1')) {
      const name = params[0]?.toLowerCase();
      const threshold = params[1] || 3;
      const statusObj = mockDb.providerStatus.get(name) || {
        provider_name: params[0],
        is_enabled: true,
        consecutive_failures: 0,
        health_status: 'healthy',
        version: '1.0.0',
        capabilities: ['fetch'],
        updated_at: new Date().toISOString()
      };

      statusObj.consecutive_failures += 1;
      if (statusObj.consecutive_failures >= threshold) {
        statusObj.health_status = 'down';
        statusObj.is_enabled = false;
      } else {
        statusObj.health_status = 'degraded';
      }
      statusObj.updated_at = new Date().toISOString();
      mockDb.providerStatus.set(name, statusObj);
      return { rows: [statusObj] };
    }

    // Mock reset failure count
    if (statementNormalized.includes('update provider_status') && statementNormalized.includes('consecutive_failures = 0')) {
      const name = params[0]?.toLowerCase();
      const statusObj = mockDb.providerStatus.get(name) || {
        provider_name: params[0],
        is_enabled: true,
        consecutive_failures: 0,
        health_status: 'healthy',
        version: '1.0.0',
        capabilities: ['fetch'],
        updated_at: new Date().toISOString()
      };

      statusObj.consecutive_failures = 0;
      statusObj.health_status = 'healthy';
      statusObj.is_enabled = true;
      statusObj.last_successful_sync = new Date().toISOString();
      statusObj.updated_at = new Date().toISOString();
      mockDb.providerStatus.set(name, statusObj);
      return { rows: [statusObj] };
    }

    // Mock provider status listings
    if (statementNormalized.includes('from provider_status') && !statementNormalized.includes('where')) {
      return { rows: Array.from(mockDb.providerStatus.values()) };
    }

    // Mock single provider status
    if (statementNormalized.includes('from provider_status') && statementNormalized.includes('where provider_name')) {
      const name = params[0]?.toLowerCase();
      const statusObj = mockDb.providerStatus.get(name) || {
        provider_name: params[0],
        is_enabled: true,
        consecutive_failures: 0,
        last_successful_sync: null,
        health_status: 'healthy',
        version: '1.0.0',
        capabilities: ['fetch', 'parse', 'normalize', 'validate', 'save'],
        updated_at: new Date().toISOString()
      };
      return { rows: [statusObj] };
    }

    // Mock updates / insert into provider status
    if (statementNormalized.includes('insert into provider_status') || statementNormalized.includes('update provider_status')) {
      const name = params[0];
      const nameLower = name?.toLowerCase();
      const statusObj = mockDb.providerStatus.get(nameLower) || {
        provider_name: name,
        is_enabled: params[1] ?? true,
        consecutive_failures: params[2] ?? 0,
        last_successful_sync: params[3],
        health_status: params[4] || 'healthy',
        version: params[5] || '1.0.0',
        capabilities: params[6] || [],
        updated_at: new Date().toISOString()
      };

      if (params[1] !== undefined) statusObj.is_enabled = params[1];
      if (params[2] !== undefined) statusObj.consecutive_failures = params[2];
      if (params[3] !== undefined) statusObj.last_successful_sync = params[3];
      if (params[4] !== undefined) statusObj.health_status = params[4];
      if (params[5] !== undefined) statusObj.version = params[5];
      if (params[6] !== undefined) statusObj.capabilities = params[6];
      statusObj.updated_at = new Date().toISOString();

      mockDb.providerStatus.set(nameLower, statusObj);
      return { rows: [statusObj] };
    }

    // Mock sync history counts / aggregates
    if (statementNormalized.includes('select count(*) from provider_sync_history') && statementNormalized.includes('status = \'success\'')) {
      const successCount = mockDb.providerSyncHistory.filter(h => h.status === 'success').length;
      return { rows: [{ count: successCount.toString() }] };
    }
    if (statementNormalized.includes('select count(*) from provider_sync_history')) {
      return { rows: [{ count: mockDb.providerSyncHistory.length.toString() }] };
    }
    if (statementNormalized.includes('select sum(jobs_saved) from provider_sync_history')) {
      const sum = mockDb.providerSyncHistory.reduce((acc, h) => acc + (h.jobs_saved || 0), 0);
      return { rows: [{ sum: sum.toString() }] };
    }
    if (statementNormalized.includes('select avg(execution_duration) from provider_sync_history')) {
      if (mockDb.providerSyncHistory.length === 0) return { rows: [{ avg: '0' }] };
      const avg = mockDb.providerSyncHistory.reduce((acc, h) => acc + h.execution_duration, 0) / mockDb.providerSyncHistory.length;
      return { rows: [{ avg: avg.toString() }] };
    }
    if (statementNormalized.includes('select provider_name, count(*) as total_syncs')) {
      const groups = {};
      for (const h of mockDb.providerSyncHistory) {
        if (!groups[h.provider_name]) {
          groups[h.provider_name] = { provider_name: h.provider_name, total_syncs: 0, success_syncs: 0, total_fetched: 0, total_parsed: 0, total_saved: 0, total_skipped: 0, avg_duration_ms: 0 };
        }
        const g = groups[h.provider_name];
        g.total_syncs++;
        if (h.status === 'success') g.success_syncs++;
        g.total_fetched += (h.jobs_fetched || 0);
        g.total_parsed += (h.jobs_parsed || 0);
        g.total_saved += (h.jobs_saved || 0);
        g.total_skipped += (h.jobs_skipped || 0);
        g.avg_duration_ms += (h.execution_duration || 0);
      }
      const rows = Object.values(groups).map(g => {
        g.avg_duration_ms = g.avg_duration_ms / g.total_syncs;
        return {
          ...g,
          total_syncs: g.total_syncs.toString(),
          success_syncs: g.success_syncs.toString()
        };
      });
      if (rows.length === 0) {
        rows.push({ provider_name: 'Unstop', total_syncs: '0', success_syncs: '0', total_fetched: 0, total_parsed: 0, total_saved: 0, total_skipped: 0, avg_duration_ms: 0 });
      }
      return { rows };
    }
    if (statementNormalized.includes('insert into provider_sync_history')) {
      const historyItem = {
        provider_name: params[0],
        status: params[1],
        execution_duration: params[2],
        jobs_fetched: params[3] || 0,
        jobs_parsed: params[4] || 0,
        jobs_saved: params[5] || 0,
        jobs_skipped: params[6] || 0,
        error_message: params[7]
      };
      mockDb.providerSyncHistory.push(historyItem);
      return { rows: [{ id: mockDb.providerSyncHistory.length, ...historyItem }] };
    }

    // Mock single log insert / retrieve
    if (statementNormalized.includes('insert into logs')) {
      return { rows: [{ id: 1 }] };
    }

    // Default mock response
    return { rows: [] };
  }

  const activePool = await connect();
  const start = Date.now();
  try {
    const res = await activePool.query(statement, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed: ${statement}`, { module: 'database', duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error(`Database query failed: ${statement}`, { module: 'database', error, statement, params });
    throw error;
  }
}

// Transaction wrapper
export async function transaction(callback) {
  if (process.env.NODE_ENV === 'test') {
    return callback({
      query: async (stmt, params) => query(stmt, params)
    });
  }

  const activePool = await connect();
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back due to error', { module: 'database', error });
    throw error;
  } finally {
    client.release();
  }
}
