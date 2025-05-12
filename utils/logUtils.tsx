/**
 * Logging Utilities Module
 * 
 * Provides consistent logging functions with adjustable verbosity to control log volume.
 * Logs only output in development environments. All logs are prefixed with '[TTS]' for
 * easier identification in the console. Log volume can be reduced by setting a lower log level.
 * 
 * @module logUtils
 */

/**
 * Log level constants for internal use
 */
const LOG_LEVELS = {
  SILENT: 0,
  CRITICAL: 1,
  ERROR: 2,
  WARN: 3,
  INFO: 4,
  DEBUG: 5,
} as const;

/**
 * Type for valid log levels
 */
type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

/**
 * Current log level. Controls verbosity:
 * 0 = Silent (no logs)
 * 1 = Critical errors only
 * 2 = All errors (critical + non-critical)
 * 3 = Errors and warnings
 * 4 = Errors, warnings, and info
 * 5 = All logs (including debug)
 */
let logLevel: LogLevel = LOG_LEVELS.ERROR;

/**
 * Sets the log level to control verbosity
 * 
 * @param level - Log level (0-5)
 * @throws {Error} If level is not 0, 1, 2, 3, 4, or 5
 * @example
 * setLogLevel(2); // Only critical and non-critical errors will be logged
 */
export const setLogLevel = (level: LogLevel): void => {
  if (!Object.values(LOG_LEVELS).includes(level)) {
    throw new Error('Log level must be 0 (silent), 1 (critical), 2 (errors), 3 (warnings), 4 (info), or 5 (debug)');
  }
  logLevel = level;
};

/**
 * Determines if a log should be output based on the current log level or force parameter
 * 
 * @param requiredLevel - Minimum log level required for the log
 * @param force - Optional flag to bypass log level check
 * @returns Whether the log should be output
 */
const shouldLog = (requiredLevel: LogLevel, force: boolean = false): boolean => {
  return process.env.NODE_ENV === 'development' && (force || logLevel >= requiredLevel);
};

/**
 * Log critical error messages in development environment
 * 
 * Outputs critical error logs with application prefix, but only in development mode
 * and when log level is 1 or higher (CRITICAL, ERROR, WARN, INFO, DEBUG), or when force is true.
 * 
 * @param args - Arguments to log (will be passed directly to console.error)
 * @param force - Optional flag to force logging regardless of log level
 * @example
 * devCritical('Application crashed:', error, true); // Forces log even if level < CRITICAL
 */
export const devCritical = (...args: [...any[], boolean?]): void => {
  const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : false;
  if (shouldLog(LOG_LEVELS.CRITICAL, force)) {
    console.error('[TTS] CRITICAL:', ...args);
  }
};

/**
 * Log error messages in development environment
 * 
 * Outputs error logs with application prefix, but only in development mode
 * and when log level is 2 or higher (ERROR, WARN, INFO, DEBUG), or when force is true.
 * 
 * @param args - Arguments to log (will be passed directly to console.error)
 * @param force - Optional flag to force logging regardless of log level
 * @example
 * devError('Failed to fetch data:', error, true); // Forces log even if level < ERROR
 */
export const devError = (...args: [...any[], boolean?]): void => {
  const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : false;
  if (shouldLog(LOG_LEVELS.ERROR, force)) {
    console.error('[TTS] ERROR:', ...args);
  }
};

/**
 * Log warning messages in development environment
 * 
 * Outputs warning logs with application prefix, but only in development mode
 * and when log level is 3 or higher (WARN, INFO, DEBUG), or when force is true.
 * 
 * @param args - Arguments to log (will be passed directly to console.warn)
 * @param force - Optional flag to force logging regardless of log level
 * @example
 * devWarn('Deprecated function used:', functionName, true); // Forces log even if level < WARN
 */
export const devWarn = (...args: [...any[], boolean?]): void => {
  const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : false;
  if (shouldLog(LOG_LEVELS.WARN, force)) {
    console.warn('[TTS] WARN:', ...args);
  }
};

/**
 * Log information messages in development environment
 * 
 * Outputs standard console logs with application prefix, but only in development mode
 * and when log level is 4 or higher (INFO, DEBUG), or when force is true.
 * 
 * @param args - Arguments to log (will be passed directly to console.log)
 * @param force - Optional flag to force logging regardless of log level
 * @example
 * devLog('User logged in:', userId, true); // Forces log even if level < INFO
 */
export const devLog = (...args: [...any[], boolean?]): void => {
  const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : false;
  if (shouldLog(LOG_LEVELS.INFO, force)) {
    console.log('[TTS] INFO:', ...args);
  }
};

/**
 * Log debug messages in development environment
 * 
 * Outputs debug logs with application prefix, but only in development mode
 * and when log level is 5 (DEBUG), or when force is true.
 * 
 * @param args - Arguments to log (will be passed directly to console.log)
 * @param force - Optional flag to force logging regardless of log level
 * @example
 * devDebug('State updated:', state, true); // Forces log even if level < DEBUG
 */
export const devDebug = (...args: [...any[], boolean?]): void => {
  const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : false;
  if (shouldLog(LOG_LEVELS.DEBUG, force)) {
    console.log('[TTS] DEBUG:', ...args);
  }
};

/**
 * Export LOG_LEVELS for external use
 */
export { LOG_LEVELS };