/**
 * Configuration loader for CosmosMapper
 *
 * Loads configuration from:
 * 1. cosmosmapper.config.json (if present)
 * 2. Environment variables (take precedence for secrets)
 * 3. CLI arguments (highest precedence)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const DEFAULT_CONFIG = {
  output: './output',
  sampleSize: 100,
  databases: [],      // Empty = all databases
  container: null,    // Single container to document (--container flag)
  containers: {
    include: [],      // Empty = all containers
    exclude: []       // Patterns to exclude (e.g., '*-archive')
  },
  formats: ['markdown', 'html'],
  logLevel: 'normal', // 'quiet', 'normal', or 'verbose'
  watch: false,       // Watch mode for continuous regeneration
  typeDetection: {
    customPatterns: [],  // User-defined type patterns: { name, pattern, displayName }
    enumDetection: {
      enabled: true,      // Detect enum-like fields
      maxUniqueValues: 10, // Max distinct values to be considered enum
      minFrequency: 0.8   // Min occurrence rate
    }
  },
  validation: {
    enabled: false,   // Set true to query data for confidence scoring
    sampleSize: 1000, // FK values to sample for integrity check
    weights: {
      referentialIntegrity: 0.45,
      typeConsistency: 0.20,
      frequency: 0.15,
      namingPattern: 0.20
    }
  },
  versioning: {
    cacheDir: '.cosmoscache',  // Where to store snapshots
    retention: 10,              // Number of unnamed snapshots to keep
    failOnBreaking: false       // Exit code 1 if breaking changes detected
  }
};

/**
 * Load configuration from file if it exists
 */
