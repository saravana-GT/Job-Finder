import { formatErrorResponse } from '../utils/formatter.js';

export function notFoundHandler(req, res) {
  res.status(404).json(formatErrorResponse('Route not found', 404));
}
