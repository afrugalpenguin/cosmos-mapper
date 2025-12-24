/**
 * Generates JSON Schema files from inferred Cosmos DB schemas.
 * Supports JSON Schema draft-07 and 2020-12.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getRootProperties, getChildProperties } from '../analysis/schemaInferrer.js';

// JSON Schema draft URLs
const DRAFT_URLS = {
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  '2020-12': 'https://json-schema.org/draft/2020-12/schema'
};

// Map CosmosMapper types to JSON Schema types
const TYPE_MAPPING = {
  'string': { type: 'string' },
  'guid': { type: 'string', format: 'uuid' },
  'datetime': { type: 'string', format: 'date-time' },
  'email': { type: 'string', format: 'email' },
  'url': { type: 'string', format: 'uri' },
  'phone': { type: 'string', pattern: '^[+]?[0-9\\s\\-().]+$' },
  'integer': { type: 'integer' },
  'number': { type: 'number' },
  'boolean': { type: 'boolean' },
  'null': { type: 'null' },
  'array': { type: 'array' },
  'object': { type: 'object' }
};

// Reference object types that should be treated as objects
const REFERENCE_TYPES = [
  'DateTimeObject',
  'ReferenceObject',
  'LookupObject',
  'SimpleReference',
  'CaseInsensitiveString'
];

/**
 * Maps a CosmosMapper type to JSON Schema type definition.
 * @param {string} cosmosType - Type from CosmosMapper
 * @returns {object} JSON Schema type definition
 */
export function mapTypeToJsonSchema(cosmosType) {
  if (TYPE_MAPPING[cosmosType]) {
    return { ...TYPE_MAPPING[cosmosType] };
  }

  // Reference object types -> object
  if (REFERENCE_TYPES.includes(cosmosType)) {
    return { type: 'object' };
  }

  // Unknown types default to string
  return { type: 'string' };
}

/**
 * Converts a property to JSON Schema format.
 * @param {object} prop - Property from CosmosMapper schema
 * @param {object} allProperties - All properties (for nested objects)
 * @param {object} config - JSON Schema config options
 * @returns {object} JSON Schema property definition
 */
export function convertPropertyToJsonSchema(prop, allProperties, config = {}) {
  const includeExamples = config.includeExamples !== false;

  // Handle multiple types
  const types = prop.types || [];

  // Filter out null for nullable handling
  const nonNullTypes = types.filter(t => t !== 'null');
  const isNullable = prop.isNullable || types.includes('null');

  let schema = {};

  // Handle enum fields
  if (prop.isEnum && prop.enumValues?.length > 0) {
    schema.type = 'string';
    schema.enum = prop.enumValues;
  }
  // Handle arrays
  else if (prop.isArray || types.includes('array')) {
    schema.type = 'array';

    // Find array item schema
    const itemPath = `${prop.path}[]`;
    const itemProp = allProperties[itemPath];

    if (itemProp) {
      schema.items = convertPropertyToJsonSchema(itemProp, allProperties, config);
    } else if (prop.arrayItemTypes?.length > 0) {
      // Use array item types if available
      schema.items = buildTypeSchema(prop.arrayItemTypes, config);
    } else {
      schema.items = {};
    }
  }
  // Handle objects with nested properties
  else if (nonNullTypes.includes('object') || REFERENCE_TYPES.some(t => nonNullTypes.includes(t))) {
    schema.type = 'object';

    // Get child properties
    const children = getChildProperties(allProperties, prop.path);
    if (children.length > 0) {
      schema.properties = {};
      const requiredFields = [];

      for (const child of children) {
        // Skip array item markers
        if (child.name === '[]') continue;

        schema.properties[child.name] = convertPropertyToJsonSchema(child, allProperties, config);

        if (child.isRequired && !child.isNullable) {
          requiredFields.push(child.name);
        }
      }

      if (requiredFields.length > 0) {
        schema.required = requiredFields;
      }
    }
  }
  // Handle single type
  else if (nonNullTypes.length === 1) {
    Object.assign(schema, mapTypeToJsonSchema(nonNullTypes[0]));
  }
  // Handle multiple types (use oneOf)
  else if (nonNullTypes.length > 1) {
    schema.oneOf = nonNullTypes.map(t => mapTypeToJsonSchema(t));
  }
  // Default to string
  else {
    schema.type = 'string';
  }

  // Add nullable support
  if (isNullable && schema.type && schema.type !== 'null') {
    // JSON Schema 2020-12 style: use array for type
    if (Array.isArray(schema.type)) {
      if (!schema.type.includes('null')) {
        schema.type.push('null');
      }
    } else {
      schema.type = [schema.type, 'null'];
    }
  }

  // Add examples
  if (includeExamples && prop.examples?.length > 0) {
    // Filter out object/array examples, use only primitives
    const primitiveExamples = prop.examples.filter(ex =>
      typeof ex === 'string' && !ex.startsWith('{') && !ex.startsWith('[')
    );
    if (primitiveExamples.length > 0) {
      schema.examples = primitiveExamples.slice(0, 3);
    }
  }

  return schema;
}

/**
 * Builds a type schema from multiple types.
 */
function buildTypeSchema(types, config) {
  const nonNullTypes = types.filter(t => t !== 'null');

  if (nonNullTypes.length === 0) {
    return {};
  }

  if (nonNullTypes.length === 1) {
    return mapTypeToJsonSchema(nonNullTypes[0]);
  }

  return {
    oneOf: nonNullTypes.map(t => mapTypeToJsonSchema(t))
  };
}

/**
 * Converts a container schema to JSON Schema format.
 * @param {string} containerName - Container name
 * @param {object} schema - CosmosMapper schema
 * @param {object} config - JSON Schema config options
 * @returns {object} JSON Schema document
 */
export function convertToJsonSchema(containerName, schema, config = {}) {
  const draft = config.draft || '2020-12';
  const schemaUrl = DRAFT_URLS[draft] || DRAFT_URLS['2020-12'];

  const jsonSchema = {
    $schema: schemaUrl,
    $id: `${containerName}.schema.json`,
    title: containerName,
    description: `Schema inferred from Cosmos DB container '${containerName}'`,
    type: 'object'
  };

  // Get root properties
  const rootProps = getRootProperties(schema.properties);
  const properties = {};
  const requiredFields = [];

  for (const prop of rootProps) {
    properties[prop.name] = convertPropertyToJsonSchema(prop, schema.properties, config);

    if (prop.isRequired && !prop.isNullable) {
      requiredFields.push(prop.name);
    }
  }

  jsonSchema.properties = properties;

  if (requiredFields.length > 0) {
    jsonSchema.required = requiredFields;
  }

  return jsonSchema;
}

/**
 * Generates JSON Schema files for all containers.
 * @param {object} data - Analysis results
 * @param {string} outputDir - Output directory
 * @param {object} config - JSON Schema config options
 */
export async function generateJsonSchemas(data, outputDir, config = {}) {
  const { containerSchemas } = data;

  // Create schemas subdirectory
  const schemasDir = join(outputDir, 'schemas');
  await mkdir(schemasDir, { recursive: true });

  const generatedFiles = [];

  for (const [containerName, schema] of Object.entries(containerSchemas)) {
    const jsonSchema = convertToJsonSchema(containerName, schema, config);

    const filename = `${sanitizeFilename(containerName)}.schema.json`;
    const filepath = join(schemasDir, filename);

    await writeFile(filepath, JSON.stringify(jsonSchema, null, 2));
    generatedFiles.push(filepath);
  }

  return generatedFiles;
}

/**
 * Sanitizes a container name for use as a filename.
 */
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
