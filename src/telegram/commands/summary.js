import { JobRepository } from '../../repositories/jobRepository.js';
import { CompanyRepository } from '../../repositories/companyRepository.js';
import { DeadlineRepository } from '../../repositories/deadlineRepository.js';

export async function summaryCommand() {
  const jobRepo = new JobRepository();
  const companyRepo = new CompanyRepository();
  const deadlineRepo = new DeadlineRepository();

  const totalJobs = await jobRepo.countJobs();
  const totalCompanies = await companyRepo.countCompanies();
  const todaysJobs = await jobRepo.countTodaysJobs();
  const upcomingDeadlines = await deadlineRepo.getUpcomingDeadlines(5);

  let message = '📊 *AI Placement Assistant Summary*\n\n';
  message += `💼 *Total Jobs:* ${totalJobs}\n`;
  message += `🏢 *Companies:* ${totalCompanies}\n`;
  message += `📅 *Today's Jobs:* ${todaysJobs}\n\n`;

  message += `🔔 *Upcoming Deadlines:*\n`;
  if (upcomingDeadlines.length === 0) {
    message += '  _No upcoming deadlines found._\n';
  } else {
    for (const d of upcomingDeadlines) {
      const formattedDate = new Date(d.deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      message += `  • *${d.company}* - ${d.role} (${formattedDate})\n`;
    }
  }

  return message;
}
