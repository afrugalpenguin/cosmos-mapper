/**
 * Confidence score calculation for relationship detection.
 * Combines multiple validation signals into a composite confidence score.
 */

import {
  validateReferentialIntegrity,
  validateTypeConsistency,
  validateFrequency,
  detectDenormalization,
  analyseCardinality
} from './relationshipValidator.js';

/**
 * Weight configuration for confidence factors.
 * @typedef {Object} ConfidenceWeights
 * @property {number} referentialIntegrity - Weight for FK validation (0-1)
 * @property {number} typeConsistency - Weight for type matching (0-1)
 * @property {number} frequency - Weight for field population rate (0-1)
 * @property {number} namingPattern - Weight for naming convention match (0-1)
 */

/**
 * Default weights for confidence calculation.
 * @type {ConfidenceWeights}
 */
export const DEFAULT_WEIGHTS = {
  referentialIntegrity: 0.45,
  typeConsistency: 0.20,
  frequency: 0.15,
  namingPattern: 0.20
};

/**
 * Full confidence analysis result.
 * @typedef {Object} ConfidenceAnalysis
 * @property {number} score - Composite confidence score (0-100)
 * @property {string} level - Confidence level: 'high', 'medium', 'low', 'very-low'
 * @property {string} summary - Human-readable summary
 * @property {object} factors - Individual factor scores and details
 * @property {boolean} validated - Whether validation queries were run
 */

/**
 * Calculate confidence score for a relationship.
 * When client is provided, performs actual data validation.
 * Otherwise, uses heuristic scoring based on available metadata.
 *
 * @param {import('./relationships.js').Relationship} relationship - Relationship to score
 * @param {object} sourceSchema - Schema of source container
 * @param {object} targetSchema - Schema of target container (null if orphan)
 * @param {import('@azure/cosmos').CosmosClient} [client] - Cosmos client for validation
 * @param {ConfidenceWeights} [weights] - Custom weights
 * @returns {Promise<ConfidenceAnalysis>}
 */
export async function calculateConfidence(
  relationship,
  sourceSchema,
  targetSchema,
  client = null,
  weights = DEFAULT_WEIGHTS
) {
  const factors = {};

  // Orphan relationships get low confidence
  if (relationship.isOrphan) {
    return {
      score: 15,
      level: 'very-low',
      summary: 'Target container not found',
      factors: {
        orphan: { confidence: 15, reason: 'No matching container exists' }
      },
      validated: false
    };
  }

  // Factor 1: Referential Integrity (requires client)
  if (client) {
    const riResult = await validateReferentialIntegrity(client, relationship);
    factors.referentialIntegrity = {
      confidence: riResult.confidence,
      matchRate: riResult.matchRate,
      sampleSize: riResult.sampleSize,
      reason: riResult.reason
    };
  } else {
    // No client - use heuristic
    factors.referentialIntegrity = {
      confidence: 50,
      reason: 'Not validated (no client)'
    };
  }

  // Factor 2: Type Consistency
  const typeResult = validateTypeConsistency(relationship, sourceSchema, targetSchema);
  factors.typeConsistency = {
    confidence: typeResult.confidence,
    consistent: typeResult.consistent,
    fkTypes: typeResult.fkTypes,
    idTypes: typeResult.idTypes,
    reason: typeResult.reason
  };

  // Factor 3: Frequency
  const freqResult = validateFrequency(relationship, sourceSchema);
  factors.frequency = {
    confidence: freqResult.confidence,
    populatedRate: freqResult.populatedRate,
    reason: freqResult.interpretation
  };

  // Factor 4: Naming Pattern
  const namingResult = scoreNamingPattern(relationship);
  factors.namingPattern = {
    confidence: namingResult.confidence,
    pattern: namingResult.pattern,
    reason: namingResult.reason
  };

  // Factor 5: Denormalization (informational, doesn't affect score directly)
  const denormResult = detectDenormalization(relationship, sourceSchema);
  factors.denormalization = {
    isDenormalized: denormResult.isDenormalized,
    nestedFields: denormResult.nestedFields,
    reason: denormResult.reason
  };

  // Factor 6: Cardinality (informational, requires client)
  if (client) {
    const cardResult = await analyseCardinality(client, relationship);
    factors.cardinality = {
      type: cardResult.cardinality,
      avgReferences: cardResult.avgReferencesPerTarget,
      maxReferences: cardResult.maxReferencesPerTarget,
      singleRatio: cardResult.singleReferenceRatio,
      confidence: cardResult.confidence,
      error: cardResult.error
    };
  }

  // Calculate composite score
  const compositeScore = calculateCompositeScore(factors, weights);
  const level = getConfidenceLevel(compositeScore);
  const summary = generateSummary(compositeScore, factors, relationship);

  return {
    score: compositeScore,
    level,
    summary,
    factors,
    validated: !!client
  };
}

