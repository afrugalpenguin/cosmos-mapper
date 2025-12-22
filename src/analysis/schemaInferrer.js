import { detectType, isReferenceType } from './typeDetector.js';

// Cosmos DB internal fields to exclude
const COSMOS_METADATA_FIELDS = ['_rid', '_self', '_etag', '_ts', '_attachments'];

/**
 * Infers schema from an array of sampled documents.
 * @param {object[]} documents - Array of documents to analyse
 * @param {object} config - Optional configuration (typeDetection settings)
 * @returns {object} Inferred schema with property details
 */
export function inferSchema(documents, config = {}) {
  if (!documents || documents.length === 0) {
    return { properties: {}, documentCount: 0 };
  }

  const customPatterns = config.typeDetection?.customPatterns || [];

  const schema = {
    properties: {},
    documentCount: documents.length
  };

  // Process each document
  for (const doc of documents) {
    walkObject(doc, '', schema.properties, documents.length, customPatterns);
  }

  // Calculate required/optional based on occurrence frequency
  calculateOptionality(schema.properties, documents.length);

  // Detect enum-like fields if enabled
  const enumConfig = config.typeDetection?.enumDetection;
  if (enumConfig?.enabled !== false) {
    detectEnumFields(schema.properties, documents.length, enumConfig);
  }

  return schema;
}

/**
 * Recursively walks an object and records property information.
 */
function walkObject(obj, basePath, properties, totalDocs, customPatterns = []) {
  if (obj === null || obj === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    // Skip Cosmos metadata fields
    if (COSMOS_METADATA_FIELDS.includes(key)) {
      continue;
    }

    const path = basePath ? `${basePath}.${key}` : key;

    // Initialize property record if not exists
    if (!properties[path]) {
      properties[path] = {
        path,
        name: key,
        parentPath: basePath || null,
        types: new Set(),
        occurrences: 0,
        examples: new Set(),
        nullCount: 0,
        allValues: new Set(),  // Track all unique values for enum detection
        children: {},
        isArray: false,
        arrayItemTypes: new Set()
      };
    }

    const prop = properties[path];
    prop.occurrences++;

    // Track null values separately
    if (value === null) {
      prop.nullCount++;
    }

    // Detect and record type
    const type = detectType(value, customPatterns);
    prop.types.add(type);

    // Track all unique values for enum detection (limit to prevent memory issues)
    if (type === 'string' && value !== null && prop.allValues.size < 50) {
      prop.allValues.add(value);
    }

    // Record example value (limit to 5 unique examples)
    if (prop.examples.size < 5 && value !== null && value !== undefined) {
      const example = formatExample(value, type);
      if (example) {
        prop.examples.add(example);
      }
    }

    // Handle arrays
    if (Array.isArray(value)) {
      prop.isArray = true;
      processArray(value, path, properties, prop, totalDocs, customPatterns);
    }
    // Handle nested objects (but not special patterns)
    else if (type === 'object' && typeof value === 'object') {
      walkObject(value, path, properties, totalDocs, customPatterns);
    }
  }
}

/**
 * Processes array items and records their types/schema.
 */
function processArray(arr, basePath, properties, parentProp, totalDocs, customPatterns = []) {
  const itemPath = `${basePath}[]`;

  // Initialize array item record
  if (!properties[itemPath]) {
    properties[itemPath] = {
      path: itemPath,
      name: '[]',
      parentPath: basePath,
      types: new Set(),
      occurrences: 0,
      examples: new Set(),
      nullCount: 0,
      allValues: new Set(),
      children: {},
      isArrayItem: true
    };
  }

  const itemProp = properties[itemPath];

  for (const item of arr) {
    itemProp.occurrences++;
    const itemType = detectType(item, customPatterns);
    itemProp.types.add(itemType);
    parentProp.arrayItemTypes.add(itemType);

    // Track null values
    if (item === null) {
      itemProp.nullCount++;
    }

    // Track all unique values for enum detection
    if (itemType === 'string' && item !== null && itemProp.allValues.size < 50) {
      itemProp.allValues.add(item);
    }

    // Record example
    if (itemProp.examples.size < 3) {
      const example = formatExample(item, itemType);
      if (example) {
        itemProp.examples.add(example);
      }
    }

    // If array items are objects, walk them too
    if (itemType === 'object' && typeof item === 'object' && item !== null) {
      walkObject(item, itemPath, properties, totalDocs, customPatterns);
    }
  }
}

