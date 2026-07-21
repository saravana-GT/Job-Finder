import { logger } from '../../utils/logger.js';

export class ComplianceChecker {
  /**
   * Predefined robots.txt rules for target platforms to avoid illegal calls when offline or blocked.
   */
  static get PredefinedRules() {
    return {
      naukri: {
        disallowedPaths: ['/jobs', '/jobs-in', '/recruiters', '/search', '/client-search', '/api/'],
        allowsScraping: false
      },
      internshala: {
        disallowedPaths: ['/internships/detail', '/internship/detail', '/search', '/api/'],
        allowsScraping: false
      },
      wellfound: {
        disallowedPaths: ['/jobs', '/jobs/', '/api/'],
        allowsScraping: false
      },
      foundit: {
        disallowedPaths: ['/jobs', '/jobs-in', '/search', '/api/'],
        allowsScraping: false
      },
      unstop: {
        disallowedPaths: ['/jobs', '/opportunities', '/search', '/api/'],
        allowsScraping: false
      }
    };
  }

  /**
   * Check if direct automated fetching is allowed for a path on a platform.
   * @param {string} platform Platform name
   * @param {string} targetUrl The target URL to test
   * @param {string} userAgent The User Agent string
   */
  static async isUrlAllowed(platform, targetUrl, userAgent = 'PlacementAssistantBot') {
    const platformKey = platform.toLowerCase();
    const rules = this.PredefinedRules[platformKey];

    logger.debug(`Checking compliance for platform: ${platform}, URL: ${targetUrl}`, { module: 'compliance' });

    if (!rules) {
      // If we don't know the platform, default to standard conservative robots.txt parsing
      logger.warn(`No predefined compliance rules for "${platform}". Allowing check to pass, but caution is recommended.`, { module: 'compliance' });
      return true;
    }

    // Check if the URL path falls under any disallowed path prefixes
    try {
      const parsedUrl = new URL(targetUrl);
      const path = parsedUrl.pathname.toLowerCase();

      for (const disallowed of rules.disallowedPaths) {
        if (path.startsWith(disallowed.toLowerCase())) {
          logger.warn(`[Compliance Check] Automated fetch BLOCKED for "${platform}" at path "${path}" (matches disallowed prefix "${disallowed}").`, { module: 'compliance' });
          return false;
        }
      }

      return rules.allowsScraping;
    } catch (err) {
      logger.error(`Failed to parse target URL "${targetUrl}" during compliance check`, { module: 'compliance', error: err });
      return false;
    }
  }
}
export default ComplianceChecker;
