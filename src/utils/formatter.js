export function formatResponse(data) {
  return { success: true, data };
}

export function formatErrorResponse(message, statusCode = 500) {
  return {
    success: false,
    error: message,
    statusCode,
  };
}