/**
 * Calculate composite score from weighted factors.
 * @param {object} factors - Individual factor results
 * @param {ConfidenceWeights} weights - Factor weights
 * @returns {number} Composite score (0-100)
 */
function calculateCompositeScore(factors, weights) {
  let weightedSum = 0;
  let totalWeight = 0;

  if (factors.referentialIntegrity) {
    weightedSum += factors.referentialIntegrity.confidence * weights.referentialIntegrity;
    totalWeight += weights.referentialIntegrity;
  }

  if (factors.typeConsistency) {
    weightedSum += factors.typeConsistency.confidence * weights.typeConsistency;
    totalWeight += weights.typeConsistency;
  }

  if (factors.frequency) {
    weightedSum += factors.frequency.confidence * weights.frequency;
    totalWeight += weights.frequency;
  }

  if (factors.namingPattern) {
    weightedSum += factors.namingPattern.confidence * weights.namingPattern;
    totalWeight += weights.namingPattern;
  }

  // Normalise if weights don't sum to 1
  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Get confidence level label from score.
 * @param {number} score - Confidence score (0-100)
 * @returns {string} Level: 'high', 'medium', 'low', 'very-low'
 */
function getConfidenceLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very-low';
}

/**
 * Score relationship based on naming pattern.
 * @param {import('./relationships.js').Relationship} relationship
 * @returns {object} Pattern score result
 */
function scoreNamingPattern(relationship) {
  const { fromProperty, toContainer } = relationship;
  const propLower = fromProperty.toLowerCase();
  const containerLower = toContainer.toLowerCase();

  // Pattern: Property ends with 'Id' and matches container name
  // e.g., CustomerId -> Customers or Customer
  if (propLower.endsWith('id')) {
    const baseName = propLower.slice(0, -2);
    const containerBase = containerLower.replace(/s$/, '');

    if (baseName === containerBase || baseName === containerLower) {
      return {
        confidence: 95,
        pattern: 'exact-id-suffix',
        reason: `Property "${fromProperty}" matches container "${toContainer}" exactly`
      };
    }

    // Partial match (e.g., CustId -> Customers)
    if (containerBase.startsWith(baseName) || baseName.startsWith(containerBase)) {
      return {
        confidence: 70,
        pattern: 'partial-id-suffix',
        reason: `Property "${fromProperty}" partially matches container "${toContainer}"`
      };
    }
  }

  // Pattern: Property ends with '_id' (snake_case)
  if (propLower.endsWith('_id')) {
    const baseName = propLower.slice(0, -3).replace(/_/g, '');
    const containerBase = containerLower.replace(/s$/, '');

    if (baseName === containerBase) {
      return {
        confidence: 90,
        pattern: 'snake-case-id',
        reason: `Property "${fromProperty}" matches container "${toContainer}"`
      };
    }
  }

  // Pattern: Nested .Id property (e.g., Customer.Id)
  if (fromProperty.endsWith('.Id') || fromProperty.endsWith('.id')) {
    const parentName = fromProperty.split('.').slice(-2, -1)[0].toLowerCase();
    const containerBase = containerLower.replace(/s$/, '');

    if (parentName === containerBase || parentName === containerLower) {
      return {
        confidence: 85,
        pattern: 'nested-id',
        reason: `Nested "${fromProperty}" matches container "${toContainer}"`
      };
    }
  }

  // Generic property name match
  if (propLower === containerLower || propLower === containerLower.replace(/s$/, '')) {
    return {
      confidence: 60,
      pattern: 'name-match',
      reason: `Property name matches container name`
    };
  }

  // No clear pattern match
  return {
    confidence: 40,
    pattern: 'unclear',
    reason: 'No strong naming pattern detected'
  };
}

