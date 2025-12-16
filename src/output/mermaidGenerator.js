/**
 * Generates Mermaid ERD diagrams from schema and relationship data.
 */

import { getTypeDisplayName } from '../analysis/typeDetector.js';
import { getRootProperties } from '../analysis/schemaInferrer.js';
import { getUniqueRelationshipsForERD } from '../analysis/relationships.js';

/**
 * Generates a complete Mermaid ERD diagram.
 * @param {object} containerSchemas - Map of container name to schema
 * @param {object[]} relationships - All detected relationships
 * @param {object} options - Generation options
 * @returns {string} Mermaid ERD diagram code
 */
export function generateERD(containerSchemas, relationships, options = {}) {
  const {
    maxPropertiesPerEntity = 15,
    showTypes = true,
    showKeys = true,
    title = null
  } = options;

  const lines = ['erDiagram'];

  // Add title as comment if provided
  if (title) {
    lines.unshift(`%% ${title}`);
  }

  // Generate entity definitions
  for (const [containerName, schema] of Object.entries(containerSchemas)) {
    const entityDef = generateEntityDefinition(
      containerName,
      schema,
      relationships,
      { maxProperties: maxPropertiesPerEntity, showTypes, showKeys }
    );
    lines.push('');
    lines.push(...entityDef);
  }

  // Generate relationship lines
  lines.push('');
  const uniqueRels = getUniqueRelationshipsForERD(relationships);
  for (const rel of uniqueRels) {
    const relLine = generateRelationshipLine(rel);
    if (relLine) {
      lines.push(`    ${relLine}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates entity definition for a container.
 */
function generateEntityDefinition(containerName, schema, relationships, options) {
  const lines = [];
  const props = getRootProperties(schema.properties || {});

  // Find which properties are FKs
  const fkProperties = new Set(
    relationships
      .filter(r => r.fromContainer === containerName)
      .map(r => r.fromProperty.split('.')[0])
  );

  lines.push(`    ${sanitiseEntityName(containerName)} {`);

  // Limit properties shown
  const displayProps = props.slice(0, options.maxProperties);

  for (const prop of displayProps) {
    const line = formatPropertyLine(prop, fkProperties, options);
    lines.push(`        ${line}`);
  }

  // Add indicator if properties were truncated
  if (props.length > options.maxProperties) {
    lines.push(`        string _more_ "${props.length - options.maxProperties} more..."`);
  }

  lines.push(`    }`);

  return lines;
}

/**
 * Formats a single property line for the ERD entity.
 */
function formatPropertyLine(prop, fkProperties, options) {
  // Get primary type (first in list)
  const type = prop.types && prop.types.length > 0
    ? sanitiseTypeName(prop.types[0])
    : 'unknown';

  const name = sanitisePropertyName(prop.name);

  // Determine key markers
  let keyMarker = '';
  if (options.showKeys) {
    if (prop.name === 'id') {
      keyMarker = ' PK';
    } else if (fkProperties.has(prop.name)) {
      keyMarker = ' FK';
    }
  }

  // Add comment for optional fields or special types
  let comment = '';
  if (!prop.isRequired && prop.name !== 'id') {
    comment = ' "optional"';
  }

  return `${type} ${name}${keyMarker}${comment}`;
}

/**
 * Generates a relationship line between entities.
 */
function generateRelationshipLine(rel) {
  const from = sanitiseEntityName(rel.fromContainer);
  const to = sanitiseEntityName(rel.toContainer);

  // Determine cardinality symbols
  // ||--o{ means "one to many" (from has one, to has many)
  // }o--|| means "many to one" (from has many, to has one)
  let cardinalitySymbol;

  if (rel.cardinality === 'many-to-one') {
    // Many [from] relate to one [to]
    cardinalitySymbol = '}o--||';
  } else if (rel.cardinality === 'one-to-many') {
    // One [from] has many [to]
    cardinalitySymbol = '||--o{';
  } else {
    // Default: many to one
    cardinalitySymbol = '}o--||';
  }

  // Create relationship label from property name
  const label = rel.fromProperty.replace(/\./g, '_').replace('Id', '');

  return `${from} ${cardinalitySymbol} ${to} : "${label}"`;
}

/**
 * Sanitises a container name for Mermaid entity name.
 * Mermaid entity names can't have special characters.
 */
function sanitiseEntityName(name) {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Sanitises a property name for Mermaid.
 */
function sanitisePropertyName(name) {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '') || 'unnamed';
}

/**
 * Sanitises a type name for Mermaid.
 */
function sanitiseTypeName(type) {
  const typeMap = {
    'guid': 'guid',
    'datetime': 'datetime',
    'DateTimeObject': 'datetime',
    'ReferenceObject': 'reference',
    'LookupObject': 'lookup',
    'SimpleReference': 'reference',
    'CaseInsensitiveString': 'string',
    'integer': 'int',
    'number': 'float',
    'boolean': 'bool',
    'string': 'string',
    'array': 'array',
    'object': 'object',
    'null': 'null'
  };

  return typeMap[type] || 'string';
}

/**
 * Generates a simplified ERD showing only relationships.
 */
export function generateSimpleERD(containerNames, relationships) {
  const lines = ['erDiagram'];

  // Add all containers as simple entities
  for (const name of containerNames) {
    lines.push(`    ${sanitiseEntityName(name)}`);
  }

  lines.push('');

  // Add relationships
  const uniqueRels = getUniqueRelationshipsForERD(relationships);
  for (const rel of uniqueRels) {
    const relLine = generateRelationshipLine(rel);
    if (relLine) {
      lines.push(`    ${relLine}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates separate ERDs for each database.
 */
export function generateDatabaseERDs(containerSchemas, relationships, databaseContainers) {
  const erds = {};

  for (const [dbName, containerNames] of Object.entries(databaseContainers)) {
    // Filter schemas and relationships for this database
    const dbSchemas = {};
    for (const name of containerNames) {
      if (containerSchemas[name]) {
        dbSchemas[name] = containerSchemas[name];
      }
    }

    const dbRelationships = relationships.filter(r =>
      containerNames.includes(r.fromContainer) ||
      containerNames.includes(r.toContainer)
    );

    erds[dbName] = generateERD(dbSchemas, dbRelationships, {
      title: `${dbName} Database ERD`
    });
  }

  return erds;
}
