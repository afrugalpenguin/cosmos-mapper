/**
 * Classifies schema changes as breaking vs. additive.
 * Breaking changes may cause issues for consumers depending on the data.
 */

/**
 * @typedef {'critical'|'warning'|'info'} ChangeImpact
 */

/**
 * Determine if a property change is breaking.
 * @param {object} change - PropertyChange object
 * @returns {boolean}
 */
export function isBreakingPropertyChange(change) {
  switch (change.changeType) {
    case 'REMOVED':
      // Property removal is always breaking - consumers may depend on it
      return true;

    case 'TYPE_CHANGED':
      // Type narrowing is breaking (e.g., string|number -> string)
      return isTypeNarrowing(change.before?.types, change.after?.types);

    case 'OPTIONALITY_CHANGED':
      // Required -> optional is breaking (data contracts may be violated)
      const wasRequired = change.before?.isRequired || false;
      const isRequired = change.after?.isRequired || false;
      return wasRequired && !isRequired;

    case 'FREQUENCY_CHANGED':
      // Significant frequency drop could indicate data issues
      const beforeFreq = change.before?.frequency || 0;
      const afterFreq = change.after?.frequency || 0;
      // Breaking if frequency dropped below 50% of original
      return afterFreq < beforeFreq * 0.5;

    case 'ADDED':
      // New properties are never breaking
      return false;

    default:
      return false;
  }
}

/**
 * Determine if a relationship change is breaking.
 * @param {object} change - RelationshipChange object
 * @returns {boolean}
 */
export function isBreakingRelationshipChange(change) {
  switch (change.changeType) {
    case 'RELATIONSHIP_REMOVED':
      // Removed relationships break join patterns
      return true;

    case 'CARDINALITY_CHANGED':
      // Changing from one-to-one to many-to-one isn't breaking
      // Changing from many-to-one to one-to-one could be breaking
      const before = change.before?.cardinality;
      const after = change.after?.cardinality;
      return before === 'many-to-one' && after === 'one-to-one';

    case 'CONFIDENCE_CHANGED':
      // Confidence drop below threshold could indicate data quality issues
      const beforeScore = change.before?.confidence?.score || 0;
      const afterScore = change.after?.confidence?.score || 0;
      // Breaking if confidence dropped from high/medium to low/very-low
      return beforeScore >= 60 && afterScore < 40;

    case 'RELATIONSHIP_ADDED':
      // New relationships are never breaking
      return false;

    default:
      return false;
  }
}

/**
 * Determine if a container change is breaking.
 * @param {object} change - ContainerChange object
 * @returns {boolean}
 */
export function isBreakingContainerChange(change) {
  return change.changeType === 'CONTAINER_REMOVED';
}

/**
 * Check if type change represents narrowing (removing valid types).
 * @param {string[]} beforeTypes - Previous types
 * @param {string[]} afterTypes - Current types
 * @returns {boolean}
 */
