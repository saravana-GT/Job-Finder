import { formatResponse } from '../utils/formatter.js';
import { JobService } from '../services/jobService.js';
import { CompanyService } from '../services/companyService.js';
import { ApplicationService } from '../services/applicationService.js';
import { SummaryService } from '../services/summaryService.js';
import { DeadlineRepository } from '../repositories/deadlineRepository.js';

const jobService = new JobService();
const companyService = new CompanyService();
const applicationService = new ApplicationService();
const summaryService = new SummaryService();
const deadlineRepository = new DeadlineRepository();

export async function getJobs(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const jobs = await jobService.getJobs(limit);
    res.json(formatResponse(jobs));
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req, res, next) {
  try {
    const summary = await summaryService.getSummary();
    res.json(formatResponse(summary));
  } catch (error) {
    next(error);
  }
}

export async function getCompanies(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const companies = await companyService.getCompanies(limit);
    res.json(formatResponse(companies));
  } catch (error) {
    next(error);
  }
}

export async function getApplications(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const applications = await applicationService.getApplications(limit);
    res.json(formatResponse(applications));
  } catch (error) {
    next(error);
  }
}

export async function getDeadlines(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const deadlines = await deadlineRepository.getUpcomingDeadlines(limit);
    res.json(formatResponse(deadlines));
  } catch (error) {
    next(error);
  }
}
