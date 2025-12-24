/**
 * Simple logging utility with progress indication.
 * Supports quiet mode (errors only) and verbose mode (debug info).
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Log levels
const LEVELS = {
  quiet: 0,   // Errors only
  normal: 1,  // Standard output
  verbose: 2  // Debug info
};

let currentLevel = LEVELS.normal;

/**
 * Logger with formatted output.
 */
export const logger = {
  /**
   * Set the logging level
   */
  setLevel(level) {
    if (level === 'quiet') currentLevel = LEVELS.quiet;
    else if (level === 'verbose') currentLevel = LEVELS.verbose;
    else currentLevel = LEVELS.normal;
  },

  /**
   * Get current log level
   */
  getLevel() {
    if (currentLevel === LEVELS.quiet) return 'quiet';
    if (currentLevel === LEVELS.verbose) return 'verbose';
    return 'normal';
  },

  /**
   * Check if we should log at this level
   */
  shouldLog(level = LEVELS.normal) {
    return currentLevel >= level;
  },

  /**
   * Prints the application header.
   */
  header(version = '1.0.0') {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(`${COLORS.bright}${COLORS.cyan}CosmosMapper v${version}${COLORS.reset}`);
    console.log(`${COLORS.dim}${'='.repeat(40)}${COLORS.reset}`);
    console.log('');
  },

  /**
   * Logs an informational message.
   */
  info(message) {
    if (!this.shouldLog()) return;
    console.log(`${COLORS.blue}ℹ${COLORS.reset} ${message}`);
  },

  /**
   * Logs a success message.
   */
  success(message) {
    if (!this.shouldLog()) return;
    console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
  },

  /**
   * Logs a warning message.
   */
  warn(message) {
    if (!this.shouldLog()) return;
    console.log(`${COLORS.yellow}⚠${COLORS.reset} ${message}`);
  },

  /**
   * Logs an error message. Always shown regardless of level.
   */
  error(message, error = null) {
    console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
    if (error && (process.env.DEBUG || currentLevel === LEVELS.verbose)) {
      console.error(error);
    }
  },

  /**
   * Logs a section header.
   */
  section(title) {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(`${COLORS.bright}${title}${COLORS.reset}`);
  },

  /**
   * Logs a sub-item with indentation.
   */
  item(message, indent = 1) {
    if (!this.shouldLog()) return;
    const prefix = '  '.repeat(indent) + '→';
    console.log(`${COLORS.dim}${prefix}${COLORS.reset} ${message}`);
  },

  /**
   * Logs progress for a container.
   */
  container(name, docCount, status = 'ok') {
    if (!this.shouldLog()) return;
    const statusIcon = status === 'ok'
      ? `${COLORS.green}✓${COLORS.reset}`
      : status === 'empty'
        ? `${COLORS.yellow}○${COLORS.reset}`
        : `${COLORS.red}✗${COLORS.reset}`;

    const docLabel = docCount === 1 ? 'doc' : 'docs';
    console.log(`  ${statusIcon} ${name} (${docCount} ${docLabel})`);
  },

  /**
   * Logs a summary statistic.
   */
  stat(label, value) {
    if (!this.shouldLog()) return;
    console.log(`  ${COLORS.dim}${label}:${COLORS.reset} ${value}`);
  },

  /**
   * Logs completion message.
   */
  done(outputPath) {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(`${COLORS.green}${COLORS.bright}Done!${COLORS.reset} Documentation generated in ${COLORS.cyan}${outputPath}${COLORS.reset}`);
    console.log('');
  },

  /**
   * Logs a blank line.
   */
  blank() {
    if (!this.shouldLog()) return;
    console.log('');
  },

  /**
   * Logs debug information (verbose mode only).
   */
  debug(message) {
    if (currentLevel < LEVELS.verbose) return;
    console.log(`${COLORS.magenta}[debug]${COLORS.reset} ${message}`);
  },

  /**
   * Logs a watch mode notification.
   */
  watch(message) {
    console.log(`${COLORS.cyan}[watch]${COLORS.reset} ${message}`);
  }
};
