export function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
}

export function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}
