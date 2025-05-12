/**
 * API Catch-All Route Handler
 * 
 * This module defines a Next.js catch-all route for handling all API requests under `/api/*`.
 * It routes requests to the appropriate handler in the `services/api` directory based on the
 * first path segment (e.g., `/api/mergeAudio` routes to `mergeAudioHandler`).
 * 
 * Logging is performed using the `logUtils` module to ensure consistency and suppression in
 * production environments. The route supports multiple API endpoints, including audio merging,
 * text-to-speech services, storage services, and utility tools.
 * 
 * @module pages/api/[...path]
 * @requires ../../services/api/mergeAudioAPI
 * @requires ../../services/api/speechEngineAPIs/awsPollyAPI
 * @requires ../../services/api/tools/extractTextFromUrlAPI
 * @requires ../../services/api/speechEngineAPIs/elevenLabsAPI
 * @requires ../../services/api/speechEngineAPIs/speechServiceAPI
 * @requires ../../services/api/tools/aiServiceAPI
 * @requires ../../services/api/storageServiceAPI
 * @requires ../../services/api/fileConfigAPI
 * @requires ../../utils/logUtils
 */

import mergeAudioHandler from '../../services/api/mergeAudioAPI';
import awsPollyHandler from '../../services/api/speechEngineAPIs/awsPollyAPI';
import extractTextHandler from '../../services/api/tools/extractTextFromUrlAPI';
import elevenLabsHandler from '../../services/api/speechEngineAPIs/elevenLabsAPI';
import speechServiceHandler from '../../services/api/speechEngineAPIs/speechServiceAPI';
import aiServiceHandler from '../../services/api/tools/aiServiceAPI';
import storageServiceHandler from '../../services/api/storageServiceAPI';
import fileConfigHandler from '../../services/api/fileConfigAPI';
import { devLog, devError } from '../../utils/logUtils';
import getRawBody from 'raw-body'; // For manual body parsing

// Map endpoint names to their handlers
const apiRoutes = {
    mergeAudio: mergeAudioHandler,
    awsPolly: awsPollyHandler,
    extractTextFromUrl: extractTextHandler,
    elevenLabs: elevenLabsHandler,
    speechService: speechServiceHandler,
    aiService: aiServiceHandler,
    storageService: storageServiceHandler,
    config: fileConfigHandler,
};

// Simple in-memory cache system for API responses
const responseCache = {
    // Cache structure: { [cacheKey]: { data: any, timestamp: number } }
    cache: {},

    // Generate a cache key from the request
    getKey(req, path) {
        // Use a combination of method, path and query params for the cache key
        const queryString = new URLSearchParams(req.query).toString();
        return `${req.method}:${path.join('/')}:${queryString}`;
    },

    // Get cached response if available and not expired
    get(key, ttlMs = 10000) { // Default TTL: 10 seconds
        const entry = this.cache[key];
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > ttlMs) {
            // Cache entry expired
            delete this.cache[key];
            return null;
        }

        return entry.data;
    },

    // Store response in cache
    set(key, data, ttlMs = 10000) {
        this.cache[key] = {
            data,
            timestamp: Date.now()
        };

        // Schedule cleanup after TTL
        setTimeout(() => {
            delete this.cache[key];
        }, ttlMs);
    }
};

// Rate limiting to prevent excessive identical requests
const rateLimiter = {
    // Store timestamps of recent requests
    requests: {},

    // Check if request is allowed or rate limited
    isAllowed(key, intervalMs = 2000) { // Default interval: 2 seconds
        const now = Date.now();
        const lastRequest = this.requests[key];

        if (!lastRequest || (now - lastRequest) > intervalMs) {
            // Allow request and update timestamp
            this.requests[key] = now;
            return true;
        }

        // Rate limit exceeded
        return false;
    }
};

/**
 * Handles all API requests under `/api/*` by routing them to the appropriate handler.
 * 
 * This catch-all route extracts the endpoint from the request path and calls the corresponding
 * handler from `apiRoutes`. For JSON-based routes (e.g., mergeAudio), it manually parses the body
 * if Content-Type is application/json. Streaming routes (e.g., storageService/upload) bypass parsing.
 * 
 * @async
 * @function handler
 * @param {Object} req - The Next.js request object
 * @param {string|string[]} req.query.path - Array of path segments or single string
 * @param {string} req.url - The full URL of the request
 * @param {string} req.method - The HTTP method (e.g., POST, GET)
 * @param {Object} res - The Next.js response object
 * @returns {Promise<void>} Resolves when the response is sent
 * @throws {Error} If an error occurs in the handler, caught and returned as a 500 response
 */