/**
 * Generate human-readable summary.
 * @param {number} score - Composite score
 * @param {object} factors - Factor details
 * @param {import('./relationships.js').Relationship} relationship
 * @returns {string} Summary text
 */
function generateSummary(score, factors, relationship) {
  const parts = [];

  if (score >= 80) {
    parts.push('High confidence relationship');
  } else if (score >= 60) {
    parts.push('Likely relationship');
  } else if (score >= 40) {
    parts.push('Possible relationship');
  } else {
    parts.push('Uncertain relationship');
  }

  // Add key factor notes
  if (factors.referentialIntegrity?.matchRate >= 0.9) {
    parts.push('with excellent data integrity');
  } else if (factors.referentialIntegrity?.matchRate < 0.5) {
    parts.push('with low data integrity');
  }

  if (factors.denormalization?.isDenormalized === true) {
    parts.push('(denormalized)');
  }

  if (factors.cardinality?.type === 'one-to-one') {
    parts.push('[1:1]');
  } else if (factors.cardinality?.type === 'many-to-one') {
    parts.push('[N:1]');
  }

  if (relationship.isCrossDatabase) {
    parts.push('[cross-database]');
  }

  if (relationship.isAmbiguous) {
    parts.push('[ambiguous target]');
  }

  return parts.join(' ');
}

/**
 * Batch calculate confidence for multiple relationships.
 * @param {import('./relationships.js').Relationship[]} relationships
 * @param {object} schemas - Map of container name to schema
 * @param {import('@azure/cosmos').CosmosClient} [client]
 * @param {ConfidenceWeights} [weights]
 * @returns {Promise<Map<string, ConfidenceAnalysis>>}
 */
export async function calculateConfidenceBatch(relationships, schemas, client = null, weights = DEFAULT_WEIGHTS) {
  const results = new Map();

  for (const rel of relationships) {
    const key = `${rel.fromContainer}.${rel.fromProperty}->${rel.toContainer}`;
    const sourceSchema = schemas[rel.fromContainer];
    const targetSchema = rel.isOrphan ? null : schemas[rel.toContainer];

    const analysis = await calculateConfidence(rel, sourceSchema, targetSchema, client, weights);
    results.set(key, analysis);

    // Attach to relationship object for convenience
    rel.confidence = analysis;
  }

  return results;
}

/**
 * Get confidence statistics for a set of relationships.
 * @param {import('./relationships.js').Relationship[]} relationships
 * @returns {object} Statistics
 */
export function getConfidenceStats(relationships) {
  const withConfidence = relationships.filter(r => r.confidence);

  if (withConfidence.length === 0) {
    return {
      total: relationships.length,
      validated: 0,
      averageScore: 0,
      byLevel: { high: 0, medium: 0, low: 0, 'very-low': 0 }
    };
  }

  const scores = withConfidence.map(r => r.confidence.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const byLevel = { high: 0, medium: 0, low: 0, 'very-low': 0 };
  for (const rel of withConfidence) {
    byLevel[rel.confidence.level]++;
  }

  return {
    total: relationships.length,
    validated: withConfidence.filter(r => r.confidence.validated).length,
    averageScore: avgScore,
    byLevel
  };
}
