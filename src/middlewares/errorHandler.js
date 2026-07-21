import { formatErrorResponse } from '../utils/formatter.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  logger.error(message, {
    module: 'http',
    error,
  });

  res.status(statusCode).json(formatErrorResponse(message, statusCode));
}
