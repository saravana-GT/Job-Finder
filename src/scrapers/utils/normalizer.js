/**
 * Normalize location string into 'Remote', 'Hybrid', or physical location title case.
 */
export function normalizeLocation(location) {
  if (!location) return 'Onsite';
  const locLower = location.toLowerCase().trim();
  if (locLower === '') return 'Onsite';
  if (locLower.includes('remote') || locLower.includes('work from home') || locLower.includes('wfh')) {
    return 'Remote';
  }
  if (locLower.includes('hybrid')) {
    return 'Hybrid';
  }
  // Convert physical location to Title Case
  return location
    .split(' ')
    .filter(w => w.trim() !== '')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize employment type into 'Internship', 'Full Time', 'Part Time', or 'Contract'.
 */
export function normalizeEmploymentType(type) {
  if (!type) return 'Full Time';
  const typeLower = type.toLowerCase().trim();
  if (typeLower.includes('intern') || typeLower.includes('internship')) {
    return 'Internship';
  }
  if (typeLower.includes('part') && typeLower.includes('time')) {
    return 'Part Time';
  }
  if (typeLower.includes('contract') || typeLower.includes('freelance') || typeLower.includes('temporary')) {
    return 'Contract';
  }
  // Default fallback
  return 'Full Time';
}

/**
 * Standardize salary format.
 */
export function normalizeSalary(salary) {
  if (!salary) return 'Not Specified';
  const trimmed = salary.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'unspecified') return 'Not Specified';
  return trimmed;
}

/**
 * Normalize date into ISO string.
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString();
}

/**
 * Normalize skills string or array into flat array of trimmed strings.
 */
export function normalizeSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills.map(s => s.trim()).filter(s => s.length > 0);
  }
  if (typeof skills === 'string') {
    // Splits by comma, semicolon, pipe, or forward-slash
    return skills
      .split(/[;,|\/]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return [];
}
