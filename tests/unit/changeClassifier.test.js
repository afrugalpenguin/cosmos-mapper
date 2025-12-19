import { describe, it, expect } from 'vitest';
import {
  isBreakingPropertyChange,
  isBreakingRelationshipChange,
  isBreakingContainerChange,
  getChangeImpact,
  getPropertyChangeImpact,
  getRelationshipChangeImpact,
  classifyChanges,
  getBreakingReason
} from '../../src/versioning/changeClassifier.js';

describe('changeClassifier', () => {
  describe('isBreakingPropertyChange', () => {
    it('should mark removed property as breaking', () => {
      const change = {
        changeType: 'REMOVED',
        before: { types: ['string'], isRequired: true },
        after: null
      };
      expect(isBreakingPropertyChange(change)).toBe(true);
    });

    it('should mark type narrowing as breaking', () => {
      const change = {
        changeType: 'TYPE_CHANGED',
        before: { types: ['string', 'number'] },
        after: { types: ['string'] }
      };
      expect(isBreakingPropertyChange(change)).toBe(true);
    });

    it('should NOT mark type widening as breaking', () => {
      const change = {
        changeType: 'TYPE_CHANGED',
        before: { types: ['string'] },
        after: { types: ['string', 'null'] }
      };
      expect(isBreakingPropertyChange(change)).toBe(false);
    });

    it('should mark required->optional as breaking', () => {
      const change = {
        changeType: 'OPTIONALITY_CHANGED',
        before: { isRequired: true },
        after: { isRequired: false }
      };
      expect(isBreakingPropertyChange(change)).toBe(true);
    });

    it('should NOT mark optional->required as breaking', () => {
      const change = {
        changeType: 'OPTIONALITY_CHANGED',
        before: { isRequired: false },
        after: { isRequired: true }
      };
      expect(isBreakingPropertyChange(change)).toBe(false);
    });

    it('should NOT mark added property as breaking', () => {
      const change = {
        changeType: 'ADDED',
        before: null,
        after: { types: ['string'] }
      };
      expect(isBreakingPropertyChange(change)).toBe(false);
    });

    it('should mark severe frequency drop as breaking', () => {
      const change = {
        changeType: 'FREQUENCY_CHANGED',
        before: { frequency: 0.9 },
        after: { frequency: 0.3 }
      };
      expect(isBreakingPropertyChange(change)).toBe(true);
    });

    it('should NOT mark minor frequency drop as breaking', () => {
      const change = {
        changeType: 'FREQUENCY_CHANGED',
        before: { frequency: 0.9 },
        after: { frequency: 0.6 }
      };
      expect(isBreakingPropertyChange(change)).toBe(false);
    });
  });

  describe('isBreakingRelationshipChange', () => {
    it('should mark removed relationship as breaking', () => {
      const change = {
        changeType: 'RELATIONSHIP_REMOVED',
        before: { fromContainer: 'orders' },
        after: null
      };
      expect(isBreakingRelationshipChange(change)).toBe(true);
    });

    it('should NOT mark added relationship as breaking', () => {
      const change = {
        changeType: 'RELATIONSHIP_ADDED',
        before: null,
        after: { fromContainer: 'orders' }
      };
      expect(isBreakingRelationshipChange(change)).toBe(false);
    });

    it('should mark many-to-one -> one-to-one as breaking', () => {
      const change = {
        changeType: 'CARDINALITY_CHANGED',
        before: { cardinality: 'many-to-one' },
        after: { cardinality: 'one-to-one' }
      };
      expect(isBreakingRelationshipChange(change)).toBe(true);
    });

    it('should NOT mark one-to-one -> many-to-one as breaking', () => {
      const change = {
        changeType: 'CARDINALITY_CHANGED',
        before: { cardinality: 'one-to-one' },
        after: { cardinality: 'many-to-one' }
      };
      expect(isBreakingRelationshipChange(change)).toBe(false);
    });

    it('should mark severe confidence drop as breaking', () => {
      const change = {
        changeType: 'CONFIDENCE_CHANGED',
        before: { confidence: { score: 80 } },
        after: { confidence: { score: 30 } }
      };
      expect(isBreakingRelationshipChange(change)).toBe(true);
    });

    it('should NOT mark minor confidence drop as breaking', () => {
      const change = {
        changeType: 'CONFIDENCE_CHANGED',
        before: { confidence: { score: 80 } },
        after: { confidence: { score: 60 } }
      };
      expect(isBreakingRelationshipChange(change)).toBe(false);
    });
  });

  describe('isBreakingContainerChange', () => {
    it('should mark removed container as breaking', () => {
      const change = { changeType: 'CONTAINER_REMOVED' };
      expect(isBreakingContainerChange(change)).toBe(true);
    });

    it('should NOT mark added container as breaking', () => {
      const change = { changeType: 'CONTAINER_ADDED' };
      expect(isBreakingContainerChange(change)).toBe(false);
    });
  });

  describe('getChangeImpact', () => {
    it('should return critical for removed property', () => {
      const change = { changeType: 'REMOVED', propertyPath: 'id' };
      expect(getChangeImpact(change)).toBe('critical');
    });

    it('should return critical for removed container', () => {
      const change = { changeType: 'CONTAINER_REMOVED', container: 'legacy' };
      expect(getChangeImpact(change)).toBe('critical');
    });

    it('should return critical for removed relationship', () => {
      const change = { changeType: 'RELATIONSHIP_REMOVED', relationshipKey: 'test' };
      expect(getChangeImpact(change)).toBe('critical');
    });

    it('should return info for added property', () => {
      const change = { changeType: 'ADDED', propertyPath: 'newField' };
      expect(getChangeImpact(change)).toBe('info');
    });

    it('should return warning for breaking type change', () => {
      const change = {
        changeType: 'TYPE_CHANGED',
        propertyPath: 'price',
        before: { types: ['string', 'number'] },
        after: { types: ['string'] }
      };
      expect(getChangeImpact(change)).toBe('warning');
    });
  });

  describe('classifyChanges', () => {
    it('should add isBreaking and impact to all changes', () => {
      const comparison = {
        containerChanges: [
          { container: 'new', changeType: 'CONTAINER_ADDED' }
        ],
        propertyChanges: {
          'products': [
            { propertyPath: 'old', changeType: 'REMOVED', before: {}, after: null }
          ]
        },
        relationshipChanges: [
          { relationshipKey: 'test', changeType: 'RELATIONSHIP_ADDED', before: null, after: {} }
        ],
        summary: {
          containersAdded: 1,
          propertiesRemoved: 1,
          relationshipsAdded: 1,
          breakingChanges: 0,
          totalChanges: 3
        }
      };

      const classified = classifyChanges(comparison);

      // Check container changes
      expect(classified.containerChanges[0].isBreaking).toBe(false);
      expect(classified.containerChanges[0].impact).toBe('info');

      // Check property changes
      expect(classified.propertyChanges['products'][0].isBreaking).toBe(true);
      expect(classified.propertyChanges['products'][0].impact).toBe('critical');

      // Check relationship changes
      expect(classified.relationshipChanges[0].isBreaking).toBe(false);
      expect(classified.relationshipChanges[0].impact).toBe('info');

      // Check summary
      expect(classified.summary.breakingChanges).toBe(1);
    });

    it('should count all breaking changes correctly', () => {
      const comparison = {
        containerChanges: [
          { container: 'old', changeType: 'CONTAINER_REMOVED' }
        ],
        propertyChanges: {
          'products': [
            { propertyPath: 'field1', changeType: 'REMOVED', before: {}, after: null },
            { propertyPath: 'field2', changeType: 'REMOVED', before: {}, after: null }
          ]
        },
        relationshipChanges: [
          { relationshipKey: 'test', changeType: 'RELATIONSHIP_REMOVED', before: {}, after: null }
        ],
        summary: { breakingChanges: 0 }
      };

      const classified = classifyChanges(comparison);

      // 1 container + 2 properties + 1 relationship = 4 breaking
      expect(classified.summary.breakingChanges).toBe(4);
    });
  });

  describe('getBreakingReason', () => {
    it('should return explanation for removed property', () => {
      const change = { changeType: 'REMOVED', isBreaking: true };
      const reason = getBreakingReason(change);
      expect(reason).toContain('consumers');
      expect(reason).toContain('depend');
    });

    it('should return explanation for removed container', () => {
      const change = { changeType: 'CONTAINER_REMOVED', isBreaking: true };
      const reason = getBreakingReason(change);
      expect(reason).toContain('container');
      expect(reason).toContain('queries');
    });

    it('should return null for non-breaking change', () => {
      const change = { changeType: 'ADDED', isBreaking: false };
      const reason = getBreakingReason(change);
      expect(reason).toBeNull();
    });

    it('should return explanation for type narrowing', () => {
      const change = { changeType: 'TYPE_CHANGED', isBreaking: true };
      const reason = getBreakingReason(change);
      expect(reason).toContain('Narrowing');
    });

    it('should return explanation for optionality change', () => {
      const change = { changeType: 'OPTIONALITY_CHANGED', isBreaking: true };
      const reason = getBreakingReason(change);
      expect(reason).toContain('required');
      expect(reason).toContain('optional');
    });
  });
});
