/**
 * Generates Azure DevOps wiki-compatible Markdown documentation.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getTypeDisplayName } from '../analysis/typeDetector.js';
import { getRootProperties, getChildProperties } from '../analysis/schemaInferrer.js';
import { generateERD, generateSimpleERD } from './mermaidGenerator.js';

/**
 * Generates all documentation files.
 * @param {object} data - Analysis results
 * @param {string} outputDir - Output directory path
 */
export async function generateDocumentation(data, outputDir) {
  const { databases, containerSchemas, relationships, timestamp } = data;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Generate main index page
  await generateIndexPage(data, outputDir);

  // Generate per-database documentation
  for (const [dbName, dbInfo] of Object.entries(databases)) {
    const dbDir = join(outputDir, sanitisePath(dbName));
    await mkdir(dbDir, { recursive: true });

    // Database overview page
    await generateDatabaseOverview(dbName, dbInfo, containerSchemas, relationships, dbDir, timestamp);

    // Per-container pages
    for (const containerName of dbInfo.containers) {
      const schema = containerSchemas[`${dbName}.${containerName}`] || containerSchemas[containerName];
      if (schema) {
        await generateContainerPage(containerName, dbName, schema, relationships, dbDir, timestamp);
      }
    }
  }

  // Generate cross-database relationships page
  const crossDbRels = relationships.filter(r => r.isCrossDatabase);
  if (crossDbRels.length > 0) {
    await generateCrossDatabasePage(crossDbRels, outputDir, timestamp);
  }
}

/**
 * Generates the main index page.
 */
async function generateIndexPage(data, outputDir) {
  const { databases, containerSchemas, relationships, timestamp } = data;

  const lines = [
    '# Cosmos DB Schema Documentation',
    '',
    `> Generated: ${timestamp}`,
    '',
    '## Overview',
    '',
    'This documentation describes the schema structure of the Cosmos DB databases.',
    '',
    '## Entity Relationship Diagram',
    '',
    '```mermaid',
    generateSimpleERD(
      Object.keys(containerSchemas),
      relationships.filter(r => !r.isOrphan)
    ),
    '```',
    '',
    '<details>',
    '<summary>Diagram Legend</summary>',
    '',
    '| Symbol | Meaning |',
    '|--------|---------|',
    '| `\\|\\|` | Exactly one |',
    '| `o\\|` | Zero or one |',
    '| `}o` | Zero or more |',
    '| `}\\|` | One or more |',
    '',
    'Example: `orders }o--\\|\\| stores` = "Many orders belong to one store"',
    '',
    '</details>',
    '',
    '## Databases',
    ''
  ];

  for (const [dbName, dbInfo] of Object.entries(databases)) {
    lines.push(`### [${dbName}](./${sanitisePath(dbName)}/_overview.md)`);
    lines.push('');
    lines.push(`${dbInfo.containers.length} containers`);
    lines.push('');
    for (const containerName of dbInfo.containers) {
      lines.push(`- [${containerName}](./${sanitisePath(dbName)}/${sanitisePath(containerName)}.md)`);
    }
    lines.push('');
  }

  // Cross-database relationships summary
  const crossDbRels = relationships.filter(r => r.isCrossDatabase && !r.isOrphan);
  if (crossDbRels.length > 0) {
    lines.push('## Cross-Database Relationships');
    lines.push('');
    lines.push(`Found ${crossDbRels.length} relationships that cross database boundaries.`);
    lines.push('See [Cross-Database Relationships](./_cross-database.md) for details.');
    lines.push('');
  }


  await writeFile(join(outputDir, 'index.md'), lines.join('\n'));
}

/**
 * Generates database overview page.
 */
