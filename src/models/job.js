export class Job {
  constructor({ id, title, company, source, postedAt, status = 'draft' }) {
    this.id = id;
    this.title = title;
    this.company = company;
    this.source = source;
    this.postedAt = postedAt;
    this.status = status;
  }
}