/**
 * Formats a value as an example string.
 */
function formatExample(value, type) {
  if (value === null || value === undefined) {
    return null;
  }

  switch (type) {
    case 'guid':
    case 'datetime':
    case 'string':
      // Truncate long strings
      const str = String(value);
      return str.length > 50 ? str.substring(0, 47) + '...' : str;

    case 'integer':
    case 'number':
    case 'boolean':
      return String(value);

    case 'DateTimeObject':
    case 'ReferenceObject':
    case 'LookupObject':
    case 'SimpleReference':
    case 'CaseInsensitiveString':
      // For pattern objects, show structure indicator
      return `{${Object.keys(value).join(', ')}}`;

    case 'object':
      // Show key count for complex objects
      const keys = Object.keys(value);
      return keys.length <= 3
        ? `{${keys.join(', ')}}`
        : `{${keys.slice(0, 3).join(', ')}, ...}`;

    case 'array':
      return `[${value.length} items]`;

    default:
      return null;
  }
}

/**
 * Calculates whether each property is required or optional.
 * Also determines nullable status.
 * Required = appears in >= 95% of documents
 */
function calculateOptionality(properties, totalDocs, threshold = 0.95) {
  for (const prop of Object.values(properties)) {
    // Convert Sets to Arrays for serialization
    prop.types = Array.from(prop.types);
    prop.examples = Array.from(prop.examples);
    if (prop.arrayItemTypes) {
      prop.arrayItemTypes = Array.from(prop.arrayItemTypes);
    }
    if (prop.allValues) {
      prop.allValues = Array.from(prop.allValues);
    }

    // Calculate frequency
    prop.frequency = prop.occurrences / totalDocs;
    prop.isRequired = prop.frequency >= threshold;

    // Calculate nullable status
    prop.isNullable = prop.nullCount > 0;
    prop.nullFrequency = totalDocs > 0 ? prop.nullCount / totalDocs : 0;

    // Determine optionality classification
    if (prop.frequency >= threshold) {
      if (prop.nullCount > 0) {
        prop.optionality = 'nullable';  // Always present, sometimes null
      } else {
        prop.optionality = 'required';  // Always present, never null
      }
    } else if (prop.frequency >= 0.05) {
      prop.optionality = 'optional';    // Sometimes missing
    } else {
      prop.optionality = 'sparse';      // Rarely present
    }
  }
}

/**
 * Detects enum-like fields based on limited unique values.
 */
function detectEnumFields(properties, totalDocs, config = {}) {
  const maxValues = config.maxUniqueValues || 10;
  const minFrequency = config.minFrequency || 0.8;

  for (const prop of Object.values(properties)) {
    // Only consider string properties with limited unique values
    if (!prop.types.includes('string')) continue;
    if (!prop.allValues || prop.allValues.length === 0) continue;
    if (prop.allValues.length > maxValues) continue;
    if (prop.frequency < minFrequency) continue;

    // This looks like an enum
    prop.isEnum = true;
    prop.enumValues = [...prop.allValues].sort();
  }

  // Also detect computed/derived fields
  detectComputedFields(properties);
}

/**
 * Detects computed/derived fields based on pattern consistency.
 * Fields where all values match a specific pattern are likely computed.
 */
