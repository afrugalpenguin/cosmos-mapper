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

// Sample data - e-commerce domain (completely synthetic)
const sampleData = {
  'ecommerce-store': {
    products: [
      {
        id: 'prod-001',
        StoreId: 'store-001',
        SKU: 'WIDGET-BLU-LG',
        Name: 'Blue Widget (Large)',
        Description: 'A large blue widget for all your widget needs',
        Category: { Id: 1, Name: 'Widgets', Code: 'WDG' },
        Price: { Amount: 29.99, Currency: { Id: 1, Name: 'US Dollar', Code: 'USD' } },
        Stock: 150,
        Supplier: { Id: 'sup-001', Name: 'Widget Co', Code: 'WDGCO' },
        CreatedOn: { Value: '2024-01-10T10:00:00Z', Epoch: 1704880800 },
        IsActive: true
      },
      {
        id: 'prod-002',
        StoreId: 'store-001',
        SKU: 'GADGET-RED-SM',
        Name: 'Red Gadget (Small)',
        Description: 'A compact red gadget',
        Category: { Id: 2, Name: 'Gadgets', Code: 'GDG' },
        Price: { Amount: 49.99, Currency: { Id: 1, Name: 'US Dollar', Code: 'USD' } },
        Stock: 75,
        Supplier: { Id: 'sup-002', Name: 'Gadget World', Code: 'GDGW' },
        CreatedOn: { Value: '2024-01-12T14:30:00Z', Epoch: 1705070600 },
        IsActive: true
      },
      {
        id: 'prod-003',
        StoreId: 'store-001',
        SKU: 'GIZMO-GRN-MD',
        Name: 'Green Gizmo (Medium)',
        Description: 'A medium-sized green gizmo with extra features',
        Category: { Id: 3, Name: 'Gizmos', Code: 'GZM' },
        Price: { Amount: 99.99, Currency: { Id: 2, Name: 'Euro', Code: 'EUR' } },
        Stock: 30,
        Supplier: { Id: 'sup-001', Name: 'Widget Co', Code: 'WDGCO' },
        Tags: ['featured', 'new-arrival'],
        CreatedOn: { Value: '2024-02-01T09:00:00Z', Epoch: 1706778000 },
        IsActive: true
      }
    ],
    orders: [
      {
        id: 'ord-001',
        StoreId: 'store-001',
        OrderNumber: 'ORD-2024-0001',
        Customer: { Id: 'cust-001', Name: 'Alice Smith', Email: 'alice@example.com' },
        Status: { Id: 1, Name: 'Pending', Code: 'PND' },
        Items: [
          { ProductId: 'prod-001', SKU: 'WIDGET-BLU-LG', Quantity: 2, UnitPrice: 29.99 },
          { ProductId: 'prod-002', SKU: 'GADGET-RED-SM', Quantity: 1, UnitPrice: 49.99 }
        ],
        Subtotal: 109.97,
        Tax: 9.90,
        Total: 119.87,
        ShippingAddress: {
          Street: '123 Main Street',
          City: 'Springfield',
          State: 'IL',
          PostalCode: '62701',
          Country: { Id: 1, Name: 'United States', Code: 'US' }
        },
        PaymentMethod: { Id: 1, Name: 'Credit Card', Code: 'CC' },
        OrderDate: { Value: '2024-02-15T16:30:00Z', Epoch: 1708014600 },
        CreatedOn: { Value: '2024-02-15T16:30:00Z', Epoch: 1708014600 }
      },
      {
        id: 'ord-002',
        StoreId: 'store-001',
        OrderNumber: 'ORD-2024-0002',
        Customer: { Id: 'cust-002', Name: 'Bob Jones', Email: 'bob@example.com' },
        Status: { Id: 2, Name: 'Shipped', Code: 'SHP' },
        Items: [
          { ProductId: 'prod-003', SKU: 'GIZMO-GRN-MD', Quantity: 1, UnitPrice: 99.99 }
        ],
        Subtotal: 99.99,
        Tax: 9.00,
        Total: 108.99,
        ShippingAddress: {
          Street: '456 Oak Avenue',
          City: 'Portland',
          State: 'OR',
          PostalCode: '97201',
          Country: { Id: 1, Name: 'United States', Code: 'US' }
        },
        PaymentMethod: { Id: 2, Name: 'PayPal', Code: 'PP' },
        TrackingNumber: 'TRK-123456789',
        OrderDate: { Value: '2024-02-18T10:15:00Z', Epoch: 1708251300 },
        ShippedDate: { Value: '2024-02-19T14:00:00Z', Epoch: 1708351200 },
        CreatedOn: { Value: '2024-02-18T10:15:00Z', Epoch: 1708251300 }
      }
    ],
    customers: [
      {
        id: 'cust-001',
        StoreId: 'store-001',
        Email: 'alice@example.com',
        Name: 'Alice Smith',
        Phone: '+1-555-0101',
        Addresses: [
          {
            Type: 'shipping',
            Street: '123 Main Street',
            City: 'Springfield',
            State: 'IL',
            PostalCode: '62701',
            Country: { Id: 1, Name: 'United States', Code: 'US' },
            IsDefault: true
          }
        ],
        MemberSince: { Value: '2023-06-15T00:00:00Z', Epoch: 1686787200 },
        TotalOrders: 5,
        TotalSpent: 450.50,
        LoyaltyTier: { Id: 2, Name: 'Silver', Code: 'SLV' },
        CreatedOn: { Value: '2023-06-15T09:00:00Z', Epoch: 1686819600 }
      },
      {
        id: 'cust-002',
        StoreId: 'store-001',
        Email: 'bob@example.com',
        Name: 'Bob Jones',
        Phone: '+1-555-0102',
        Addresses: [
          {
            Type: 'shipping',
            Street: '456 Oak Avenue',
            City: 'Portland',
            State: 'OR',
            PostalCode: '97201',
            Country: { Id: 1, Name: 'United States', Code: 'US' },
            IsDefault: true
          }
        ],
        MemberSince: { Value: '2024-01-20T00:00:00Z', Epoch: 1705708800 },
        TotalOrders: 1,
        TotalSpent: 108.99,
        LoyaltyTier: { Id: 1, Name: 'Bronze', Code: 'BRZ' },
        CreatedOn: { Value: '2024-01-20T11:30:00Z', Epoch: 1705750200 }
      }
    ],
    reviews: [
      {
        id: 'rev-001',
        StoreId: 'store-001',
        ProductId: 'prod-001',
        CustomerId: 'cust-001',
        Rating: 5,
        Title: 'Great widget!',
        Comment: 'This widget exceeded my expectations. Highly recommend.',
        Verified: true,
        HelpfulVotes: 12,
        CreatedOn: { Value: '2024-02-20T08:00:00Z', Epoch: 1708416000 }
      },
      {
        id: 'rev-002',
        StoreId: 'store-001',
        ProductId: 'prod-002',
        CustomerId: 'cust-002',
        Rating: 4,
        Title: 'Good gadget, minor issues',
        Comment: 'Works well overall but packaging could be better.',
        Verified: true,
        HelpfulVotes: 3,
        CreatedOn: { Value: '2024-02-21T15:30:00Z', Epoch: 1708529400 }
      }
    ],
    inventory: [
      {
        id: 'inv-001',
        StoreId: 'store-001',
        ProductId: 'prod-001',
        WarehouseId: 'wh-001',
        Quantity: 100,
        ReservedQuantity: 5,
        ReorderLevel: 20,
        LastRestocked: { Value: '2024-02-01T00:00:00Z', Epoch: 1706745600 },
        UpdatedOn: { Value: '2024-02-15T17:00:00Z', Epoch: 1708016400 }
      },
      {
        id: 'inv-002',
        StoreId: 'store-001',
        ProductId: 'prod-002',
        WarehouseId: 'wh-001',
        Quantity: 50,
        ReservedQuantity: 0,
        ReorderLevel: 15,
        LastRestocked: { Value: '2024-01-15T00:00:00Z', Epoch: 1705276800 },
        UpdatedOn: { Value: '2024-02-10T09:00:00Z', Epoch: 1707555600 }
      }
    ]
  },
  'ecommerce-platform': {
    stores: [
      {
        id: 'store-001',
        Name: 'Demo Shop',
        Code: 'DEMO',
        URL: 'https://demo.example.com',
        Owner: { Id: 'user-001', Name: 'Demo Admin', Email: 'admin@example.com' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Plan: { Id: 2, Name: 'Professional', Code: 'PRO' },
        Settings: {
          Currency: 'USD',
          Timezone: 'America/New_York',
          TaxRate: 9.0
        },
        CreatedOn: { Value: '2023-01-01T00:00:00Z', Epoch: 1672531200 }
      },
      {
        id: 'store-002',
        Name: 'Test Store',
        Code: 'TEST',
        URL: 'https://test.example.com',
        Owner: { Id: 'user-002', Name: 'Test User', Email: 'test@example.com' },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Plan: { Id: 1, Name: 'Starter', Code: 'STR' },
        Settings: {
          Currency: 'EUR',
          Timezone: 'Europe/London',
          TaxRate: 20.0
        },
        CreatedOn: { Value: '2023-06-15T00:00:00Z', Epoch: 1686787200 }
      }
    ],
    suppliers: [
      {
        id: 'sup-001',
        Name: 'Widget Co',
        Code: 'WDGCO',
        ContactEmail: 'orders@widgetco.example.com',
        ContactPhone: '+1-555-1000',
        Address: {
          Street: '100 Industrial Way',
          City: 'Chicago',
          State: 'IL',
          PostalCode: '60601',
          Country: { Id: 1, Name: 'United States', Code: 'US' }
        },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Rating: 4.5,
        CreatedOn: { Value: '2022-01-01T00:00:00Z', Epoch: 1640995200 }
      },
      {
        id: 'sup-002',
        Name: 'Gadget World',
        Code: 'GDGW',
        ContactEmail: 'sales@gadgetworld.example.com',
        ContactPhone: '+1-555-2000',
        Address: {
          Street: '200 Tech Boulevard',
          City: 'San Jose',
          State: 'CA',
          PostalCode: '95101',
          Country: { Id: 1, Name: 'United States', Code: 'US' }
        },
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        Rating: 4.2,
        CreatedOn: { Value: '2022-06-01T00:00:00Z', Epoch: 1654041600 }
      }
    ],
    warehouses: [
      {
        id: 'wh-001',
        Name: 'Main Warehouse',
        Code: 'MAIN',
        Address: {
          Street: '500 Logistics Drive',
          City: 'Memphis',
          State: 'TN',
          PostalCode: '38118',
          Country: { Id: 1, Name: 'United States', Code: 'US' }
        },
        Capacity: 10000,
        CurrentStock: 3500,
        Status: { Id: 1, Name: 'Active', Code: 'ACT' },
        CreatedOn: { Value: '2022-01-01T00:00:00Z', Epoch: 1640995200 }
      }
    ],
    categories: [
      {
        id: 'cat-001',
        Code: 'WDG',
        Name: 'Widgets',
        Description: 'Various widgets for home and office',
        ParentId: null,
        SortOrder: 1,
        IsActive: true
      },
      {
        id: 'cat-002',
        Code: 'GDG',
        Name: 'Gadgets',
        Description: 'Electronic gadgets and accessories',
        ParentId: null,
        SortOrder: 2,
        IsActive: true
      },
      {
        id: 'cat-003',
        Code: 'GZM',
        Name: 'Gizmos',
        Description: 'Specialty gizmos and tools',
        ParentId: null,
        SortOrder: 3,
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
