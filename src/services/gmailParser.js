import { logger } from '../utils/logger.js';

export class GmailParser {
  /**
   * Parse email headers and body to extract metadata.
   * @param {object} message Gmail message representation from SDK
   */
  parseMessage(message) {
    logger.info(`Parsing Gmail message metadata ID: ${message.id}`, { module: 'gmail-parser' });

    const headers = message.payload?.headers || [];
    const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');

    const subject = subjectHeader ? subjectHeader.value : '';
    const fromVal = fromHeader ? fromHeader.value : '';
    const emailDate = dateHeader ? dateHeader.value : '';

    // Extract recruiter details from From header
    // Format: "Recruiter Name <email@company.com>"
    let recruiterName = '';
    let recruiterEmail = '';
    const fromRegex = /^(?:"?([^"<]+)"?\s*)?<?([^>]+)>?$/;
    const fromMatch = fromVal.match(fromRegex);
    if (fromMatch) {
      recruiterName = (fromMatch[1] || '').trim();
      recruiterEmail = (fromMatch[2] || '').trim();
    } else {
      recruiterEmail = fromVal.trim();
    }

    // Resolve body content
    const body = this.extractBodyText(message.payload);

    // Heuristics for metadata extraction
    const company = this.extractCompany(subject, body, recruiterEmail);
    const role = this.extractRole(subject, body);
    const platform = this.extractPlatform(subject, body);
    const meetingLink = this.extractMeetingLink(body);
    const recruiterPhone = this.extractRecruiterPhone(body);
    const interviewType = this.extractInterviewType(subject, body);
    const referenceNumber = this.extractReferenceNumber(subject, body);

    // Extract Dates
    const interviewDateDetails = this.extractInterviewDateTime(body);
    const offerExpiry = this.extractOfferExpiry(body);
    const assessmentDeadline = this.extractAssessmentDeadline(body);

