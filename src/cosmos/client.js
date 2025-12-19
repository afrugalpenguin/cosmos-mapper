import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Creates an authenticated Cosmos DB client.
 * Uses key-based auth if COSMOS_KEY is provided, otherwise Azure AD.
 */
export function createCosmosClient(endpoint, key) {
  if (key) {
    // Key-based authentication
    return new CosmosClient({ endpoint, key });
  } else {
    // Azure AD / Managed Identity authentication
    const credential = new DefaultAzureCredential();
    return new CosmosClient({ endpoint, aadCredentials: credential });
  }
}

/**
 * Lists all databases in the Cosmos account.
 * @returns {Promise<string[]>} Array of database names
 */
export async function listDatabases(client) {
  const { resources } = await client.databases.readAll().fetchAll();
  return resources.map(db => db.id);
}

/**
 * Lists all containers in a database.
 * @returns {Promise<string[]>} Array of container names
 */
export async function listContainers(client, databaseName) {
  const database = client.database(databaseName);
  const { resources } = await database.containers.readAll().fetchAll();
  return resources.map(container => container.id);
}

/**
 * Samples the most recent N documents from a container.
 * @param {CosmosClient} client - The Cosmos client
 * @param {string} databaseName - Database name
 * @param {string} containerName - Container name
 * @param {number} limit - Maximum documents to sample (default 100)
 * @returns {Promise<object[]>} Array of sampled documents
 */
export async function sampleDocuments(client, databaseName, containerName, limit = 100) {
  const container = client.database(databaseName).container(containerName);

  const query = {
    query: 'select * from c order by c._ts desc offset 0 limit @limit',
    parameters: [{ name: '@limit', value: limit }]
  };

  try {
    const { resources } = await container.items.query(query).fetchAll();
    return resources;
  } catch (error) {
    // Handle empty containers or access issues gracefully
    if (error.code === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Gets container metadata including partition key.
 * @returns {Promise<object>} Container properties
 */
export async function getContainerInfo(client, databaseName, containerName) {
  const container = client.database(databaseName).container(containerName);
  const { resource } = await container.read();
  return {
    id: resource.id,
    partitionKey: resource.partitionKey?.paths || [],
    indexingProduct: resource.indexingProduct
  };
}

/**
 * Execute a custom query against a container.
 * @param {CosmosClient} client - The Cosmos client
 * @param {string} databaseName - Database name
 * @param {string} containerName - Container name
 * @param {object} querySpec - Query specification with query and parameters
 * @returns {Promise<object[]>} Query results
 */
export async function queryContainer(client, databaseName, containerName, querySpec) {
  const container = client.database(databaseName).container(containerName);
  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources;
}

/**
 * Get distinct values for a property path.
 * Used for referential integrity validation.
 * @param {CosmosClient} client - The Cosmos client
 * @param {string} databaseName - Database name
 * @param {string} containerName - Container name
 * @param {string} propertyPath - Property path (e.g., 'CustomerId' or 'Customer.Id')
 * @param {number} limit - Maximum values to retrieve
 * @returns {Promise<any[]>} Array of distinct values
 */
export async function getDistinctValues(client, databaseName, containerName, propertyPath, limit = 1000) {
  // Handle nested property paths by building accessor
  const accessor = propertyPath.split('.').reduce((acc, part) => `${acc}["${part}"]`, 'c');

  const querySpec = {
    query: `SELECT DISTINCT VALUE ${accessor} FROM c WHERE IS_DEFINED(${accessor}) OFFSET 0 LIMIT @limit`,
    parameters: [{ name: '@limit', value: limit }]
  };

  try {
    return await queryContainer(client, databaseName, containerName, querySpec);
  } catch (error) {
    // Return empty array on query errors (e.g., property doesn't exist)
    if (error.code === 400) {
      return [];
    }
    throw error;
  }
}

/**
 * Check which IDs exist in a container.
 * @param {CosmosClient} client - The Cosmos client
 * @param {string} databaseName - Database name
 * @param {string} containerName - Container name
 * @param {string[]} ids - Array of IDs to check
 * @returns {Promise<string[]>} Array of IDs that exist
 */
export async function checkIdsExist(client, databaseName, containerName, ids) {
  if (!ids || ids.length === 0) return [];

  // Filter out null/undefined values
  const validIds = ids.filter(id => id != null);
  if (validIds.length === 0) return [];

  // Batch into chunks to avoid query size limits
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < validIds.length; i += chunkSize) {
    const chunk = validIds.slice(i, i + chunkSize);
    const querySpec = {
      query: `SELECT VALUE c.id FROM c WHERE c.id IN (${chunk.map((_, j) => `@id${j}`).join(',')})`,
      parameters: chunk.map((id, j) => ({ name: `@id${j}`, value: id }))
    };

    try {
      const chunkResults = await queryContainer(client, databaseName, containerName, querySpec);
      results.push(...chunkResults);
    } catch (error) {
      // Skip chunk on error, continue with others
      if (error.code !== 400) {
        throw error;
      }
    }
  }

  return results;
}