async function loadConfigFile(configPath) {
  const fullPath = resolve(configPath);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const content = await readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to parse config file ${configPath}: ${error.message}`);
  }
}

/**
 * Parse CLI arguments for config overrides
 */
function parseCliArgs(args = process.argv.slice(2)) {
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--config' && args[i + 1]) {
      parsed.configPath = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      parsed.output = args[++i];
    } else if (arg === '--sample-size' && args[i + 1]) {
      parsed.sampleSize = parseInt(args[++i], 10);
    } else if (arg === '--databases' && args[i + 1]) {
      parsed.databases = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--format' && args[i + 1]) {
      parsed.formats = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--validate') {
      parsed.validation = { enabled: true };
    } else if (arg === '--no-validate') {
      parsed.validation = { enabled: false };
    }
    // Versioning options
    else if (arg === '--snapshot') {
      // Check if next arg is a name (not another flag)
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        parsed.snapshotName = args[++i];
      }
      parsed.snapshot = true;
    } else if (arg === '--diff') {
      parsed.diff = true;
    } else if (arg === '--diff-from' && args[i + 1]) {
      parsed.diffFrom = args[++i];
      parsed.diff = true;  // Implies diff mode
    } else if (arg === '--fail-on-breaking') {
      parsed.versioning = { ...parsed.versioning, failOnBreaking: true };
    }
    // Output control options
    else if (arg === '--quiet' || arg === '-q') {
      parsed.logLevel = 'quiet';
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.logLevel = 'verbose';
    }
    // Watch mode
    else if (arg === '--watch' || arg === '-w') {
      parsed.watch = true;
    }
    // Single container
    else if (arg === '--container' && args[i + 1]) {
      parsed.container = args[++i];
    }
  }

  return parsed;
}

/**
 * Parse environment variables
 */
function parseEnvVars() {
  const env = {};

  if (process.env.COSMOS_ENDPOINT) {
    env.endpoint = process.env.COSMOS_ENDPOINT;
  }

  if (process.env.COSMOS_KEY) {
    env.key = process.env.COSMOS_KEY;
  }

  if (process.env.DATABASES) {
    env.databases = process.env.DATABASES.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (process.env.SAMPLE_SIZE) {
    env.sampleSize = parseInt(process.env.SAMPLE_SIZE, 10);
  }

  if (process.env.OUTPUT_DIR) {
    env.output = process.env.OUTPUT_DIR;
  }

  if (process.env.VALIDATE_RELATIONSHIPS) {
    const val = process.env.VALIDATE_RELATIONSHIPS.toLowerCase();
    env.validation = { enabled: val === 'true' || val === '1' };
  }

  return env;
}

/**
 * Check if a container matches any of the given patterns
 */
export function matchesPattern(containerName, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some(pattern => {
    // Simple glob matching: * matches any characters
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(containerName);
  });
}

/**
 * Check if a container should be included based on config
 */
export function shouldIncludeContainer(containerName, config) {
  // If exclude patterns match, skip it
  if (matchesPattern(containerName, config.containers?.exclude)) {
    return false;
  }

  // If include patterns are specified, container must match
  if (config.containers?.include?.length > 0) {
    return matchesPattern(containerName, config.containers.include);
  }

  // No include patterns = include all (that aren't excluded)
  return true;
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];

  if (!config.endpoint) {
    errors.push('endpoint is required (set COSMOS_ENDPOINT environment variable)');
  }

  if (config.sampleSize && (isNaN(config.sampleSize) || config.sampleSize < 1)) {
    errors.push('sampleSize must be a positive number');
  }

  if (config.formats && !Array.isArray(config.formats)) {
    errors.push('formats must be an array');
  }

  const validFormats = ['markdown', 'html'];
  if (config.formats) {
    const invalidFormats = config.formats.filter(f => !validFormats.includes(f));
    if (invalidFormats.length > 0) {
      errors.push(`invalid formats: ${invalidFormats.join(', ')}. Valid: ${validFormats.join(', ')}`);
    }
  }

  return errors;
}

/**
 * Load and merge configuration from all sources
 *
 * Priority (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables (for secrets)
 * 3. Config file
 * 4. Defaults
 */
export async function loadConfig(cliArgs = process.argv.slice(2)) {
  // Parse CLI args first to get potential config path
  const cli = parseCliArgs(cliArgs);
  const configPath = cli.configPath || 'cosmosmapper.config.json';

  // Load config file
  const fileConfig = await loadConfigFile(configPath);

  // Parse environment variables
  const envConfig = parseEnvVars();

  // Merge: defaults <- file <- env <- cli
  const config = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    ...cli
  };

  // Ensure nested objects are properly merged
  config.containers = {
    ...DEFAULT_CONFIG.containers,
    ...fileConfig?.containers,
    ...cli.containers
  };

  config.validation = {
    ...DEFAULT_CONFIG.validation,
    ...fileConfig?.validation,
    ...envConfig?.validation,
    ...cli.validation,
    weights: {
      ...DEFAULT_CONFIG.validation.weights,
      ...fileConfig?.validation?.weights
    }
  };

  config.versioning = {
    ...DEFAULT_CONFIG.versioning,
    ...fileConfig?.versioning,
    ...cli.versioning
  };

  config.typeDetection = {
    ...DEFAULT_CONFIG.typeDetection,
    ...fileConfig?.typeDetection,
    customPatterns: fileConfig?.typeDetection?.customPatterns || DEFAULT_CONFIG.typeDetection.customPatterns,
    enumDetection: {
      ...DEFAULT_CONFIG.typeDetection.enumDetection,
      ...fileConfig?.typeDetection?.enumDetection
    }
  };

  // Copy versioning flags from CLI
  if (cli.snapshot !== undefined) config.snapshot = cli.snapshot;
  if (cli.snapshotName !== undefined) config.snapshotName = cli.snapshotName;
  if (cli.diff !== undefined) config.diff = cli.diff;
  if (cli.diffFrom !== undefined) config.diffFrom = cli.diffFrom;

  // Clean up internal properties
  delete config.configPath;

  // Validate
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n  - ${errors.join('\n  - ')}`);
  }

  return config;
}

/**
 * Get default config for documentation/examples
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}
