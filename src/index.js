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
import { createCosmosClient, listDatabases, listContainers, sampleDocuments, getContainerInfo, getContainerStats } from './cosmos/client.js';
import { inferSchema } from './analysis/schemaInferrer.js';
import { detectRelationships } from './analysis/relationships.js';
import { calculateConfidenceBatch, getConfidenceStats } from './analysis/confidenceCalculator.js';
import { generateDocumentation } from './output/markdownGenerator.js';
import { generateHtmlDocumentation } from './output/htmlGenerator.js';
import { generateJsonSchemas } from './output/jsonSchemaGenerator.js';
import { logger } from './utils/logger.js';
import { loadConfig, shouldIncludeContainer } from './config/index.js';
import { saveSnapshot, loadSnapshot, getLatestSnapshot, pruneSnapshots } from './versioning/snapshotManager.js';
import { compareSnapshots } from './versioning/schemaComparer.js';
import { classifyChanges } from './versioning/changeClassifier.js';
import { formatDiffForConsole, generateDiffMarkdown } from './output/diffReportGenerator.js';

/**
 * Run the analysis and generate documentation.
 * Extracted to support watch mode re-runs.
 */
async function runAnalysis(config) {
  logger.header('1.7');

  try {
    // Connect to Cosmos DB
    logger.info(`Connecting to Cosmos DB...`);
    const authType = config.key ? 'key-based' : 'Azure AD';
    logger.item(`Using ${authType} authentication`);
    logger.debug(`Endpoint: ${config.endpoint}`);

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
      return { exitCode: 1 };
    }

    // Discover containers in each database
    logger.section('Discovering containers...');

    for (const [dbName, dbInfo] of Object.entries(databasesToAnalyse)) {
      const allDbContainers = await listContainers(client, dbName);

      // Apply --container filter if specified
      let containers;
      if (config.container) {
        containers = allDbContainers.filter(c => c === config.container);
        if (containers.length === 0) {
          logger.debug(`Container '${config.container}' not found in ${dbName}`);
        }
      } else {
        // Filter containers based on include/exclude patterns
        containers = allDbContainers.filter(c => shouldIncludeContainer(c, config));
      }

      dbInfo.containers = containers;

      if (containers.length < allDbContainers.length) {
        logger.item(`${dbName}: ${containers.length}/${allDbContainers.length} containers (filtered)`);
      } else {
        logger.item(`${dbName}: ${containers.length} containers`);
      }
      logger.debug(`Containers: ${containers.join(', ')}`);
    }

    // Check if --container was specified but not found anywhere
    if (config.container) {
      const totalContainers = Object.values(databasesToAnalyse)
        .reduce((sum, db) => sum + db.containers.length, 0);
      if (totalContainers === 0) {
        logger.error(`Container '${config.container}' not found in any database.`);
        return { exitCode: 1 };
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
          logger.debug(`Sampling ${containerName}...`);

          // Fetch container metadata and stats in parallel with sampling
          const [documents, containerInfo, containerStats] = await Promise.all([
            sampleDocuments(client, dbName, containerName, config.sampleSize),
            getContainerInfo(client, dbName, containerName),
            getContainerStats(client, dbName, containerName)
          ]);

          if (documents.length === 0) {
            logger.container(containerName, 0, 'empty');
            continue;
          }

          // Infer schema
          const schema = inferSchema(documents);

          // Add container metadata to schema
          schema.containerInfo = {
            database: dbName,
            partitionKey: containerInfo.partitionKey,
            indexingPolicy: containerInfo.indexingPolicy,
            defaultTtl: containerInfo.defaultTtl,
            uniqueKeyPolicy: containerInfo.uniqueKeyPolicy
          };

          // Add stats
          schema.stats = containerStats;

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
          logger.debug(`Found ${Object.keys(schema.properties).length} properties, ${relationships.length} relationships`);
          logger.debug(`Partition key: ${containerInfo.partitionKey.join(', ') || 'none'}`);
          logger.debug(`Document count: ~${containerStats.documentCount}`);
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
      timestamp,
      sampleSize: config.sampleSize
    };

    // Schema versioning: compare with previous snapshot if --diff flag
    let comparison = null;
    if (config.diff || config.diffFrom) {
      logger.section('Comparing with previous snapshot...');

      try {
        const previousSnapshot = config.diffFrom
          ? await loadSnapshot(config.diffFrom, config.versioning.cacheDir)
          : await getLatestSnapshot(config.versioning.cacheDir);

        if (previousSnapshot) {
          const rawComparison = compareSnapshots(previousSnapshot, analysisData);
          comparison = classifyChanges(rawComparison);
          analysisData.comparison = comparison;

          // Output comparison summary
          console.log(formatDiffForConsole(comparison));

          if (comparison.summary.totalChanges > 0) {
            logger.stat('Total changes', comparison.summary.totalChanges);
            logger.stat('Breaking changes', comparison.summary.breakingChanges);

            // Generate markdown diff report
            await generateDiffMarkdown(comparison, {
              baselineId: previousSnapshot.metadata?.id || 'unknown',
              currentTimestamp: timestamp
            }, config.output);
            logger.item('Change report generated: schema-changes.md');
          }
        } else {
          logger.warn('No previous snapshot found for comparison.');
          logger.item('Run with --snapshot to create a baseline snapshot first.');
        }
      } catch (error) {
        logger.warn(`Could not compare snapshots: ${error.message}`);
      }
    }

    // Save snapshot if --snapshot flag provided
    if (config.snapshot) {
      logger.section('Saving snapshot...');

      try {
        const snapshotResult = await saveSnapshot(analysisData, {
          name: config.snapshotName,
          cacheDir: config.versioning.cacheDir
        });

        const name = snapshotResult.name || snapshotResult.id;
        logger.item(`Snapshot saved: ${name}`);

        // Prune old snapshots based on retention policy
        const deleted = await pruneSnapshots(config.versioning.retention, config.versioning.cacheDir);
        if (deleted > 0) {
          logger.item(`Pruned ${deleted} old snapshot(s)`);
        }
      } catch (error) {
        logger.warn(`Could not save snapshot: ${error.message}`);
      }
    }

    // Generate outputs based on configured formats
    if (config.formats.includes('markdown')) {
      await generateDocumentation(analysisData, config.output);
      logger.item('Markdown documentation generated');
    }

    if (config.formats.includes('html')) {
      const htmlPath = await generateHtmlDocumentation(analysisData, config.output, config.branding);
      logger.item(`HTML report generated: ${htmlPath}`);
    }

    if (config.formats.includes('jsonschema')) {
      const schemaFiles = await generateJsonSchemas(analysisData, config.output, config.jsonSchema);
      logger.item(`JSON Schema files generated: ${schemaFiles.length} schemas`);
    }

    logger.done(config.output);

    // Return exit code based on breaking changes
    if (config.versioning.failOnBreaking && comparison?.summary?.breakingChanges > 0) {
      logger.error(`Exiting with error: ${comparison.summary.breakingChanges} breaking change(s) detected.`);
      return { exitCode: 1 };
    }

    return { exitCode: 0 };

  } catch (error) {
    logger.error(`Fatal error: ${error.message}`, error);
    return { exitCode: 1 };
  }
}

/**
 * Main entry point.
 */
async function main() {
  // Load configuration
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  // Set log level based on config
  logger.setLevel(config.logLevel);
  logger.debug(`Log level: ${config.logLevel}`);
  logger.debug(`Watch mode: ${config.watch}`);
  logger.debug(`Container filter: ${config.container || 'none'}`);

  // Watch mode
  if (config.watch) {
    logger.watch('Starting watch mode - press Ctrl+C to stop');
    logger.watch('Watching for changes in Cosmos DB...');

    // Initial run
    await runAnalysis(config);

    // Set up interval for periodic re-runs
    const intervalMs = 30000; // 30 seconds
    logger.watch(`Will re-check every ${intervalMs / 1000} seconds`);

    const interval = setInterval(async () => {
      logger.watch('Re-running analysis...');
      await runAnalysis(config);
    }, intervalMs);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      logger.watch('Stopping watch mode...');
      clearInterval(interval);
      process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();
  } else {
    // Single run mode
    const result = await runAnalysis(config);
    process.exit(result.exitCode);
  }
}

// Run
main();
