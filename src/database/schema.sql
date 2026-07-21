-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(255),
    industry VARCHAR(255),
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(100) NOT NULL,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    employment_type VARCHAR(100),
    salary VARCHAR(100),
    experience VARCHAR(100),
    skills TEXT[], -- array of skills
    description TEXT,
    apply_url TEXT UNIQUE, -- UNIQUE constraint to prevent duplicate jobs
    posted_date TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    ai_score INT,
    logo VARCHAR(255),
    source_id VARCHAR(100),
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_platform_source_id UNIQUE (platform, source_id)
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    status VARCHAR(100) DEFAULT 'applied',
    resume_used VARCHAR(255),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create deadlines table
CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    telegram_enabled BOOLEAN DEFAULT TRUE,
    calendar_enabled BOOLEAN DEFAULT FALSE,
    gmail_enabled BOOLEAN DEFAULT FALSE,
    ai_enabled BOOLEAN DEFAULT TRUE
);

-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    level VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_apply_url ON jobs(apply_url);
CREATE INDEX IF NOT EXISTS idx_jobs_company_role ON jobs(company, role);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_deadline ON deadlines(deadline);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Insert default settings row
INSERT INTO settings (id, telegram_enabled, calendar_enabled, gmail_enabled, ai_enabled)
VALUES (1, TRUE, FALSE, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Create provider status table
CREATE TABLE IF NOT EXISTS provider_status (
    provider_name VARCHAR(100) PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT TRUE,
    consecutive_failures INT DEFAULT 0,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(50) DEFAULT 'healthy', -- 'healthy', 'degraded', 'down', 'disabled'
    version VARCHAR(20) DEFAULT '1.0.0',
    capabilities TEXT[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create provider sync history table
CREATE TABLE IF NOT EXISTS provider_sync_history (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'success', 'failed'
    execution_duration INT NOT NULL, -- in ms
    jobs_fetched INT DEFAULT 0,
    jobs_parsed INT DEFAULT 0,
    jobs_saved INT DEFAULT 0,
    jobs_skipped INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for provider history
CREATE INDEX IF NOT EXISTS idx_provider_sync_history_name ON provider_sync_history(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_sync_history_created_at ON provider_sync_history(created_at);

-- Seed default provider status rows
INSERT INTO provider_status (provider_name, is_enabled, health_status, version, capabilities)
VALUES 
  ('Unstop', TRUE, 'healthy', '1.0.0', ARRAY['fetch', 'parse', 'normalize', 'validate', 'save']),
  ('Internshala', TRUE, 'healthy', '1.0.0', ARRAY['fetch', 'parse', 'normalize', 'validate', 'save']),
  ('Wellfound', TRUE, 'healthy', '1.0.0', ARRAY['fetch', 'parse', 'normalize', 'validate', 'save']),
  ('Foundit', TRUE, 'healthy', '1.0.0', ARRAY['fetch', 'parse', 'normalize', 'validate', 'save']),
  ('Naukri', TRUE, 'healthy', '1.0.0', ARRAY['fetch', 'parse', 'normalize', 'validate', 'save'])
ON CONFLICT (provider_name) DO NOTHING;

-- Phase 5 settings table alterations
ALTER TABLE settings ADD COLUMN IF NOT EXISTS notification_threshold INT DEFAULT 75;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS digest_mode VARCHAR(50) DEFAULT 'instant';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP WITH TIME ZONE;

-- Create notifications history table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'retried', 'ignored', 'expired', 'duplicate'
    channel VARCHAR(50) NOT NULL, -- 'telegram', 'email', etc.
    retry_count INT DEFAULT 0,
    response TEXT,
    CONSTRAINT unique_notification_job_channel UNIQUE (job_id, channel)
);

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    priority INT DEFAULT 0,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    next_attempt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'dlq'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_queue_job_channel UNIQUE (job_id, channel)
);

-- Create indexes for notifications performance
CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);

-- Phase 6 ATS table alterations on applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_letter_used TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_date DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_time TIME;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS offer_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS salary_offered NUMERIC;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_name VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_email VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_phone VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create application history table
CREATE TABLE IF NOT EXISTS application_history (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    previous_status VARCHAR(100),
    current_status VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(100) NOT NULL, -- 'assessment', 'interview', 'offer_deadline', 'registration_deadline'
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    meeting_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    lead_time VARCHAR(50) NOT NULL, -- '7 days', '3 days', '1 day', '6 hours', '2 hours', '30 minutes'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_lead UNIQUE (event_id, lead_time)
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content JSONB NOT NULL
);

-- Create indexes for ATS performance
CREATE INDEX IF NOT EXISTS idx_application_history_app ON application_history(application_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_app ON calendar_events(application_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Phase 7 Resume Engine tables
CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    target_role VARCHAR(255) NOT NULL,
    version INT DEFAULT 1,
    primary_skills TEXT[] DEFAULT '{}',
    secondary_skills TEXT[] DEFAULT '{}',
    projects JSONB DEFAULT '[]',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    certifications TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resume_versions (
    id SERIAL PRIMARY KEY,
    resume_id INT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version INT NOT NULL,
    parsed_content TEXT NOT NULL,
    metadata JSONB NOT NULL,
    file_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_resume_version UNIQUE (resume_id, version)
);

CREATE TABLE IF NOT EXISTS resume_scores (
    id SERIAL PRIMARY KEY,
    resume_id INT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_match_score INT NOT NULL DEFAULT 0,
    keyword_match_score INT NOT NULL DEFAULT 0,
    role_match_score INT NOT NULL DEFAULT 0,
    experience_match_score INT NOT NULL DEFAULT 0,
    tech_match_score INT NOT NULL DEFAULT 0,
    overall_match_score INT NOT NULL DEFAULT 0,
    confidence_score INT NOT NULL DEFAULT 0,
    match_reason TEXT,
    missing_skills TEXT[] DEFAULT '{}',
    missing_keywords TEXT[] DEFAULT '{}',
    suggested_improvements TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_resume_job UNIQUE (resume_id, job_id)
);

-- Resume indexes
CREATE INDEX IF NOT EXISTS idx_resume_versions_resume ON resume_versions(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_scores_resume ON resume_scores(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_scores_job ON resume_scores(job_id);

-- Phase 8 Google Sync alterations
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS google_credentials (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    client_id TEXT,
    client_secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_sync_state (
    service_name VARCHAR(50) PRIMARY KEY, -- 'gmail', 'calendar'
    sync_token TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_emails (
    id VARCHAR(255) PRIMARY KEY, -- Gmail message ID
    thread_id VARCHAR(255),
    subject TEXT,
    sender TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    category VARCHAR(100), -- 'Job Application Confirmation', 'Online Assessment', etc.
    confidence_score INT DEFAULT 0,
    extracted_metadata JSONB DEFAULT '{}',
    ats_updated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_google ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_category ON processed_emails(category);





