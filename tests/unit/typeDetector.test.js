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

    describe('email detection', () => {
      it('should detect valid email addresses', () => {
        expect(detectType('user@example.com')).toBe('email');
        expect(detectType('test.user@domain.co.uk')).toBe('email');
        expect(detectType('name+tag@company.org')).toBe('email');
      });

      it('should NOT detect invalid emails', () => {
        expect(detectType('not-an-email')).toBe('string');
        expect(detectType('@missing-local.com')).toBe('string');
        expect(detectType('missing-domain@')).toBe('string');
      });
    });

    describe('URL detection', () => {
      it('should detect valid URLs', () => {
        expect(detectType('https://example.com')).toBe('url');
        expect(detectType('http://localhost:3000/path')).toBe('url');
        expect(detectType('https://api.example.com/v1/users?id=123')).toBe('url');
      });

      it('should NOT detect non-http URLs or invalid URLs', () => {
        expect(detectType('ftp://files.example.com')).toBe('string');
        expect(detectType('example.com')).toBe('string');
        expect(detectType('www.example.com')).toBe('string');
      });
    });

    describe('phone detection', () => {
      it('should detect international phone numbers', () => {
        expect(detectType('+1234567890')).toBe('phone');
        expect(detectType('+44 20 7946 0958')).toBe('phone');
        expect(detectType('+1-555-123-4567')).toBe('phone');
      });

      it('should detect US format phone numbers', () => {
        expect(detectType('(123) 456-7890')).toBe('phone');
        expect(detectType('123-456-7890')).toBe('phone');
        expect(detectType('123.456.7890')).toBe('phone');
      });

      it('should NOT detect date-like strings as phone', () => {
        expect(detectType('15-01-2024')).toBe('string');
        expect(detectType('2024-01-15')).toBe('datetime');
        expect(detectType('12/25/2024')).toBe('string');
      });

      it('should NOT detect random digit strings as phone', () => {
        expect(detectType('1234567890123456')).toBe('string');  // Too long with no format
        expect(detectType('12345')).toBe('string');  // Too short
      });
    });

    describe('custom pattern detection', () => {
      it('should detect custom patterns when provided', () => {
        const customPatterns = [
          { name: 'sku', pattern: '^SKU-\\d{6}$', displayName: 'SKU' }
        ];
        expect(detectType('SKU-123456', customPatterns)).toBe('sku');
        expect(detectType('SKU-000001', customPatterns)).toBe('sku');
      });

      it('should fall back to string for non-matching custom patterns', () => {
        const customPatterns = [
          { name: 'sku', pattern: '^SKU-\\d{6}$', displayName: 'SKU' }
        ];
        expect(detectType('PROD-123456', customPatterns)).toBe('string');
        expect(detectType('SKU-12345', customPatterns)).toBe('string'); // Too short
      });

      it('should check built-in patterns before custom patterns', () => {
        const customPatterns = [
          { name: 'custom-guid', pattern: '^[0-9a-f-]+$', displayName: 'Custom' }
        ];
        // GUIDs should still be detected as guid, not custom-guid
        expect(detectType('12345678-1234-1234-1234-123456789abc', customPatterns)).toBe('guid');
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
      expect(getTypeDisplayName('email')).toBe('Email');
      expect(getTypeDisplayName('url')).toBe('URL');
      expect(getTypeDisplayName('phone')).toBe('Phone');
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

    it('should use custom pattern display names when provided', () => {
      const customPatterns = [
        { name: 'sku', pattern: '^SKU-\\d{6}$', displayName: 'SKU Code' }
      ];
      expect(getTypeDisplayName('sku', customPatterns)).toBe('SKU Code');
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
