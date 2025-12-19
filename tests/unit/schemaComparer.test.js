import { describe, it, expect } from 'vitest';
import {
  compareSnapshots,
  compareProperties,
  compareRelationships,
  compareContainers,
  hasChanges,
  hasBreakingChanges
} from '../../src/versioning/schemaComparer.js';

describe('schemaComparer', () => {
  describe('compareProperties', () => {
    it('should detect added properties', () => {
      const baseline = {
        'id': { path: 'id', types: ['guid'], isRequired: true }
      };
      const current = {
        'id': { path: 'id', types: ['guid'], isRequired: true },
        'name': { path: 'name', types: ['string'], isRequired: true }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('ADDED');
      expect(changes[0].propertyPath).toBe('name');
      expect(changes[0].before).toBeNull();
      expect(changes[0].after.types).toEqual(['string']);
    });

    it('should detect removed properties', () => {
      const baseline = {
        'id': { path: 'id', types: ['guid'], isRequired: true },
        'oldField': { path: 'oldField', types: ['string'], isRequired: false }
      };
      const current = {
        'id': { path: 'id', types: ['guid'], isRequired: true }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('REMOVED');
      expect(changes[0].propertyPath).toBe('oldField');
      expect(changes[0].before.types).toEqual(['string']);
      expect(changes[0].after).toBeNull();
    });

    it('should detect type changes', () => {
      const baseline = {
        'price': { path: 'price', types: ['string'], isRequired: true }
      };
      const current = {
        'price': { path: 'price', types: ['number'], isRequired: true }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('TYPE_CHANGED');
      expect(changes[0].description).toContain('string');
      expect(changes[0].description).toContain('number');
    });

    it('should detect optionality changes', () => {
      const baseline = {
        'name': { path: 'name', types: ['string'], isRequired: true, frequency: 1.0 }
      };
      const current = {
        'name': { path: 'name', types: ['string'], isRequired: false, frequency: 0.8 }
      };

      const changes = compareProperties(baseline, current, 'products');

      const optionalityChange = changes.find(c => c.changeType === 'OPTIONALITY_CHANGED');
      expect(optionalityChange).toBeDefined();
      expect(optionalityChange.description).toContain('required -> optional');
    });

    it('should detect frequency changes', () => {
      const baseline = {
        'description': { path: 'description', types: ['string'], isRequired: false, frequency: 0.9 }
      };
      const current = {
        'description': { path: 'description', types: ['string'], isRequired: false, frequency: 0.3 }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('FREQUENCY_CHANGED');
      expect(changes[0].description).toContain('90%');
      expect(changes[0].description).toContain('30%');
    });

    it('should ignore minor frequency changes', () => {
      const baseline = {
        'name': { path: 'name', types: ['string'], frequency: 0.95 }
      };
      const current = {
        'name': { path: 'name', types: ['string'], frequency: 0.92 }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(0);
    });

    it('should handle nested properties', () => {
      const baseline = {
        'address': { path: 'address', types: ['object'] },
        'address.street': { path: 'address.street', types: ['string'] }
      };
      const current = {
        'address': { path: 'address', types: ['object'] },
        'address.street': { path: 'address.street', types: ['string'] },
        'address.city': { path: 'address.city', types: ['string'] }
      };

      const changes = compareProperties(baseline, current, 'customers');

      expect(changes).toHaveLength(1);
      expect(changes[0].propertyPath).toBe('address.city');
      expect(changes[0].changeType).toBe('ADDED');
    });

    it('should handle array item properties', () => {
      const baseline = {
        'tags[]': { path: 'tags[]', types: ['string'], isArrayItem: true }
      };
      const current = {
        'tags[]': { path: 'tags[]', types: ['string', 'number'], isArrayItem: true }
      };

      const changes = compareProperties(baseline, current, 'products');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('TYPE_CHANGED');
    });
  });

  describe('compareRelationships', () => {
    it('should detect new relationships', () => {
      const baseline = [];
      const current = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          cardinality: 'many-to-one',
          confidence: { score: 85, level: 'high' }
        }
      ];

      const changes = compareRelationships(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('RELATIONSHIP_ADDED');
      expect(changes[0].description).toContain('orders');
      expect(changes[0].description).toContain('customers');
    });

    it('should detect removed relationships', () => {
      const baseline = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'productId',
          toContainer: 'products',
          toDatabase: 'shop',
          cardinality: 'many-to-one'
        }
      ];
      const current = [];

      const changes = compareRelationships(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('RELATIONSHIP_REMOVED');
    });

    it('should detect cardinality changes', () => {
      const baseline = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          cardinality: 'one-to-one'
        }
      ];
      const current = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          cardinality: 'many-to-one'
        }
      ];

      const changes = compareRelationships(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('CARDINALITY_CHANGED');
      expect(changes[0].description).toContain('one-to-one');
      expect(changes[0].description).toContain('many-to-one');
    });

    it('should detect confidence changes', () => {
      const baseline = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          confidence: { score: 90, level: 'high' }
        }
      ];
      const current = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          confidence: { score: 50, level: 'medium' }
        }
      ];

      const changes = compareRelationships(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('CONFIDENCE_CHANGED');
      expect(changes[0].description).toContain('90%');
      expect(changes[0].description).toContain('50%');
    });

    it('should ignore minor confidence changes', () => {
      const baseline = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          confidence: { score: 85 }
        }
      ];
      const current = [
        {
          fromContainer: 'orders',
          fromDatabase: 'shop',
          fromProperty: 'customerId',
          toContainer: 'customers',
          toDatabase: 'shop',
          confidence: { score: 80 }
        }
      ];

      const changes = compareRelationships(baseline, current);

      expect(changes).toHaveLength(0);
    });
  });

  describe('compareContainers', () => {
    it('should detect added containers', () => {
      const baseline = { schemas: { 'products': {} } };
      const current = { schemas: { 'products': {}, 'orders': {} } };

      const changes = compareContainers(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('CONTAINER_ADDED');
      expect(changes[0].container).toBe('orders');
    });

    it('should detect removed containers', () => {
      const baseline = { schemas: { 'products': {}, 'legacy': {} } };
      const current = { schemas: { 'products': {} } };

      const changes = compareContainers(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('CONTAINER_REMOVED');
      expect(changes[0].container).toBe('legacy');
    });

    it('should handle containerSchemas format', () => {
      const baseline = { schemas: { 'products': {} } };
      const current = { containerSchemas: { 'products': {}, 'orders': {} } };

      const changes = compareContainers(baseline, current);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('CONTAINER_ADDED');
      expect(changes[0].container).toBe('orders');
    });
  });

  describe('compareSnapshots', () => {
    it('should return complete comparison result', () => {
      const baseline = {
        schemas: {
          'products': {
            properties: {
              'id': { types: ['guid'], isRequired: true }
            },
            documentCount: 100
          }
        },
        relationships: []
      };

      const current = {
        schemas: {
          'products': {
            properties: {
              'id': { types: ['guid'], isRequired: true },
              'name': { types: ['string'], isRequired: true }
            },
            documentCount: 100
          }
        },
        relationships: []
      };

      const result = compareSnapshots(baseline, current);

      expect(result.containerChanges).toBeDefined();
      expect(result.propertyChanges).toBeDefined();
      expect(result.relationshipChanges).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.propertiesAdded).toBe(1);
    });

    it('should calculate summary correctly', () => {
      const baseline = {
        schemas: {
          'products': {
            properties: {
              'id': { types: ['guid'] },
              'oldField': { types: ['string'] }
            }
          },
          'legacy': { properties: {} }
        },
        relationships: [
          {
            fromContainer: 'orders',
            fromDatabase: 'shop',
            fromProperty: 'productId',
            toContainer: 'products',
            toDatabase: 'shop'
          }
        ]
      };

      const current = {
        schemas: {
          'products': {
            properties: {
              'id': { types: ['guid'] },
              'newField': { types: ['number'] }
            }
          },
          'orders': { properties: {} }
        },
        relationships: []
      };

      const result = compareSnapshots(baseline, current);

      expect(result.summary.containersAdded).toBe(1);
      expect(result.summary.containersRemoved).toBe(1);
      expect(result.summary.propertiesAdded).toBe(1);
      expect(result.summary.propertiesRemoved).toBe(1);
      expect(result.summary.relationshipsRemoved).toBe(1);
      expect(result.summary.totalChanges).toBeGreaterThan(0);
    });
  });

  describe('hasChanges', () => {
    it('should return true when there are changes', () => {
      const comparison = {
        summary: { totalChanges: 5 }
      };
      expect(hasChanges(comparison)).toBe(true);
    });

    it('should return false when no changes', () => {
      const comparison = {
        summary: { totalChanges: 0 }
      };
      expect(hasChanges(comparison)).toBe(false);
    });
  });

  describe('hasBreakingChanges', () => {
    it('should return true when there are breaking changes', () => {
      const comparison = {
        summary: { breakingChanges: 2 }
      };
      expect(hasBreakingChanges(comparison)).toBe(true);
    });

    it('should return false when no breaking changes', () => {
      const comparison = {
        summary: { breakingChanges: 0 }
      };
      expect(hasBreakingChanges(comparison)).toBe(false);
    });
  });
});
