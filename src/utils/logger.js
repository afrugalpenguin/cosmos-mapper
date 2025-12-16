/**
 * Simple logging utility with progress indication.
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

/**
 * Logger with formatted output.
 */
export const logger = {
  /**
   * Prints the application header.
   */
  header(version = '1.0.0') {
    console.log('');
    console.log(`${COLORS.bright}${COLORS.cyan}CosmosMapper v${version}${COLORS.reset}`);
    console.log(`${COLORS.dim}${'='.repeat(40)}${COLORS.reset}`);
    console.log('');
  },

  /**
   * Logs an informational message.
   */
  info(message) {
    console.log(`${COLORS.blue}ℹ${COLORS.reset} ${message}`);
  },

  /**
   * Logs a success message.
   */
  success(message) {
    console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
  },

  /**
   * Logs a warning message.
   */
  warn(message) {
    console.log(`${COLORS.yellow}⚠${COLORS.reset} ${message}`);
  },

  /**
   * Logs an error message.
   */
  error(message, error = null) {
    console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
    if (error && process.env.DEBUG) {
      console.error(error);
    }
  },

  /**
   * Logs a section header.
   */
  section(title) {
    console.log('');
    console.log(`${COLORS.bright}${title}${COLORS.reset}`);
  },

  /**
   * Logs a sub-item with indentation.
   */
  item(message, indent = 1) {
    const prefix = '  '.repeat(indent) + '→';
    console.log(`${COLORS.dim}${prefix}${COLORS.reset} ${message}`);
  },

  /**
   * Logs progress for a container.
   */
  container(name, docCount, status = 'ok') {
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
    console.log(`  ${COLORS.dim}${label}:${COLORS.reset} ${value}`);
  },

  /**
   * Logs completion message.
   */
  done(outputPath) {
    console.log('');
    console.log(`${COLORS.green}${COLORS.bright}Done!${COLORS.reset} Documentation generated in ${COLORS.cyan}${outputPath}${COLORS.reset}`);
    console.log('');
  },

  /**
   * Logs a blank line.
   */
  blank() {
    console.log('');
  }
};
