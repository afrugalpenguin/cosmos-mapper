/**
 * Manages schema snapshot persistence and retrieval.
 * Snapshots capture the complete analysis state for comparison over time.
 */

import { mkdir, readdir, readFile, writeFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

const SNAPSHOT_VERSION = '1.0';
const SNAPSHOTS_DIR = 'snapshots';

/**
 * Generate a unique snapshot ID from timestamp.
 * @returns {string} ISO timestamp formatted as ID (safe for filenames)
 */
function generateSnapshotId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Calculate SHA256 checksum for data integrity.
 * @param {object} data - Data to hash
 * @returns {string} SHA256 hash
 */
function calculateChecksum(data) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Ensure the snapshots directory exists.
 * @param {string} cacheDir - Base cache directory
 * @returns {Promise<string>} Path to snapshots directory
 */
async function ensureSnapshotsDir(cacheDir) {
  const snapshotsPath = join(cacheDir, SNAPSHOTS_DIR);
  await mkdir(snapshotsPath, { recursive: true });
  return snapshotsPath;
}

/**
 * Build snapshot object from analysis data.
 * @param {object} analysisData - The complete analysis result
 * @param {object} options - Snapshot options
 * @returns {object} Formatted snapshot
 */
function buildSnapshot(analysisData, options = {}) {
  const id = generateSnapshotId();

  // Extract database info
  const databases = {};
  const schemas = {};

  for (const [dbName, dbInfo] of Object.entries(analysisData.databases || {})) {
    databases[dbName] = {
      containers: dbInfo.containers || []
    };
  }

  // Extract container schemas
  for (const [containerKey, schema] of Object.entries(analysisData.containerSchemas || {})) {
    schemas[containerKey] = {
      properties: schema.properties || {},
      documentCount: schema.documentCount || 0
    };
  }

  const snapshotData = {
    schemas,
    relationships: analysisData.relationships || []
  };

  return {
    version: SNAPSHOT_VERSION,
    metadata: {
      id,
      name: options.name || null,
      createdAt: new Date().toISOString(),
      sampleSize: analysisData.sampleSize || 100,
      databases: Object.keys(databases),
      containerCount: Object.keys(schemas).length,
      relationshipCount: (analysisData.relationships || []).length,
      checksum: calculateChecksum(snapshotData)
    },
    databases,
    schemas,
    relationships: analysisData.relationships || []
  };
}

/**
 * Save current analysis as a snapshot.
 * @param {object} analysisData - The complete analysis result
 * @param {object} options - Save options
 * @param {string} [options.name] - Optional named snapshot
 * @param {string} [options.cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<{id: string, path: string, name: string|null}>}
 */
export async function saveSnapshot(analysisData, options = {}) {
  const cacheDir = options.cacheDir || '.cosmoscache';
  const snapshotsPath = await ensureSnapshotsDir(cacheDir);

  const snapshot = buildSnapshot(analysisData, options);
  const filename = options.name
    ? `${options.name}.json`
    : `${snapshot.metadata.id}.json`;
  const filePath = join(snapshotsPath, filename);

  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

  return {
    id: snapshot.metadata.id,
    path: filePath,
    name: options.name || null
  };
}

/**
 * Load a snapshot by ID, name, or 'latest'.
 * @param {string} identifier - Snapshot ID, name, or 'latest'
 * @param {string} [cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<object|null>} Loaded snapshot or null if not found
 */
export async function loadSnapshot(identifier, cacheDir = '.cosmoscache') {
  const snapshotsPath = join(cacheDir, SNAPSHOTS_DIR);

  // Handle 'latest' identifier
  if (identifier === 'latest') {
    return getLatestSnapshot(cacheDir);
  }

  // Try exact filename match (with or without .json)
  const possibleNames = [
    `${identifier}.json`,
    identifier.endsWith('.json') ? identifier : null
  ].filter(Boolean);

  for (const filename of possibleNames) {
    try {
      const filePath = join(snapshotsPath, filename);
      const content = await readFile(filePath, 'utf8');
      const snapshot = JSON.parse(content);

      // Validate checksum
      if (snapshot.metadata?.checksum) {
        const dataToVerify = {
          schemas: snapshot.schemas,
          relationships: snapshot.relationships
        };
        const calculatedChecksum = calculateChecksum(dataToVerify);
        if (calculatedChecksum !== snapshot.metadata.checksum) {
          console.warn(`Warning: Checksum mismatch for snapshot ${identifier}`);
        }
      }

      return snapshot;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return null;
}

/**
 * Get the most recent snapshot.
 * @param {string} [cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<object|null>} Latest snapshot or null if none exist
 */
export async function getLatestSnapshot(cacheDir = '.cosmoscache') {
  const snapshots = await listSnapshots(cacheDir);

  if (snapshots.length === 0) {
    return null;
  }

  // Sort by createdAt descending and get the first
  const sorted = snapshots.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return loadSnapshot(sorted[0].id, cacheDir);
}

/**
 * List all available snapshots.
 * @param {string} [cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<Array<{id: string, name: string|null, createdAt: string, path: string}>>}
 */
export async function listSnapshots(cacheDir = '.cosmoscache') {
  const snapshotsPath = join(cacheDir, SNAPSHOTS_DIR);

  try {
    const files = await readdir(snapshotsPath);
    const snapshots = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = join(snapshotsPath, file);
        const content = await readFile(filePath, 'utf8');
        const snapshot = JSON.parse(content);

        snapshots.push({
          id: snapshot.metadata?.id || file.replace('.json', ''),
          name: snapshot.metadata?.name || null,
          createdAt: snapshot.metadata?.createdAt || null,
          path: filePath,
          containerCount: snapshot.metadata?.containerCount || 0,
          relationshipCount: snapshot.metadata?.relationshipCount || 0
        });
      } catch (err) {
        // Skip invalid files
        console.warn(`Warning: Could not parse snapshot file ${file}`);
      }
    }

    return snapshots;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Delete snapshots beyond retention limit.
 * Named snapshots are never automatically deleted.
 * @param {number} keepCount - Number of unnamed snapshots to keep
 * @param {string} [cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<number>} Number of deleted snapshots
 */
export async function pruneSnapshots(keepCount, cacheDir = '.cosmoscache') {
  const snapshots = await listSnapshots(cacheDir);

  // Separate named and unnamed snapshots
  const namedSnapshots = snapshots.filter(s => s.name !== null);
  const unnamedSnapshots = snapshots.filter(s => s.name === null);

  // Sort unnamed by date descending
  unnamedSnapshots.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Keep the most recent 'keepCount' unnamed snapshots
  const toDelete = unnamedSnapshots.slice(keepCount);

  let deletedCount = 0;
  for (const snapshot of toDelete) {
    try {
      await unlink(snapshot.path);
      deletedCount++;
    } catch (err) {
      console.warn(`Warning: Could not delete snapshot ${snapshot.path}`);
    }
  }

  return deletedCount;
}

/**
 * Delete a specific snapshot by ID or name.
 * @param {string} identifier - Snapshot ID or name
 * @param {string} [cacheDir='.cosmoscache'] - Cache directory path
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteSnapshot(identifier, cacheDir = '.cosmoscache') {
  const snapshotsPath = join(cacheDir, SNAPSHOTS_DIR);

  const possibleNames = [
    `${identifier}.json`,
    identifier.endsWith('.json') ? identifier : null
  ].filter(Boolean);

  for (const filename of possibleNames) {
    try {
      const filePath = join(snapshotsPath, filename);
      await unlink(filePath);
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return false;
}
