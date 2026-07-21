import { logger } from '../utils/logger.js';

export class EmailClassifier {
  constructor() {
    this.rules = [
      {
        category: 'Interview Invitation',
        keywords: ['interview', 'schedule interview', 'interview invitation', 'technical round', 'interview loop', 'availability for a call', 'meet with', 'discussion scheduled'],
        weight: 15
      },
      {
        category: 'Online Assessment',
        keywords: ['assessment', 'test link', 'hackerrank', 'hackerearth', 'codility', 'online test', 'coding assessment', 'technical test', 'take-home test'],
        weight: 15
      },
      {
        category: 'Offer Letter',
        keywords: ['offer letter', 'job offer', 'congratulations! offer', 'selected for the role', 'offer of employment', 'salary details'],
        weight: 20
      },
      {
        category: 'Rejection',
        keywords: ['not moving forward', 'unfortunately', 'other candidates', 'pursue other', 'decided not to proceed', 'regret to inform'],
        weight: 20
      },
      {
        category: 'Job Application Confirmation',
        keywords: ['application received', 'thank you for applying', 'received your application', 'successfully applied', 'confirm your application'],
        weight: 15
      },
      {
        category: 'HR Discussion',
        keywords: ['hr round', 'hr interview', 'salary discussion', 'hr discussion', 'hr call'],
        weight: 15
      },
      {
        category: 'Shortlisting',
        keywords: ['shortlisted', 'resume shortlisted', 'moving to the next stage', 'passed screening'],
        weight: 15
      },
      {
        category: 'Registration Confirmation',
        keywords: ['registration confirmed', 'registered successfully', 'welcome to', 'account created', 'sign up confirmed'],
        weight: 10
      }
    ];
  }

  /**
   * Classify email text.
   * @param {string} subject
   * @param {string} body
   */
  classify(subject = '', body = '') {
    const textToAnalyze = `${subject} ${body}`.toLowerCase();
    let bestCategory = 'Unrelated';
    let maxConfidence = 0;

    for (const rule of this.rules) {
      let matchCount = 0;
      let hasExactPhrase = false;

      for (const keyword of rule.keywords) {
        if (textToAnalyze.includes(keyword)) {
          matchCount++;
          // High-weight check
          if (subject.toLowerCase().includes(keyword)) {
            hasExactPhrase = true;
          }
        }
      }

      if (matchCount > 0) {
        let confidence = matchCount * rule.weight;
        if (hasExactPhrase) confidence += 30; // boost confidence if keyword matches subject
        confidence = Math.min(100, confidence);

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestCategory = rule.category;
        }
      }
    }

    // Force lower confidence threshold
    if (maxConfidence < 40) {
      bestCategory = 'Unrelated';
      maxConfidence = 0;
    }

    logger.debug(`Email classified as: "${bestCategory}" with confidence: ${maxConfidence}%`, { module: 'email-classifier' });

    return {
      category: bestCategory,
      confidenceScore: maxConfidence
    };
  }
}

export const emailClassifier = new EmailClassifier();
export default emailClassifier;
