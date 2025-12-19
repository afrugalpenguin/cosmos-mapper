import { describe, it, expect, vi } from 'vitest';
import {
  validateReferentialIntegrity,
  validateTypeConsistency,
  validateFrequency,
  detectDenormalization
} from '../../src/analysis/relationshipValidator.js';

describe('relationshipValidator', () => {
  describe('validateReferentialIntegrity', () => {
    it('should skip orphan relationships', async () => {
      const relationship = {
        fromDatabase: 'db',
        fromContainer: 'orders',
        fromProperty: 'UnknownId',
        toDatabase: null,
        toContainer: 'unknown',
        isOrphan: true
      };

      const result = await validateReferentialIntegrity(null, relationship);

      expect(result.validated).toBe(false);
      expect(result.reason).toContain('does not exist');
    });

    it('should return low confidence when no FK values found', async () => {
      const mockClient = {};
      const relationship = {
        fromDatabase: 'db',
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toDatabase: 'db',
        toContainer: 'stores',
        isOrphan: false
      };

      // Mock getDistinctValues to return empty array
      vi.mock('../../src/cosmos/client.js', () => ({
        getDistinctValues: vi.fn().mockResolvedValue([]),
        checkIdsExist: vi.fn().mockResolvedValue([])
      }));

      const result = await validateReferentialIntegrity(mockClient, relationship);

      expect(result.validated).toBe(false);
      expect(result.sampleSize).toBe(0);
    });
  });

  describe('validateTypeConsistency', () => {
    it('should return high confidence for exact type match', () => {
      const relationship = {
        fromProperty: 'StoreId'
      };
      const sourceSchema = {
        properties: {
          StoreId: { types: ['string'] }
        }
      };
      const targetSchema = {
        properties: {
          id: { types: ['string'] }
        }
      };

      const result = validateTypeConsistency(relationship, sourceSchema, targetSchema);

      expect(result.consistent).toBe(true);
      expect(result.confidence).toBe(90);
      expect(result.reason).toContain('Exact type match');
    });

    it('should return low confidence for type mismatch', () => {
      const relationship = {
        fromProperty: 'StoreId'
      };
      const sourceSchema = {
        properties: {
          StoreId: { types: ['number'] }
        }
      };
      const targetSchema = {
        properties: {
          id: { types: ['string'] }
        }
      };

      const result = validateTypeConsistency(relationship, sourceSchema, targetSchema);

      expect(result.consistent).toBe(false);
      expect(result.confidence).toBe(20);
      expect(result.reason).toContain('Type mismatch');
    });

    it('should return partial match for overlapping types', () => {
      const relationship = {
        fromProperty: 'StoreId'
      };
      const sourceSchema = {
        properties: {
          StoreId: { types: ['string', 'null'] }
        }
      };
      const targetSchema = {
        properties: {
          id: { types: ['string', 'number'] }
        }
      };

      const result = validateTypeConsistency(relationship, sourceSchema, targetSchema);

      expect(result.consistent).toBe(true);
      expect(result.confidence).toBe(65);
      expect(result.reason).toContain('Partial type match');
    });

    it('should handle missing FK property', () => {
      const relationship = {
        fromProperty: 'NonExistent'
      };
      const sourceSchema = {
        properties: {}
      };
      const targetSchema = {
        properties: {
          id: { types: ['string'] }
        }
      };

      const result = validateTypeConsistency(relationship, sourceSchema, targetSchema);

      expect(result.consistent).toBe(false);
      expect(result.reason).toContain('FK property not found');
    });

    it('should handle nested property paths', () => {
      const relationship = {
        fromProperty: 'Customer.Id'
      };
      const sourceSchema = {
        properties: {
          Id: { types: ['guid'] }
        }
      };
      const targetSchema = {
        properties: {
          id: { types: ['guid'] }
        }
      };

      const result = validateTypeConsistency(relationship, sourceSchema, targetSchema);

      expect(result.consistent).toBe(true);
    });
  });

  describe('validateFrequency', () => {
    it('should return high confidence for required fields', () => {
      const relationship = { fromProperty: 'StoreId' };
      const schema = {
        properties: {
          StoreId: { isRequired: true, frequency: 1 }
        }
      };

      const result = validateFrequency(relationship, schema);

      expect(result.confidence).toBe(90);
      expect(result.interpretation).toContain('Required');
    });

    it('should return medium confidence for commonly populated fields', () => {
      const relationship = { fromProperty: 'StoreId' };
      const schema = {
        properties: {
          StoreId: { frequency: 0.8 }
        }
      };

      const result = validateFrequency(relationship, schema);

      expect(result.confidence).toBe(70);
      expect(result.interpretation).toContain('Common');
    });

    it('should return low confidence for rare fields', () => {
      const relationship = { fromProperty: 'LegacyId' };
      const schema = {
        properties: {
          LegacyId: { frequency: 0.1 }
        }
      };

      const result = validateFrequency(relationship, schema);

      expect(result.confidence).toBe(20);
      expect(result.interpretation).toContain('Rare');
    });

    it('should handle missing property', () => {
      const relationship = { fromProperty: 'NonExistent' };
      const schema = { properties: {} };

      const result = validateFrequency(relationship, schema);

      expect(result.confidence).toBe(0);
    });
  });

  describe('detectDenormalization', () => {
    it('should detect no embedded object as likely live reference', () => {
      const relationship = { fromProperty: 'CustomerId' };
      const schema = {
        properties: {
          CustomerId: { types: ['guid'] }
        }
      };

      const result = detectDenormalization(relationship, schema);

      expect(result.isDenormalized).toBe(false);
      expect(result.reason).toContain('live reference');
    });

    it('should detect embedded object with snapshot fields', () => {
      const relationship = { fromProperty: 'CustomerId' };
      const schema = {
        properties: {
          CustomerId: { types: ['guid'] },
          'Customer.Name': { types: ['string'] },
          'Customer.Email': { types: ['string'] }
        }
      };

      const result = detectDenormalization(relationship, schema);

      expect(result.isDenormalized).toBe(true);
      expect(result.confidence).toBe(85);
      expect(result.nestedFields).toContain('name');
    });

    it('should handle unclear nested objects', () => {
      const relationship = { fromProperty: 'CustomerId' };
      const schema = {
        properties: {
          CustomerId: { types: ['guid'] },
          'Customer.Foo': { types: ['string'] },
          'Customer.Bar': { types: ['number'] }
        }
      };

      const result = detectDenormalization(relationship, schema);

      expect(result.isDenormalized).toBe('possible');
      expect(result.confidence).toBe(50);
    });

    it('should handle missing schema', () => {
      const relationship = { fromProperty: 'CustomerId' };

      const result = detectDenormalization(relationship, null);

      expect(result.isDenormalized).toBe(false);
      expect(result.reason).toContain('Schema not available');
    });
  });
});
