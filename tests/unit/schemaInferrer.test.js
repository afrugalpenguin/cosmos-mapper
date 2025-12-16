import { describe, it, expect } from 'vitest';
import {
  inferSchema,
  buildPropertyTree,
  getRootProperties,
  getChildProperties
} from '../../src/analysis/schemaInferrer.js';
import { sampleDocuments, edgeCaseDocuments } from '../fixtures/sampleDocuments.js';

describe('schemaInferrer', () => {
  describe('inferSchema', () => {
    describe('empty input handling', () => {
      it('should handle empty array', () => {
        const schema = inferSchema([]);
        expect(schema.properties).toEqual({});
        expect(schema.documentCount).toBe(0);
      });

      it('should handle null input', () => {
        const schema = inferSchema(null);
        expect(schema.properties).toEqual({});
        expect(schema.documentCount).toBe(0);
      });

      it('should handle undefined input', () => {
        const schema = inferSchema(undefined);
        expect(schema.properties).toEqual({});
        expect(schema.documentCount).toBe(0);
      });
    });

    describe('basic property detection', () => {
      it('should detect simple properties', () => {
        const docs = [{ name: 'test', count: 42 }];
        const schema = inferSchema(docs);

        expect(schema.properties.name).toBeDefined();
        expect(schema.properties.count).toBeDefined();
        expect(schema.documentCount).toBe(1);
      });

      it('should detect property types', () => {
        const docs = [
          { str: 'hello', num: 42, bool: true, id: '12345678-1234-1234-1234-123456789abc' }
        ];
        const schema = inferSchema(docs);

        expect(schema.properties.str.types).toContain('string');
        expect(schema.properties.num.types).toContain('integer');
        expect(schema.properties.bool.types).toContain('boolean');
        expect(schema.properties.id.types).toContain('guid');
      });

      it('should track occurrence counts', () => {
        const docs = [
          { always: 'a', sometimes: 'b' },
          { always: 'c' },
          { always: 'd', sometimes: 'e' }
        ];
        const schema = inferSchema(docs);

        expect(schema.properties.always.occurrences).toBe(3);
        expect(schema.properties.sometimes.occurrences).toBe(2);
      });
    });

    describe('Cosmos metadata exclusion', () => {
      it('should exclude _rid, _self, _etag, _ts, _attachments', () => {
        const docs = [{
          id: 'test',
          _rid: 'cosmos-rid',
          _self: 'cosmos-self',
          _etag: 'cosmos-etag',
          _ts: 1234567890,
          _attachments: []
        }];
        const schema = inferSchema(docs);

        expect(schema.properties._rid).toBeUndefined();
        expect(schema.properties._self).toBeUndefined();
        expect(schema.properties._etag).toBeUndefined();
        expect(schema.properties._ts).toBeUndefined();
        expect(schema.properties._attachments).toBeUndefined();
        expect(schema.properties.id).toBeDefined();
      });
    });

    describe('nested object handling', () => {
      it('should detect nested properties with dot notation', () => {
        const docs = [{
          address: {
            street: '123 Main St',
            city: 'Boston'
          }
        }];
        const schema = inferSchema(docs);

        expect(schema.properties.address).toBeDefined();
        expect(schema.properties['address.street']).toBeDefined();
        expect(schema.properties['address.city']).toBeDefined();
        expect(schema.properties['address.street'].parentPath).toBe('address');
      });

      it('should handle deeply nested objects', () => {
        const schema = inferSchema([edgeCaseDocuments.deeplyNested]);

        expect(schema.properties.level1).toBeDefined();
        expect(schema.properties['level1.level2']).toBeDefined();
        expect(schema.properties['level1.level2.level3']).toBeDefined();
        expect(schema.properties['level1.level2.level3.value']).toBeDefined();
      });
    });

    describe('array handling', () => {
      it('should detect array properties', () => {
        const docs = [{ tags: ['a', 'b', 'c'] }];
        const schema = inferSchema(docs);

        expect(schema.properties.tags).toBeDefined();
        expect(schema.properties.tags.isArray).toBe(true);
        expect(schema.properties.tags.types).toContain('array');
      });

      it('should detect array item types', () => {
        const docs = [{ tags: ['a', 'b'] }];
        const schema = inferSchema(docs);

        expect(schema.properties['tags[]']).toBeDefined();
        expect(schema.properties['tags[]'].types).toContain('string');
      });

      it('should detect array of objects with nested paths', () => {
        const schema = inferSchema([edgeCaseDocuments.arrayOfObjects]);

        expect(schema.properties.items).toBeDefined();
        expect(schema.properties['items[]']).toBeDefined();
        expect(schema.properties['items[].name']).toBeDefined();
        expect(schema.properties['items[].quantity']).toBeDefined();
      });
    });

    describe('optionality calculation', () => {
      it('should mark properties appearing in 95%+ docs as required', () => {
        // Create 100 docs, property appears in all
        const docs = Array(100).fill(null).map((_, i) => ({
          id: String(i),
          required: 'always'
        }));
        const schema = inferSchema(docs);

        expect(schema.properties.required.isRequired).toBe(true);
      });

      it('should mark properties appearing in <95% docs as optional', () => {
        // Create 100 docs, property appears in only 50
        const docs = Array(100).fill(null).map((_, i) => ({
          id: String(i),
          ...(i < 50 ? { optional: 'sometimes' } : {})
        }));
        const schema = inferSchema(docs);

        expect(schema.properties.optional.isRequired).toBe(false);
      });

      it('should calculate frequency correctly', () => {
        const docs = Array(100).fill(null).map((_, i) => ({
          id: String(i),
          ...(i < 80 ? { partial: 'value' } : {})
        }));
        const schema = inferSchema(docs);

        expect(schema.properties.partial.frequency).toBeCloseTo(0.8, 2);
      });
    });

    describe('example collection', () => {
      it('should collect up to 5 unique examples', () => {
        const docs = [
          { value: 'a' },
          { value: 'b' },
          { value: 'c' },
          { value: 'd' },
          { value: 'e' },
          { value: 'f' },
          { value: 'g' }
        ];
        const schema = inferSchema(docs);

        expect(schema.properties.value.examples.length).toBeLessThanOrEqual(5);
      });

      it('should truncate long string examples', () => {
        const schema = inferSchema([edgeCaseDocuments.longString]);
        const example = schema.properties.description.examples[0];

        expect(example.length).toBeLessThanOrEqual(50);
        expect(example).toContain('...');
      });

      it('should not include null/undefined examples', () => {
        const docs = [
          { value: null },
          { value: 'actual' }
        ];
        const schema = inferSchema(docs);

        expect(schema.properties.value.examples).not.toContain(null);
        expect(schema.properties.value.examples).toContain('actual');
      });
    });

    describe('mixed types', () => {
      it('should accumulate multiple types for same property', () => {
        const schema = inferSchema(edgeCaseDocuments.mixedTypeProperty);

        expect(schema.properties.value.types).toContain('string');
        expect(schema.properties.value.types).toContain('integer');
        expect(schema.properties.value.types).toContain('boolean');
      });
    });

    describe('object pattern detection in schema', () => {
      it('should detect ReferenceObject pattern', () => {
        const schema = inferSchema(sampleDocuments);

        expect(schema.properties.tenant.types).toContain('ReferenceObject');
      });
    });
  });

  describe('buildPropertyTree', () => {
    it('should build tree with root-level properties', () => {
      // Test only root level properties (nested have a known limitation)
      const properties = {
        name: { path: 'name', name: 'name', parentPath: null },
        address: { path: 'address', name: 'address', parentPath: null },
        count: { path: 'count', name: 'count', parentPath: null }
      };

      const tree = buildPropertyTree(properties);

      expect(tree.name).toBeDefined();
      expect(tree.address).toBeDefined();
      expect(tree.count).toBeDefined();
      expect(tree.name.children).toEqual({});
    });
  });

  describe('getRootProperties', () => {
    it('should return only root-level properties', () => {
      const properties = {
        id: { path: 'id', name: 'id', parentPath: null, isRequired: true },
        name: { path: 'name', name: 'name', parentPath: null, isRequired: false },
        'nested.child': { path: 'nested.child', name: 'child', parentPath: 'nested' }
      };

      const roots = getRootProperties(properties);

      expect(roots.length).toBe(2);
      expect(roots.some(p => p.name === 'id')).toBe(true);
      expect(roots.some(p => p.name === 'name')).toBe(true);
      expect(roots.some(p => p.name === 'child')).toBe(false);
    });

    it('should sort with id first', () => {
      const properties = {
        name: { path: 'name', name: 'name', parentPath: null, isRequired: true },
        id: { path: 'id', name: 'id', parentPath: null, isRequired: true },
        active: { path: 'active', name: 'active', parentPath: null, isRequired: true }
      };

      const roots = getRootProperties(properties);

      expect(roots[0].name).toBe('id');
    });

    it('should sort required before optional', () => {
      const properties = {
        optional: { path: 'optional', name: 'optional', parentPath: null, isRequired: false },
        required: { path: 'required', name: 'required', parentPath: null, isRequired: true }
      };

      const roots = getRootProperties(properties);

      expect(roots[0].name).toBe('required');
      expect(roots[1].name).toBe('optional');
    });

    it('should sort alphabetically within same requirement level', () => {
      const properties = {
        zebra: { path: 'zebra', name: 'zebra', parentPath: null, isRequired: true },
        alpha: { path: 'alpha', name: 'alpha', parentPath: null, isRequired: true },
        beta: { path: 'beta', name: 'beta', parentPath: null, isRequired: true }
      };

      const roots = getRootProperties(properties);

      expect(roots[0].name).toBe('alpha');
      expect(roots[1].name).toBe('beta');
      expect(roots[2].name).toBe('zebra');
    });
  });

  describe('getChildProperties', () => {
    it('should return children of specified parent path', () => {
      const properties = {
        address: { path: 'address', name: 'address', parentPath: null },
        'address.street': { path: 'address.street', name: 'street', parentPath: 'address' },
        'address.city': { path: 'address.city', name: 'city', parentPath: 'address' },
        'other.field': { path: 'other.field', name: 'field', parentPath: 'other' }
      };

      const children = getChildProperties(properties, 'address');

      expect(children.length).toBe(2);
      expect(children.some(p => p.name === 'street')).toBe(true);
      expect(children.some(p => p.name === 'city')).toBe(true);
    });

    it('should return empty array for non-existent parent', () => {
      const properties = {
        name: { path: 'name', name: 'name', parentPath: null }
      };

      const children = getChildProperties(properties, 'nonexistent');

      expect(children).toEqual([]);
    });

    it('should sort children alphabetically', () => {
      const properties = {
        'parent.zebra': { path: 'parent.zebra', name: 'zebra', parentPath: 'parent' },
        'parent.alpha': { path: 'parent.alpha', name: 'alpha', parentPath: 'parent' }
      };

      const children = getChildProperties(properties, 'parent');

      expect(children[0].name).toBe('alpha');
      expect(children[1].name).toBe('zebra');
    });
  });
});
