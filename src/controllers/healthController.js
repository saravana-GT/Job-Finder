import { formatResponse } from '../utils/formatter.js';

export async function healthController(req, res) {
  res.json(formatResponse({ status: 'running' }));
}
