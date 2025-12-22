/**
 * Compares two schema snapshots and identifies changes.
 * Used for detecting schema evolution and breaking changes.
 */

/**
 * @typedef {'ADDED'|'REMOVED'|'TYPE_CHANGED'|'OPTIONALITY_CHANGED'|'FREQUENCY_CHANGED'|'ENUM_VALUES_CHANGED'|'COMPUTED_CHANGED'} PropertyChangeType
 * @typedef {'RELATIONSHIP_ADDED'|'RELATIONSHIP_REMOVED'|'CARDINALITY_CHANGED'|'CONFIDENCE_CHANGED'} RelationshipChangeType
 * @typedef {'CONTAINER_ADDED'|'CONTAINER_REMOVED'} ContainerChangeType
 */

/**
 * @typedef {Object} PropertyChange
 * @property {string} container - Container name
 * @property {string} propertyPath - Full property path
 * @property {PropertyChangeType} changeType
 * @property {object|null} before - Previous state (null if added)
 * @property {object|null} after - Current state (null if removed)
 * @property {string} description - Human-readable description
 */

/**
 * @typedef {Object} RelationshipChange
 * @property {string} relationshipKey - Unique identifier for the relationship
 * @property {RelationshipChangeType} changeType
 * @property {object|null} before - Previous state (null if added)
 * @property {object|null} after - Current state (null if removed)
 * @property {string} description - Human-readable description
 */

/**
 * @typedef {Object} ContainerChange
 * @property {string} container - Container name
 * @property {ContainerChangeType} changeType
 * @property {string} description - Human-readable description
 */

/**
 * @typedef {Object} ComparisonSummary
 * @property {number} containersAdded
 * @property {number} containersRemoved
 * @property {number} propertiesAdded
 * @property {number} propertiesRemoved
 * @property {number} propertiesChanged
 * @property {number} relationshipsAdded
 * @property {number} relationshipsRemoved
 * @property {number} relationshipsChanged
 * @property {number} breakingChanges
 * @property {number} totalChanges
 */

/**
 * @typedef {Object} ComparisonResult
 * @property {ContainerChange[]} containerChanges
 * @property {Object.<string, PropertyChange[]>} propertyChanges - Keyed by container
 * @property {RelationshipChange[]} relationshipChanges
 * @property {ComparisonSummary} summary
 */

/**
 * Generate a unique key for a relationship.
 * @param {object} rel - Relationship object
 * @returns {string}
 */
function getRelationshipKey(rel) {
  return `${rel.fromDatabase}.${rel.fromContainer}.${rel.fromProperty}->${rel.toDatabase}.${rel.toContainer}`;
}

/**
 * Compare two snapshots and return all changes.
 * @param {object} baseline - Previous snapshot
 * @param {object} current - Current analysis or snapshot
 * @returns {ComparisonResult}
 */
export function compareSnapshots(baseline, current) {
  const containerChanges = compareContainers(baseline, current);
  const propertyChanges = {};
  const relationshipChanges = compareRelationships(
    baseline.relationships || [],
    current.relationships || []
  );

  // Get all container names from both snapshots
  const baselineContainers = Object.keys(baseline.schemas || {});
  const currentContainers = Object.keys(current.schemas || current.containerSchemas || {});
  const allContainers = new Set([...baselineContainers, ...currentContainers]);

  // Compare properties for each container that exists in both
  for (const container of allContainers) {
    const baselineSchema = baseline.schemas?.[container];
    const currentSchema = current.schemas?.[container] || current.containerSchemas?.[container];

    if (baselineSchema && currentSchema) {
      const changes = compareProperties(
        baselineSchema.properties || {},
        currentSchema.properties || {},
        container
      );
      if (changes.length > 0) {
        propertyChanges[container] = changes;
      }
    }
  }

  // Calculate summary
  const summary = calculateSummary(containerChanges, propertyChanges, relationshipChanges);

  return {
    containerChanges,
    propertyChanges,
    relationshipChanges,
    summary
  };
}

/**
 * Compare containers between snapshots.
 * @param {object} baseline - Previous snapshot
 * @param {object} current - Current analysis or snapshot
 * @returns {ContainerChange[]}
 */
export function compareContainers(baseline, current) {
  const changes = [];

  const baselineContainers = new Set(Object.keys(baseline.schemas || {}));
  const currentContainers = new Set(Object.keys(current.schemas || current.containerSchemas || {}));

  // Find added containers
  for (const container of currentContainers) {
    if (!baselineContainers.has(container)) {
      changes.push({
        container,
        changeType: 'CONTAINER_ADDED',
        description: `New container '${container}' detected`
      });
    }
  }

  // Find removed containers
  for (const container of baselineContainers) {
    if (!currentContainers.has(container)) {
      changes.push({
        container,
        changeType: 'CONTAINER_REMOVED',
        description: `Container '${container}' no longer exists`
      });
    }
  }

  return changes;
}

