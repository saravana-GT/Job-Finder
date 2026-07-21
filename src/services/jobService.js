import { JobRepository } from '../repositories/jobRepository.js';

export class JobService {
  constructor() {
    this.jobRepository = new JobRepository();
  }

  async getJobs(limit = 10) {
    return this.jobRepository.listJobs(limit);
  }
}
