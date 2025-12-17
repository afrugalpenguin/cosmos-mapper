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
 * @property {boolean} isAmbiguous - Whether multiple databases have the target container
 * @property {string[]} possibleDatabases - All databases containing the target container
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
    const refs = findReferencesInProperty(prop, containerName, allContainers);

    for (const ref of refs) {
      const matchResult = matchToContainer(ref.targetName, allContainers, containerName, databaseName);
      const match = matchResult.match;

      const relationship = {
        fromContainer: containerName,
        fromDatabase: databaseName,
        fromProperty: ref.propertyPath,
        toContainer: match?.name || ref.targetName,
        toDatabase: match?.database || null,
        toProperty: 'id',
        cardinality: 'many-to-one',
        isCrossDatabase: match ? match.database !== databaseName : false,
        isOrphan: !match,
        isAmbiguous: matchResult.isAmbiguous,
        possibleDatabases: matchResult.possibleDatabases
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
 * @param {object} prop - Property to analyse
 * @param {string} sourceContainer - Name of source container
 * @param {ContainerInfo[]} allContainers - All known containers for name matching
 */
function findReferencesInProperty(prop, sourceContainer, allContainers) {
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

  // Pattern 5: Property name matches an existing container name
  // Only create relationship if target container actually exists (no orphans)
  // Skip if already matched by other patterns
  const alreadyMatched = refs.some(r => r.targetName === name.toLowerCase());
  if (!alreadyMatched && name !== 'id' && name.toLowerCase() !== sourceContainer.toLowerCase()) {
    // Check if property name matches any container (with plural/singular variations)
    const containerExists = doesContainerExist(name, allContainers, sourceContainer);
    if (containerExists) {
      refs.push({ propertyPath: path, targetName: name.toLowerCase() });
    }
  }

  return refs;
}

/**
 * Checks if a container with the given name exists (with plural/singular variations).
 * @param {string} name - Property name to check
 * @param {ContainerInfo[]} containers - All known containers
 * @param {string} sourceContainer - Source container to exclude
 * @returns {boolean} Whether a matching container exists
 */
function doesContainerExist(name, containers, sourceContainer) {
  const normalised = name.toLowerCase();
  const namesToTry = [
    normalised,
    normalised + 's', // plural
    normalised.endsWith('s') ? normalised.slice(0, -1) : null, // singular
    normalised.endsWith('ies') ? normalised.slice(0, -3) + 'y' : null // policies -> policy
  ].filter(Boolean);

  return containers.some(c =>
    namesToTry.includes(c.name.toLowerCase()) &&
    c.name.toLowerCase() !== sourceContainer.toLowerCase()
  );
}

/**
 * Match result with potential ambiguity information.
 * @typedef {Object} MatchResult
 * @property {ContainerInfo|null} match - The matched container (first found if ambiguous)
 * @property {boolean} isAmbiguous - Whether multiple databases have this container
 * @property {string[]} possibleDatabases - All databases containing a matching container
 */

/**
 * Attempts to match a reference name to an existing container.
 * Prefers same-database matches over cross-database matches.
 * Returns ambiguity info when multiple databases have the same container name.
 * @returns {MatchResult}
 */
function matchToContainer(targetName, containers, sourceContainer, sourceDatabase) {
  const normalised = targetName.toLowerCase();
  const namesToTry = [
    normalised,
    normalised + 's', // plural
    normalised.endsWith('s') ? normalised.slice(0, -1) : null, // singular
    normalised.endsWith('ies') ? normalised.slice(0, -3) + 'y' : null // policies -> policy
  ].filter(Boolean);

  // First pass: try to find a match in the same database
  for (const name of namesToTry) {
    const match = containers.find(c =>
      c.name.toLowerCase() === name &&
      c.name.toLowerCase() !== sourceContainer.toLowerCase() &&
      c.database === sourceDatabase
    );
    if (match) {
      return { match, isAmbiguous: false, possibleDatabases: [match.database] };
    }
  }

  // Second pass: find ALL cross-database matches to detect ambiguity
  for (const name of namesToTry) {
    const allMatches = containers.filter(c =>
      c.name.toLowerCase() === name &&
      c.name.toLowerCase() !== sourceContainer.toLowerCase()
    );

    if (allMatches.length > 0) {
      // Get unique databases that have this container
      const uniqueDatabases = [...new Set(allMatches.map(m => m.database))];

      return {
        match: allMatches[0],
        isAmbiguous: uniqueDatabases.length > 1,
        possibleDatabases: uniqueDatabases
      };
    }
  }

  return { match: null, isAmbiguous: false, possibleDatabases: [] };
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
