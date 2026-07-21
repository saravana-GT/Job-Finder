import { logger } from '../utils/logger.js';

export class KeywordExtractor {
  /**
   * Parse experience string into min and max numerical values.
   * Examples:
   *   "0-2 years" -> { min: 0, max: 2 }
   *   "2 to 5 years" -> { min: 2, max: 5 }
   *   "5+ years" -> { min: 5, max: 99 }
   *   "Fresher" -> { min: 0, max: 1 }
   * @param {string} expStr 
   */
  static parseExperience(expStr) {
    const result = { min: 0, max: 99 };
    if (!expStr || typeof expStr !== 'string') return result;

    const clean = expStr.toLowerCase().trim();

    if (clean.includes('fresher') || clean.includes('entry level') || clean.includes('intern')) {
      return { min: 0, max: 1 };
    }

    // Match "2-5 years" or "2 to 5 years" or "2-5 yrs"
    const rangeRegex = /(\d+)\s*(?:-|to)\s*(\d+)/;
    const rangeMatch = clean.match(rangeRegex);
    if (rangeMatch) {
      result.min = parseInt(rangeMatch[1], 10);
      result.max = parseInt(rangeMatch[2], 10);
      return result;
    }

    // Match "5+ years" or "5 + years" or "5+ yrs"
    const plusRegex = /(\d+)\s*\+/;
    const plusMatch = clean.match(plusRegex);
    if (plusMatch) {
      result.min = parseInt(plusMatch[1], 10);
      result.max = 99;
      return result;
    }

    // Match single number "3 years"
    const singleRegex = /(\d+)\s*(?:years|year|yr|yrs)/;
    const singleMatch = clean.match(singleRegex);
    if (singleMatch) {
      const val = parseInt(singleMatch[1], 10);
      result.min = val;
      result.max = val;
      return result;
    }

    return result;
  }

  /**
   * Parse salary string and return annual value in INR.
   * Standardizes LPA (Lakhs Per Annum) to numeric value.
   * Standardizes USD to INR (using a rough conversion rate of 80).
   * Standardizes monthly stipends to annual salary (/month * 12).
   * Examples:
   *   "12 LPA" -> 1,200,000
   *   "10 - 15 LPA" -> { min: 1,000,000, max: 1,500,000 }
   *   "15,000 /month" -> { min: 180,000, max: 180,000 }
   * @param {string} salaryStr 
   */
  static parseSalary(salaryStr) {
    const fallback = { min: null, max: null, isCompetitive: true };
    if (!salaryStr || typeof salaryStr !== 'string') return fallback;

    const clean = salaryStr.toLowerCase().replace(/,/g, '').trim();

    if (clean.includes('competitive') || clean.includes('best in industry') || clean.includes('not specified') || clean.includes('unspecified')) {
      return fallback;
    }

    // 1. Check for LPA ranges: "10-15 lpa" or "10 to 15 lpa"
    const lpaRangeRegex = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*lpa/;
    const lpaRangeMatch = clean.match(lpaRangeRegex);
    if (lpaRangeMatch) {
      return {
        min: parseFloat(lpaRangeMatch[1]) * 100000,
        max: parseFloat(lpaRangeMatch[2]) * 100000,
        isCompetitive: false
      };
    }

    // 2. Check for single LPA: "12 lpa"
    const lpaSingleRegex = /(\d+(?:\.\d+)?)\s*lpa/;
    const lpaSingleMatch = clean.match(lpaSingleRegex);
    if (lpaSingleMatch) {
      const val = parseFloat(lpaSingleMatch[1]) * 100000;
      return { min: val, max: val, isCompetitive: false };
    }

    // 3. Check for monthly stipend: "15000/month" or "15000 pm" or "15000 per month"
    const monthlyRangeRegex = /(\d+)\s*(?:-|to)\s*(\d+)\s*(?:\/month|pm|per month|monthly)/;
    const monthlyRangeMatch = clean.match(monthlyRangeRegex);
    if (monthlyRangeMatch) {
      return {
        min: parseInt(monthlyRangeMatch[1], 10) * 12,
        max: parseInt(monthlyRangeMatch[2], 10) * 12,
        isCompetitive: false
      };
    }

    const monthlySingleRegex = /(\d+)\s*(?:\/month|pm|per month|monthly)/;
    const monthlySingleMatch = clean.match(monthlySingleRegex);
    if (monthlySingleMatch) {
      const val = parseInt(monthlySingleMatch[1], 10) * 12;
      return { min: val, max: val, isCompetitive: false };
    }

    // 4. Check for USD ranges: "$100k - $120k" or "$100000 - $120000"
    const usdRate = 80; // Conversion multiplier to INR
    const usdRangeRegex = /\$(\d+)\s*k?\s*(?:-|to)\s*\$?(\d+)\s*k?/;
    const usdRangeMatch = clean.match(usdRangeRegex);
    if (usdRangeMatch) {
      const isK = clean.includes('k');
      const multiplier = isK ? 1000 * usdRate : usdRate;
      return {
        min: parseFloat(usdRangeMatch[1]) * multiplier,
        max: parseFloat(usdRangeMatch[2]) * multiplier,
        isCompetitive: false
      };
    }

    // Attempt to extract numeric digits as last resort
    const digits = clean.match(/\d+/g);
    if (digits && digits.length >= 2) {
      return {
        min: parseInt(digits[0], 10),
        max: parseInt(digits[1], 10),
        isCompetitive: false
      };
    } else if (digits && digits.length === 1) {
      const val = parseInt(digits[0], 10);
      return { min: val, max: val, isCompetitive: false };
    }

    return fallback;
  }

  /**
   * Helper to convert user expected salary string (e.g. "10 LPA") to standard annual numeric value.
   */
  static parseUserExpectedSalary(expectedStr) {
    if (!expectedStr) return 0;
    const clean = expectedStr.toLowerCase().replace(/,/g, '').trim();
    
    const lpaMatch = clean.match(/(\d+(?:\.\d+)?)\s*lpa/);
    if (lpaMatch) {
      return parseFloat(lpaMatch[1]) * 100000;
    }

    const numericMatch = clean.match(/\d+/);
    if (numericMatch) {
      const val = parseInt(numericMatch[0], 10);
      // If the number is small (e.g. 10), treat as LPA, else raw value
      return val < 100 ? val * 100000 : val;
    }

    return 0;
  }
}
export default KeywordExtractor;
