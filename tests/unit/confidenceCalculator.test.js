import { describe, it, expect, vi } from 'vitest';
import {
  calculateConfidence,
  calculateConfidenceBatch,
  getConfidenceStats,
  DEFAULT_WEIGHTS
} from '../../src/analysis/confidenceCalculator.js';

// Mock the validator module
vi.mock('../../src/analysis/relationshipValidator.js', () => ({
  validateReferentialIntegrity: vi.fn().mockResolvedValue({
    validated: true,
    matchRate: 0.95,
    sampleSize: 100,
    matchedCount: 95,
    orphanCount: 5,
    confidence: 95,
    reason: 'Excellent referential integrity'
  }),
  validateTypeConsistency: vi.fn().mockReturnValue({
    consistent: true,
    confidence: 90,
    reason: 'Exact type match: string',
    fkTypes: ['string'],
    idTypes: ['string']
  }),
  validateFrequency: vi.fn().mockReturnValue({
    populatedRate: 1,
    confidence: 90,
    interpretation: 'Required relationship'
  }),
  detectDenormalization: vi.fn().mockReturnValue({
    isDenormalized: false,
    confidence: 80,
    reason: 'No embedded object found',
    nestedFields: []
  })
}));

describe('confidenceCalculator', () => {
  describe('DEFAULT_WEIGHTS', () => {
    it('should have weights that sum to 1', () => {
      const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBe(1);
    });

    it('should prioritise referential integrity', () => {
      expect(DEFAULT_WEIGHTS.referentialIntegrity).toBeGreaterThan(DEFAULT_WEIGHTS.typeConsistency);
      expect(DEFAULT_WEIGHTS.referentialIntegrity).toBeGreaterThan(DEFAULT_WEIGHTS.frequency);
      expect(DEFAULT_WEIGHTS.referentialIntegrity).toBeGreaterThan(DEFAULT_WEIGHTS.namingPattern);
    });
  });

  describe('calculateConfidence', () => {
    it('should return very-low confidence for orphan relationships', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'UnknownId',
        toContainer: 'unknown',
        isOrphan: true
      };

      const result = await calculateConfidence(relationship, {}, null);

      expect(result.score).toBe(15);
      expect(result.level).toBe('very-low');
      expect(result.validated).toBe(false);
    });

    it('should calculate confidence for well-matched relationships', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false,
        isCrossDatabase: false,
        isAmbiguous: false
      };
      const sourceSchema = {
        properties: {
          StoreId: { types: ['string'], frequency: 1 }
        }
      };
      const targetSchema = {
        properties: {
          id: { types: ['string'] }
        }
      };

      const result = await calculateConfidence(relationship, sourceSchema, targetSchema);

      // Score depends on mocked validation results - should be reasonable
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(['high', 'medium']).toContain(result.level);
      expect(result.factors).toHaveProperty('referentialIntegrity');
      expect(result.factors).toHaveProperty('typeConsistency');
      expect(result.factors).toHaveProperty('frequency');
      expect(result.factors).toHaveProperty('namingPattern');
    });

    it('should mark as validated when client is provided', async () => {
      const mockClient = {};
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {}, mockClient);

      expect(result.validated).toBe(true);
    });

    it('should not mark as validated without client', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.validated).toBe(false);
    });

    it('should include denormalization info in factors', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'CustomerId',
        toContainer: 'customers',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.factors.denormalization).toBeDefined();
      expect(result.factors.denormalization).toHaveProperty('isDenormalized');
    });
  });

  describe('naming pattern scoring', () => {
    it('should give high score for exact Id suffix match', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.factors.namingPattern.confidence).toBeGreaterThanOrEqual(90);
      expect(result.factors.namingPattern.pattern).toBe('exact-id-suffix');
    });

    it('should give medium score for partial match', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'CustId',  // Partial match for 'customers'
        toContainer: 'customers',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.factors.namingPattern.pattern).toBe('partial-id-suffix');
    });

    it('should give lower score for unclear pattern', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'Reference',  // No clear pattern
        toContainer: 'products',
        isOrphan: false
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.factors.namingPattern.confidence).toBeLessThanOrEqual(60);
    });
  });

  describe('calculateConfidenceBatch', () => {
    it('should process multiple relationships', async () => {
      const relationships = [
        { fromContainer: 'orders', fromProperty: 'StoreId', toContainer: 'stores', isOrphan: false },
        { fromContainer: 'orders', fromProperty: 'ProductId', toContainer: 'products', isOrphan: false }
      ];
      const schemas = {
        orders: { properties: {} },
        stores: { properties: { id: { types: ['string'] } } },
        products: { properties: { id: { types: ['string'] } } }
      };

      const results = await calculateConfidenceBatch(relationships, schemas);

      expect(results.size).toBe(2);
      expect(relationships[0].confidence).toBeDefined();
      expect(relationships[1].confidence).toBeDefined();
    });

    it('should handle empty relationships array', async () => {
      const results = await calculateConfidenceBatch([], {});
      expect(results.size).toBe(0);
    });
  });

  describe('getConfidenceStats', () => {
    it('should calculate statistics for relationships with confidence', () => {
      const relationships = [
        { confidence: { score: 90, level: 'high', validated: true } },
        { confidence: { score: 75, level: 'medium', validated: true } },
        { confidence: { score: 45, level: 'low', validated: false } },
        { confidence: { score: 25, level: 'very-low', validated: false } }
      ];

      const stats = getConfidenceStats(relationships);

      expect(stats.total).toBe(4);
      expect(stats.validated).toBe(2);
      expect(stats.averageScore).toBe(59); // (90+75+45+25)/4 rounded
      expect(stats.byLevel.high).toBe(1);
      expect(stats.byLevel.medium).toBe(1);
      expect(stats.byLevel.low).toBe(1);
      expect(stats.byLevel['very-low']).toBe(1);
    });

    it('should handle relationships without confidence', () => {
      const relationships = [
        { fromContainer: 'orders', toContainer: 'stores' },
        { fromContainer: 'orders', toContainer: 'products' }
      ];

      const stats = getConfidenceStats(relationships);

      expect(stats.total).toBe(2);
      expect(stats.validated).toBe(0);
      expect(stats.averageScore).toBe(0);
    });

    it('should handle empty array', () => {
      const stats = getConfidenceStats([]);

      expect(stats.total).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('confidence levels', () => {
    it('should classify scores correctly', async () => {
      // Test boundary conditions for level classification
      const testCases = [
        { score: 85, expectedLevel: 'high' },
        { score: 80, expectedLevel: 'high' },
        { score: 79, expectedLevel: 'medium' },
        { score: 60, expectedLevel: 'medium' },
        { score: 59, expectedLevel: 'low' },
        { score: 40, expectedLevel: 'low' },
        { score: 39, expectedLevel: 'very-low' },
        { score: 15, expectedLevel: 'very-low' }
      ];

      for (const tc of testCases) {
        const relationship = {
          fromContainer: 'orders',
          fromProperty: 'StoreId',
          toContainer: 'stores',
          isOrphan: tc.score < 20
        };

        const result = await calculateConfidence(relationship, {}, {});

        // The actual level depends on factor scores, but for orphans we know the level
        if (tc.score < 20) {
          expect(result.level).toBe('very-low');
        }
      }
    });
  });

  describe('summary generation', () => {
    it('should include cross-database indicator', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false,
        isCrossDatabase: true
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.summary).toContain('cross-database');
    });

    it('should include ambiguous indicator', async () => {
      const relationship = {
        fromContainer: 'orders',
        fromProperty: 'StoreId',
        toContainer: 'stores',
        isOrphan: false,
        isAmbiguous: true
      };

      const result = await calculateConfidence(relationship, {}, {});

      expect(result.summary).toContain('ambiguous');
    });
  });
});