/**
 * Compare properties of a single container.
 * @param {object} baselineProps - Previous properties
 * @param {object} currentProps - Current properties
 * @param {string} container - Container name for context
 * @returns {PropertyChange[]}
 */
export function compareProperties(baselineProps, currentProps, container = '') {
  const changes = [];

  const baselinePaths = new Set(Object.keys(baselineProps));
  const currentPaths = new Set(Object.keys(currentProps));

  // Find added properties
  for (const path of currentPaths) {
    if (!baselinePaths.has(path)) {
      changes.push({
        container,
        propertyPath: path,
        changeType: 'ADDED',
        before: null,
        after: currentProps[path],
        description: `New property '${path}' added`
      });
    }
  }

  // Find removed properties
  for (const path of baselinePaths) {
    if (!currentPaths.has(path)) {
      changes.push({
        container,
        propertyPath: path,
        changeType: 'REMOVED',
        before: baselineProps[path],
        after: null,
        description: `Property '${path}' removed`
      });
    }
  }

  // Find changed properties
  for (const path of baselinePaths) {
    if (currentPaths.has(path)) {
      const baseline = baselineProps[path];
      const current = currentProps[path];

      // Check type changes
      const baselineTypes = (baseline.types || []).sort().join(',');
      const currentTypes = (current.types || []).sort().join(',');

      if (baselineTypes !== currentTypes) {
        changes.push({
          container,
          propertyPath: path,
          changeType: 'TYPE_CHANGED',
          before: baseline,
          after: current,
          description: `Property '${path}' type changed from [${baselineTypes}] to [${currentTypes}]`
        });
      }

      // Check optionality changes
      const baselineRequired = baseline.isRequired || false;
      const currentRequired = current.isRequired || false;

      if (baselineRequired !== currentRequired) {
        const change = baselineRequired ? 'required -> optional' : 'optional -> required';
        changes.push({
          container,
          propertyPath: path,
          changeType: 'OPTIONALITY_CHANGED',
          before: baseline,
          after: current,
          description: `Property '${path}' changed from ${change}`
        });
      }

      // Check significant frequency changes (>10% change)
      const baselineFreq = baseline.frequency || 0;
      const currentFreq = current.frequency || 0;
      const freqDiff = Math.abs(baselineFreq - currentFreq);

      if (freqDiff > 0.1) {
        changes.push({
          container,
          propertyPath: path,
          changeType: 'FREQUENCY_CHANGED',
          before: baseline,
          after: current,
          description: `Property '${path}' frequency changed from ${(baselineFreq * 100).toFixed(0)}% to ${(currentFreq * 100).toFixed(0)}%`
        });
      }

      // Check optionality classification changes (required/nullable/optional/sparse)
      const baselineOptionality = baseline.optionality || (baseline.isRequired ? 'required' : 'optional');
      const currentOptionality = current.optionality || (current.isRequired ? 'required' : 'optional');

      if (baselineOptionality !== currentOptionality && !changes.some(c => c.propertyPath === path && c.changeType === 'OPTIONALITY_CHANGED')) {
        changes.push({
          container,
          propertyPath: path,
          changeType: 'OPTIONALITY_CHANGED',
          before: baseline,
          after: current,
          description: `Property '${path}' changed from ${baselineOptionality} to ${currentOptionality}`
        });
      }

      // Check enum value changes
      const baselineEnum = baseline.isEnum ? (baseline.enumValues || []).sort().join(',') : '';
      const currentEnum = current.isEnum ? (current.enumValues || []).sort().join(',') : '';

      if (baselineEnum !== currentEnum) {
        if (!baseline.isEnum && current.isEnum) {
          changes.push({
            container,
            propertyPath: path,
            changeType: 'ENUM_VALUES_CHANGED',
            before: baseline,
            after: current,
            description: `Property '${path}' is now detected as enum with values: ${current.enumValues?.join(', ')}`
          });
        } else if (baseline.isEnum && !current.isEnum) {
          changes.push({
            container,
            propertyPath: path,
            changeType: 'ENUM_VALUES_CHANGED',
            before: baseline,
            after: current,
            description: `Property '${path}' is no longer an enum (had values: ${baseline.enumValues?.join(', ')})`
          });
        } else if (baseline.isEnum && current.isEnum) {
          changes.push({
            container,
            propertyPath: path,
            changeType: 'ENUM_VALUES_CHANGED',
            before: baseline,
            after: current,
            description: `Property '${path}' enum values changed from [${baseline.enumValues?.join(', ')}] to [${current.enumValues?.join(', ')}]`
          });
        }
      }

      // Check computed field changes
      const baselineComputed = baseline.isComputed || false;
      const currentComputed = current.isComputed || false;

      if (baselineComputed !== currentComputed || (baselineComputed && baseline.computedPattern !== current.computedPattern)) {
        changes.push({
          container,
          propertyPath: path,
          changeType: 'COMPUTED_CHANGED',
          before: baseline,
          after: current,
          description: baselineComputed !== currentComputed
            ? `Property '${path}' computed status changed: ${baselineComputed ? 'was computed' : 'not computed'} -> ${currentComputed ? 'now computed' : 'no longer computed'}`
            : `Property '${path}' computed pattern changed from ${baseline.computedPattern} to ${current.computedPattern}`
        });
      }
    }
  }

  return changes;
}

