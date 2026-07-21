import { CompanyRepository } from '../repositories/companyRepository.js';

export class CompanyService {
  constructor() {
    this.companyRepository = new CompanyRepository();
  }

  async getCompanies(limit = 100) {
    return this.companyRepository.listCompanies(limit);
  }
}