function isTypeNarrowing(beforeTypes, afterTypes) {
  if (!beforeTypes || !afterTypes) return false;

  const beforeSet = new Set(beforeTypes);
  const afterSet = new Set(afterTypes);

  // If any type was removed, it's narrowing
  for (const type of beforeSet) {
    if (!afterSet.has(type)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if type change represents widening (adding valid types).
 * @param {string[]} beforeTypes - Previous types
 * @param {string[]} afterTypes - Current types
 * @returns {boolean}
 */
function isTypeWidening(beforeTypes, afterTypes) {
  if (!beforeTypes || !afterTypes) return false;

  const beforeSet = new Set(beforeTypes);
  const afterSet = new Set(afterTypes);

  // Widening if we have all previous types plus new ones
  for (const type of beforeSet) {
    if (!afterSet.has(type)) {
      return false; // Lost a type, not pure widening
    }
  }

  return afterSet.size > beforeSet.size;
}

/**
 * Get impact level for a property change.
 * @param {object} change - PropertyChange object
 * @returns {ChangeImpact}
 */
export function getPropertyChangeImpact(change) {
  if (isBreakingPropertyChange(change)) {
    if (change.changeType === 'REMOVED') {
      return 'critical';
    }
    return 'warning';
  }

  if (change.changeType === 'TYPE_CHANGED') {
    return isTypeWidening(change.before?.types, change.after?.types)
      ? 'info'
      : 'warning';
  }

  return 'info';
}

/**
 * Get impact level for a relationship change.
 * @param {object} change - RelationshipChange object
 * @returns {ChangeImpact}
 */
export function getRelationshipChangeImpact(change) {
  if (isBreakingRelationshipChange(change)) {
    if (change.changeType === 'RELATIONSHIP_REMOVED') {
      return 'critical';
    }
    return 'warning';
  }

  return 'info';
}

/**
 * Get impact level for a container change.
 * @param {object} change - ContainerChange object
 * @returns {ChangeImpact}
 */
export function getContainerChangeImpact(change) {
  if (isBreakingContainerChange(change)) {
    return 'critical';
  }
  return 'info';
}

/**
 * Get impact level for any change.
 * @param {object} change - Change object (property, relationship, or container)
 * @returns {ChangeImpact}
 */
export function getChangeImpact(change) {
  // Determine type based on available properties
  if ('propertyPath' in change) {
    return getPropertyChangeImpact(change);
  }
  if ('relationshipKey' in change) {
    return getRelationshipChangeImpact(change);
  }
  if ('container' in change && !('propertyPath' in change)) {
    return getContainerChangeImpact(change);
  }

  return 'info';
}

/**
 * Classify all changes in a comparison result and count breaking changes.
 * @param {object} comparison - ComparisonResult object
 * @returns {object} - Classified comparison with breaking counts
 */
export function classifyChanges(comparison) {
  let breakingChanges = 0;
  const classified = {
    containerChanges: [],
    propertyChanges: {},
    relationshipChanges: [],
    summary: { ...comparison.summary }
  };

  // Classify container changes
  for (const change of comparison.containerChanges) {
    const isBreaking = isBreakingContainerChange(change);
    const impact = getContainerChangeImpact(change);
    if (isBreaking) breakingChanges++;
    classified.containerChanges.push({ ...change, isBreaking, impact });
  }

  // Classify property changes
  for (const [container, changes] of Object.entries(comparison.propertyChanges)) {
    classified.propertyChanges[container] = [];
    for (const change of changes) {
      const isBreaking = isBreakingPropertyChange(change);
      const impact = getPropertyChangeImpact(change);
      if (isBreaking) breakingChanges++;
      classified.propertyChanges[container].push({ ...change, isBreaking, impact });
    }
  }

  // Classify relationship changes
  for (const change of comparison.relationshipChanges) {
    const isBreaking = isBreakingRelationshipChange(change);
    const impact = getRelationshipChangeImpact(change);
    if (isBreaking) breakingChanges++;
    classified.relationshipChanges.push({ ...change, isBreaking, impact });
  }

  // Update summary with accurate breaking count
  classified.summary.breakingChanges = breakingChanges;

  return classified;
}

/**
 * Get a human-readable explanation for why a change is breaking.
 * @param {object} change - Change object with isBreaking flag
 * @returns {string|null} - Explanation or null if not breaking
 */
export function getBreakingReason(change) {
  if (!change.isBreaking) return null;

  if (change.changeType === 'REMOVED') {
    return 'Removing a property may break consumers that depend on this field';
  }

  if (change.changeType === 'CONTAINER_REMOVED') {
    return 'Removing a container will break any queries or references to it';
  }

  if (change.changeType === 'TYPE_CHANGED') {
    return 'Narrowing types may cause existing data to become invalid';
  }

  if (change.changeType === 'OPTIONALITY_CHANGED') {
    return 'Changing from required to optional may violate data contracts';
  }

  if (change.changeType === 'RELATIONSHIP_REMOVED') {
    return 'Removing a relationship will break join queries';
  }

  if (change.changeType === 'CARDINALITY_CHANGED') {
    return 'Changing cardinality may affect query results and assumptions';
  }

  if (change.changeType === 'CONFIDENCE_CHANGED') {
    return 'Significant confidence drop indicates potential data quality issues';
  }

  if (change.changeType === 'FREQUENCY_CHANGED') {
    return 'Significant frequency drop may indicate missing or changed data';
  }

  return 'This change may affect consumers of this schema';
}
