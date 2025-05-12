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
   * Determines if a log should be output based on the current log level
   * 
   * @param requiredLevel - Minimum log level required for the log
   * @returns Whether the log should be output
   */
  const shouldLog = (requiredLevel: LogLevel): boolean => {
    return process.env.NODE_ENV === 'development' && logLevel >= requiredLevel;
  };
  
  /**
   * Log critical error messages in development environment
   * 
   * Outputs critical error logs with application prefix, but only in development mode
   * and when log level is 1 or higher (CRITICAL, ERROR, WARN, INFO, DEBUG).
   * 
   * @param args - Arguments to log (will be passed directly to console.error)
   * @example
   * devCritical('Application crashed:', error);
   */
  export const devCritical = (...args: any[]): void => {
    if (shouldLog(LOG_LEVELS.CRITICAL)) {
      console.error('[TTS] CRITICAL:', ...args);
    }
  };
  
  /**
   * Log error messages in development environment
   * 
   * Outputs error logs with application prefix, but only in development mode
   * and when log level is 2 or higher (ERROR, WARN, INFO, DEBUG).
   * 
   * @param args - Arguments to log (will be passed directly to console.error)
   * @example
   * devError('Failed to fetch data:', error);
   */
  export const devError = (...args: any[]): void => {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error('[TTS] ERROR:', ...args);
    }
  };
  
  /**
   * Log warning messages in development environment
   * 
   * Outputs warning logs with application prefix, but only in development mode
   * and when log level is 3 or higher (WARN, INFO, DEBUG).
   * 
   * @param args - Arguments to log (will be passed directly to console.warn)
   * @example
   * devWarn('Deprecated function used:', functionName);
   */
  export const devWarn = (...args: any[]): void => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn('[TTS] WARN:', ...args);
    }
  };
  
  /**
   * Log information messages in development environment
   * 
   * Outputs standard console logs with application prefix, but only in development mode
   * and when log level is 4 or higher (INFO, DEBUG).
   * 
   * @param args - Arguments to log (will be passed directly to console.log)
   * @example
   * devLog('User logged in:', userId);
   */
  export const devLog = (...args: any[]): void => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log('[TTS] INFO:', ...args);
    }
  };
  
  /**
   * Log debug messages in development environment
   * 
   * Outputs debug logs with application prefix, but only in development mode
   * and when log level is 5 (DEBUG).
   * 
   * @param args - Arguments to log (will be passed directly to console.log)
   * @example
   * devDebug('State updated:', state);
   */
  export const devDebug = (...args: any[]): void => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log('[TTS] DEBUG:', ...args);
    }
  };
  
  /**
   * Export LOG_LEVELS for external use
   */
  export { LOG_LEVELS };