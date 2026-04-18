/**
 * logger.js
 * @module logger
 * @description Centralised logging service for StadiumIQ.
 * Provides environment-aware logging levels (DEBUG, INFO, WARN, ERROR)
 * and consistent module tagging. Replaces direct `console` usage.
 * Built for Cloud Logging integration where stdout/stderr streams
 * are aggregated and analysed.
 */

// Define log levels
const LEVELS = {
  DEBUG: 1,
  INFO:  2,
  WARN:  3,
  ERROR: 4,
  NONE:  5,
};

// Default log level (can be overridden via localStorage for debugging on prod)
let currentLevel = LEVELS.INFO;

// Try to load override from localStorage safely
try {
  if (typeof window !== "undefined" && window.localStorage?.getItem("LOG_LEVEL")) {
    const override = window.localStorage.getItem("LOG_LEVEL").toUpperCase();
    if (LEVELS[override]) currentLevel = LEVELS[override];
  }
} catch (e) {
  // Ignore localStorage access errors (e.g. incognito mode permissions)
}

/**
 * Format a log message with consistently structured tags.
 *
 * @param {string} module - The module name (e.g. "auth", "ai")
 * @param {string} msg    - The main log message
 * @returns {string} The formatted message block
 * @private
 */
function formatMessage(module, msg) {
  return `[StadiumIQ:${module.padStart(9)}] ${msg}`;
}

export const logger = {
  /**
   * Log fine-grained debug info. Muted by default in production.
   * @param {string} module - Emitting module
   * @param {string} msg    - Message
   * @param {...any} args   - Additional payload
   */
  debug: (module, msg, ...args) => {
    if (currentLevel <= LEVELS.DEBUG) {
      console.debug(formatMessage(module, msg), ...args);
    }
  },

  /**
   * Log application lifecycle events.
   * @param {string} module - Emitting module
   * @param {string} msg    - Message
   * @param {...any} args   - Additional payload
   */
  info: (module, msg, ...args) => {
    if (currentLevel <= LEVELS.INFO) {
      console.info(formatMessage(module, msg), ...args);
    }
  },

  /**
   * Log degraded states or recoverable errors.
   * @param {string} module - Emitting module
   * @param {string} msg    - Message
   * @param {...any} args   - Additional payload
   */
  warn: (module, msg, ...args) => {
    if (currentLevel <= LEVELS.WARN) {
      console.warn(formatMessage(module, msg), ...args);
    }
  },

  /**
   * Log critical pipeline failures.
   * @param {string} module - Emitting module
   * @param {string} msg    - Message
   * @param {...any} args   - Additional payload
   */
  error: (module, msg, ...args) => {
    if (currentLevel <= LEVELS.ERROR) {
      console.error(formatMessage(module, msg), ...args);
    }
  },

  /**
   * Allow dynamic reconfiguration of log level.
   * @param {"DEBUG"|"INFO"|"WARN"|"ERROR"|"NONE"} level
   */
  setLevel: (level) => {
    if (LEVELS[level]) currentLevel = LEVELS[level];
  }
};
