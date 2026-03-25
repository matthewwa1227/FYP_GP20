/**
 * Environment-aware Logger Utility
 * 
 * MISSION 59: Filter debug logs in production while keeping essential logs visible.
 * 
 * Usage:
 *   const logger = require('../utils/logger');
 *   
 *   logger.error('Critical error');        // Always visible (❌)
 *   logger.info('HTTP status');            // Always visible (ℹ️)
 *   logger.success('Generation complete'); // Always visible (✅)
 *   logger.warn('Warning message');        // Always visible (⚠️)
 *   logger.debug('Debug details');         // Dev only (🔍)
 *   logger.mission(59, 'Task complete');   // Dev only (🚀 MISSION XX:)
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  /**
   * Error logs - ALWAYS visible in all environments
   * Use for: Critical errors, failures, exceptions
   */
  error: (...args) => console.error('❌', ...args),

  /**
   * Info logs - ALWAYS visible in all environments
   * Use for: HTTP status, general information
   */
  info: (...args) => console.log('ℹ️', ...args),

  /**
   * Success logs - ALWAYS visible in all environments
   * Use for: Completion confirmations, successful operations
   */
  success: (...args) => console.log('✅', ...args),

  /**
   * Warning logs - ALWAYS visible in all environments
   * Use for: Non-critical issues, fallbacks, attention needed
   */
  warn: (...args) => console.log('⚠️', ...args),

  /**
   * Debug logs - DEV ONLY
   * Use for: Detailed debugging, development traces
   */
  debug: (...args) => {
    if (!isProduction) {
      console.log('🔍', ...args);
    }
  },

  /**
   * HTTP/API logs - DEV ONLY
   * Use for: API calls, response previews, status codes in dev
   */
  http: (...args) => {
    if (!isProduction) {
      console.log('📡', ...args);
    }
  },

  /**
   * Data/Content logs - DEV ONLY
   * Use for: Raw responses, content previews, parsing details
   */
  data: (...args) => {
    if (!isProduction) {
      console.log('📦', ...args);
    }
  },

  /**
   * Mission-specific logs - DEV ONLY
   * Use for: Mission tracking during development
   * @param {number} num - Mission number
   * @param {...any} args - Log message parts
   */
  mission: (num, ...args) => {
    if (!isProduction) {
      console.log(`🚀 MISSION ${num}:`, ...args);
    }
  },

  /**
   * Image/Vision logs - DEV ONLY
   * Use for: Image processing, vision API details
   */
  image: (...args) => {
    if (!isProduction) {
      console.log('🖼️', ...args);
    }
  },

  /**
   * Document/File logs - DEV ONLY
   * Use for: File uploads, document analysis details
   */
  file: (...args) => {
    if (!isProduction) {
      console.log('📁', ...args);
    }
  },

  /**
   * AI/Generation logs - DEV ONLY
   * Use for: AI generation details, token usage, prompts
   */
  ai: (...args) => {
    if (!isProduction) {
      console.log('🤖', ...args);
    }
  },

  /**
   * Timing/Performance logs - DEV ONLY
   * Use for: Execution time, timeouts, performance metrics
   */
  time: (...args) => {
    if (!isProduction) {
      console.log('⏱️', ...args);
    }
  },

  /**
   * Progress logs - DEV ONLY
   * Use for: Long-running operation progress updates
   */
  progress: (...args) => {
    if (!isProduction) {
      console.log('⏳', ...args);
    }
  },

  /**
   * Raw console access - DEV ONLY
   * Use sparingly for special cases
   */
  raw: (...args) => {
    if (!isProduction) {
      console.log(...args);
    }
  }
};

module.exports = logger;
