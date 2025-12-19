/**
 * Generates schema change reports in various formats.
 * Used to display diff results to users.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Format a comparison result for console output.
 * @param {object} comparison - Classified comparison result
 * @returns {string} Formatted text for console
 */
export function formatDiffForConsole(comparison) {
  const lines = [];
  const { summary } = comparison;

  // Header
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    SCHEMA CHANGE REPORT                    ');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push('Summary:');
  lines.push('─────────────────────────────────────────────────────────────');

  if (summary.totalChanges === 0) {
    lines.push('  No changes detected.');
    return lines.join('\n');
  }

  if (summary.containersAdded > 0) {
    lines.push(`  + ${summary.containersAdded} container(s) added`);
  }
  if (summary.containersRemoved > 0) {
    lines.push(`  - ${summary.containersRemoved} container(s) removed`);
  }
  if (summary.propertiesAdded > 0) {
    lines.push(`  + ${summary.propertiesAdded} property(s) added`);
  }
  if (summary.propertiesRemoved > 0) {
    lines.push(`  - ${summary.propertiesRemoved} property(s) removed`);
  }
  if (summary.propertiesChanged > 0) {
    lines.push(`  ~ ${summary.propertiesChanged} property(s) changed`);
  }
  if (summary.relationshipsAdded > 0) {
    lines.push(`  + ${summary.relationshipsAdded} relationship(s) added`);
  }
  if (summary.relationshipsRemoved > 0) {
    lines.push(`  - ${summary.relationshipsRemoved} relationship(s) removed`);
  }
  if (summary.relationshipsChanged > 0) {
    lines.push(`  ~ ${summary.relationshipsChanged} relationship(s) changed`);
  }

  lines.push('');
  lines.push(`  Total: ${summary.totalChanges} change(s)`);

  if (summary.breakingChanges > 0) {
    lines.push(`  ⚠️  ${summary.breakingChanges} BREAKING change(s)`);
  }

  // Breaking changes detail
  const breakingChanges = getBreakingChanges(comparison);
  if (breakingChanges.length > 0) {
    lines.push('');
    lines.push('Breaking Changes:');
    lines.push('─────────────────────────────────────────────────────────────');

    for (const change of breakingChanges) {
      const icon = change.impact === 'critical' ? '🔴' : '🟡';
      lines.push(`  ${icon} ${change.description}`);
    }
  }

  // Additive changes detail (only show first few)
  const additiveChanges = getAdditiveChanges(comparison);
  if (additiveChanges.length > 0) {
    lines.push('');
    lines.push('Additive Changes:');
    lines.push('─────────────────────────────────────────────────────────────');

    const toShow = additiveChanges.slice(0, 10);
    for (const change of toShow) {
      lines.push(`  🟢 ${change.description}`);
    }

    if (additiveChanges.length > 10) {
      lines.push(`  ... and ${additiveChanges.length - 10} more`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a markdown diff report.
 * @param {object} comparison - Classified comparison result
 * @param {object} metadata - Additional metadata (baseline/current info)
 * @param {string} outputDir - Directory to write the report
 * @returns {Promise<string>} Path to generated file
 */
export async function generateDiffMarkdown(comparison, metadata, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const lines = [];
  const { summary } = comparison;

  // Header
  lines.push('# Schema Change Report');
  lines.push('');

  if (metadata.baselineId && metadata.currentTimestamp) {
    lines.push(`> Comparing: \`${metadata.baselineId}\` → Current (${metadata.currentTimestamp})`);
    lines.push('');
  }

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Containers added | ${summary.containersAdded} |`);
  lines.push(`| Containers removed | ${summary.containersRemoved} |`);
  lines.push(`| Properties added | ${summary.propertiesAdded} |`);
  lines.push(`| Properties removed | ${summary.propertiesRemoved} |`);
  lines.push(`| Properties changed | ${summary.propertiesChanged} |`);
  lines.push(`| Relationships added | ${summary.relationshipsAdded} |`);
  lines.push(`| Relationships removed | ${summary.relationshipsRemoved} |`);
  lines.push(`| **Breaking changes** | **${summary.breakingChanges}** |`);
  lines.push(`| **Total changes** | **${summary.totalChanges}** |`);
  lines.push('');

  // Breaking changes
  const breakingChanges = getBreakingChanges(comparison);
  if (breakingChanges.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    lines.push('These changes may affect consumers of this schema:');
    lines.push('');

    for (const change of breakingChanges) {
      lines.push(`### ${getChangeTitle(change)}`);
      lines.push('');
      lines.push(`**Type:** ${formatChangeType(change.changeType)}`);
      lines.push('');
      lines.push(change.description);
      lines.push('');

      if (change.before && change.after) {
        lines.push('<details>');
        lines.push('<summary>Details</summary>');
        lines.push('');
        lines.push('**Before:**');
        lines.push('```json');
        lines.push(JSON.stringify(change.before, null, 2));
        lines.push('```');
        lines.push('');
        lines.push('**After:**');
        lines.push('```json');
        lines.push(JSON.stringify(change.after, null, 2));
        lines.push('```');
        lines.push('</details>');
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Additive changes
  const additiveChanges = getAdditiveChanges(comparison);
  if (additiveChanges.length > 0) {
    lines.push('## Additive Changes');
    lines.push('');
    lines.push('These changes are non-breaking additions:');
    lines.push('');

    for (const change of additiveChanges) {
      lines.push(`- **${getChangeTitle(change)}**: ${change.description}`);
    }
    lines.push('');
  }

  // No changes
  if (summary.totalChanges === 0) {
    lines.push('## No Changes');
    lines.push('');
    lines.push('No schema changes detected between the snapshots.');
    lines.push('');
  }

  const content = lines.join('\n');
  const filePath = join(outputDir, 'schema-changes.md');
  await writeFile(filePath, content, 'utf8');

  return filePath;
}

/**
 * Generate HTML section for the main report.
 * @param {object} comparison - Classified comparison result
 * @returns {string} HTML fragment
 */
export function generateDiffHtmlSection(comparison) {
  const { summary } = comparison;

  if (summary.totalChanges === 0) {
    return '';
  }

  const breakingChanges = getBreakingChanges(comparison);
  const additiveChanges = getAdditiveChanges(comparison);

  let html = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Schema Changes Detected
        ${summary.breakingChanges > 0 ? `
        <span class="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          ${summary.breakingChanges} breaking
        </span>
        ` : ''}
      </h2>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold text-gray-900">${summary.totalChanges}</div>
          <div class="text-xs text-gray-500">Total Changes</div>
        </div>
        <div class="text-center p-3 bg-green-50 rounded-lg">
          <div class="text-2xl font-bold text-green-600">${summary.propertiesAdded + summary.containersAdded + summary.relationshipsAdded}</div>
          <div class="text-xs text-gray-500">Added</div>
        </div>
        <div class="text-center p-3 bg-red-50 rounded-lg">
          <div class="text-2xl font-bold text-red-600">${summary.propertiesRemoved + summary.containersRemoved + summary.relationshipsRemoved}</div>
          <div class="text-xs text-gray-500">Removed</div>
        </div>
        <div class="text-center p-3 bg-yellow-50 rounded-lg">
          <div class="text-2xl font-bold text-yellow-600">${summary.propertiesChanged + summary.relationshipsChanged}</div>
          <div class="text-xs text-gray-500">Changed</div>
        </div>
      </div>
  `;

  // Breaking changes list
  if (breakingChanges.length > 0) {
    html += `
      <div class="mb-4">
        <h3 class="text-sm font-medium text-red-700 mb-2">Breaking Changes</h3>
        <div class="space-y-2">
    `;

    for (const change of breakingChanges.slice(0, 5)) {
      const icon = change.impact === 'critical' ? '🔴' : '🟡';
      html += `
          <div class="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-lg text-sm">
            <span>${icon}</span>
            <span class="text-gray-700">${escapeHtml(change.description)}</span>
          </div>
      `;
    }

    if (breakingChanges.length > 5) {
      html += `
          <div class="text-xs text-gray-500 text-center py-1">
            + ${breakingChanges.length - 5} more breaking changes
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // Additive changes list
  if (additiveChanges.length > 0) {
    html += `
      <div>
        <h3 class="text-sm font-medium text-green-700 mb-2">Additive Changes</h3>
        <div class="space-y-1 max-h-32 overflow-y-auto">
    `;

    for (const change of additiveChanges.slice(0, 10)) {
      html += `
          <div class="flex items-start gap-2 px-3 py-1 text-sm">
            <span class="text-green-500">+</span>
            <span class="text-gray-600">${escapeHtml(change.description)}</span>
          </div>
      `;
    }

    if (additiveChanges.length > 10) {
      html += `
          <div class="text-xs text-gray-500 text-center py-1">
            + ${additiveChanges.length - 10} more additive changes
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  html += `
    </div>
  `;

  return html;
}

/**
 * Get all breaking changes from a comparison.
 * @param {object} comparison - Classified comparison
 * @returns {object[]} Array of breaking changes
 */
function getBreakingChanges(comparison) {
  const breaking = [];

  for (const change of comparison.containerChanges || []) {
    if (change.isBreaking) breaking.push(change);
  }

  for (const changes of Object.values(comparison.propertyChanges || {})) {
    for (const change of changes) {
      if (change.isBreaking) breaking.push(change);
    }
  }

  for (const change of comparison.relationshipChanges || []) {
    if (change.isBreaking) breaking.push(change);
  }

  return breaking;
}

/**
 * Get all additive (non-breaking) changes from a comparison.
 * @param {object} comparison - Classified comparison
 * @returns {object[]} Array of additive changes
 */
function getAdditiveChanges(comparison) {
  const additive = [];

  for (const change of comparison.containerChanges || []) {
    if (!change.isBreaking) additive.push(change);
  }

  for (const changes of Object.values(comparison.propertyChanges || {})) {
    for (const change of changes) {
      if (!change.isBreaking) additive.push(change);
    }
  }

  for (const change of comparison.relationshipChanges || []) {
    if (!change.isBreaking) additive.push(change);
  }

  return additive;
}

/**
 * Get a title for a change.
 * @param {object} change - Change object
 * @returns {string} Title string
 */
function getChangeTitle(change) {
  if (change.container && change.propertyPath) {
    return `${change.container}.${change.propertyPath}`;
  }
  if (change.container) {
    return change.container;
  }
  if (change.relationshipKey) {
    return change.relationshipKey;
  }
  return 'Unknown';
}

/**
 * Format a change type for display.
 * @param {string} changeType - Change type constant
 * @returns {string} Human-readable string
 */
function formatChangeType(changeType) {
  const mapping = {
    'ADDED': 'Property Added',
    'REMOVED': 'Property Removed',
    'TYPE_CHANGED': 'Type Changed',
    'OPTIONALITY_CHANGED': 'Optionality Changed',
    'FREQUENCY_CHANGED': 'Frequency Changed',
    'CONTAINER_ADDED': 'Container Added',
    'CONTAINER_REMOVED': 'Container Removed',
    'RELATIONSHIP_ADDED': 'Relationship Added',
    'RELATIONSHIP_REMOVED': 'Relationship Removed',
    'CARDINALITY_CHANGED': 'Cardinality Changed',
    'CONFIDENCE_CHANGED': 'Confidence Changed'
  };
  return mapping[changeType] || changeType;
}

/**
 * Escape HTML entities.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