async function generateDatabaseOverview(dbName, dbInfo, containerSchemas, relationships, dbDir, timestamp) {
  // Filter relationships for this database
  const dbRelationships = relationships.filter(r =>
    dbInfo.containers.includes(r.fromContainer) || dbInfo.containers.includes(r.toContainer)
  );

  // Filter schemas for this database
  const dbSchemas = {};
  for (const containerName of dbInfo.containers) {
    const schema = containerSchemas[`${dbName}.${containerName}`] || containerSchemas[containerName];
    if (schema) {
      dbSchemas[containerName] = schema;
    }
  }

  const lines = [
    `# ${dbName} Database`,
    '',
    `> Generated: ${timestamp}`,
    '',
    '## Entity Relationship Diagram',
    '',
    '```mermaid',
    generateERD(dbSchemas, dbRelationships.filter(r => !r.isOrphan), {
      title: `${dbName} ERD`,
      maxPropertiesPerEntity: 10
    }),
    '```',
    '',
    '<details>',
    '<summary>Diagram Legend</summary>',
    '',
    '| Symbol | Meaning |',
    '|--------|---------|',
    '| `\\|\\|` | Exactly one |',
    '| `o\\|` | Zero or one |',
    '| `}o` | Zero or more |',
    '| `}\\|` | One or more |',
    '',
    '**Key Markers:** `ID` = Document Identifier, `REF` = Inferred Reference',
    '',
    '</details>',
    '',
    '## Containers',
    '',
    '| Container | Properties | Relationships |',
    '|-----------|------------|---------------|'
  ];

  for (const containerName of dbInfo.containers) {
    const schema = dbSchemas[containerName];
    const propCount = schema ? Object.keys(schema.properties).filter(p => !p.includes('.')).length : 0;
    const relCount = dbRelationships.filter(r => r.fromContainer === containerName && !r.isOrphan).length;

    lines.push(`| [${containerName}](./${sanitisePath(containerName)}.md) | ${propCount} | ${relCount} |`);
  }

  lines.push('');
  lines.push('[← Back to Index](../index.md)');

  await writeFile(join(dbDir, '_overview.md'), lines.join('\n'));
}

/**
 * Generates container documentation page.
 */
async function generateContainerPage(containerName, dbName, schema, relationships, dbDir, timestamp) {
  // Only show confirmed relationships for THIS container in THIS database (not orphans)
  const containerRels = relationships.filter(r =>
    r.fromContainer === containerName &&
    r.fromDatabase === dbName &&
    !r.isOrphan
  );
  const incomingRels = relationships.filter(r =>
    r.toContainer === containerName &&
    r.toDatabase === dbName &&
    !r.isOrphan
  );

  const lines = [
    `# ${containerName}`,
    '',
    `> Generated: ${timestamp}`,
    '',
    `**Database:** ${dbName}`,
    '',
    '## Schema',
    '',
    generatePropertyTable(schema),
    ''
  ];

  // Nested objects
  const nestedObjects = getNestedObjectPaths(schema);
  if (nestedObjects.length > 0) {
    lines.push('## Nested Objects');
    lines.push('');

    for (const parentPath of nestedObjects) {
      lines.push(`<details>`);
      lines.push(`<summary><strong>${parentPath}</strong></summary>`);
      lines.push('');
      lines.push(generateNestedPropertyTable(schema, parentPath));
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  // Relationships
  if (containerRels.length > 0 || incomingRels.length > 0) {
    lines.push('## Relationships');
    lines.push('');

    if (containerRels.length > 0) {
      lines.push('### Outgoing References');
      lines.push('');
      lines.push('| Property | References | Type |');
      lines.push('|----------|------------|------|');
      for (const rel of containerRels) {
        let targetDisplay;
        if (rel.isAmbiguous) {
          // Show container name with "(multiple databases)" note
          targetDisplay = `${rel.toContainer} *(multiple databases)*`;
        } else {
          const targetLink = `[${rel.toContainer}](${rel.isCrossDatabase ? '../' + sanitisePath(rel.toDatabase) + '/' : ''}${sanitisePath(rel.toContainer)}.md)`;
          targetDisplay = targetLink;
        }
        lines.push(`| ${rel.fromProperty} | ${targetDisplay} | ${rel.cardinality} |`);
      }
      lines.push('');
    }

    if (incomingRels.length > 0) {
      lines.push('### Incoming References');
      lines.push('');
      lines.push('| From Container | Property |');
      lines.push('|----------------|----------|');
      for (const rel of incomingRels) {
        const fromLink = `[${rel.fromContainer}](${rel.isCrossDatabase ? '../' + sanitisePath(rel.fromDatabase) + '/' : ''}${sanitisePath(rel.fromContainer)}.md)`;
        lines.push(`| ${fromLink} | ${rel.fromProperty} |`);
      }
      lines.push('');
    }
  }

  lines.push('[← Back to Database Overview](./_overview.md) | [← Back to Index](../index.md)');

  await writeFile(join(dbDir, `${sanitisePath(containerName)}.md`), lines.join('\n'));
}

/**
 * Generates property table for root-level properties.
 */
function generatePropertyTable(schema) {
  const props = getRootProperties(schema.properties);
  const lines = [
    '| Property | Type | Status | Example | Notes |',
    '|----------|------|--------|---------|-------|'
  ];

  for (const prop of props) {
    const type = formatTypes(prop.types);
    const status = formatOptionality(prop);
    const example = formatExamples(prop.examples);
    const notes = formatNotes(prop);
    lines.push(`| ${prop.name} | ${type} | ${status} | ${example} | ${notes} |`);
  }

  return lines.join('\n');
}

/**
 * Formats the optionality status.
 */
function formatOptionality(prop) {
  const optionality = prop.optionality || (prop.isRequired ? 'required' : 'optional');
  switch (optionality) {
    case 'required': return 'Required';
    case 'nullable': return 'Nullable';
    case 'optional': return 'Optional';
    case 'sparse': return 'Sparse';
    default: return prop.isRequired ? 'Yes' : 'No';
  }
}

/**
 * Formats notes for enum and computed fields.
 */
function formatNotes(prop) {
  const notes = [];
  if (prop.isEnum && prop.enumValues) {
    const values = prop.enumValues.slice(0, 3).join(', ');
    notes.push(`Enum: ${values}${prop.enumValues.length > 3 ? '...' : ''}`);
  }
  if (prop.isComputed) {
    notes.push(`Computed (${prop.computedPattern})`);
  }
  return notes.length > 0 ? notes.join('; ') : '-';
}

/**
 * Generates property table for nested object properties.
 */
function generateNestedPropertyTable(schema, parentPath) {
  const props = getChildProperties(schema.properties, parentPath);
  const lines = [
    '| Property | Type | Status | Example | Notes |',
    '|----------|------|--------|---------|-------|'
  ];

  for (const prop of props) {
    const type = formatTypes(prop.types);
    const status = formatOptionality(prop);
    const example = formatExamples(prop.examples);
    const notes = formatNotes(prop);
    lines.push(`| ${prop.name} | ${type} | ${status} | ${example} | ${notes} |`);
  }

  return lines.join('\n');
}

/**
 * Gets paths of nested objects that should have their own tables.
 */
function getNestedObjectPaths(schema) {
  const paths = new Set();

  for (const prop of Object.values(schema.properties)) {
    if (prop.parentPath && !prop.parentPath.includes('[]')) {
      paths.add(prop.parentPath);
    }
  }

  // Sort by depth (fewer dots first)
  return Array.from(paths).sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    return depthA - depthB || a.localeCompare(b);
  });
}

