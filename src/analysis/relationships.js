/**
 * Relationship detection between Cosmos DB containers.
 * Identifies foreign key-like relationships based on property names and patterns.
 */

/**
 * Container information for relationship matching.
 * @typedef {Object} ContainerInfo
 * @property {string} name - Container name
 * @property {string} database - Database name
 */

/**
 * Detected relationship.
 * @typedef {Object} Relationship
 * @property {string} fromContainer - Source container name
 * @property {string} fromDatabase - Source database name
 * @property {string} fromProperty - Property path containing the reference
 * @property {string} toContainer - Target container name
 * @property {string} toDatabase - Target database name
 * @property {string} toProperty - Target property (usually 'id')
 * @property {string} cardinality - 'many-to-one' or 'one-to-many'
 * @property {boolean} isCrossDatabase - Whether relationship crosses databases
 * @property {boolean} isOrphan - Whether target container exists
 */

/**
 * Detects relationships from a container's schema.
 * @param {string} containerName - Container being analysed
 * @param {string} databaseName - Database name
 * @param {object} schema - Inferred schema for the container
 * @param {ContainerInfo[]} allContainers - All known containers
 * @returns {Relationship[]} Detected relationships
 */
export function detectRelationships(containerName, databaseName, schema, allContainers) {
  const relationships = [];
  const properties = schema.properties || {};

  for (const prop of Object.values(properties)) {
    const refs = findReferencesInProperty(prop, containerName);

    for (const ref of refs) {
      const match = matchToContainer(ref.targetName, allContainers, containerName);

      const relationship = {
        fromContainer: containerName,
        fromDatabase: databaseName,
        fromProperty: ref.propertyPath,
        toContainer: match?.name || ref.targetName,
        toDatabase: match?.database || null,
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: match ? match.database !== databaseName : false,
        isOrphan: !match
      };

      // Avoid duplicate relationships
      if (!isDuplicateRelationship(relationships, relationship)) {
        relationships.push(relationship);
      }
    }
  }

  return relationships;
}

/**
 * Finds potential references within a property.
 */
function findReferencesInProperty(prop, sourceContainer) {
  const refs = [];
  const path = prop.path;
  const name = prop.name;

  // Pattern 1: Property ends with 'Id' (e.g., TenantId, PolicyId)
  if (name.endsWith('Id') && name !== 'id') {
    const targetName = name.slice(0, -2).toLowerCase();
    refs.push({ propertyPath: path, targetName });
  }

  // Pattern 2: Property ends with '_id' (e.g., tenant_id)
  if (name.endsWith('_id')) {
    const targetName = name.slice(0, -3).toLowerCase();
    refs.push({ propertyPath: path, targetName });
  }

  // Pattern 3: Nested object with .Id property (e.g., Policy.Id)
  // Check if this is a nested Id within a parent object
  if (name === 'Id' && prop.parentPath) {
    // Get the parent object name (e.g., "Policy" from "Policy.Id")
    const parentName = prop.parentPath.split('.').pop().replace('[]', '');
    if (parentName && parentName !== sourceContainer) {
      refs.push({ propertyPath: prop.parentPath, targetName: parentName.toLowerCase() });
    }
  }

  // Pattern 4: Reference pattern types (ReferenceObject, SimpleReference)
  if (prop.types && (prop.types.includes('ReferenceObject') || prop.types.includes('SimpleReference'))) {
    const targetName = name.toLowerCase();
    if (targetName !== sourceContainer.toLowerCase()) {
      refs.push({ propertyPath: path, targetName });
    }
  }

  return refs;
}

/**
 * Attempts to match a reference name to an existing container.
 */
function matchToContainer(targetName, containers, sourceContainer) {
  const normalised = targetName.toLowerCase();

  // Try exact match first
  let match = containers.find(c =>
    c.name.toLowerCase() === normalised &&
    c.name.toLowerCase() !== sourceContainer.toLowerCase()
  );
  if (match) return match;

  // Try plural form
  const plural = normalised + 's';
  match = containers.find(c =>
    c.name.toLowerCase() === plural &&
    c.name.toLowerCase() !== sourceContainer.toLowerCase()
  );
  if (match) return match;

  // Try singular form (remove trailing 's')
  if (normalised.endsWith('s')) {
    const singular = normalised.slice(0, -1);
    match = containers.find(c =>
      c.name.toLowerCase() === singular &&
      c.name.toLowerCase() !== sourceContainer.toLowerCase()
    );
    if (match) return match;
  }

  // Try 'ies' -> 'y' (e.g., policies -> policy)
  if (normalised.endsWith('ies')) {
    const singular = normalised.slice(0, -3) + 'y';
    match = containers.find(c =>
      c.name.toLowerCase() === singular &&
      c.name.toLowerCase() !== sourceContainer.toLowerCase()
    );
    if (match) return match;
  }

  return null;
}

/**
 * Checks if relationship already exists (avoid duplicates).
 */
function isDuplicateRelationship(existing, newRel) {
  return existing.some(r =>
    r.fromContainer === newRel.fromContainer &&
    r.toContainer === newRel.toContainer &&
    r.fromProperty === newRel.fromProperty
  );
}

/**
 * Inverts relationships to show both directions.
 * Creates one-to-many entries for many-to-one relationships.
 */
export function invertRelationships(relationships) {
  const inverted = [];

  for (const rel of relationships) {
    if (!rel.isOrphan) {
      inverted.push({
        ...rel,
        fromContainer: rel.toContainer,
        fromDatabase: rel.toDatabase,
        fromProperty: 'id',
        toContainer: rel.fromContainer,
        toDatabase: rel.fromDatabase,
        toProperty: rel.fromProperty,
        cardinality: 'one-to-many'
      });
    }
  }

  return [...relationships, ...inverted];
}

/**
 * Groups relationships by source container.
 */
export function groupRelationshipsByContainer(relationships) {
  const grouped = {};

  for (const rel of relationships) {
    if (!grouped[rel.fromContainer]) {
      grouped[rel.fromContainer] = [];
    }
    grouped[rel.fromContainer].push(rel);
  }

  return grouped;
}

/**
 * Gets unique relationships for ERD (no duplicates in both directions).
 */
export function getUniqueRelationshipsForERD(relationships) {
  const seen = new Set();
  const unique = [];

  for (const rel of relationships) {
    // Create a normalised key (alphabetical order of containers)
    const containers = [rel.fromContainer, rel.toContainer].sort();
    const key = `${containers[0]}|${containers[1]}|${rel.fromProperty}`;

    if (!seen.has(key) && !rel.isOrphan) {
      seen.add(key);
      unique.push(rel);
    }
  }

  return unique;
}
