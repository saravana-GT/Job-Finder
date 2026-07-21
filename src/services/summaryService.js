import { JobRepository } from '../repositories/jobRepository.js';
import { CompanyRepository } from '../repositories/companyRepository.js';
import { DeadlineRepository } from '../repositories/deadlineRepository.js';
import { ApplicationRepository } from '../repositories/applicationRepository.js';

export class SummaryService {
  constructor() {
    this.jobRepository = new JobRepository();
    this.companyRepository = new CompanyRepository();
    this.deadlineRepository = new DeadlineRepository();
    this.applicationRepository = new ApplicationRepository();
  }

  async getSummary() {
    const totalJobs = await this.jobRepository.countJobs();
    const todaysJobs = await this.jobRepository.countTodaysJobs();
    const totalCompanies = await this.companyRepository.countCompanies();
    const upcomingDeadlines = await this.deadlineRepository.getUpcomingDeadlines(5);
    const apps = await this.applicationRepository.listApplications(100);
    const pendingApplications = apps.filter(a => a.status === 'applied' || a.status === 'pending').length;

    return {
      totalJobs,
      todaysJobs,
      totalCompanies,
      matchedJobs: totalJobs, // placeholder until AI scoring is added
      pendingApplications,
      upcomingDeadlines
    };
  }
}
