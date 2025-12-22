/**
 * Type detection for Cosmos DB document values.
 * Detects specific types from values: guid, datetime, integer, number, boolean, etc.
 */

// UUID/GUID pattern
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 datetime patterns
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Email pattern (simplified RFC 5322)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// URL pattern (HTTP/HTTPS)
const URL_REGEX = /^https?:\/\/[^\s]+$/i;

// Phone number patterns (common formats)
// International: +1 234 567 8901, +44 20 1234 5678
// US formats: (123) 456-7890, 123-456-7890, 123.456.7890
// Must have clear phone formatting, not just digits
const PHONE_PATTERNS = [
  /^\+\d[\d\s\-\.]{7,18}$/,                    // International: +1234567890, +1 234-567-8901
  /^\(\d{2,4}\)\s*\d{3,4}[\s\-\.]\d{3,4}$/,   // (123) 456-7890, (0123) 456 7890
  /^\d{3}[\-\.]\d{3}[\-\.]\d{4}$/,            // 123-456-7890, 123.456.7890
  /^\d{4,5}[\s\-\.]\d{6,7}$/                  // UK style: 01onal 123456
];

/**
 * Detects the type of a value.
 * @param {any} value - The value to detect type for
 * @param {Array} customPatterns - Optional custom patterns from config
 * @returns {string} The detected type
 */
export function detectType(value, customPatterns = []) {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  const jsType = typeof value;

  if (jsType === 'boolean') {
    return 'boolean';
  }

  if (jsType === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }

  if (jsType === 'string') {
    return detectStringType(value, customPatterns);
  }

  if (jsType === 'object') {
    return detectObjectPattern(value);
  }

  return jsType;
}

/**
 * Detects specific types within string values.
 * @param {string} value - The string value to analyze
 * @param {Array} customPatterns - Optional custom patterns from config
 */
function detectStringType(value, customPatterns = []) {
  if (value === '') {
    return 'string';
  }

  // Check for GUID first (most specific)
  if (GUID_REGEX.test(value)) {
    return 'guid';
  }

  // Check for ISO datetime
  if (ISO_DATE_REGEX.test(value)) {
    return 'datetime';
  }

  // Check for email
  if (EMAIL_REGEX.test(value)) {
    return 'email';
  }

  // Check for URL
  if (URL_REGEX.test(value)) {
    return 'url';
  }

  // Check for phone number using specific patterns
  for (const phonePattern of PHONE_PATTERNS) {
    if (phonePattern.test(value)) {
      return 'phone';
    }
  }

  // Check custom patterns
  for (const pattern of customPatterns) {
    try {
      const regex = new RegExp(pattern.pattern);
      if (regex.test(value)) {
        return pattern.name;
      }
    } catch (e) {
      // Invalid regex, skip
    }
  }

  return 'string';
}

/**
 * Detects common object patterns in the data.
 */
function detectObjectPattern(obj) {
  const keys = Object.keys(obj).sort();
  const keyString = keys.join(',');

  // DateTimeObject pattern: { Value: "ISO string", Epoch: number }
  if (keys.length === 2 && keys.includes('Value') && keys.includes('Epoch')) {
    if (typeof obj.Epoch === 'number') {
      return 'DateTimeObject';
    }
  }

  // ReferenceObject pattern: { Id: "guid", Name: "string", Code: "string" }
  if (keys.includes('Id') && keys.includes('Name') && keys.includes('Code')) {
    if (typeof obj.Id === 'string' && GUID_REGEX.test(obj.Id)) {
      return 'ReferenceObject';
    }
  }

  // LookupObject pattern: { Id: number, Name: "string", Code: "string" }
  if (keys.includes('Id') && keys.includes('Name') && keys.includes('Code')) {
    if (typeof obj.Id === 'number') {
      return 'LookupObject';
    }
  }

  // CaseInsensitiveString pattern: { Value: "string", Lower: "string" }
  if (keys.length === 2 && keys.includes('Value') && keys.includes('Lower')) {
    if (typeof obj.Value === 'string' && typeof obj.Lower === 'string') {
      return 'CaseInsensitiveString';
    }
  }

  // SimpleReference pattern: { Id: "guid", Reference: "string" } (like Product in orders)
  if (keys.length === 2 && keys.includes('Id') && keys.includes('Reference')) {
    if (typeof obj.Id === 'string' && GUID_REGEX.test(obj.Id)) {
      return 'SimpleReference';
    }
  }

  return 'object';
}

/**
 * Gets a display-friendly type name.
 * @param {string} type - The internal type name
 * @param {Array} customPatterns - Optional custom patterns for display name lookup
 */
export function getTypeDisplayName(type, customPatterns = []) {
  const displayNames = {
    'DateTimeObject': 'DateTime',
    'ReferenceObject': 'Reference',
    'LookupObject': 'Lookup',
    'CaseInsensitiveString': 'CIString',
    'SimpleReference': 'Reference',
    'guid': 'GUID',
    'datetime': 'DateTime',
    'email': 'Email',
    'url': 'URL',
    'phone': 'Phone',
    'integer': 'Integer',
    'number': 'Number',
    'boolean': 'Boolean',
    'string': 'String',
    'array': 'Array',
    'object': 'Object',
    'null': 'Null'
  };

  // Check if type matches a custom pattern
  const customPattern = customPatterns.find(p => p.name === type);
  if (customPattern && customPattern.displayName) {
    return customPattern.displayName;
  }

  return displayNames[type] || type;
}

/**
 * Checks if a type is a reference pattern (potential FK).
 */
export function isReferenceType(type) {
  return ['ReferenceObject', 'SimpleReference', 'LookupObject'].includes(type);
}