export default async function handler(req, res) {
    // Normalize path to an array
    const path = Array.isArray(req.query.path) ? req.query.path : typeof req.query.path === 'string' ? [req.query.path] : [];
    const endpoint = path.length > 0 ? path[0] : null;

    // Log the incoming request details for debugging
    devLog(`API request received: /api/${path.join('/') || ''} [${req.method}]`);

    // Check if the endpoint is valid and has a handler
    if (!endpoint || !apiRoutes[endpoint]) {
        devError(`No handler for endpoint: ${endpoint || 'none'}`);
        return res.status(404).json({
            message: `API route /api/${path.join('/') || ''} not found`,
        });
    }

    // Special handling for repeated list requests
    if (endpoint === 'storageService' && path.length > 1 && path[1] === 'list' && req.method === 'GET') {
        const cacheKey = responseCache.getKey(req, path);

        // Check rate limiter first - more strict rate limiting for list requests
        if (!rateLimiter.isAllowed(cacheKey, 2000)) { // 2 second interval for list requests
            devLog(`Rate limiting applied for ${req.method}:${path.join('/')}`);
            return res.status(429).json({
                message: 'Too many requests. Please try again later.',
                retryAfter: 2, // Retry after 2 seconds
                success: false,
                rateLimited: true
            });
        }

        // Check cache - longer cache lifetime for list responses
        const cachedResponse = responseCache.get(cacheKey, 10000); // 10 second TTL for list responses
        if (cachedResponse) {
            devLog(`Serving cached response for ${req.method}:${path.join('/')}`);
            // Note: We're still returning a 200 status for cached empty arrays, which is correct behavior
            return res.status(200).json(cachedResponse);
        }

        // If not in cache, wrap the response to cache it
        const originalJson = res.json;
        res.json = function(data) {
            // Cache the successful response including empty arrays
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Always cache list responses, even if they're empty arrays
                // This prevents repeated calls for empty files
                responseCache.set(cacheKey, data, 10000);

                // For empty arrays, cache them longer since they're less likely to change
                if (Array.isArray(data) && data.length === 0) {
                    responseCache.set(cacheKey, data, 30000); // 30 seconds for empty arrays
                }
            }
            return originalJson.call(this, data);
        };
    }

    // For debugging file uploads
    if (endpoint === 'storageService' && path[1] === 'upload' && req.method === 'POST') {
        devLog('Storage service upload request received');
        try {
            const contentType = req.headers['content-type'];
            devLog(`Content-Type: ${contentType}`);
            if (contentType && contentType.includes('multipart/form-data')) {
                devLog('Request is multipart/form-data');
            }
        } catch (e) {
            devError('Error during request debug logging', e);
        }
    }

    // Manually parse JSON body for non-streaming routes
    if (req.method === 'POST' && endpoint !== 'storageService') {
        try {
            const contentType = req.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                const rawBody = await getRawBody(req);
                req.body = JSON.parse(rawBody.toString('utf8'));
                devLog(`Parsed JSON body for ${endpoint}:`, req.body);
            }
        } catch (error) {
            devError(`Failed to parse JSON body for ${endpoint}:`, error.message);
            return res.status(400).json({ message: 'Invalid JSON body' });
        }
    }

    try {
        // Route the request to the appropriate handler
        devLog(`Routing to ${endpoint} handler`);
        await apiRoutes[endpoint](req, res);
    } catch (error) {
        devError(`Error in ${endpoint} handler: ${error.message}`, error.stack);
        let errorResponse = {
            message: `Server error: ${error.message}`,
            path: `/api/${path.join('/')}`,
            method: req.method
        };
        if (error.code) {
            errorResponse.code = error.code;
        }
        res.status(500).json(errorResponse);
    }
}

/**
 * Config object for the API route
 * bodyParser is disabled to allow streaming for storageService/upload
 * Response limit is disabled to allow large file responses
 */
export const config = {
    api: {
        bodyParser: false,
        responseLimit: false
    }
};