/**
 * Compare relationship sets.
 * @param {object[]} baselineRels - Previous relationships
 * @param {object[]} currentRels - Current relationships
 * @returns {RelationshipChange[]}
 */
export function compareRelationships(baselineRels, currentRels) {
  const changes = [];

  // Create lookup maps
  const baselineMap = new Map();
  for (const rel of baselineRels) {
    baselineMap.set(getRelationshipKey(rel), rel);
  }

  const currentMap = new Map();
  for (const rel of currentRels) {
    currentMap.set(getRelationshipKey(rel), rel);
  }

  // Find added relationships
  for (const [key, rel] of currentMap) {
    if (!baselineMap.has(key)) {
      changes.push({
        relationshipKey: key,
        changeType: 'RELATIONSHIP_ADDED',
        before: null,
        after: rel,
        description: `New relationship: ${rel.fromContainer}.${rel.fromProperty} -> ${rel.toContainer}`
      });
    }
  }

  // Find removed relationships
  for (const [key, rel] of baselineMap) {
    if (!currentMap.has(key)) {
      changes.push({
        relationshipKey: key,
        changeType: 'RELATIONSHIP_REMOVED',
        before: rel,
        after: null,
        description: `Removed relationship: ${rel.fromContainer}.${rel.fromProperty} -> ${rel.toContainer}`
      });
    }
  }

  // Find changed relationships
  for (const [key, baseline] of baselineMap) {
    const current = currentMap.get(key);
    if (current) {
      // Check cardinality changes
      if (baseline.cardinality !== current.cardinality) {
        changes.push({
          relationshipKey: key,
          changeType: 'CARDINALITY_CHANGED',
          before: baseline,
          after: current,
          description: `Cardinality changed from ${baseline.cardinality} to ${current.cardinality}`
        });
      }

      // Check significant confidence changes (>20 point difference)
      const baselineScore = baseline.confidence?.score || 0;
      const currentScore = current.confidence?.score || 0;

      if (Math.abs(baselineScore - currentScore) > 20) {
        changes.push({
          relationshipKey: key,
          changeType: 'CONFIDENCE_CHANGED',
          before: baseline,
          after: current,
          description: `Confidence changed from ${baselineScore}% to ${currentScore}%`
        });
      }
    }
  }

  return changes;
}

/**
 * Calculate summary statistics for the comparison.
 * @param {ContainerChange[]} containerChanges
 * @param {Object.<string, PropertyChange[]>} propertyChanges
 * @param {RelationshipChange[]} relationshipChanges
 * @returns {ComparisonSummary}
 */
function calculateSummary(containerChanges, propertyChanges, relationshipChanges) {
  const containersAdded = containerChanges.filter(c => c.changeType === 'CONTAINER_ADDED').length;
  const containersRemoved = containerChanges.filter(c => c.changeType === 'CONTAINER_REMOVED').length;

  let propertiesAdded = 0;
  let propertiesRemoved = 0;
  let propertiesChanged = 0;

  for (const changes of Object.values(propertyChanges)) {
    for (const change of changes) {
      if (change.changeType === 'ADDED') propertiesAdded++;
      else if (change.changeType === 'REMOVED') propertiesRemoved++;
      else propertiesChanged++;
    }
  }

  const relationshipsAdded = relationshipChanges.filter(r => r.changeType === 'RELATIONSHIP_ADDED').length;
  const relationshipsRemoved = relationshipChanges.filter(r => r.changeType === 'RELATIONSHIP_REMOVED').length;
  const relationshipsChanged = relationshipChanges.filter(r =>
    r.changeType === 'CARDINALITY_CHANGED' || r.changeType === 'CONFIDENCE_CHANGED'
  ).length;

  // Count breaking changes (will be updated by changeClassifier)
  const breakingChanges = containersRemoved + propertiesRemoved;

  const totalChanges = containersAdded + containersRemoved +
    propertiesAdded + propertiesRemoved + propertiesChanged +
    relationshipsAdded + relationshipsRemoved + relationshipsChanged;

  return {
    containersAdded,
    containersRemoved,
    propertiesAdded,
    propertiesRemoved,
    propertiesChanged,
    relationshipsAdded,
    relationshipsRemoved,
    relationshipsChanged,
    breakingChanges,
    totalChanges
  };
}

/**
 * Check if there are any changes between snapshots.
 * @param {ComparisonResult} comparison
 * @returns {boolean}
 */
export function hasChanges(comparison) {
  return comparison.summary.totalChanges > 0;
}

/**
 * Check if there are any breaking changes.
 * @param {ComparisonResult} comparison
 * @returns {boolean}
 */
export function hasBreakingChanges(comparison) {
  return comparison.summary.breakingChanges > 0;
}
