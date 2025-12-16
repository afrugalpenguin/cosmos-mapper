/**
 * Type detection for Cosmos DB document values.
 * Detects specific types from values: guid, datetime, integer, number, boolean, etc.
 */

// UUID/GUID pattern
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 datetime patterns
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Detects the type of a value.
 * @param {any} value - The value to detect type for
 * @returns {string} The detected type
 */
export function detectType(value) {
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
    return detectStringType(value);
  }

  if (jsType === 'object') {
    return detectObjectPattern(value);
  }

  return jsType;
}

/**
 * Detects specific types within string values.
 */
function detectStringType(value) {
  if (value === '') {
    return 'string';
  }

  // Check for GUID
  if (GUID_REGEX.test(value)) {
    return 'guid';
  }

  // Check for ISO datetime
  if (ISO_DATE_REGEX.test(value)) {
    return 'datetime';
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

  // SimpleReference pattern: { Id: "guid", Reference: "string" } (like Policy in claims)
  if (keys.length === 2 && keys.includes('Id') && keys.includes('Reference')) {
    if (typeof obj.Id === 'string' && GUID_REGEX.test(obj.Id)) {
      return 'SimpleReference';
    }
  }

  return 'object';
}

/**
 * Gets a display-friendly type name.
 */
export function getTypeDisplayName(type) {
  const displayNames = {
    'DateTimeObject': 'DateTime',
    'ReferenceObject': 'Reference',
    'LookupObject': 'Lookup',
    'CaseInsensitiveString': 'CIString',
    'SimpleReference': 'Reference',
    'guid': 'GUID',
    'datetime': 'DateTime',
    'integer': 'Integer',
    'number': 'Number',
    'boolean': 'Boolean',
    'string': 'String',
    'array': 'Array',
    'object': 'Object',
    'null': 'Null'
  };

  return displayNames[type] || type;
}

/**
 * Checks if a type is a reference pattern (potential FK).
 */
export function isReferenceType(type) {
  return ['ReferenceObject', 'SimpleReference', 'LookupObject'].includes(type);
}
