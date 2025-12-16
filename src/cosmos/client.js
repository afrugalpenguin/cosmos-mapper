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
