import { query } from '../database/connection.js';

export class CompanyRepository {
  /**
   * List all companies.
   */
  async listCompanies(limit = 100) {
    const sql = 'SELECT id, name, website, industry, location, created_at FROM companies ORDER BY name ASC LIMIT $1';
    const res = await query(sql, [limit]);
    return res.rows;
  }

  /**
   * Create a company. Prevents duplicates by name.
   */
  async createCompany(companyData) {
    const { name, website, industry, location } = companyData;
    const sql = `
      INSERT INTO companies (name, website, industry, location)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO UPDATE SET
        website = COALESCE(EXCLUDED.website, companies.website),
        industry = COALESCE(EXCLUDED.industry, companies.industry),
        location = COALESCE(EXCLUDED.location, companies.location)
      RETURNING *
    `;
    const res = await query(sql, [name, website, industry, location]);
    return res.rows[0];
  }

  /**
   * Get total count of companies.
   */
  async countCompanies() {
    const sql = 'SELECT COUNT(*) FROM companies';
    const res = await query(sql);
    return parseInt(res.rows[0].count, 10);
  }
}
