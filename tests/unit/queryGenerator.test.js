import { describe, it, expect } from 'vitest';
import { generateSampleQueries, formatQueriesAsMarkdown } from '../../src/output/queryGenerator.js';

describe('queryGenerator', () => {
  describe('generateSampleQueries', () => {
    it('should generate basic queries for any container', () => {
      const schema = {
        properties: {
          id: { type: 'GUID' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      expect(queries.length).toBeGreaterThan(0);
      expect(queries.find(q => q.name === 'Select all documents')).toBeDefined();
      expect(queries.find(q => q.name === 'Select recent documents')).toBeDefined();
      expect(queries.find(q => q.name === 'Count documents')).toBeDefined();
    });

    it('should generate partition key query when partition key exists', () => {
      const schema = {
        containerInfo: {
          partitionKey: ['/storeId']
        },
        properties: {
          storeId: { type: 'GUID' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const pkQuery = queries.find(q => q.name.includes('partition key'));
      expect(pkQuery).toBeDefined();
      expect(pkQuery.query).toContain('storeId');
    });

    it('should generate query by id field', () => {
      const schema = {
        properties: {
          id: { type: 'GUID' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const idQuery = queries.find(q => q.name === 'Get document by ID');
      expect(idQuery).toBeDefined();
      expect(idQuery.query).toContain('c.id =');
    });

    it('should generate query by foreign key fields', () => {
      const schema = {
        properties: {
          customerId: { type: 'GUID' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const fkQuery = queries.find(q => q.name === 'Query by customerId');
      expect(fkQuery).toBeDefined();
      expect(fkQuery.query).toContain('c.customerId =');
    });

    it('should generate enum filter query', () => {
      const schema = {
        properties: {
          status: {
            type: 'String',
            enumValues: ['pending', 'shipped', 'delivered']
          }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const enumQuery = queries.find(q => q.name === 'Filter by status');
      expect(enumQuery).toBeDefined();
      expect(enumQuery.query).toContain('c.status =');
      expect(enumQuery.description).toContain('pending');
    });

    it('should generate date range query for DateTime fields', () => {
      const schema = {
        properties: {
          createdAt: { type: 'DateTime' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const dateQuery = queries.find(q => q.name.includes('Date range'));
      expect(dateQuery).toBeDefined();
      expect(dateQuery.query).toContain('>=');
      expect(dateQuery.query).toContain('<');
    });

    it('should generate IS_DEFINED query for optional fields', () => {
      const schema = {
        properties: {
          notes: { type: 'String', optionality: 'optional' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const optionalQuery = queries.find(q => q.name.includes('with notes'));
      expect(optionalQuery).toBeDefined();
      expect(optionalQuery.query).toContain('IS_DEFINED');
    });

    it('should generate aggregate query for numeric fields', () => {
      const schema = {
        properties: {
          total: { type: 'Number' }
        }
      };

      const queries = generateSampleQueries('orders', schema);

      const aggQuery = queries.find(q => q.name.includes('Aggregate'));
      expect(aggQuery).toBeDefined();
      expect(aggQuery.query).toContain('SUM');
      expect(aggQuery.query).toContain('AVG');
    });
  });

  describe('formatQueriesAsMarkdown', () => {
    it('should format queries as markdown', () => {
      const queries = [
        {
          name: 'Test query',
          description: 'A test query',
          query: 'SELECT * FROM c'
        }
      ];

      const md = formatQueriesAsMarkdown(queries);

      expect(md).toContain('#### Test query');
      expect(md).toContain('A test query');
      expect(md).toContain('```sql');
      expect(md).toContain('SELECT * FROM c');
      expect(md).toContain('```');
    });

    it('should format multiple queries', () => {
      const queries = [
        { name: 'Query 1', description: 'Desc 1', query: 'SELECT 1' },
        { name: 'Query 2', description: 'Desc 2', query: 'SELECT 2' }
      ];

      const md = formatQueriesAsMarkdown(queries);

      expect(md).toContain('Query 1');
      expect(md).toContain('Query 2');
    });
  });
});
