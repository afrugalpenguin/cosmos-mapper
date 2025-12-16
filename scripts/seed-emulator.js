#!/usr/bin/env node

/**
 * Seeds the Cosmos DB Emulator with sample data for demo purposes.
 * Run: node scripts/seed-emulator.js
 */

import { CosmosClient } from '@azure/cosmos';

// Emulator defaults
const EMULATOR_ENDPOINT = 'https://localhost:8081';
const EMULATOR_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

// Disable TLS verification for emulator's self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new CosmosClient({
  endpoint: EMULATOR_ENDPOINT,
  key: EMULATOR_KEY
});

// Sample data - all synthetic/fake
const sampleData = {
  'ecommerce-store': {
    orders: [
      {
        id: 'order-001',
        StoreId: 'store-001',
        Reference: 'CLM-2024-0001',
        Description: 'Property damage from water leak',
        DateOfLoss: { Value: '2024-01-15T00:00:00Z', Epoch: 1705276800 },
        Product: { Id: 'product-001', Reference: 'PRD-2024-001' },
        Event: { Id: 'event-001', Description: 'Winter Storm Alpha', Code: 'EVT-001' },
        Status: { Id: 1, Name: 'Open', Code: 'OPN' },
        Insured: 'Acme Corporation',
        Country: { Id: 1, Name: 'United Kingdom', Code: 'GB' },
        CreatedOn: { Value: '2024-01-20T10:00:00Z', Epoch: 1705744800 },
        IsDeleted: false
      },
      {
        id: 'order-002',
        StoreId: 'store-001',
        Reference: 'CLM-2024-0002',
        Description: 'Vehicle collision damage',
        DateOfLoss: { Value: '2024-02-10T00:00:00Z', Epoch: 1707523200 },
        Product: { Id: 'product-002', Reference: 'PRD-2024-002' },
        Event: null,
        Status: { Id: 2, Name: 'Closed', Code: 'CLS' },
        Insured: 'Widget Industries',
        Country: { Id: 2, Name: 'United States', Code: 'US' },
        State: { Id: 5, Name: 'California', Code: 'CA' },
        CreatedOn: { Value: '2024-02-12T14:30:00Z', Epoch: 1707747000 },
        IsDeleted: false
      },
      {
        id: 'order-003',
        StoreId: 'store-001',
        Reference: 'CLM-2024-0003',
        Description: 'Liability order - slip and fall',
        DateOfLoss: { Value: '2024-03-05T00:00:00Z', Epoch: 1709596800 },
        Product: { Id: 'product-001', Reference: 'PRD-2024-001' },
        Event: { Id: 'event-002', Description: 'Q1 Incidents', Code: 'EVT-002' },
        Status: { Id: 1, Name: 'Open', Code: 'OPN' },
        Insured: 'Acme Corporation',
        Country: { Id: 1, Name: 'United Kingdom', Code: 'GB' },
        CreatedOn: { Value: '2024-03-06T09:15:00Z', Epoch: 1709715300 },
        IsDeleted: false
      }
    ],
    categories: [
      {
        id: 'product-001',
        StoreId: 'store-001',
        Reference: 'PRD-2024-001',
        Insured: 'Acme Corporation',
        InceptionDate: { Value: '2024-01-01T00:00:00Z', Epoch: 1704067200 },
        ExpiryDate: { Value: '2025-01-01T00:00:00Z', Epoch: 1735689600 },
        Limit: 1000000,
        Excess: 10000,
        Currency: { Id: 1, Name: 'British Pound', Code: 'GBP' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Product: { Id: 'prod-001', Name: 'Commercial Property', Code: 'CP' },
        Contract: { Id: 'contract-001', Reference: 'CON-2024-001' },
        CreatedOn: { Value: '2023-12-15T10:00:00Z', Epoch: 1702634400 }
      },
      {
        id: 'product-002',
        StoreId: 'store-001',
        Reference: 'PRD-2024-002',
        Insured: 'Widget Industries',
        InceptionDate: { Value: '2024-01-15T00:00:00Z', Epoch: 1705276800 },
        ExpiryDate: { Value: '2025-01-15T00:00:00Z', Epoch: 1736899200 },
        Limit: 500000,
        Excess: 5000,
        Currency: { Id: 2, Name: 'US Dollar', Code: 'USD' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Product: { Id: 'prod-002', Name: 'Motor Fleet', Code: 'MF' },
        Contract: { Id: 'contract-001', Reference: 'CON-2024-001' },
        CreatedOn: { Value: '2024-01-10T14:00:00Z', Epoch: 1704895200 }
      }
    ],
    events: [
      {
        id: 'event-001',
        StoreId: 'store-001',
        Code: 'EVT-001',
        Description: 'Winter Storm Alpha',
        DateOfEvent: { Value: '2024-01-14T00:00:00Z', Epoch: 1705190400 },
        Country: { Id: 1, Name: 'United Kingdom', Code: 'GB' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        CreatedOn: { Value: '2024-01-14T12:00:00Z', Epoch: 1705233600 }
      },
      {
        id: 'event-002',
        StoreId: 'store-001',
        Code: 'EVT-002',
        Description: 'Q1 Incidents',
        DateOfEvent: { Value: '2024-03-01T00:00:00Z', Epoch: 1709251200 },
        Country: { Id: 1, Name: 'United Kingdom', Code: 'GB' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        CreatedOn: { Value: '2024-03-01T08:00:00Z', Epoch: 1709280000 }
      }
    ],
    movements: [
      {
        id: 'mov-001',
        StoreId: 'store-001',
        OrderId: 'order-001',
        Type: { Id: 1, Name: 'Reserve', Code: 'RES' },
        Amount: 25000,
        Currency: { Id: 1, Name: 'British Pound', Code: 'GBP' },
        TransactionDate: { Value: '2024-01-21T00:00:00Z', Epoch: 1705795200 },
        CreatedOn: { Value: '2024-01-21T11:00:00Z', Epoch: 1705834800 }
      },
      {
        id: 'mov-002',
        StoreId: 'store-001',
        OrderId: 'order-001',
        Type: { Id: 2, Name: 'Payment', Code: 'PAY' },
        Amount: 15000,
        Currency: { Id: 1, Name: 'British Pound', Code: 'GBP' },
        TransactionDate: { Value: '2024-02-15T00:00:00Z', Epoch: 1707955200 },
        CreatedOn: { Value: '2024-02-15T10:30:00Z', Epoch: 1707993000 }
      }
    ],
    premiums: [
      {
        id: 'prem-001',
        StoreId: 'store-001',
        Product: { Id: 'product-001', Reference: { Value: 'PRD-2024-001', Lower: 'pol-2024-001' } },
        Amount: 50000,
        Currency: { Id: 1, Name: 'British Pound', Code: 'GBP' },
        TransactionType: { Id: 1, Name: 'Gross Premium', Code: 'GRP' },
        TransactionDate: { Value: '2024-01-05T00:00:00Z', Epoch: 1704412800 },
        CreatedOn: { Value: '2024-01-05T09:00:00Z', Epoch: 1704445200 }
      }
    ],
    importlogs: [
      {
        id: 'imp-001',
        StoreId: 'store-001',
        FileName: 'orders_jan_2024.csv',
        Status: { Id: 1, Name: 'Completed', Code: 'DONE' },
        RecordsProcessed: 150,
        RecordsFailed: 2,
        StartedOn: { Value: '2024-01-20T08:00:00Z', Epoch: 1705737600 },
        CompletedOn: { Value: '2024-01-20T08:15:00Z', Epoch: 1705738500 }
      }
    ]
  },
  'sample-platform': {
    stores: [
      {
        id: 'store-001',
        Name: 'Demo Insurance Ltd',
        Code: 'DEMO',
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        CreatedOn: { Value: '2023-01-01T00:00:00Z', Epoch: 1672531200 },
        Settings: { MaxUsers: 50, AllowImport: true }
      },
      {
        id: 'store-002',
        Name: 'Test Underwriters',
        Code: 'TEST',
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        CreatedOn: { Value: '2023-06-01T00:00:00Z', Epoch: 1685577600 },
        Settings: { MaxUsers: 25, AllowImport: true }
      }
    ],
    contracts: [
      {
        id: 'contract-001',
        StoreId: 'store-001',
        Reference: 'CON-2024-001',
        Broker: { Id: 'broker-001', Name: 'Sample Brokers Ltd', Code: 'SBL' },
        Share: 100,
        InceptionDate: { Value: '2024-01-01T00:00:00Z', Epoch: 1704067200 },
        CreatedOn: { Value: '2023-12-01T10:00:00Z', Epoch: 1701424800 }
      }
    ],
    security: [
      {
        id: 'sec-001',
        UserId: 'user-001',
        StoreId: 'store-001',
        Role: { Id: 1, Name: 'Administrator', Code: 'ADMIN' },
        Permissions: ['read', 'write', 'delete', 'admin'],
        CreatedOn: { Value: '2023-01-15T09:00:00Z', Epoch: 1673773200 }
      }
    ],
    dictionaries: [
      {
        id: 'dict-001',
        Type: 'Status',
        Code: 'OPN',
        Name: 'Open',
        SortOrder: 1,
        IsActive: true
      },
      {
        id: 'dict-002',
        Type: 'Status',
        Code: 'CLS',
        Name: 'Closed',
        SortOrder: 2,
        IsActive: true
      },
      {
        id: 'dict-003',
        Type: 'Country',
        Code: 'GB',
        Name: 'United Kingdom',
        SortOrder: 1,
        IsActive: true
      }
    ]
  }
};

async function seedDatabase() {
  console.log('');
  console.log('Cosmos DB Emulator Seeder');
  console.log('=========================');
  console.log('');

  try {
    // Test connection
    console.log('Connecting to emulator...');
    const { resources: dbs } = await client.databases.readAll().fetchAll();
    console.log(`Connected. Found ${dbs.length} existing databases.`);
    console.log('');

    // Create databases and containers
    for (const [dbName, containers] of Object.entries(sampleData)) {
      console.log(`Creating database: ${dbName}`);

      const { database } = await client.databases.createIfNotExists({ id: dbName });

      for (const [containerName, documents] of Object.entries(containers)) {
        console.log(`  Creating container: ${containerName}`);

        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/id'] }
        });

        // Insert documents
        for (const doc of documents) {
          try {
            await container.items.create(doc);
            process.stdout.write('.');
          } catch (err) {
            if (err.code === 409) {
              // Already exists, skip
              process.stdout.write('s');
            } else {
              throw err;
            }
          }
        }
        console.log(` (${documents.length} docs)`);
      }
      console.log('');
    }

    console.log('Done! Sample data seeded successfully.');
    console.log('');
    console.log('To run cosmos-mapper against this data:');
    console.log('');
    console.log('  1. Update .env:');
    console.log('     COSMOS_ENDPOINT=https://localhost:8081');
    console.log('     COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==');
    console.log('     STORE_DATABASE=ecommerce-store');
    console.log('     PLATFORM_DATABASE=sample-platform');
    console.log('');
    console.log('  2. Run: npm start');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Make sure the Cosmos DB Emulator is running.');
    console.error('Download: https://aka.ms/cosmosdb-emulator');
    console.error('');
    process.exit(1);
  }
}

seedDatabase();
