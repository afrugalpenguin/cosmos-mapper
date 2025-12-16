#!/usr/bin/env node

/**
 * CosmosMapper - Azure Cosmos DB Schema Documentation Generator
 *
 * Connects to Cosmos DB, samples documents, infers schemas,
 * detects relationships, and generates ADO wiki-compatible documentation.
 */

import 'dotenv/config';
import { createCosmosClient, listDatabases, listContainers, sampleDocuments, getContainerInfo } from './cosmos/client.js';
import { inferSchema } from './analysis/schemaInferrer.js';
import { detectRelationships } from './analysis/relationships.js';
import { generateDocumentation } from './output/markdownGenerator.js';
import { logger } from './utils/logger.js';

// Configuration from environment
const config = {
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY || null, // null triggers Azure AD auth
  tenantDatabase: process.env.TENANT_DATABASE,
  platformDatabase: process.env.PLATFORM_DATABASE,
  sampleSize: parseInt(process.env.SAMPLE_SIZE, 10) || 100,
  outputDir: './output'
};

/**
 * Main entry point.
 */
async function main() {
  logger.header();

  // Validate configuration
  if (!config.endpoint) {
    logger.error('COSMOS_ENDPOINT is required. Set it in your .env file.');
    process.exit(1);
  }

  if (!config.tenantDatabase && !config.platformDatabase) {
    logger.error('At least one of TENANT_DATABASE or PLATFORM_DATABASE is required.');
    process.exit(1);
  }

  try {
    // Connect to Cosmos DB
    logger.info(`Connecting to Cosmos DB...`);
    const authType = config.key ? 'key-based' : 'Azure AD';
    logger.item(`Using ${authType} authentication`);

    const client = createCosmosClient(config.endpoint, config.key);

    // Verify connection by listing databases
    const allDatabases = await listDatabases(client);
    logger.success(`Connected. Found ${allDatabases.length} databases.`);

    // Build list of databases to analyse
    const databasesToAnalyse = {};

    if (config.tenantDatabase) {
      if (!allDatabases.includes(config.tenantDatabase)) {
        logger.warn(`Tenant database '${config.tenantDatabase}' not found.`);
      } else {
        databasesToAnalyse[config.tenantDatabase] = { type: 'tenant', containers: [] };
      }
    }

    if (config.platformDatabase) {
      if (!allDatabases.includes(config.platformDatabase)) {
        logger.warn(`Platform database '${config.platformDatabase}' not found.`);
      } else {
        databasesToAnalyse[config.platformDatabase] = { type: 'platform', containers: [] };
      }
    }

    if (Object.keys(databasesToAnalyse).length === 0) {
      logger.error('No valid databases to analyse.');
      process.exit(1);
    }

    // Discover containers in each database
    logger.section('Discovering containers...');

    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      const containers = await listContainers(client, dbName);
      dbInfo.containers = containers;
      logger.item(`${dbName}: ${containers.length} containers`);
    }

    // Build list of all containers for relationship matching
    const allContainers = [];
    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      for (const containerName of dbInfo.containers) {
        allContainers.push({
          name: containerName,
          database: dbName,
          databaseType: dbInfo.type
        });
      }
    }

    // Sample documents and infer schemas
    const containerSchemas = {};
    const allRelationships = [];

    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      logger.section(`Analysing ${dbName} (${dbInfo.type})...`);

      for (const containerName of dbInfo.containers) {
        try {
          // Sample documents
          const documents = await sampleDocuments(client, dbName, containerName, config.sampleSize);

          if (documents.length === 0) {
            logger.container(containerName, 0, 'empty');
            continue;
          }

          // Infer schema
          const schema = inferSchema(documents);
          const schemaKey = containerName; // Use simple name for cross-db matching
          containerSchemas[schemaKey] = schema;

          // Detect relationships
          const relationships = detectRelationships(
            containerName,
            dbName,
            dbInfo.type,
            schema,
            allContainers
          );
          allRelationships.push(...relationships);

          logger.container(containerName, documents.length, 'ok');
        } catch (error) {
          logger.container(containerName, 0, 'error');
          logger.error(`  Failed to analyse: ${error.message}`, error);
        }
      }
    }

    // Summary statistics
    logger.section('Analysis Summary');
    logger.stat('Containers analysed', Object.keys(containerSchemas).length);
    logger.stat('Relationships detected', allRelationships.filter(r => !r.isOrphan).length);
    logger.stat('Orphan references', allRelationships.filter(r => r.isOrphan).length);
    logger.stat('Cross-database relationships', allRelationships.filter(r => r.isCrossDatabase).length);

    // Generate documentation
    logger.section('Generating documentation...');

    const timestamp = new Date().toISOString();
    await generateDocumentation({
      databases: databasesToAnalyse,
      containerSchemas,
      relationships: allRelationships,
      timestamp
    }, config.outputDir);

    logger.done(config.outputDir);

  } catch (error) {
    logger.error(`Fatal error: ${error.message}`, error);
    process.exit(1);
  }
}

// Run
main();
