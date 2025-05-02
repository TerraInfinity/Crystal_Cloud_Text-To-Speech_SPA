/**
 * Logging Utilities Module
 * 
 * Provides consistent logging functions that only output in development environments.
 * Helps with debugging while ensuring no sensitive information is logged in production.
 * All logs are prefixed with '[TTS]' for easier identification in the console.
 * 
 * @module logUtils
 */

/**
 * Log information messages in development environment
 * 
 * Outputs standard console logs with application prefix, but only in development mode.
 * Safe to use throughout the application as logs will be automatically suppressed in production.
 * 
 * @param {...any} args - Arguments to log (will be passed directly to console.log)
 * @example
 * devLog('User logged in:', userId);
 */
export const devLog = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[TTS]', ...args);
    }
};

/**
 * Log error messages in development environment
 * 
 * Outputs error logs with application prefix, but only in development mode.
 * Uses console.error to ensure proper formatting in browser dev tools.
 * 
 * @param {...any} args - Arguments to log (will be passed directly to console.error)
 * @example
 * devError('Failed to fetch data:', error);
 */
export const devError = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.error('[TTS]', ...args);
    }
};

/**
 * Log warning messages in development environment
 * 
 * Outputs warning logs with application prefix, but only in development mode.
 * Uses console.warn to ensure proper formatting in browser dev tools.
 * 
 * @param {...any} args - Arguments to log (will be passed directly to console.warn)
 * @example
 * devWarn('Deprecated function used:', functionName);
 */
export const devWarn = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.warn('[TTS]', ...args);
    }
};