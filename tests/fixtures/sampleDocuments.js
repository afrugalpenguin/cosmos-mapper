/**
 * Sample documents and test data for unit tests.
 */

// Valid GUID examples
export const validGuids = [
  '12345678-1234-1234-1234-123456789abc',
  'ABCDEF01-2345-6789-ABCD-EF0123456789',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff'
];

// Invalid GUID examples
export const invalidGuids = [
  '12345678-1234-1234-1234-123456789',     // Too short
  '12345678-1234-1234-1234-123456789abcde', // Too long
  '12345678123412341234123456789abc',       // No hyphens
  'gggggggg-gggg-gggg-gggg-gggggggggggg',  // Invalid chars
  '12345678-1234-1234-1234'                 // Missing segment
];

// Valid datetime examples
export const validDatetimes = [
  '2024-01-15',
  '2024-01-15T10:30:00',
  '2024-01-15T10:30:00Z',
  '2024-01-15T10:30:00.123Z',
  '2024-01-15T10:30:00+05:00',
  '2024-01-15T10:30:00-08:00'
];

// Invalid datetime examples
export const invalidDatetimes = [
  '2024/01/15',
  '15-01-2024',
  'Jan 15, 2024',
  '2024-1-15',
  '2024-01-15 10:30:00'  // Space instead of T
];

// Object pattern examples
export const objectPatterns = {
  dateTimeObject: {
    Value: '2024-01-15T10:30:00Z',
    Epoch: 1705315800000
  },
  referenceObject: {
    Id: '12345678-1234-1234-1234-123456789abc',
    Name: 'Test Name',
    Code: 'TEST01'
  },
  referenceObjectWithExtras: {
    Id: '12345678-1234-1234-1234-123456789abc',
    Name: 'Test Name',
    Code: 'TEST01',
    Description: 'Extra field'
  },
  lookupObject: {
    Id: 42,
    Name: 'Lookup Name',
    Code: 'LOOKUP01'
  },
  caseInsensitiveString: {
    Value: 'Test Value',
    Lower: 'test value'
  },
  simpleReference: {
    Id: '12345678-1234-1234-1234-123456789abc',
    Reference: 'REF-001'
  },
  genericObject: {
    foo: 'bar',
    baz: 123
  },
  partialReference: {
    Id: '12345678-1234-1234-1234-123456789abc',
    Name: 'Test Name'
    // Missing Code - should be generic object
  }
};

// Sample Cosmos DB documents for schema inference
export const sampleDocuments = [
  {
    id: '12345678-1234-1234-1234-123456789abc',
    name: 'Document 1',
    count: 42,
    price: 19.99,
    active: true,
    createdAt: '2024-01-15T10:30:00Z',
    store: {
      Id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      Name: 'Store A',
      Code: 'STRA'
    },
    tags: ['tag1', 'tag2'],
    metadata: {
      source: 'import',
      version: 1
    },
    _rid: 'cosmos-internal',
    _self: 'cosmos-self',
    _etag: 'cosmos-etag',
    _ts: 1705315800
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Document 2',
    count: 100,
    price: 29.99,
    active: false,
    createdAt: '2024-01-16T11:00:00Z',
    store: {
      Id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      Name: 'Store B',
      Code: 'STRB'
    },
    tags: ['tag3'],
    optionalField: 'sometimes present',
    metadata: {
      source: 'api',
      version: 2
    },
    _rid: 'cosmos-internal-2',
    _self: 'cosmos-self-2',
    _etag: 'cosmos-etag-2',
    _ts: 1705402200
  }
];

// Documents with various edge cases
export const edgeCaseDocuments = {
  emptyDocument: {},
  nullValues: {
    id: '33333333-3333-3333-3333-333333333333',
    nullField: null,
    presentField: 'value'
  },
  deeplyNested: {
    id: '44444444-4444-4444-4444-444444444444',
    level1: {
      level2: {
        level3: {
          value: 'deep'
        }
      }
    }
  },
  arrayOfObjects: {
    id: '55555555-5555-5555-5555-555555555555',
    items: [
      { name: 'Item 1', quantity: 1 },
      { name: 'Item 2', quantity: 2 }
    ]
  },
  mixedTypeProperty: [
    { id: '1', value: 'string value' },
    { id: '2', value: 42 },
    { id: '3', value: true }
  ],
  longString: {
    id: '66666666-6666-6666-6666-666666666666',
    description: 'This is a very long string that should be truncated when displayed as an example value in the schema documentation output'
  }
};

// Container configurations for relationship testing
export const testContainers = [
  { name: 'stores', database: 'platform' },
  { name: 'suppliers', database: 'platform' },
  { name: 'categories', database: 'platform' },
  { name: 'products', database: 'store-a' },
  { name: 'orders', database: 'store-a' },
  { name: 'customers', database: 'store-a' },
  { name: 'products', database: 'store-b' },
  { name: 'orders', database: 'store-b' },
  { name: 'customers', database: 'store-b' }
];

// Schema with various relationship patterns
export const schemaWithRelationships = {
  properties: {
    id: {
      path: 'id',
      name: 'id',
      parentPath: null,
      types: ['guid'],
      occurrences: 100,
      isRequired: true
    },
    StoreId: {
      path: 'StoreId',
      name: 'StoreId',
      parentPath: null,
      types: ['guid'],
      occurrences: 100,
      isRequired: true
    },
    store_id: {
      path: 'store_id',
      name: 'store_id',
      parentPath: null,
      types: ['guid'],
      occurrences: 50,
      isRequired: false
    },
    Category: {
      path: 'Category',
      name: 'Category',
      parentPath: null,
      types: ['ReferenceObject'],
      occurrences: 100,
      isRequired: true
    },
    'Category.Id': {
      path: 'Category.Id',
      name: 'Id',
      parentPath: 'Category',
      types: ['guid'],
      occurrences: 100,
      isRequired: true
    },
    Supplier: {
      path: 'Supplier',
      name: 'Supplier',
      parentPath: null,
      types: ['SimpleReference'],
      occurrences: 80,
      isRequired: false
    },
    CustomerId: {
      path: 'CustomerId',
      name: 'CustomerId',
      parentPath: null,
      types: ['guid'],
      occurrences: 100,
      isRequired: true
    },
    UnknownRefId: {
      path: 'UnknownRefId',
      name: 'UnknownRefId',
      parentPath: null,
      types: ['guid'],
      occurrences: 100,
      isRequired: true
    }
  }
};
