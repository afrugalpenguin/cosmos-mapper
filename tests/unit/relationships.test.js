import { describe, it, expect } from 'vitest';
import {
  detectRelationships,
  invertRelationships,
  groupRelationshipsByContainer,
  getUniqueRelationshipsForERD
} from '../../src/analysis/relationships.js';
import { testContainers, schemaWithRelationships } from '../fixtures/sampleDocuments.js';

describe('relationships', () => {
  describe('detectRelationships', () => {
    describe('pattern detection', () => {
      it('should detect *Id pattern (StoreId -> stores)', () => {
        const schema = {
          properties: {
            StoreId: {
              path: 'StoreId',
              name: 'StoreId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'store-db' },
          { name: 'stores', database: 'platform' }
        ];

        const rels = detectRelationships('orders', 'store-db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].fromProperty).toBe('StoreId');
        expect(rels[0].toContainer).toBe('stores');
      });

      it('should detect *_id pattern (store_id -> stores)', () => {
        const schema = {
          properties: {
            store_id: {
              path: 'store_id',
              name: 'store_id',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'stores', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].fromProperty).toBe('store_id');
        expect(rels[0].toContainer).toBe('stores');
      });

      it('should detect nested Id pattern (Store.Id -> stores)', () => {
        const schema = {
          properties: {
            Store: {
              path: 'Store',
              name: 'Store',
              parentPath: null,
              types: ['object']
            },
            'Store.Id': {
              path: 'Store.Id',
              name: 'Id',
              parentPath: 'Store',
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'stores', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        const storeRel = rels.find(r => r.toContainer === 'stores');
        expect(storeRel).toBeDefined();
        expect(storeRel.fromProperty).toBe('Store');
      });

      it('should detect ReferenceObject type pattern', () => {
        const schema = {
          properties: {
            Store: {
              path: 'Store',
              name: 'Store',
              parentPath: null,
              types: ['ReferenceObject']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'stores', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].toContainer).toBe('stores');
      });

      it('should detect SimpleReference type pattern', () => {
        const schema = {
          properties: {
            Contract: {
              path: 'Contract',
              name: 'Contract',
              parentPath: null,
              types: ['SimpleReference']
            }
          }
        };
        const containers = [
          { name: 'categories', database: 'db' },
          { name: 'contracts', database: 'db' }
        ];

        const rels = detectRelationships('categories', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].toContainer).toBe('contracts');
      });

      it('should detect property name matching existing container (Pattern 5)', () => {
        // Property name 'Supplier' matches container 'suppliers' (with plural)
        // This should work even without ReferenceObject type
        const schema = {
          properties: {
            Supplier: {
              path: 'Supplier',
              name: 'Supplier',
              parentPath: null,
              types: ['object']  // Regular object, NOT ReferenceObject
            }
          }
        };
        const containers = [
          { name: 'products', database: 'db' },
          { name: 'suppliers', database: 'db' }
        ];

        const rels = detectRelationships('products', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].fromProperty).toBe('Supplier');
        expect(rels[0].toContainer).toBe('suppliers');
      });

      it('should NOT create relationship when property name does not match any container (Pattern 5)', () => {
        // Property 'Warehouse' should NOT create orphan if no warehouse/warehouses container exists
        const schema = {
          properties: {
            Warehouse: {
              path: 'Warehouse',
              name: 'Warehouse',
              parentPath: null,
              types: ['object']
            }
          }
        };
        const containers = [
          { name: 'products', database: 'db' },
          { name: 'categories', database: 'db' }  // No 'warehouse' or 'warehouses' container
        ];

        const rels = detectRelationships('products', 'db', schema, containers);

        // Should have no relationships (Pattern 5 only fires when container exists)
        expect(rels.length).toBe(0);
      });
    });

    describe('container matching', () => {
      it('should prefer same-database matches', () => {
        const schema = {
          properties: {
            StoreId: {
              path: 'StoreId',
              name: 'StoreId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'store-a' },
          { name: 'stores', database: 'store-a' },  // Same DB - should match
          { name: 'stores', database: 'store-b' }   // Different DB
        ];

        const rels = detectRelationships('orders', 'store-a', schema, containers);

        expect(rels[0].toDatabase).toBe('store-a');
        expect(rels[0].isCrossDatabase).toBe(false);
      });

      it('should fall back to cross-database when no same-database match', () => {
        const schema = {
          properties: {
            StoreId: {
              path: 'StoreId',
              name: 'StoreId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'store-a' },
          { name: 'stores', database: 'platform' }  // Different DB
        ];

        const rels = detectRelationships('orders', 'store-a', schema, containers);

        expect(rels[0].toDatabase).toBe('platform');
        expect(rels[0].isCrossDatabase).toBe(true);
      });

      it('should detect ambiguous cross-database relationships', () => {
        const schema = {
          properties: {
            EventId: {
              path: 'EventId',
              name: 'EventId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'processing', database: 'platform' },
          { name: 'events', database: 'store-a' },
          { name: 'events', database: 'store-b' },
          { name: 'events', database: 'store-c' }
        ];

        const rels = detectRelationships('processing', 'platform', schema, containers);

        expect(rels[0].isAmbiguous).toBe(true);
        expect(rels[0].possibleDatabases.length).toBe(3);
        expect(rels[0].possibleDatabases).toContain('store-a');
        expect(rels[0].possibleDatabases).toContain('store-b');
        expect(rels[0].possibleDatabases).toContain('store-c');
      });

      it('should match plural container names (store -> stores)', () => {
        // Note: pluralization adds 's', so 'store' matches 'stores'
        const schema = {
          properties: {
            StoreId: {
              path: 'StoreId',
              name: 'StoreId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'stores', database: 'db' }  // Plural form
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('stores');
      });

      it('should match singular container names (categories -> category)', () => {
        const schema = {
          properties: {
            Product: {
              path: 'Product',
              name: 'Product',
              parentPath: null,
              types: ['SimpleReference']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'product', database: 'db' }  // Singular form
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('product');
      });

      it('should handle special plural (ies -> y)', () => {
        // 'CategoriesId' -> 'categories' -> tries: 'categories', 'categoriess', 'categorie', 'product'
        // The 'product' singular matches the container
        const schema = {
          properties: {
            CategoriesId: {
              path: 'CategoriesId',
              name: 'CategoriesId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'product', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('product');
      });
    });

    describe('exclusions', () => {
      it('should NOT detect property named exactly "id"', () => {
        const schema = {
          properties: {
            id: {
              path: 'id',
              name: 'id',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [{ name: 'orders', database: 'db' }];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels.length).toBe(0);
      });

      it('should NOT create self-references', () => {
        const schema = {
          properties: {
            OrderId: {
              path: 'OrderId',
              name: 'OrderId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        // Should not reference itself
        expect(rels.filter(r => r.toContainer === 'orders').length).toBe(0);
      });

      it('should mark orphan references when no container matches', () => {
        const schema = {
          properties: {
            UnknownId: {
              path: 'UnknownId',
              name: 'UnknownId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [{ name: 'orders', database: 'db' }];

        const rels = detectRelationships('orders', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].isOrphan).toBe(true);
        expect(rels[0].toContainer).toBe('unknown');
      });
    });

    describe('duplicate prevention', () => {
      it('should not create duplicate relationships', () => {
        // Schema where same relationship could be detected multiple ways
        const schema = {
          properties: {
            StoreId: {
              path: 'StoreId',
              name: 'StoreId',
              parentPath: null,
              types: ['guid']
            },
            Store: {
              path: 'Store',
              name: 'Store',
              parentPath: null,
              types: ['ReferenceObject']
            }
          }
        };
        const containers = [
          { name: 'orders', database: 'db' },
          { name: 'stores', database: 'db' }
        ];

        const rels = detectRelationships('orders', 'db', schema, containers);

        // Should have 2 relationships (different fromProperty)
        const storeRels = rels.filter(r => r.toContainer === 'stores');
        expect(storeRels.length).toBe(2);
        expect(storeRels[0].fromProperty).not.toBe(storeRels[1].fromProperty);
      });
    });
  });

  describe('invertRelationships', () => {
    it('should create inverted relationships', () => {
      const rels = [{
        fromContainer: 'orders',
        fromDatabase: 'store',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        toDatabase: 'platform',
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: true,
        isOrphan: false
      }];

      const inverted = invertRelationships(rels);

      expect(inverted.length).toBe(2);  // Original + inverted

      const invertedRel = inverted.find(r => r.fromContainer === 'stores');
      expect(invertedRel).toBeDefined();
      expect(invertedRel.toContainer).toBe('orders');
      expect(invertedRel.cardinality).toBe('one-to-many');
    });

    it('should NOT invert orphan relationships', () => {
      const rels = [{
        fromContainer: 'orders',
        fromDatabase: 'store',
        fromProperty: 'UnknownId',
        toContainer: 'unknown',
        toDatabase: null,
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: false,
        isOrphan: true
      }];

      const inverted = invertRelationships(rels);

      // Should only have original (no inversion)
      expect(inverted.length).toBe(1);
      expect(inverted[0].isOrphan).toBe(true);
    });
  });

  describe('groupRelationshipsByContainer', () => {
    it('should group relationships by source container', () => {
      const rels = [
        { fromContainer: 'orders', toContainer: 'stores' },
        { fromContainer: 'orders', toContainer: 'categories' },
        { fromContainer: 'categories', toContainer: 'stores' }
      ];

      const grouped = groupRelationshipsByContainer(rels);

      expect(grouped.orders.length).toBe(2);
      expect(grouped.categories.length).toBe(1);
    });

    it('should handle empty relationships', () => {
      const grouped = groupRelationshipsByContainer([]);
      expect(grouped).toEqual({});
    });
  });

  describe('getUniqueRelationshipsForERD', () => {
    it('should deduplicate relationships with same containers and property', () => {
      // Key is: sorted containers + fromProperty
      // So same containers + same property = duplicate
      const rels = [
        {
          fromContainer: 'orders',
          toContainer: 'stores',
          fromProperty: 'StoreId',
          isOrphan: false
        },
        {
          fromContainer: 'stores',
          toContainer: 'orders',
          fromProperty: 'StoreId',  // Same property
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      // Should only have one (same container pair + same property)
      expect(unique.length).toBe(1);
    });

    it('should keep relationships with different properties (not deduplicated)', () => {
      // Bidirectional relationships have different fromProperty values
      // (StoreId vs id), so they're NOT deduplicated
      const rels = [
        {
          fromContainer: 'orders',
          toContainer: 'stores',
          fromProperty: 'StoreId',
          isOrphan: false
        },
        {
          fromContainer: 'stores',
          toContainer: 'orders',
          fromProperty: 'id',  // Different property
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      // Both kept because different fromProperty
      expect(unique.length).toBe(2);
    });

    it('should filter out orphan relationships', () => {
      const rels = [
        {
          fromContainer: 'orders',
          toContainer: 'stores',
          fromProperty: 'StoreId',
          isOrphan: false
        },
        {
          fromContainer: 'orders',
          toContainer: 'unknown',
          fromProperty: 'UnknownId',
          isOrphan: true
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      expect(unique.length).toBe(1);
      expect(unique[0].toContainer).toBe('stores');
    });

    it('should keep relationships with different properties', () => {
      const rels = [
        {
          fromContainer: 'orders',
          toContainer: 'stores',
          fromProperty: 'StoreId',
          isOrphan: false
        },
        {
          fromContainer: 'orders',
          toContainer: 'stores',
          fromProperty: 'CreatedByStoreId',
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      expect(unique.length).toBe(2);
    });
  });
});