function detectComputedFields(properties) {
  // Common computed field patterns
  const computedPatterns = [
    { name: 'uuid-v4', regex: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
    { name: 'prefixed-id', regex: /^[A-Z]{2,5}-\d{4,}$/ },  // e.g., INV-12345, ORD-00001
    { name: 'timestamp-id', regex: /^\d{13,}$/ },            // Unix timestamp ms
    { name: 'slug', regex: /^[a-z0-9]+(-[a-z0-9]+)+$/ },    // URL slugs
    { name: 'hash', regex: /^[a-f0-9]{32,64}$/i }           // MD5, SHA hashes
  ];

  for (const prop of Object.values(properties)) {
    // Only consider string properties with multiple unique values
    if (!prop.types.includes('string')) continue;
    if (!prop.allValues || prop.allValues.length < 3) continue;
    if (prop.isEnum) continue;  // Skip enums

    // Check if all values match a computed pattern
    for (const pattern of computedPatterns) {
      const allMatch = prop.allValues.every(v => pattern.regex.test(v));
      if (allMatch) {
        prop.isComputed = true;
        prop.computedPattern = pattern.name;
        break;
      }
    }

    // If no predefined pattern matched, check for consistent structure
    if (!prop.isComputed && prop.allValues.length >= 5) {
      const consistentPattern = detectConsistentPattern(prop.allValues);
      if (consistentPattern) {
        prop.isComputed = true;
        prop.computedPattern = consistentPattern;
      }
    }
  }
}

/**
 * Detects if all values share a consistent structural pattern.
 * Returns pattern description or null.
 */
function detectConsistentPattern(values) {
  if (values.length < 5) return null;

  // Check if all values have same length
  const lengths = new Set(values.map(v => v.length));
  if (lengths.size === 1) {
    const len = values[0].length;
    // Check if structure is consistent (same positions for digits/letters/separators)
    const structure = values[0].split('').map(c => {
      if (/\d/.test(c)) return 'D';
      if (/[A-Z]/.test(c)) return 'U';
      if (/[a-z]/.test(c)) return 'L';
      return c;  // Keep separators as-is
    }).join('');

    const allSameStructure = values.every(v => {
      const vStructure = v.split('').map(c => {
        if (/\d/.test(c)) return 'D';
        if (/[A-Z]/.test(c)) return 'U';
        if (/[a-z]/.test(c)) return 'L';
        return c;
      }).join('');
      return vStructure === structure;
    });

    if (allSameStructure && structure.includes('D')) {
      // Has consistent structure with numbers - likely computed
      return `fixed-format-${len}`;
    }
  }

  return null;
}

/**
 * Builds a hierarchical tree from flat property paths.
 */
export function buildPropertyTree(properties) {
  const tree = {};

  // Sort by path length (process parents first)
  const sortedProps = Object.values(properties)
    .sort((a, b) => a.path.split('.').length - b.path.split('.').length);

  for (const prop of sortedProps) {
    if (!prop.parentPath) {
      // Root level property
      tree[prop.name] = { ...prop, children: {} };
    } else {
      // Find parent and add as child
      const parent = findInTree(tree, prop.parentPath);
      if (parent) {
        parent.children[prop.name] = { ...prop, children: {} };
      }
    }
  }

  return tree;
}

/**
 * Finds a property in the tree by path.
 */
function findInTree(tree, path) {
  const parts = path.replace(/\[\]/g, '.[]').split('.').filter(p => p);
  let current = tree;

  for (const part of parts) {
    if (current[part]) {
      current = current[part].children || current[part];
    } else if (current.children && current.children[part]) {
      current = current.children[part];
    } else {
      return null;
    }
  }

  return current;
}

/**
 * Gets all root-level properties (for table display).
 */
export function getRootProperties(properties) {
  return Object.values(properties)
    .filter(p => !p.parentPath)
    .sort((a, b) => {
      // Sort: id first, then required, then alphabetical
      if (a.name === 'id') return -1;
      if (b.name === 'id') return 1;
      if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Gets child properties of a given path.
 */
export function getChildProperties(properties, parentPath) {
  return Object.values(properties)
    .filter(p => p.parentPath === parentPath)
    .sort((a, b) => a.name.localeCompare(b.name));
}