    return {
      company,
      role,
      platform,
      meetingLink,
      recruiterName: recruiterName || 'HR Team',
      recruiterEmail,
      recruiterPhone,
      interviewType,
      referenceNumber,
      date: interviewDateDetails.date,
      time: interviewDateDetails.time,
      timezone: interviewDateDetails.timezone,
      offerExpiry,
      assessmentDeadline,
      subject,
      receivedAt: emailDate ? new Date(emailDate).toISOString() : new Date().toISOString()
    };
  }

  /**
   * Helper to recursively extract plaintext body from Gmail parts payload.
   */
  extractBodyText(payload) {
    if (!payload) return '';
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.mimeType === 'text/html' && payload.body?.data && !this.plainTextFound) {
      // Return decoded html if plain text not available
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    let text = '';
    if (payload.parts) {
      for (const part of payload.parts) {
        text += this.extractBodyText(part) + '\n';
      }
    }
    return text;
  }

  extractCompany(subject, body, email) {
    // 1. Try to get company from email domain (if not public)
    const domainMatch = email.match(/@([^>]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'protonmail.com', 'zoho.com'];
      if (!publicDomains.includes(domain)) {
        const name = domain.split('.')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }

    // 2. Try match from common phrases "at Google", "with Stripe", "from Foundit"
    const companyRegex = /(?:at|with|from|joining)\s+([A-Z][a-zA-Z0-9\s.]{2,20})/g;
    let match;
    const matches = [];
    while ((match = companyRegex.exec(`${subject} ${body}`)) !== null) {
      const matchedName = match[1].trim();
      const ignore = ['The', 'Your', 'Our', 'New', 'This', 'We', 'Java', 'Spring', 'React', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!ignore.some(w => matchedName.startsWith(w))) {
        matches.push(matchedName);
      }
    }

    if (matches.length > 0) return matches[0];
    return 'Target Company';
  }

  extractRole(subject, body) {
    const roles = ['Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Fullstack Engineer', 'Frontend Developer', 'Backend Developer', 'Fullstack Developer', 'Data Scientist', 'DevOps Engineer', 'Android Developer', 'System Architect', 'QA Engineer', 'Product Manager'];
    const text = `${subject} ${body}`.toLowerCase();
    for (const role of roles) {
      if (text.includes(role.toLowerCase())) {
        // Normalize developers to engineers for consistency
        if (role === 'Backend Developer') return 'Backend Engineer';
        if (role === 'Frontend Developer') return 'Frontend Engineer';
        if (role === 'Fullstack Developer') return 'Fullstack Engineer';
        return role;
      }
    }

    // Regex match fallback
    const roleMatch = text.match(/(?:role of|position of|job of)\s+([a-zA-Z\s]{3,30})/i);
    if (roleMatch) return roleMatch[1].trim();

    return 'Software Engineer';
  }

  extractPlatform(subject, body) {
    const platforms = ['Naukri', 'Internshala', 'Wellfound', 'Foundit', 'Unstop', 'LinkedIn', 'Indeed'];
    const text = `${subject} ${body}`.toLowerCase();
    for (const p of platforms) {
      if (text.includes(p.toLowerCase())) return p;
    }
    return 'Gmail Sync';
  }

  extractMeetingLink(body) {
    const linksRegex = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com)\/[^\s"'\>]+)/i;
    const match = body.match(linksRegex);
    return match ? match[1] : null;
  }

  extractRecruiterPhone(body) {
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const match = body.match(phoneRegex);
    return match ? match[0] : null;
  }

  extractInterviewType(subject, body) {
    const types = ['Technical', 'HR', 'System Design', 'Behavioral', 'Managerial', 'Coding Round', 'Screening'];
    const text = `${subject} ${body}`.toLowerCase();
    for (const t of types) {
      if (text.includes(t.toLowerCase())) return t;
    }
    return 'Technical';
  }

  extractReferenceNumber(subject, body) {
    const refRegex = /(?:ref|reference|job id|application id|req id)[:#\s-]*([a-zA-Z0-9-]{4,15})/i;
    const match = `${subject} ${body}`.match(refRegex);
    return match ? match[1].trim() : null;
  }

  extractInterviewDateTime(body) {
    const text = body.toLowerCase();
    const result = { date: null, time: null, timezone: 'IST' };

    // Search for Date patterns: e.g. "on July 25, 2026" or "on 25/07/2026" or "2026-07-25"
    const datePatterns = [
      /(?:on)\s+([a-zA-Z]+ \d{1,2}(?:st|nd|rd|th)?,\s*\d{4})/i, // July 25, 2026
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/, // 25/07/2026 or 07-25-2026
      /(\d{4}-\d{1,2}-\d{1,2})/ // 2026-07-25
    ];

    for (const pattern of datePatterns) {
      const match = body.match(pattern);
      if (match) {
        result.date = match[1].replace(/(st|nd|rd|th)/g, ''); // Clean ordinal suffixes
        break;
      }
    }

    // Search for Time patterns: e.g. "at 11:30 am" or "at 15:00"
    const timePatterns = [
      /(?:at)\s+(\d{1,2}:\d{2}\s*(?:am|pm|gmt|ist|utc))/i, // 11:30 am
      /(\d{1,2}:\d{2})\s*(?:hrs|hours)/i // 15:00
    ];

    for (const pattern of timePatterns) {
      const match = body.match(pattern);
      if (match) {
        result.time = match[1].trim();
        break;
      }
    }

    // Determine Timezone
    if (text.includes('ist')) result.timezone = 'IST';
    else if (text.includes('pst')) result.timezone = 'PST';
    else if (text.includes('gmt')) result.timezone = 'GMT';
    else if (text.includes('utc')) result.timezone = 'UTC';

    return result;
  }

  extractOfferExpiry(body) {
    const regex = /(?:offer expires|valid till|deadline to accept|accept by)[:\s-]*([a-zA-Z]+ \d{1,2},\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})/i;
    const match = body.match(regex);
    return match ? new Date(match[1].replace(/(st|nd|rd|th)/g, '')).toISOString() : null;
  }

  extractAssessmentDeadline(body) {
    const regex = /(?:complete the test by|test deadline|assessment expires|test link valid till)[:\s-]*([a-zA-Z]+ \d{1,2},\s*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})/i;
    const match = body.match(regex);
    return match ? new Date(match[1].replace(/(st|nd|rd|th)/g, '')).toISOString() : null;
  }
}

export const gmailParser = new GmailParser();
export default gmailParser;
