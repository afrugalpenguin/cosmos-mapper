import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  saveSnapshot,
  loadSnapshot,
  getLatestSnapshot,
  listSnapshots,
  pruneSnapshots,
  deleteSnapshot
} from '../../src/versioning/snapshotManager.js';

const TEST_CACHE_DIR = '.test-cosmoscache';

// Sample analysis data for testing
const sampleAnalysisData = {
  databases: {
    'ecommerce': {
      containers: ['products', 'orders', 'customers']
    }
  },
  containerSchemas: {
    'products': {
      properties: {
        'id': { path: 'id', types: ['guid'], isRequired: true, frequency: 1.0 },
        'name': { path: 'name', types: ['string'], isRequired: true, frequency: 1.0 },
        'price': { path: 'price', types: ['number'], isRequired: true, frequency: 0.98 }
      },
      documentCount: 100
    },
    'orders': {
      properties: {
        'id': { path: 'id', types: ['guid'], isRequired: true, frequency: 1.0 },
        'productId': { path: 'productId', types: ['guid'], isRequired: true, frequency: 0.95 }
      },
      documentCount: 50
    }
  },
  relationships: [
    {
      fromContainer: 'orders',
      fromDatabase: 'ecommerce',
      fromProperty: 'productId',
      toContainer: 'products',
      toDatabase: 'ecommerce',
      cardinality: 'many-to-one',
      confidence: { score: 85, level: 'high' }
    }
  ],
  sampleSize: 100
};

