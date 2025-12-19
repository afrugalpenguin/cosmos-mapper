/**
 * Schema versioning and change detection module.
 * Enables tracking schema evolution over time and detecting breaking changes.
 */

export {
  saveSnapshot,
  loadSnapshot,
  getLatestSnapshot,
  listSnapshots,
  pruneSnapshots,
  deleteSnapshot
} from './snapshotManager.js';

export {
  compareSnapshots,
  compareProperties,
  compareRelationships
} from './schemaComparer.js';

export {
  isBreakingPropertyChange,
  isBreakingRelationshipChange,
  getChangeImpact,
  classifyChanges
} from './changeClassifier.js';
