import { BaseScraper } from '../baseScraper.js';

export class MockProvider extends BaseScraper {
  constructor() {
    super('MockProvider');
    this.mockJobs = [];
  }

  setMockJobs(jobs) {
    this.mockJobs = jobs;
  }

  async fetchJobs() {
    return this.mockJobs;
  }

  async parseJobs(rawData) {
    return rawData;
  }

  async normalizeJobs(parsedJobs) {
    return parsedJobs;
  }
}
export default MockProvider;
