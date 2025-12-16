import { detectType, isReferenceType } from './typeDetector.js';

// Cosmos DB internal fields to exclude
const COSMOS_METADATA_FIELDS = ['_rid', '_self', '_etag', '_ts', '_attachments'];

/**
 * Infers schema from an array of sampled documents.
 * @param {object[]} documents - Array of documents to analyse
 * @returns {object} Inferred schema with property details
 */
export function inferSchema(documents) {
  if (!documents || documents.length === 0) {
    return { properties: {}, documentCount: 0 };
  }

  const schema = {
    properties: {},
    documentCount: documents.length
  };

  // Process each document
  for (const doc of documents) {
    walkObject(doc, '', schema.properties, documents.length);
  }

  // Calculate required/optional based on occurrence frequency
  calculateOptionality(schema.properties, documents.length);

  return schema;
}

/**
 * Recursively walks an object and records property information.
 */
function walkObject(obj, basePath, properties, totalDocs) {
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
        children: {},
        isArray: false,
        arrayItemTypes: new Set()
      };
    }

    const prop = properties[path];
    prop.occurrences++;

    // Detect and record type
    const type = detectType(value);
    prop.types.add(type);

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
      processArray(value, path, properties, prop, totalDocs);
    }
    // Handle nested objects (but not special patterns)
    else if (type === 'object' && typeof value === 'object') {
      walkObject(value, path, properties, totalDocs);
    }
  }
}

/**
 * Processes array items and records their types/schema.
 */
function processArray(arr, basePath, properties, parentProp, totalDocs) {
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
      children: {},
      isArrayItem: true
    };
  }

  const itemProp = properties[itemPath];

  for (const item of arr) {
    itemProp.occurrences++;
    const itemType = detectType(item);
    itemProp.types.add(itemType);
    parentProp.arrayItemTypes.add(itemType);

    // Record example
    if (itemProp.examples.size < 3) {
      const example = formatExample(item, itemType);
      if (example) {
        itemProp.examples.add(example);
      }
    }

    // If array items are objects, walk them too
    if (itemType === 'object' && typeof item === 'object' && item !== null) {
      walkObject(item, itemPath, properties, totalDocs);
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

    // Calculate if required
    prop.frequency = prop.occurrences / totalDocs;
    prop.isRequired = prop.frequency >= threshold;
  }
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