/**
 * Formats type array for display.
 */
function formatTypes(types) {
  if (!types || types.length === 0) return 'unknown';

  return types
    .map(t => getTypeDisplayName(t))
    .join(' \\| ');
}

/**
 * Formats examples for display (escaped for markdown).
 */
function formatExamples(examples) {
  if (!examples || examples.length === 0) return '-';

  const example = examples[0];
  // Escape pipes and backticks for markdown table
  return `\`${example.replace(/\|/g, '\\|').replace(/`/g, "'")}\``;
}

/**
 * Generates cross-database relationships page.
 */
async function generateCrossDatabasePage(crossDbRels, outputDir, timestamp) {
  // Separate ambiguous and non-ambiguous relationships
  const ambiguousRels = crossDbRels.filter(r => r.isAmbiguous);
  const definiteRels = crossDbRels.filter(r => !r.isAmbiguous);

  const lines = [
    '# Cross-Database Relationships',
    '',
    `> Generated: ${timestamp}`,
    '',
    'These relationships connect containers across different databases.',
    ''
  ];

  // Add note about ambiguous relationships if any exist
  if (ambiguousRels.length > 0) {
    lines.push('> **Note:** Some relationships are marked as *ambiguous* because the target container');
    lines.push('> exists in multiple databases. The actual target depends on the specific record\'s context.');
    lines.push('');
  }

  lines.push('## Relationships');
  lines.push('');
  lines.push('| Source | Property | Target | Type |');
  lines.push('|--------|----------|--------|------|');

  for (const rel of definiteRels) {
    lines.push(`| ${rel.fromDatabase}.${rel.fromContainer} | ${rel.fromProperty} | ${rel.toDatabase}.${rel.toContainer} | ${rel.cardinality} |`);
  }

  // Show ambiguous relationships with all possible databases
  for (const rel of ambiguousRels) {
    const possibleTargets = rel.possibleDatabases.map(db => `${db}.${rel.toContainer}`).join(', ');
    lines.push(`| ${rel.fromDatabase}.${rel.fromContainer} | ${rel.fromProperty} | ${rel.toContainer} *(ambiguous: ${possibleTargets})* | ${rel.cardinality} |`);
  }

  lines.push('');
  lines.push('[← Back to Index](./index.md)');

  await writeFile(join(outputDir, '_cross-database.md'), lines.join('\n'));
}

/**
 * Sanitises a name for use in file paths.
 */
function sanitisePath(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
