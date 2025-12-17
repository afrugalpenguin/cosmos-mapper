import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDocumentation } from '../../src/output/markdownGenerator.js';
import { writeFile, mkdir } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

describe('markdownGenerator', () => {
  let writtenFiles = {};

  beforeEach(() => {
    writtenFiles = {};
    vi.clearAllMocks();

    // Capture written files for inspection
    writeFile.mockImplementation((path, content) => {
      writtenFiles[path] = content;
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDocumentation', () => {
    const baseData = {
      databases: {
        testdb: { containers: ['users', 'orders'] }
      },
      containerSchemas: {
        users: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: ['abc-123'] },
            name: { path: 'name', name: 'name', parentPath: null, types: ['string'], isRequired: true, examples: ['John'] }
          }
        },
        orders: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: ['ord-456'] },
            UserId: { path: 'UserId', name: 'UserId', parentPath: null, types: ['guid'], isRequired: true, examples: ['abc-123'] }
          }
        }
      },
      relationships: [
        {
          fromContainer: 'orders',
          fromDatabase: 'testdb',
          fromProperty: 'UserId',
          toContainer: 'users',
          toDatabase: 'testdb',
          cardinality: 'many-to-one',
          isCrossDatabase: false,
          isOrphan: false
        }
      ],
      timestamp: '2024-01-15T10:00:00Z'
    };

    it('should create output directory', async () => {
      await generateDocumentation(baseData, '/output');

      expect(mkdir).toHaveBeenCalledWith('/output', { recursive: true });
    });

    it('should create database subdirectories', async () => {
      await generateDocumentation(baseData, '/output');

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('testdb'), { recursive: true });
    });

    it('should generate index.md', async () => {
      await generateDocumentation(baseData, '/output');

      const indexPath = Object.keys(writtenFiles).find(p => p.endsWith('index.md'));
      expect(indexPath).toBeDefined();
      expect(writtenFiles[indexPath]).toContain('# Cosmos DB Schema Documentation');
    });

    it('should include timestamp in generated files', async () => {
      await generateDocumentation(baseData, '/output');

      const indexPath = Object.keys(writtenFiles).find(p => p.endsWith('index.md'));
      expect(writtenFiles[indexPath]).toContain('2024-01-15T10:00:00Z');
    });

    it('should include ERD diagram in index', async () => {
      await generateDocumentation(baseData, '/output');

      const indexPath = Object.keys(writtenFiles).find(p => p.endsWith('index.md'));
      expect(writtenFiles[indexPath]).toContain('```mermaid');
      expect(writtenFiles[indexPath]).toContain('erDiagram');
    });

    it('should generate database overview page', async () => {
      await generateDocumentation(baseData, '/output');

      const overviewPath = Object.keys(writtenFiles).find(p => p.includes('_overview.md'));
      expect(overviewPath).toBeDefined();
      expect(writtenFiles[overviewPath]).toContain('# testdb Database');
    });

    it('should generate container pages', async () => {
      await generateDocumentation(baseData, '/output');

      const usersPath = Object.keys(writtenFiles).find(p => p.includes('users.md'));
      const ordersPath = Object.keys(writtenFiles).find(p => p.includes('orders.md'));

      expect(usersPath).toBeDefined();
      expect(ordersPath).toBeDefined();
    });

    it('should include property table in container pages', async () => {
      await generateDocumentation(baseData, '/output');

      const usersPath = Object.keys(writtenFiles).find(p => p.includes('users.md'));
      const content = writtenFiles[usersPath];

      expect(content).toContain('| Property | Type | Required | Example |');
      expect(content).toContain('| id |');
      expect(content).toContain('| name |');
    });

    it('should show relationship information in container pages', async () => {
      await generateDocumentation(baseData, '/output');

      const ordersPath = Object.keys(writtenFiles).find(p => p.includes('orders.md'));
      const content = writtenFiles[ordersPath];

      expect(content).toContain('## Relationships');
      expect(content).toContain('Outgoing References');
      expect(content).toContain('UserId');
      expect(content).toContain('users');
    });

    it('should show incoming relationships', async () => {
      await generateDocumentation(baseData, '/output');

      const usersPath = Object.keys(writtenFiles).find(p => p.includes('users.md'));
      const content = writtenFiles[usersPath];

      expect(content).toContain('Incoming References');
      expect(content).toContain('orders');
    });

    it('should sanitise paths correctly', async () => {
      const dataWithSpecialNames = {
        ...baseData,
        databases: {
          'My Database!': { containers: ['User Items'] }
        },
        containerSchemas: {
          'User Items': {
            properties: {
              id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] }
            }
          }
        },
        relationships: []
      };

      await generateDocumentation(dataWithSpecialNames, '/output');

      // Check that sanitised paths were used (lowercase, special chars replaced)
      expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/my-database/), { recursive: true });
    });
  });

  describe('cross-database relationships', () => {
    it('should generate cross-database page when cross-db relationships exist', async () => {
      const data = {
        databases: {
          db1: { containers: ['users'] },
          db2: { containers: ['logs'] }
        },
        containerSchemas: {
          users: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } },
          logs: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } }
        },
        relationships: [{
          fromContainer: 'logs',
          fromDatabase: 'db2',
          fromProperty: 'UserId',
          toContainer: 'users',
          toDatabase: 'db1',
          cardinality: 'many-to-one',
          isCrossDatabase: true,
          isOrphan: false
        }],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const crossDbPath = Object.keys(writtenFiles).find(p => p.includes('_cross-database.md'));
      expect(crossDbPath).toBeDefined();
      expect(writtenFiles[crossDbPath]).toContain('# Cross-Database Relationships');
    });

    it('should NOT generate cross-database page when no cross-db relationships', async () => {
      const data = {
        databases: { db1: { containers: ['users'] } },
        containerSchemas: {
          users: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const crossDbPath = Object.keys(writtenFiles).find(p => p.includes('_cross-database.md'));
      expect(crossDbPath).toBeUndefined();
    });

    it('should show ambiguous relationships with multiple databases note', async () => {
      const data = {
        databases: {
          platform: { containers: ['inventory'] },
          'store-a': { containers: ['products'] },
          'store-b': { containers: ['products'] }
        },
        containerSchemas: {
          inventory: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } },
          products: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } }
        },
        relationships: [{
          fromContainer: 'inventory',
          fromDatabase: 'platform',
          fromProperty: 'ProductId',
          toContainer: 'products',
          toDatabase: 'store-a',
          cardinality: 'many-to-one',
          isCrossDatabase: true,
          isAmbiguous: true,
          possibleDatabases: ['store-a', 'store-b'],
          isOrphan: false
        }],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const inventoryPath = Object.keys(writtenFiles).find(p => p.includes('inventory.md'));
      expect(writtenFiles[inventoryPath]).toContain('multiple databases');
    });
  });

  describe('nested objects', () => {
    it('should generate nested object tables', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] },
              address: { path: 'address', name: 'address', parentPath: null, types: ['object'], isRequired: true, examples: [] },
              'address.street': { path: 'address.street', name: 'street', parentPath: 'address', types: ['string'], isRequired: true, examples: ['123 Main St'] },
              'address.city': { path: 'address.city', name: 'city', parentPath: 'address', types: ['string'], isRequired: true, examples: ['Boston'] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      expect(content).toContain('## Nested Objects');
      expect(content).toContain('address');
      expect(content).toContain('street');
      expect(content).toContain('city');
    });
  });

  describe('type formatting', () => {
    it('should display type names correctly', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: ['abc-123'] },
              created: { path: 'created', name: 'created', parentPath: null, types: ['datetime'], isRequired: true, examples: ['2024-01-15'] },
              ref: { path: 'ref', name: 'ref', parentPath: null, types: ['ReferenceObject'], isRequired: false, examples: [] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      expect(content).toContain('GUID');
      expect(content).toContain('DateTime');
      expect(content).toContain('Reference');
    });

    it('should show multiple types separated by pipe', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              value: { path: 'value', name: 'value', parentPath: null, types: ['string', 'integer'], isRequired: true, examples: [] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      expect(content).toMatch(/String.*\\.*\|.*Integer|Integer.*\\.*\|.*String/);
    });
  });

  describe('example formatting', () => {
    it('should escape pipe characters in examples', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              value: { path: 'value', name: 'value', parentPath: null, types: ['string'], isRequired: true, examples: ['a|b|c'] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      // Pipes should be escaped
      expect(content).toContain('\\|');
    });

    it('should wrap examples in backticks', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              name: { path: 'name', name: 'name', parentPath: null, types: ['string'], isRequired: true, examples: ['Test Value'] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      expect(content).toContain('`Test Value`');
    });

    it('should show dash for missing examples', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: {
            properties: {
              name: { path: 'name', name: 'name', parentPath: null, types: ['string'], isRequired: true, examples: [] }
            }
          }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      // Should have a row with dash for example
      expect(content).toMatch(/\| name \|.*\|.*\| - \|/);
    });
  });

  describe('navigation links', () => {
    it('should include back links in container pages', async () => {
      const data = {
        databases: { db: { containers: ['items'] } },
        containerSchemas: {
          items: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } }
        },
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      expect(content).toContain('[← Back to Database Overview](./_overview.md)');
      expect(content).toContain('[← Back to Index](../index.md)');
    });

    it('should include back link in database overview', async () => {
      const data = {
        databases: { db: { containers: [] } },
        containerSchemas: {},
        relationships: [],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const overviewPath = Object.keys(writtenFiles).find(p => p.includes('_overview.md'));
      expect(writtenFiles[overviewPath]).toContain('[← Back to Index](../index.md)');
    });
  });

  describe('cross-database links', () => {
    it('should generate correct relative paths for cross-database references', async () => {
      const data = {
        databases: {
          db1: { containers: ['items'] },
          db2: { containers: ['categories'] }
        },
        containerSchemas: {
          items: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } },
          categories: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true, examples: [] } } }
        },
        relationships: [{
          fromContainer: 'items',
          fromDatabase: 'db1',
          fromProperty: 'CategoryId',
          toContainer: 'categories',
          toDatabase: 'db2',
          cardinality: 'many-to-one',
          isCrossDatabase: true,
          isOrphan: false
        }],
        timestamp: '2024-01-15'
      };

      await generateDocumentation(data, '/output');

      const itemsPath = Object.keys(writtenFiles).find(p => p.includes('items.md'));
      const content = writtenFiles[itemsPath];

      // Should have relative path going up one level then into db2
      expect(content).toContain('../db2/categories.md');
    });
  });
});
