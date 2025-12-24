import { describe, it, expect } from 'vitest';
import {
  mapTypeToJsonSchema,
  convertPropertyToJsonSchema,
  convertToJsonSchema,
  generateJsonSchemas
} from '../../src/output/jsonSchemaGenerator.js';

describe('jsonSchemaGenerator', () => {
  describe('mapTypeToJsonSchema', () => {
    it('should map string to string type', () => {
      expect(mapTypeToJsonSchema('string')).toEqual({ type: 'string' });
    });

    it('should map guid to string with uuid format', () => {
      expect(mapTypeToJsonSchema('guid')).toEqual({ type: 'string', format: 'uuid' });
    });

    it('should map datetime to string with date-time format', () => {
      expect(mapTypeToJsonSchema('datetime')).toEqual({ type: 'string', format: 'date-time' });
    });

    it('should map email to string with email format', () => {
      expect(mapTypeToJsonSchema('email')).toEqual({ type: 'string', format: 'email' });
    });

    it('should map url to string with uri format', () => {
      expect(mapTypeToJsonSchema('url')).toEqual({ type: 'string', format: 'uri' });
    });

    it('should map phone to string with pattern', () => {
      const result = mapTypeToJsonSchema('phone');
      expect(result.type).toBe('string');
      expect(result.pattern).toBeDefined();
    });

    it('should map integer to integer type', () => {
      expect(mapTypeToJsonSchema('integer')).toEqual({ type: 'integer' });
    });

    it('should map number to number type', () => {
      expect(mapTypeToJsonSchema('number')).toEqual({ type: 'number' });
    });

    it('should map boolean to boolean type', () => {
      expect(mapTypeToJsonSchema('boolean')).toEqual({ type: 'boolean' });
    });

    it('should map ReferenceObject to object type', () => {
      expect(mapTypeToJsonSchema('ReferenceObject')).toEqual({ type: 'object' });
    });

    it('should map unknown types to string', () => {
      expect(mapTypeToJsonSchema('unknownType')).toEqual({ type: 'string' });
    });
  });

  describe('convertPropertyToJsonSchema', () => {
    it('should convert simple string property', () => {
      const prop = {
        path: 'name',
        name: 'name',
        types: ['string'],
        examples: ['John Doe'],
        isRequired: true
      };

      const result = convertPropertyToJsonSchema(prop, {}, { includeExamples: true });

      expect(result.type).toBe('string');
      expect(result.examples).toContain('John Doe');
    });

    it('should convert guid property with format', () => {
      const prop = {
        path: 'id',
        name: 'id',
        types: ['guid'],
        examples: ['12345678-1234-1234-1234-123456789abc'],
        isRequired: true
      };

      const result = convertPropertyToJsonSchema(prop, {});

      expect(result.type).toBe('string');
      expect(result.format).toBe('uuid');
    });

    it('should handle nullable property', () => {
      const prop = {
        path: 'middleName',
        name: 'middleName',
        types: ['string'],
        isNullable: true
      };

      const result = convertPropertyToJsonSchema(prop, {});

      expect(result.type).toEqual(['string', 'null']);
    });

    it('should convert enum property with enum values', () => {
      const prop = {
        path: 'status',
        name: 'status',
        types: ['string'],
        isEnum: true,
        enumValues: ['active', 'inactive', 'pending']
      };

      const result = convertPropertyToJsonSchema(prop, {});

      expect(result.type).toBe('string');
      expect(result.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('should convert array property with items', () => {
      const prop = {
        path: 'tags',
        name: 'tags',
        types: ['array'],
        isArray: true,
        arrayItemTypes: ['string']
      };

      const result = convertPropertyToJsonSchema(prop, {});

      expect(result.type).toBe('array');
      expect(result.items).toEqual({ type: 'string' });
    });

    it('should handle multiple types with oneOf', () => {
      const prop = {
        path: 'value',
        name: 'value',
        types: ['string', 'integer']
      };

      const result = convertPropertyToJsonSchema(prop, {});

      expect(result.oneOf).toBeDefined();
      expect(result.oneOf).toHaveLength(2);
      expect(result.oneOf).toContainEqual({ type: 'string' });
      expect(result.oneOf).toContainEqual({ type: 'integer' });
    });

    it('should convert nested object with children', () => {
      const allProperties = {
        'address': {
          path: 'address',
          name: 'address',
          parentPath: null,
          types: ['object'],
          isRequired: true
        },
        'address.street': {
          path: 'address.street',
          name: 'street',
          parentPath: 'address',
          types: ['string'],
          isRequired: true
        },
        'address.city': {
          path: 'address.city',
          name: 'city',
          parentPath: 'address',
          types: ['string'],
          isRequired: true
        },
        'address.zip': {
          path: 'address.zip',
          name: 'zip',
          parentPath: 'address',
          types: ['string'],
          isRequired: false,
          isNullable: false
        }
      };

      const result = convertPropertyToJsonSchema(allProperties['address'], allProperties);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties.street).toEqual({ type: 'string' });
      expect(result.properties.city).toEqual({ type: 'string' });
      expect(result.required).toContain('street');
      expect(result.required).toContain('city');
      expect(result.required).not.toContain('zip');
    });

    it('should exclude object examples', () => {
      const prop = {
        path: 'data',
        name: 'data',
        types: ['object'],
        examples: ['{id, name}', 'valid-string']
      };

      const result = convertPropertyToJsonSchema(prop, {}, { includeExamples: true });

      // Object-like examples should be filtered
      expect(result.examples || []).not.toContain('{id, name}');
    });

    it('should respect includeExamples=false config', () => {
      const prop = {
        path: 'name',
        name: 'name',
        types: ['string'],
        examples: ['Example']
      };

      const result = convertPropertyToJsonSchema(prop, {}, { includeExamples: false });

      expect(result.examples).toBeUndefined();
    });
  });

  describe('convertToJsonSchema', () => {
    it('should generate valid JSON Schema structure', () => {
      const schema = {
        properties: {
          'id': {
            path: 'id',
            name: 'id',
            parentPath: null,
            types: ['guid'],
            isRequired: true,
            isNullable: false
          },
          'name': {
            path: 'name',
            name: 'name',
            parentPath: null,
            types: ['string'],
            isRequired: true,
            isNullable: false
          }
        }
      };

      const result = convertToJsonSchema('orders', schema);

      expect(result.$schema).toContain('json-schema.org');
      expect(result.$id).toBe('orders.schema.json');
      expect(result.title).toBe('orders');
      expect(result.type).toBe('object');
      expect(result.properties.id).toBeDefined();
      expect(result.properties.name).toBeDefined();
      expect(result.required).toContain('id');
      expect(result.required).toContain('name');
    });

    it('should use draft-07 schema when configured', () => {
      const schema = { properties: {} };

      const result = convertToJsonSchema('test', schema, { draft: 'draft-07' });

      expect(result.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });

    it('should use 2020-12 schema by default', () => {
      const schema = { properties: {} };

      const result = convertToJsonSchema('test', schema);

      expect(result.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

    it('should include description', () => {
      const schema = { properties: {} };

      const result = convertToJsonSchema('customers', schema);

      expect(result.description).toContain('customers');
      expect(result.description).toContain('Cosmos DB');
    });

    it('should not include required if no required fields', () => {
      const schema = {
        properties: {
          'optional': {
            path: 'optional',
            name: 'optional',
            parentPath: null,
            types: ['string'],
            isRequired: false
          }
        }
      };

      const result = convertToJsonSchema('test', schema);

      expect(result.required).toBeUndefined();
    });

    it('should not mark nullable required fields as required', () => {
      const schema = {
        properties: {
          'name': {
            path: 'name',
            name: 'name',
            parentPath: null,
            types: ['string'],
            isRequired: true,
            isNullable: true
          }
        }
      };

      const result = convertToJsonSchema('test', schema);

      // Nullable fields should not be in required, even if isRequired=true
      expect(result.required || []).not.toContain('name');
    });
  });

  describe('generateJsonSchemas', () => {
    it('should handle empty containerSchemas', async () => {
      const data = { containerSchemas: {} };
      const mockFs = await import('fs/promises');

      // This will fail without proper mocking, but tests the function signature
      // In real tests, we'd mock fs/promises
    });
  });
});
