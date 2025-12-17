import { describe, it, expect } from 'vitest';
import {
  generateERD,
  generateSimpleERD,
  generateDatabaseERDs
} from '../../src/output/mermaidGenerator.js';

describe('mermaidGenerator', () => {
  describe('generateERD', () => {
    it('should generate valid erDiagram header', () => {
      const schemas = {};
      const relationships = [];

      const erd = generateERD(schemas, relationships);

      expect(erd).toContain('erDiagram');
    });

    it('should include title as comment when provided', () => {
      const schemas = {};
      const relationships = [];

      const erd = generateERD(schemas, relationships, { title: 'Test ERD' });

      expect(erd).toContain('%% Test ERD');
      expect(erd.indexOf('%% Test ERD')).toBeLessThan(erd.indexOf('erDiagram'));
    });

    it('should generate entity with properties', () => {
      const schemas = {
        users: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true },
            name: { path: 'name', name: 'name', parentPath: null, types: ['string'], isRequired: true }
          }
        }
      };
      const relationships = [];

      const erd = generateERD(schemas, relationships);

      expect(erd).toContain('users {');
      expect(erd).toContain('guid id ID');
      expect(erd).toContain('string name');
    });

    it('should mark ID for id property', () => {
      const schemas = {
        items: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true }
          }
        }
      };

      const erd = generateERD(schemas, [], { showKeys: true });

      expect(erd).toContain('guid id ID');
    });

    it('should mark REF for relationship properties', () => {
      const schemas = {
        orders: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true },
            StoreId: { path: 'StoreId', name: 'StoreId', parentPath: null, types: ['guid'], isRequired: true }
          }
        }
      };
      const relationships = [{
        fromContainer: 'orders',
        fromDatabase: 'db',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        toDatabase: 'db',
        isOrphan: false
      }];

      const erd = generateERD(schemas, relationships, { showKeys: true });

      expect(erd).toContain('guid StoreId REF');
    });

    it('should mark optional properties with comment', () => {
      const schemas = {
        items: {
          properties: {
            name: { path: 'name', name: 'name', parentPath: null, types: ['string'], isRequired: false }
          }
        }
      };

      const erd = generateERD(schemas, []);

      expect(erd).toContain('"optional"');
    });

    it('should NOT mark id as optional even if isRequired is false', () => {
      const schemas = {
        items: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: false }
          }
        }
      };

      const erd = generateERD(schemas, []);

      // id should not have "optional" comment
      expect(erd).not.toMatch(/id.*"optional"/);
    });

    it('should limit properties to maxPropertiesPerEntity', () => {
      const properties = {};
      for (let i = 0; i < 20; i++) {
        properties[`prop${i}`] = {
          path: `prop${i}`,
          name: `prop${i}`,
          parentPath: null,
          types: ['string'],
          isRequired: true
        };
      }
      const schemas = { items: { properties } };

      const erd = generateERD(schemas, [], { maxPropertiesPerEntity: 5 });

      expect(erd).toContain('_more_');
      expect(erd).toContain('15 more...');
    });

    it('should generate relationship lines', () => {
      const schemas = {
        orders: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true }
          }
        },
        stores: {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true }
          }
        }
      };
      const relationships = [{
        fromContainer: 'orders',
        fromDatabase: 'db',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        toDatabase: 'db',
        cardinality: 'many-to-one',
        isOrphan: false
      }];

      const erd = generateERD(schemas, relationships);

      expect(erd).toContain('orders }o--|| stores');
    });

    it('should use correct cardinality for one-to-many', () => {
      const schemas = {
        stores: { properties: {} },
        orders: { properties: {} }
      };
      const relationships = [{
        fromContainer: 'stores',
        fromDatabase: 'db',
        fromProperty: 'id',
        toContainer: 'orders',
        toDatabase: 'db',
        cardinality: 'one-to-many',
        isOrphan: false
      }];

      const erd = generateERD(schemas, relationships);

      expect(erd).toContain('||--o{');
    });

    it('should exclude orphan relationships', () => {
      const schemas = { orders: { properties: {} } };
      const relationships = [{
        fromContainer: 'orders',
        fromDatabase: 'db',
        fromProperty: 'UnknownId',
        toContainer: 'unknown',
        toDatabase: null,
        isOrphan: true
      }];

      const erd = generateERD(schemas, relationships);

      expect(erd).not.toContain('unknown');
    });

    it('should sanitise entity names with special characters', () => {
      const schemas = {
        'my-container': {
          properties: {
            id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true }
          }
        }
      };

      const erd = generateERD(schemas, []);

      expect(erd).toContain('my_container {');
      expect(erd).not.toContain('my-container');
    });

    it('should map type names correctly', () => {
      const schemas = {
        items: {
          properties: {
            ref: { path: 'ref', name: 'ref', parentPath: null, types: ['ReferenceObject'], isRequired: true },
            num: { path: 'num', name: 'num', parentPath: null, types: ['integer'], isRequired: true },
            flag: { path: 'flag', name: 'flag', parentPath: null, types: ['boolean'], isRequired: true }
          }
        }
      };

      const erd = generateERD(schemas, []);

      expect(erd).toContain('reference ref');
      expect(erd).toContain('int num');
      expect(erd).toContain('bool flag');
    });

    it('should handle empty schemas gracefully', () => {
      const schemas = {
        empty: { properties: {} }
      };

      const erd = generateERD(schemas, []);

      expect(erd).toContain('erDiagram');
      expect(erd).toContain('empty {');
    });
  });

  describe('generateSimpleERD', () => {
    it('should list all containers as entities', () => {
      const containerNames = ['users', 'orders', 'products'];

      const erd = generateSimpleERD(containerNames, []);

      expect(erd).toContain('users');
      expect(erd).toContain('orders');
      expect(erd).toContain('products');
    });

    it('should include relationships', () => {
      const containerNames = ['orders', 'users'];
      const relationships = [{
        fromContainer: 'orders',
        fromProperty: 'UserId',
        toContainer: 'users',
        cardinality: 'many-to-one',
        isOrphan: false
      }];

      const erd = generateSimpleERD(containerNames, relationships);

      expect(erd).toContain('orders }o--|| users');
    });

    it('should sanitise container names', () => {
      const containerNames = ['my-special-container'];

      const erd = generateSimpleERD(containerNames, []);

      expect(erd).toContain('my_special_container');
    });

    it('should handle empty inputs', () => {
      const erd = generateSimpleERD([], []);

      expect(erd).toBe('erDiagram\n');
    });
  });

  describe('generateDatabaseERDs', () => {
    it('should generate separate ERDs per database', () => {
      const containerSchemas = {
        users: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true } } },
        logs: { properties: { id: { path: 'id', name: 'id', parentPath: null, types: ['guid'], isRequired: true } } }
      };
      const relationships = [];
      const databaseContainers = {
        maindb: ['users'],
        auditdb: ['logs']
      };

      const erds = generateDatabaseERDs(containerSchemas, relationships, databaseContainers);

      expect(Object.keys(erds)).toContain('maindb');
      expect(Object.keys(erds)).toContain('auditdb');
      expect(erds.maindb).toContain('users');
      expect(erds.maindb).not.toContain('logs');
      expect(erds.auditdb).toContain('logs');
      expect(erds.auditdb).not.toContain('users');
    });

    it('should include database name in title', () => {
      const containerSchemas = {
        users: { properties: {} }
      };
      const databaseContainers = {
        mydb: ['users']
      };

      const erds = generateDatabaseERDs(containerSchemas, [], databaseContainers);

      expect(erds.mydb).toContain('%% mydb Database ERD');
    });

    it('should filter relationships to database containers', () => {
      const containerSchemas = {
        orders: { properties: {} },
        users: { properties: {} },
        logs: { properties: {} }
      };
      const relationships = [
        {
          fromContainer: 'orders',
          fromProperty: 'UserId',
          toContainer: 'users',
          cardinality: 'many-to-one',
          isOrphan: false
        },
        {
          fromContainer: 'logs',
          fromProperty: 'UserId',
          toContainer: 'users',
          cardinality: 'many-to-one',
          isOrphan: false
        }
      ];
      const databaseContainers = {
        salesdb: ['orders', 'users'],
        auditdb: ['logs']
      };

      const erds = generateDatabaseERDs(containerSchemas, relationships, databaseContainers);

      // salesdb should have orders->users relationship
      expect(erds.salesdb).toContain('orders');
      expect(erds.salesdb).toContain('users');
    });

    it('should handle missing container schemas gracefully', () => {
      const containerSchemas = {
        users: { properties: {} }
        // 'orders' is missing
      };
      const databaseContainers = {
        db: ['users', 'orders']
      };

      const erds = generateDatabaseERDs(containerSchemas, [], databaseContainers);

      // Should not throw, should include users
      expect(erds.db).toContain('users');
    });
  });

  describe('relationship line formatting', () => {
    it('should extract label from property name', () => {
      const schemas = {
        orders: { properties: {} },
        categories: { properties: {} }
      };
      const relationships = [{
        fromContainer: 'orders',
        fromProperty: 'ProductId',
        toContainer: 'categories',
        cardinality: 'many-to-one',
        isOrphan: false
      }];

      const erd = generateERD(schemas, relationships);

      // Label should be "Product" (ProductId with Id removed)
      expect(erd).toContain(': "Product"');
    });

    it('should handle nested property paths in label', () => {
      const schemas = {
        orders: { properties: {} },
        categories: { properties: {} }
      };
      const relationships = [{
        fromContainer: 'orders',
        fromProperty: 'Details.ProductId',
        toContainer: 'categories',
        cardinality: 'many-to-one',
        isOrphan: false
      }];

      const erd = generateERD(schemas, relationships);

      // Dots should be converted to underscores
      expect(erd).toContain(': "Details_Product"');
    });
  });
});
