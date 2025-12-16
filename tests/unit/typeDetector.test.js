import { describe, it, expect } from 'vitest';
import { detectType, getTypeDisplayName, isReferenceType } from '../../src/analysis/typeDetector.js';
import {
  validGuids,
  invalidGuids,
  validDatetimes,
  invalidDatetimes,
  objectPatterns
} from '../fixtures/sampleDocuments.js';

describe('typeDetector', () => {
  describe('detectType', () => {
    describe('primitive types', () => {
      it('should detect null', () => {
        expect(detectType(null)).toBe('null');
      });

      it('should detect undefined', () => {
        expect(detectType(undefined)).toBe('undefined');
      });

      it('should detect boolean true', () => {
        expect(detectType(true)).toBe('boolean');
      });

      it('should detect boolean false', () => {
        expect(detectType(false)).toBe('boolean');
      });

      it('should detect integer', () => {
        expect(detectType(42)).toBe('integer');
        expect(detectType(0)).toBe('integer');
        expect(detectType(-100)).toBe('integer');
      });

      it('should detect number (float)', () => {
        expect(detectType(3.14)).toBe('number');
        expect(detectType(-0.5)).toBe('number');
        expect(detectType(1.0000001)).toBe('number');
      });

      it('should detect plain string', () => {
        expect(detectType('hello')).toBe('string');
        expect(detectType('test value')).toBe('string');
      });

      it('should detect empty string as string', () => {
        expect(detectType('')).toBe('string');
      });

      it('should detect array', () => {
        expect(detectType([])).toBe('array');
        expect(detectType([1, 2, 3])).toBe('array');
        expect(detectType(['a', 'b'])).toBe('array');
      });
    });

    describe('GUID detection', () => {
      it('should detect valid GUIDs', () => {
        for (const guid of validGuids) {
          expect(detectType(guid)).toBe('guid');
        }
      });

      it('should detect lowercase GUIDs', () => {
        expect(detectType('12345678-1234-1234-1234-123456789abc')).toBe('guid');
      });

      it('should detect uppercase GUIDs', () => {
        expect(detectType('12345678-1234-1234-1234-123456789ABC')).toBe('guid');
      });

      it('should detect mixed case GUIDs', () => {
        // Valid hex characters only (0-9, a-f)
        expect(detectType('12345678-AbCd-1234-EfAb-123456789abc')).toBe('guid');
      });

      it('should NOT detect invalid GUIDs', () => {
        for (const invalid of invalidGuids) {
          expect(detectType(invalid)).toBe('string');
        }
      });
    });

    describe('DateTime detection', () => {
      it('should detect valid ISO datetimes', () => {
        for (const dt of validDatetimes) {
          expect(detectType(dt)).toBe('datetime');
        }
      });

      it('should detect date only format', () => {
        expect(detectType('2024-01-15')).toBe('datetime');
      });

      it('should detect datetime with timezone', () => {
        expect(detectType('2024-01-15T10:30:00+05:30')).toBe('datetime');
      });

      it('should detect datetime with Z suffix', () => {
        expect(detectType('2024-01-15T10:30:00Z')).toBe('datetime');
      });

      it('should detect datetime with milliseconds', () => {
        expect(detectType('2024-01-15T10:30:00.123456Z')).toBe('datetime');
      });

      it('should NOT detect invalid datetime formats', () => {
        for (const invalid of invalidDatetimes) {
          expect(detectType(invalid)).toBe('string');
        }
      });
    });

    describe('object pattern detection', () => {
      it('should detect DateTimeObject pattern', () => {
        expect(detectType(objectPatterns.dateTimeObject)).toBe('DateTimeObject');
      });

      it('should detect ReferenceObject pattern', () => {
        expect(detectType(objectPatterns.referenceObject)).toBe('ReferenceObject');
      });

      it('should detect ReferenceObject with extra properties', () => {
        expect(detectType(objectPatterns.referenceObjectWithExtras)).toBe('ReferenceObject');
      });

      it('should detect LookupObject pattern', () => {
        expect(detectType(objectPatterns.lookupObject)).toBe('LookupObject');
      });

      it('should detect CaseInsensitiveString pattern', () => {
        expect(detectType(objectPatterns.caseInsensitiveString)).toBe('CaseInsensitiveString');
      });

      it('should detect SimpleReference pattern', () => {
        expect(detectType(objectPatterns.simpleReference)).toBe('SimpleReference');
      });

      it('should detect generic object for unmatched patterns', () => {
        expect(detectType(objectPatterns.genericObject)).toBe('object');
      });

      it('should detect generic object for partial matches', () => {
        expect(detectType(objectPatterns.partialReference)).toBe('object');
      });

      it('should detect empty object as object', () => {
        expect(detectType({})).toBe('object');
      });

      it('should require GUID Id for ReferenceObject', () => {
        const nonGuidRef = {
          Id: 'not-a-guid',
          Name: 'Test',
          Code: 'TEST'
        };
        expect(detectType(nonGuidRef)).toBe('object');
      });

      it('should require numeric Id for LookupObject', () => {
        const stringIdLookup = {
          Id: 'string-id',
          Name: 'Test',
          Code: 'TEST'
        };
        expect(detectType(stringIdLookup)).toBe('object');
      });

      it('should require Epoch to be number for DateTimeObject', () => {
        const stringEpoch = {
          Value: '2024-01-15T10:30:00Z',
          Epoch: 'not-a-number'
        };
        expect(detectType(stringEpoch)).toBe('object');
      });
    });
  });

  describe('getTypeDisplayName', () => {
    it('should return display names for all known types', () => {
      expect(getTypeDisplayName('DateTimeObject')).toBe('DateTime');
      expect(getTypeDisplayName('ReferenceObject')).toBe('Reference');
      expect(getTypeDisplayName('LookupObject')).toBe('Lookup');
      expect(getTypeDisplayName('CaseInsensitiveString')).toBe('CIString');
      expect(getTypeDisplayName('SimpleReference')).toBe('Reference');
      expect(getTypeDisplayName('guid')).toBe('GUID');
      expect(getTypeDisplayName('datetime')).toBe('DateTime');
      expect(getTypeDisplayName('integer')).toBe('Integer');
      expect(getTypeDisplayName('number')).toBe('Number');
      expect(getTypeDisplayName('boolean')).toBe('Boolean');
      expect(getTypeDisplayName('string')).toBe('String');
      expect(getTypeDisplayName('array')).toBe('Array');
      expect(getTypeDisplayName('object')).toBe('Object');
      expect(getTypeDisplayName('null')).toBe('Null');
    });

    it('should return type itself for unknown types', () => {
      expect(getTypeDisplayName('unknown-type')).toBe('unknown-type');
      expect(getTypeDisplayName('custom')).toBe('custom');
    });
  });

  describe('isReferenceType', () => {
    it('should return true for reference types', () => {
      expect(isReferenceType('ReferenceObject')).toBe(true);
      expect(isReferenceType('SimpleReference')).toBe(true);
      expect(isReferenceType('LookupObject')).toBe(true);
    });

    it('should return false for non-reference types', () => {
      expect(isReferenceType('DateTimeObject')).toBe(false);
      expect(isReferenceType('CaseInsensitiveString')).toBe(false);
      expect(isReferenceType('guid')).toBe(false);
      expect(isReferenceType('string')).toBe(false);
      expect(isReferenceType('object')).toBe(false);
    });
  });
});
