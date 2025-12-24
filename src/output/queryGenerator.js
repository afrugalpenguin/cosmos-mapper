/**
 * Generates sample SQL queries for Cosmos DB containers based on schema.
 */

/**
 * Generate sample queries for a container.
 * @param {string} containerName - Container name
 * @param {object} schema - Inferred schema
 * @returns {object[]} Array of sample queries with descriptions
 */
export function generateSampleQueries(containerName, schema) {
  const queries = [];
  const properties = schema.properties || {};
  const partitionKey = schema.containerInfo?.partitionKey?.[0]?.replace(/^\//, '') || null;

  // 1. Basic select all
  queries.push({
    name: 'Select all documents',
    description: 'Retrieve all documents (use with OFFSET/LIMIT for large containers)',
    query: 'SELECT * FROM c'
  });

  // 2. Select with limit
  queries.push({
    name: 'Select recent documents',
    description: 'Get the 10 most recent documents by timestamp',
    query: 'SELECT * FROM c ORDER BY c._ts DESC OFFSET 0 LIMIT 10'
  });

  // 3. Count query
  queries.push({
    name: 'Count documents',
    description: 'Get total document count',
    query: 'SELECT VALUE COUNT(1) FROM c'
  });

  // 4. Partition key query (if partition key exists and is in schema)
  if (partitionKey && properties[partitionKey]) {
    const pkType = properties[partitionKey].type;
    const exampleValue = getExampleValue(pkType, partitionKey);
    queries.push({
      name: `Query by partition key (${partitionKey})`,
      description: 'Efficient single-partition query',
      query: `SELECT * FROM c WHERE c.${partitionKey} = ${exampleValue}`
    });
  }

  // 5. Query by ID field patterns
  const idFields = Object.entries(properties)
    .filter(([name, prop]) => name.endsWith('Id') || name === 'id')
    .slice(0, 2);

  for (const [fieldName, prop] of idFields) {
    if (fieldName === 'id') {
      queries.push({
        name: 'Get document by ID',
        description: 'Point read by document ID',
        query: `SELECT * FROM c WHERE c.id = "your-document-id"`
      });
    } else {
      const exampleValue = getExampleValue(prop.type, fieldName);
      queries.push({
        name: `Query by ${fieldName}`,
        description: `Find documents by ${fieldName}`,
        query: `SELECT * FROM c WHERE c.${fieldName} = ${exampleValue}`
      });
    }
  }

  // 6. Query by enum fields
  const enumFields = Object.entries(properties)
    .filter(([_, prop]) => prop.enumValues && prop.enumValues.length > 0)
    .slice(0, 2);

  for (const [fieldName, prop] of enumFields) {
    const firstValue = prop.enumValues[0];
    queries.push({
      name: `Filter by ${fieldName}`,
      description: `Filter by ${fieldName} (values: ${prop.enumValues.slice(0, 3).join(', ')}${prop.enumValues.length > 3 ? '...' : ''})`,
      query: `SELECT * FROM c WHERE c.${fieldName} = "${firstValue}"`
    });
  }

  // 7. Date range query (if DateTime fields exist)
  const dateFields = Object.entries(properties)
    .filter(([_, prop]) => prop.type === 'DateTime' || (Array.isArray(prop.type) && prop.type.includes('DateTime')))
    .slice(0, 1);

  for (const [fieldName] of dateFields) {
    queries.push({
      name: `Date range query (${fieldName})`,
      description: 'Filter by date range',
      query: `SELECT * FROM c WHERE c.${fieldName} >= "2024-01-01T00:00:00Z" AND c.${fieldName} < "2024-02-01T00:00:00Z"`
    });
  }

  // 8. Check for null/missing fields
  const optionalFields = Object.entries(properties)
    .filter(([_, prop]) => prop.optionality === 'optional' || prop.optionality === 'sparse')
    .slice(0, 1);

  for (const [fieldName] of optionalFields) {
    queries.push({
      name: `Find documents with ${fieldName}`,
      description: 'Filter for documents where optional field exists',
      query: `SELECT * FROM c WHERE IS_DEFINED(c.${fieldName})`
    });
  }

  // 9. Aggregation query
  const numericFields = Object.entries(properties)
    .filter(([_, prop]) => prop.type === 'Number' || prop.type === 'Integer')
    .slice(0, 1);

  if (numericFields.length > 0) {
    const [fieldName] = numericFields[0];
    queries.push({
      name: `Aggregate ${fieldName}`,
      description: 'Calculate sum and average',
      query: `SELECT VALUE { "total": SUM(c.${fieldName}), "avg": AVG(c.${fieldName}), "count": COUNT(1) } FROM c`
    });
  }

  return queries;
}

/**
 * Get an example value for a given type.
 */
function getExampleValue(type, fieldName) {
  const normalizedType = Array.isArray(type) ? type[0] : type;

  switch (normalizedType) {
    case 'GUID':
      return '"00000000-0000-0000-0000-000000000000"';
    case 'Integer':
    case 'Number':
      return '123';
    case 'Boolean':
      return 'true';
    case 'DateTime':
      return '"2024-01-01T00:00:00Z"';
    default:
      return `"your-${fieldName.toLowerCase()}-value"`;
  }
}

/**
 * Format queries as markdown.
 */
export function formatQueriesAsMarkdown(queries) {
  let md = '';

  for (const query of queries) {
    md += `#### ${query.name}\n\n`;
    md += `${query.description}\n\n`;
    md += '```sql\n';
    md += query.query + '\n';
    md += '```\n\n';
  }

  return md;
}