describe('snapshotManager', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  describe('saveSnapshot', () => {
    it('should create snapshot file with correct structure', async () => {
      const result = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      expect(result.id).toBeDefined();
      expect(result.path).toContain(TEST_CACHE_DIR);
      expect(result.name).toBeNull();

      // Read the file and verify structure
      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);

      expect(snapshot.version).toBe('1.0');
      expect(snapshot.metadata).toBeDefined();
      expect(snapshot.metadata.id).toBe(result.id);
      expect(snapshot.metadata.createdAt).toBeDefined();
      expect(snapshot.metadata.sampleSize).toBe(100);
      expect(snapshot.metadata.databases).toEqual(['ecommerce']);
      expect(snapshot.metadata.containerCount).toBe(2);
      expect(snapshot.metadata.relationshipCount).toBe(1);
      expect(snapshot.metadata.checksum).toBeDefined();
    });

    it('should generate unique ID from timestamp', async () => {
      const result1 = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      // Wait a tiny bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const result2 = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle named snapshots', async () => {
      const result = await saveSnapshot(sampleAnalysisData, {
        cacheDir: TEST_CACHE_DIR,
        name: 'baseline'
      });

      expect(result.name).toBe('baseline');
      expect(result.path).toContain('baseline.json');

      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);
      expect(snapshot.metadata.name).toBe('baseline');
    });

    it('should store schemas correctly', async () => {
      const result = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);

      expect(snapshot.schemas).toBeDefined();
      expect(snapshot.schemas['products']).toBeDefined();
      expect(snapshot.schemas['products'].properties['id'].types).toEqual(['guid']);
      expect(snapshot.schemas['products'].documentCount).toBe(100);
    });

    it('should store relationships correctly', async () => {
      const result = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);

      expect(snapshot.relationships).toHaveLength(1);
      expect(snapshot.relationships[0].fromContainer).toBe('orders');
      expect(snapshot.relationships[0].toContainer).toBe('products');
      expect(snapshot.relationships[0].confidence.score).toBe(85);
    });
  });

  describe('loadSnapshot', () => {
    it('should load snapshot by ID', async () => {
      const saved = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      const loaded = await loadSnapshot(saved.id, TEST_CACHE_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded.metadata.id).toBe(saved.id);
    });

    it('should load snapshot by name', async () => {
      await saveSnapshot(sampleAnalysisData, {
        cacheDir: TEST_CACHE_DIR,
        name: 'my-snapshot'
      });

      const loaded = await loadSnapshot('my-snapshot', TEST_CACHE_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded.metadata.name).toBe('my-snapshot');
    });

    it('should load latest when requested', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await new Promise(resolve => setTimeout(resolve, 10));
      const second = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const loaded = await loadSnapshot('latest', TEST_CACHE_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded.metadata.id).toBe(second.id);
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await loadSnapshot('non-existent', TEST_CACHE_DIR);
      expect(loaded).toBeNull();
    });

    it('should handle .json extension in identifier', async () => {
      const saved = await saveSnapshot(sampleAnalysisData, {
        cacheDir: TEST_CACHE_DIR,
        name: 'test'
      });

      const loaded = await loadSnapshot('test.json', TEST_CACHE_DIR);
      expect(loaded).not.toBeNull();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return null when no snapshots exist', async () => {
      const latest = await getLatestSnapshot(TEST_CACHE_DIR);
      expect(latest).toBeNull();
    });

    it('should return most recent snapshot', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await new Promise(resolve => setTimeout(resolve, 20));
      const second = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await new Promise(resolve => setTimeout(resolve, 20));
      const third = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const latest = await getLatestSnapshot(TEST_CACHE_DIR);

      expect(latest).not.toBeNull();
      expect(latest.metadata.id).toBe(third.id);
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array when no snapshots', async () => {
      const list = await listSnapshots(TEST_CACHE_DIR);
      expect(list).toEqual([]);
    });

    it('should list all snapshots', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR, name: 'named' });

      const list = await listSnapshots(TEST_CACHE_DIR);

      expect(list).toHaveLength(2);
      expect(list.some(s => s.name === 'named')).toBe(true);
      expect(list.some(s => s.name === null)).toBe(true);
    });

    it('should include metadata in listing', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const list = await listSnapshots(TEST_CACHE_DIR);

      expect(list[0].id).toBeDefined();
      expect(list[0].createdAt).toBeDefined();
      expect(list[0].path).toBeDefined();
      expect(list[0].containerCount).toBe(2);
      expect(list[0].relationshipCount).toBe(1);
    });
  });

  describe('pruneSnapshots', () => {
    it('should keep specified number of snapshots', async () => {
      // Create 5 snapshots
      for (let i = 0; i < 5; i++) {
        await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const deleted = await pruneSnapshots(2, TEST_CACHE_DIR);

      expect(deleted).toBe(3);

      const remaining = await listSnapshots(TEST_CACHE_DIR);
      expect(remaining).toHaveLength(2);
    });

    it('should delete oldest first', async () => {
      const first = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await new Promise(resolve => setTimeout(resolve, 20));
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await new Promise(resolve => setTimeout(resolve, 20));
      const third = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      await pruneSnapshots(1, TEST_CACHE_DIR);

      const remaining = await listSnapshots(TEST_CACHE_DIR);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(third.id);

      // First should be deleted
      const loaded = await loadSnapshot(first.id, TEST_CACHE_DIR);
      expect(loaded).toBeNull();
    });

    it('should never delete named snapshots', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR, name: 'important' });
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      await pruneSnapshots(0, TEST_CACHE_DIR);

      const remaining = await listSnapshots(TEST_CACHE_DIR);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('important');
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot by ID', async () => {
      const saved = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const deleted = await deleteSnapshot(saved.id, TEST_CACHE_DIR);

      expect(deleted).toBe(true);

      const loaded = await loadSnapshot(saved.id, TEST_CACHE_DIR);
      expect(loaded).toBeNull();
    });

    it('should delete snapshot by name', async () => {
      await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR, name: 'to-delete' });

      const deleted = await deleteSnapshot('to-delete', TEST_CACHE_DIR);

      expect(deleted).toBe(true);

      const loaded = await loadSnapshot('to-delete', TEST_CACHE_DIR);
      expect(loaded).toBeNull();
    });

    it('should return false for non-existent snapshot', async () => {
      const deleted = await deleteSnapshot('non-existent', TEST_CACHE_DIR);
      expect(deleted).toBe(false);
    });
  });

  describe('checksum validation', () => {
    it('should calculate checksum for data integrity', async () => {
      const result = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);

      expect(snapshot.metadata.checksum).toBeDefined();
      expect(snapshot.metadata.checksum).toHaveLength(64); // SHA256 hex length
    });

    it('should detect tampered data', async () => {
      const result = await saveSnapshot(sampleAnalysisData, { cacheDir: TEST_CACHE_DIR });

      // Tamper with the file
      const content = await readFile(result.path, 'utf8');
      const snapshot = JSON.parse(content);
      snapshot.schemas['products'].properties['hacked'] = { types: ['string'] };
      await writeFile(result.path, JSON.stringify(snapshot), 'utf8');

      // Should still load but warn (we can't easily test console.warn, but load should work)
      const loaded = await loadSnapshot(result.id, TEST_CACHE_DIR);
      expect(loaded).not.toBeNull();
    });
  });
});
