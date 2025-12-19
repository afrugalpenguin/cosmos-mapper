#!/usr/bin/env node

/**
 * CosmosMapper - Azure Cosmos DB Schema Documentation Generator
 *
 * Connects to Cosmos DB, samples documents, infers schemas,
 * detects relationships, and generates ADO wiki-compatible documentation.
 */

import 'dotenv/config';

// Allow self-signed certs for local emulator
if (process.env.COSMOS_ENDPOINT?.includes('localhost')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
import { createCosmosClient, listDatabases, listContainers, sampleDocuments, getContainerInfo } from './cosmos/client.js';
import { inferSchema } from './analysis/schemaInferrer.js';
import { detectRelationships } from './analysis/relationships.js';
import { calculateConfidenceBatch, getConfidenceStats } from './analysis/confidenceCalculator.js';
import { generateDocumentation } from './output/markdownGenerator.js';
import { generateHtmlDocumentation } from './output/htmlGenerator.js';
import { logger } from './utils/logger.js';
import { loadConfig, shouldIncludeContainer } from './config/index.js';

/**
 * Main entry point.
 */
async function main() {
  logger.header();

  // Load configuration
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  try {
    // Connect to Cosmos DB
    logger.info(`Connecting to Cosmos DB...`);
    const authType = config.key ? 'key-based' : 'Azure AD';
    logger.item(`Using ${authType} authentication`);

    const client = createCosmosClient(config.endpoint, config.key);

    // Discover all databases in the account
    const allDatabases = await listDatabases(client);
    logger.success(`Connected. Found ${allDatabases.length} databases.`);

    // Build list of databases to analyse
    const databasesToAnalyse = {};

    // If DATABASES is specified, filter to those; otherwise use all
    const databasesToProcess = config.databases.length > 0
      ? config.databases
      : allDatabases;

    if (config.databases.length > 0) {
      logger.item(`Filtering to specified databases: ${config.databases.join(', ')}`);
    } else {
      logger.item(`Documenting all ${allDatabases.length} databases`);
    }

    for (const dbName of databasesToProcess) {
      if (!allDatabases.includes(dbName)) {
        logger.warn(`Database '${dbName}' not found - skipping.`);
      } else {
        databasesToAnalyse[dbName] = { containers: [] };
      }
    }

    if (Object.keys(databasesToAnalyse).length === 0) {
      logger.error('No valid databases to analyse.');
      process.exit(1);
    }

    // Discover containers in each database
    logger.section('Discovering containers...');

    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      const allDbContainers = await listContainers(client, dbName);
      // Filter containers based on include/exclude patterns
      const containers = allDbContainers.filter(c => shouldIncludeContainer(c, config));
      dbInfo.containers = containers;

      if (containers.length < allDbContainers.length) {
        logger.item(`${dbName}: ${containers.length}/${allDbContainers.length} containers (filtered)`);
      } else {
        logger.item(`${dbName}: ${containers.length} containers`);
      }
    }

    // Build list of all containers for relationship matching
    const allContainers = [];
    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      for (const containerName of dbInfo.containers) {
        allContainers.push({
          name: containerName,
          database: dbName
        });
      }
    }

    // Sample documents and infer schemas
    const containerSchemas = {};
    const allRelationships = [];

    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      logger.section(`Analysing ${dbName}...`);

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

    // Validate relationships and calculate confidence scores
    if (config.validation.enabled && allRelationships.length > 0) {
      logger.section('Validating relationships...');
      await calculateConfidenceBatch(
        allRelationships,
        containerSchemas,
        client,
        config.validation.weights
      );
      const stats = getConfidenceStats(allRelationships);
      logger.item(`Validated ${stats.validated} relationships`);
      logger.item(`Average confidence: ${stats.averageScore}%`);
    } else if (allRelationships.length > 0) {
      // Calculate confidence without data validation (heuristics only)
      await calculateConfidenceBatch(
        allRelationships,
        containerSchemas,
        null,
        config.validation.weights
      );
    }

    // Summary statistics
    logger.section('Analysis Summary');
    logger.stat('Containers analysed', Object.keys(containerSchemas).length);
    logger.stat('Relationships detected', allRelationships.filter(r => !r.isOrphan).length);
    logger.stat('Orphan references', allRelationships.filter(r => r.isOrphan).length);
    logger.stat('Cross-database relationships', allRelationships.filter(r => r.isCrossDatabase).length);

    // Show confidence breakdown if available
    const confStats = getConfidenceStats(allRelationships);
    if (confStats.total > 0) {
      logger.stat('High confidence', confStats.byLevel.high);
      logger.stat('Medium confidence', confStats.byLevel.medium);
      logger.stat('Low confidence', confStats.byLevel.low + confStats.byLevel['very-low']);
    }

    // Generate documentation
    logger.section('Generating documentation...');

    const timestamp = new Date().toISOString();
    const analysisData = {
      databases: databasesToAnalyse,
      containerSchemas,
      relationships: allRelationships,
      timestamp
    };

    // Generate outputs based on configured formats
    if (config.formats.includes('markdown')) {
      await generateDocumentation(analysisData, config.output);
      logger.item('Markdown documentation generated');
    }

    if (config.formats.includes('html')) {
      const htmlPath = await generateHtmlDocumentation(analysisData, config.output);
      logger.item(`HTML report generated: ${htmlPath}`);
    }

    logger.done(config.output);

  } catch (error) {
    logger.error(`Fatal error: ${error.message}`, error);
    process.exit(1);
  }
}

// Run
main();
