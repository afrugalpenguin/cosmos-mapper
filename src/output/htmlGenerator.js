/**
 * Generates beautiful HTML documentation using EJS templates.
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import { getTypeDisplayName } from '../analysis/typeDetector.js';
import { getRootProperties } from '../analysis/schemaInferrer.js';
import { generateERD, generateSimpleERD } from './mermaidGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generates HTML documentation.
 * @param {object} data - Analysis results
 * @param {string} outputDir - Output directory path
 */
export async function generateHtmlDocumentation(data, outputDir) {
  const { databases, containerSchemas, relationships, timestamp } = data;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Read the template
  const templatePath = join(__dirname, '..', 'templates', 'report.ejs');
  const template = await readFile(templatePath, 'utf-8');

  // Generate ERD diagrams
  const simpleERD = generateSimpleERD(
    Object.keys(containerSchemas),
    relationships.filter(r => !r.isOrphan)
  );

  // Generate per-database ERDs
  const databaseERDs = {};
  const databaseSimpleERDs = {};
  for (const [dbName, dbInfo] of Object.entries(databases)) {
    const dbSchemas = {};
    for (const containerName of dbInfo.containers) {
      const schema = containerSchemas[`${dbName}.${containerName}`] || containerSchemas[containerName];
      if (schema) {
        dbSchemas[containerName] = schema;
      }
    }

    // Filter to intra-database relationships only for the simple ERD
    const dbIntraRelationships = relationships.filter(r =>
      r.fromDatabase === dbName && r.toDatabase === dbName && !r.isOrphan
    );

    const dbRelationships = relationships.filter(r =>
      dbInfo.containers.includes(r.fromContainer) || dbInfo.containers.includes(r.toContainer)
    ).filter(r => !r.isOrphan);

    // Simple ERD (relationships only, no properties)
    databaseSimpleERDs[dbName] = generateSimpleERD(dbInfo.containers, dbIntraRelationships);

    // Detailed ERD (with properties)
    databaseERDs[dbName] = generateERD(dbSchemas, dbRelationships, {
      title: `${dbName} ERD`,
      maxPropertiesPerEntity: 8
    });
  }

  // Render the template
  const html = ejs.render(template, {
    databases,
    containerSchemas,
    relationships,
    timestamp,
    simpleERD,
    databaseERDs,
    databaseSimpleERDs,
    // Helper functions
    getRootProperties,
    getTypeDisplayName
  });

  // Write the output file
  const outputPath = join(outputDir, 'schema-report.html');
  await writeFile(outputPath, html);

  return outputPath;
}
