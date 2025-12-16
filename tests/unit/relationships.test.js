import { describe, it, expect } from 'vitest';
import {
  detectRelationships,
  invertRelationships,
  groupRelationshipsByContainer,
  getUniqueRelationshipsForERD
} from '../../src/analysis/relationships.js';
import { testContainers, schemaWithRelationships } from '../fixtures/sampleDocuments.js';

describe('relationships', () => {
  describe('detectRelationships', () => {
    describe('pattern detection', () => {
      it('should detect *Id pattern (TenantId -> tenants)', () => {
        const schema = {
          properties: {
            TenantId: {
              path: 'TenantId',
              name: 'TenantId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'tenant-db' },
          { name: 'tenants', database: 'platform' }
        ];

        const rels = detectRelationships('claims', 'tenant-db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].fromProperty).toBe('TenantId');
        expect(rels[0].toContainer).toBe('tenants');
      });

      it('should detect *_id pattern (tenant_id -> tenants)', () => {
        const schema = {
          properties: {
            tenant_id: {
              path: 'tenant_id',
              name: 'tenant_id',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'tenants', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].fromProperty).toBe('tenant_id');
        expect(rels[0].toContainer).toBe('tenants');
      });

      it('should detect nested Id pattern (Tenant.Id -> tenants)', () => {
        const schema = {
          properties: {
            Tenant: {
              path: 'Tenant',
              name: 'Tenant',
              parentPath: null,
              types: ['object']
            },
            'Tenant.Id': {
              path: 'Tenant.Id',
              name: 'Id',
              parentPath: 'Tenant',
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'tenants', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        const tenantRel = rels.find(r => r.toContainer === 'tenants');
        expect(tenantRel).toBeDefined();
        expect(tenantRel.fromProperty).toBe('Tenant');
      });

      it('should detect ReferenceObject type pattern', () => {
        const schema = {
          properties: {
            Tenant: {
              path: 'Tenant',
              name: 'Tenant',
              parentPath: null,
              types: ['ReferenceObject']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'tenants', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].toContainer).toBe('tenants');
      });

      it('should detect SimpleReference type pattern', () => {
        const schema = {
          properties: {
            Contract: {
              path: 'Contract',
              name: 'Contract',
              parentPath: null,
              types: ['SimpleReference']
            }
          }
        };
        const containers = [
          { name: 'policies', database: 'db' },
          { name: 'contracts', database: 'db' }
        ];

        const rels = detectRelationships('policies', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].toContainer).toBe('contracts');
      });
    });

    describe('container matching', () => {
      it('should prefer same-database matches', () => {
        const schema = {
          properties: {
            TenantId: {
              path: 'TenantId',
              name: 'TenantId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'tenant-a' },
          { name: 'tenants', database: 'tenant-a' },  // Same DB - should match
          { name: 'tenants', database: 'tenant-b' }   // Different DB
        ];

        const rels = detectRelationships('claims', 'tenant-a', schema, containers);

        expect(rels[0].toDatabase).toBe('tenant-a');
        expect(rels[0].isCrossDatabase).toBe(false);
      });

      it('should fall back to cross-database when no same-database match', () => {
        const schema = {
          properties: {
            TenantId: {
              path: 'TenantId',
              name: 'TenantId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'tenant-a' },
          { name: 'tenants', database: 'platform' }  // Different DB
        ];

        const rels = detectRelationships('claims', 'tenant-a', schema, containers);

        expect(rels[0].toDatabase).toBe('platform');
        expect(rels[0].isCrossDatabase).toBe(true);
      });

      it('should detect ambiguous cross-database relationships', () => {
        const schema = {
          properties: {
            EventId: {
              path: 'EventId',
              name: 'EventId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'processing', database: 'platform' },
          { name: 'events', database: 'tenant-a' },
          { name: 'events', database: 'tenant-b' },
          { name: 'events', database: 'tenant-c' }
        ];

        const rels = detectRelationships('processing', 'platform', schema, containers);

        expect(rels[0].isAmbiguous).toBe(true);
        expect(rels[0].possibleDatabases.length).toBe(3);
        expect(rels[0].possibleDatabases).toContain('tenant-a');
        expect(rels[0].possibleDatabases).toContain('tenant-b');
        expect(rels[0].possibleDatabases).toContain('tenant-c');
      });

      it('should match plural container names (tenant -> tenants)', () => {
        // Note: pluralization adds 's', so 'tenant' matches 'tenants'
        const schema = {
          properties: {
            TenantId: {
              path: 'TenantId',
              name: 'TenantId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'tenants', database: 'db' }  // Plural form
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('tenants');
      });

      it('should match singular container names (policies -> policy)', () => {
        const schema = {
          properties: {
            Policy: {
              path: 'Policy',
              name: 'Policy',
              parentPath: null,
              types: ['SimpleReference']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'policy', database: 'db' }  // Singular form
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('policy');
      });

      it('should handle special plural (ies -> y)', () => {
        // 'PoliciesId' -> 'policies' -> tries: 'policies', 'policiess', 'policie', 'policy'
        // The 'policy' singular matches the container
        const schema = {
          properties: {
            PoliciesId: {
              path: 'PoliciesId',
              name: 'PoliciesId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'policy', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels[0].toContainer).toBe('policy');
      });
    });

    describe('exclusions', () => {
      it('should NOT detect property named exactly "id"', () => {
        const schema = {
          properties: {
            id: {
              path: 'id',
              name: 'id',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [{ name: 'claims', database: 'db' }];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels.length).toBe(0);
      });

      it('should NOT create self-references', () => {
        const schema = {
          properties: {
            ClaimId: {
              path: 'ClaimId',
              name: 'ClaimId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        // Should not reference itself
        expect(rels.filter(r => r.toContainer === 'claims').length).toBe(0);
      });

      it('should mark orphan references when no container matches', () => {
        const schema = {
          properties: {
            UnknownId: {
              path: 'UnknownId',
              name: 'UnknownId',
              parentPath: null,
              types: ['guid']
            }
          }
        };
        const containers = [{ name: 'claims', database: 'db' }];

        const rels = detectRelationships('claims', 'db', schema, containers);

        expect(rels.length).toBe(1);
        expect(rels[0].isOrphan).toBe(true);
        expect(rels[0].toContainer).toBe('unknown');
      });
    });

    describe('duplicate prevention', () => {
      it('should not create duplicate relationships', () => {
        // Schema where same relationship could be detected multiple ways
        const schema = {
          properties: {
            TenantId: {
              path: 'TenantId',
              name: 'TenantId',
              parentPath: null,
              types: ['guid']
            },
            Tenant: {
              path: 'Tenant',
              name: 'Tenant',
              parentPath: null,
              types: ['ReferenceObject']
            }
          }
        };
        const containers = [
          { name: 'claims', database: 'db' },
          { name: 'tenants', database: 'db' }
        ];

        const rels = detectRelationships('claims', 'db', schema, containers);

        // Should have 2 relationships (different fromProperty)
        const tenantRels = rels.filter(r => r.toContainer === 'tenants');
        expect(tenantRels.length).toBe(2);
        expect(tenantRels[0].fromProperty).not.toBe(tenantRels[1].fromProperty);
      });
    });
  });

  describe('invertRelationships', () => {
    it('should create inverted relationships', () => {
      const rels = [{
        fromContainer: 'claims',
        fromDatabase: 'tenant',
        fromProperty: 'TenantId',
        toContainer: 'tenants',
        toDatabase: 'platform',
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: true,
        isOrphan: false
      }];

      const inverted = invertRelationships(rels);

      expect(inverted.length).toBe(2);  // Original + inverted

      const invertedRel = inverted.find(r => r.fromContainer === 'tenants');
      expect(invertedRel).toBeDefined();
      expect(invertedRel.toContainer).toBe('claims');
      expect(invertedRel.cardinality).toBe('one-to-many');
    });

    it('should NOT invert orphan relationships', () => {
      const rels = [{
        fromContainer: 'claims',
        fromDatabase: 'tenant',
        fromProperty: 'UnknownId',
        toContainer: 'unknown',
        toDatabase: null,
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: false,
        isOrphan: true
      }];

      const inverted = invertRelationships(rels);

      // Should only have original (no inversion)
      expect(inverted.length).toBe(1);
      expect(inverted[0].isOrphan).toBe(true);
    });
  });

  describe('groupRelationshipsByContainer', () => {
    it('should group relationships by source container', () => {
      const rels = [
        { fromContainer: 'claims', toContainer: 'tenants' },
        { fromContainer: 'claims', toContainer: 'policies' },
        { fromContainer: 'policies', toContainer: 'tenants' }
      ];

      const grouped = groupRelationshipsByContainer(rels);

      expect(grouped.claims.length).toBe(2);
      expect(grouped.policies.length).toBe(1);
    });

    it('should handle empty relationships', () => {
      const grouped = groupRelationshipsByContainer([]);
      expect(grouped).toEqual({});
    });
  });

  describe('getUniqueRelationshipsForERD', () => {
    it('should deduplicate relationships with same containers and property', () => {
      // Key is: sorted containers + fromProperty
      // So same containers + same property = duplicate
      const rels = [
        {
          fromContainer: 'claims',
          toContainer: 'tenants',
          fromProperty: 'TenantId',
          isOrphan: false
        },
        {
          fromContainer: 'tenants',
          toContainer: 'claims',
          fromProperty: 'TenantId',  // Same property
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      // Should only have one (same container pair + same property)
      expect(unique.length).toBe(1);
    });

    it('should keep relationships with different properties (not deduplicated)', () => {
      // Bidirectional relationships have different fromProperty values
      // (TenantId vs id), so they're NOT deduplicated
      const rels = [
        {
          fromContainer: 'claims',
          toContainer: 'tenants',
          fromProperty: 'TenantId',
          isOrphan: false
        },
        {
          fromContainer: 'tenants',
          toContainer: 'claims',
          fromProperty: 'id',  // Different property
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      // Both kept because different fromProperty
      expect(unique.length).toBe(2);
    });

    it('should filter out orphan relationships', () => {
      const rels = [
        {
          fromContainer: 'claims',
          toContainer: 'tenants',
          fromProperty: 'TenantId',
          isOrphan: false
        },
        {
          fromContainer: 'claims',
          toContainer: 'unknown',
          fromProperty: 'UnknownId',
          isOrphan: true
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      expect(unique.length).toBe(1);
      expect(unique[0].toContainer).toBe('tenants');
    });

    it('should keep relationships with different properties', () => {
      const rels = [
        {
          fromContainer: 'claims',
          toContainer: 'tenants',
          fromProperty: 'TenantId',
          isOrphan: false
        },
        {
          fromContainer: 'claims',
          toContainer: 'tenants',
          fromProperty: 'CreatedByTenantId',
          isOrphan: false
        }
      ];

      const unique = getUniqueRelationshipsForERD(rels);

      expect(unique.length).toBe(2);
    });
  });
});
