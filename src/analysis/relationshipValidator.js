/**
 * Relationship validation functions.
 * Queries actual data to verify inferred relationships and calculate confidence scores.
 */

import { getDistinctValues, checkIdsExist } from '../cosmos/client.js';

/**
 * Validation result for referential integrity check.
 * @typedef {Object} ReferentialIntegrityResult
 * @property {boolean} validated - Whether validation was performed successfully
 * @property {number} matchRate - Percentage of FK values that exist in target (0-1)
 * @property {number} sampleSize - Number of FK values checked
 * @property {number} matchedCount - Number of FK values found in target
 * @property {number} orphanCount - Number of FK values not found in target
 * @property {number} confidence - Confidence score (0-100)
 * @property {string} reason - Human-readable explanation
 * @property {string} [error] - Error message if validation failed
 */

/**
 * Validate referential integrity for a relationship.
 * Checks what percentage of FK values exist in target container.
 * @param {import('@azure/cosmos').CosmosClient} client - Cosmos client
 * @param {import('./relationships.js').Relationship} relationship - Relationship to validate
 * @param {number} sampleSize - Maximum FK values to check
 * @returns {Promise<ReferentialIntegrityResult>}
 */
export async function validateReferentialIntegrity(client, relationship, sampleSize = 1000) {
  const { fromDatabase, fromContainer, fromProperty, toDatabase, toContainer, isOrphan } = relationship;

  // Skip orphan relationships (no target container)
  if (isOrphan) {
    return {
      validated: false,
      matchRate: 0,
      sampleSize: 0,
      matchedCount: 0,
      orphanCount: 0,
      confidence: 0,
      reason: 'Target container does not exist'
    };
  }

  try {
    // Get sample of FK values from source container
    const fkValues = await getDistinctValues(
      client, fromDatabase, fromContainer, fromProperty, sampleSize
    );

    if (fkValues.length === 0) {
      return {
        validated: false,
        matchRate: 0,
        sampleSize: 0,
        matchedCount: 0,
        orphanCount: 0,
        confidence: 0,
        reason: 'No FK values found in source container'
      };
    }

    // Filter out null/undefined values
    const validFkValues = fkValues.filter(v => v != null);

    if (validFkValues.length === 0) {
      return {
        validated: true,
        matchRate: 0,
        sampleSize: fkValues.length,
        matchedCount: 0,
        orphanCount: fkValues.length,
        confidence: 10,
        reason: 'All FK values are null'
      };
    }

    // Check how many exist in target container
    const existingIds = await checkIdsExist(
      client, toDatabase, toContainer, validFkValues
    );

    const matchedCount = existingIds.length;
    const matchRate = matchedCount / validFkValues.length;

    // Calculate confidence based on match rate
    let confidence;
    let reason;

    if (matchRate >= 0.95) {
      confidence = 95;
      reason = 'Excellent referential integrity';
    } else if (matchRate >= 0.85) {
      confidence = 85;
      reason = 'High referential integrity with minor orphans';
    } else if (matchRate >= 0.70) {
      confidence = 70;
      reason = 'Good referential integrity with some orphans';
    } else if (matchRate >= 0.50) {
      confidence = 50;
      reason = 'Moderate referential integrity';
    } else if (matchRate >= 0.30) {
      confidence = 30;
      reason = 'Low referential integrity - may be denormalized';
    } else {
      confidence = 15;
      reason = 'Very low referential integrity - likely not a real FK';
    }

    return {
      validated: true,
      matchRate,
      sampleSize: validFkValues.length,
      matchedCount,
      orphanCount: validFkValues.length - matchedCount,
      confidence,
      reason
    };
  } catch (error) {
    return {
      validated: false,
      matchRate: 0,
      sampleSize: 0,
      matchedCount: 0,
      orphanCount: 0,
      confidence: 0,
      reason: `Validation failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Validation result for type consistency check.
 * @typedef {Object} TypeConsistencyResult
 * @property {boolean} consistent - Whether types are compatible
 * @property {number} confidence - Confidence score (0-100)
 * @property {string} reason - Human-readable explanation
 * @property {string[]} fkTypes - Types of the FK property
 * @property {string[]} idTypes - Types of the target ID property
 */

/**
 * Check type consistency between FK and target ID.
 * @param {import('./relationships.js').Relationship} relationship - Relationship to check
 * @param {object} sourceSchema - Schema of source container
 * @param {object} targetSchema - Schema of target container
 * @returns {TypeConsistencyResult}
 */
export function validateTypeConsistency(relationship, sourceSchema, targetSchema) {
  const fkProp = findPropertyInSchema(sourceSchema, relationship.fromProperty);
  const idProp = targetSchema?.properties?.id;

  if (!fkProp) {
    return {
      consistent: false,
      confidence: 30,
      reason: 'FK property not found in schema',
      fkTypes: [],
      idTypes: idProp?.types || []
    };
  }

  if (!idProp) {
    return {
      consistent: false,
      confidence: 30,
      reason: 'Target container id property not found',
      fkTypes: fkProp.types || [],
      idTypes: []
    };
  }

  const fkTypes = new Set(fkProp.types || []);
  const idTypes = new Set(idProp.types || []);

  // Check for type overlap
  const overlap = [...fkTypes].filter(t => idTypes.has(t));

  if (overlap.length === 0) {
    return {
      consistent: false,
      confidence: 20,
      reason: `Type mismatch: FK is ${[...fkTypes].join('|')}, ID is ${[...idTypes].join('|')}`,
      fkTypes: [...fkTypes],
      idTypes: [...idTypes]
    };
  }

  if (fkTypes.size === 1 && idTypes.size === 1 && overlap.length === 1) {
    return {
      consistent: true,
      confidence: 90,
      reason: `Exact type match: ${overlap[0]}`,
      fkTypes: [...fkTypes],
      idTypes: [...idTypes]
    };
  }

  return {
    consistent: true,
    confidence: 65,
    reason: `Partial type match: ${overlap.join(', ')}`,
    fkTypes: [...fkTypes],
    idTypes: [...idTypes]
  };
}

/**
 * Validation result for frequency check.
 * @typedef {Object} FrequencyResult
 * @property {number} populatedRate - Rate at which the FK field is populated (0-1)
 * @property {number} confidence - Confidence score (0-100)
 * @property {string} interpretation - Human-readable interpretation
 */

/**
 * Analyse frequency of FK field population.
 * @param {import('./relationships.js').Relationship} relationship - Relationship to check
 * @param {object} sourceSchema - Schema of source container
 * @returns {FrequencyResult}
 */
export function validateFrequency(relationship, sourceSchema) {
  const fkProp = findPropertyInSchema(sourceSchema, relationship.fromProperty);

  if (!fkProp) {
    return {
      populatedRate: 0,
      confidence: 0,
      interpretation: 'Property not found in schema'
    };
  }

  // frequency is calculated during schema inference (occurrences/totalDocs)
  const populatedRate = fkProp.frequency ?? (fkProp.isRequired ? 1 : 0.5);

  let confidence;
  let interpretation;

  if (populatedRate >= 0.95) {
    confidence = 90;
    interpretation = 'Required relationship (always present)';
  } else if (populatedRate >= 0.70) {
    confidence = 70;
    interpretation = 'Common relationship (usually present)';
  } else if (populatedRate >= 0.30) {
    confidence = 45;
    interpretation = 'Conditional relationship (sometimes present)';
  } else {
    confidence = 20;
    interpretation = 'Rare field (possibly legacy)';
  }

  return {
    populatedRate,
    confidence,
    interpretation
  };
}

/**
 * Detect if relationship is denormalized (embedded snapshot vs live reference).
 * @param {import('./relationships.js').Relationship} relationship - Relationship to check
 * @param {object} sourceSchema - Schema of source container
 * @returns {object} Denormalization detection result
 */
export function detectDenormalization(relationship, sourceSchema) {
  const { fromProperty } = relationship;

  // Get the base name (e.g., "Customer" from "CustomerId")
  const baseName = fromProperty.replace(/Id$/, '').replace(/_id$/, '');

  if (!sourceSchema?.properties) {
    return {
      isDenormalized: false,
      confidence: 50,
      reason: 'Schema not available',
      nestedFields: []
    };
  }

  // Look for a corresponding nested object
  const nestedProps = Object.keys(sourceSchema.properties)
    .filter(key => key.startsWith(baseName + '.') || key === baseName);

  if (nestedProps.length === 0) {
    return {
      isDenormalized: false,
      confidence: 80,
      reason: 'No embedded object found - likely a live reference',
      nestedFields: []
    };
  }

  // Check what fields are in the nested object
  const nestedFields = nestedProps
    .filter(p => p.includes('.'))
    .map(p => p.split('.').pop().toLowerCase());

  // Common denormalization indicators
  const snapshotIndicators = ['name', 'code', 'title', 'description', 'status', 'email', 'displayname'];
  const hasSnapshotFields = snapshotIndicators.some(ind => nestedFields.includes(ind));

  if (hasSnapshotFields) {
    return {
      isDenormalized: true,
      confidence: 85,
      reason: `Denormalized snapshot: ${baseName} contains ${nestedFields.slice(0, 3).join(', ')}${nestedFields.length > 3 ? '...' : ''}`,
      nestedFields
    };
  }

  // Has nested object but unclear if it's a snapshot
  return {
    isDenormalized: 'possible',
    confidence: 50,
    reason: 'Nested object found but unclear if snapshot',
    nestedFields
  };
}

/**
 * Helper to find a property in schema by path.
 * @param {object} schema - Container schema
 * @param {string} propertyPath - Property path (may be nested)
 * @returns {object|null} Property definition or null
 */
function findPropertyInSchema(schema, propertyPath) {
  if (!schema?.properties) return null;

  // Direct match
  if (schema.properties[propertyPath]) {
    return schema.properties[propertyPath];
  }

  // Try without nested path prefix (just the final property name)
  const simpleName = propertyPath.split('.').pop();
  return schema.properties[simpleName] || null;
}
