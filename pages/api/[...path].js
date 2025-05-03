/**
 * API Catch-All Route Handler
 * 
 * This module defines a Next.js catch-all route for handling all API requests under `/api/*`.
 * It routes requests to the appropriate handler in the `services/api` directory based on the
 * first path segment (e.g., `/api/mergeAudio` routes to `mergeAudioHandler`).
 * 
 * Logging is performed using the `logUtils` module to ensure consistency and suppression in
 * production environments. The route supports multiple API endpoints, including audio merging,
 * text-to-speech services, and utility tools.
 * 
 * @module pages/api/[...path]
 * @requires ../../services/api/mergeAudioAPI
 * @requires ../../services/api/speechEngineAPIs/awsPollyAPI
 * @requires ../../services/api/tools/extractTextFromUrlAPI
 * @requires ../../services/api/speechEngineAPIs/elevenLabsAPI
 * @requires ../../services/api/speechEngineAPIs/speechServiceAPI
 * @requires ../../services/api/tools/aiServiceAPI
 * @requires ../../services/api/storageServiceAPI
 * @requires ../../utils/logUtils
 */

import mergeAudioHandler from '../../services/api/mergeAudioAPI';
import awsPollyHandler from '../../services/api/speechEngineAPIs/awsPollyAPI';
import extractTextHandler from '../../services/api/tools/extractTextFromUrlAPI';
import elevenLabsHandler from '../../services/api/speechEngineAPIs/elevenLabsAPI';
import speechServiceHandler from '../../services/api/speechEngineAPIs/speechServiceAPI';
import aiServiceHandler from '../../services/api/tools/aiServiceAPI';
import storageServiceHandler from '../../services/api/storageServiceAPI';
import { devLog, devError } from '../../utils/logUtils';

// Map endpoint names to their handlers
/**
 * Mapping of API endpoint names to their respective handler functions.
 * Each key corresponds to the first path segment of an API route (e.g., `mergeAudio` for `/api/mergeAudio`).
 * 
 * @constant
 * @type {Object.<string, Function>}
 */
const apiRoutes = {
    mergeAudio: mergeAudioHandler,
    awsPolly: awsPollyHandler,
    extractTextFromUrl: extractTextHandler,
    elevenLabs: elevenLabsHandler,
    speechService: speechServiceHandler,
    aiService: aiServiceHandler,
    storageService: storageServiceHandler,
};

/**
 * Handles all API requests under `/api/*` by routing them to the appropriate handler.
 * 
 * This catch-all route extracts the endpoint from the request path and calls the corresponding
 * handler from `apiRoutes`. If no handler is found, it returns a 404 response. Errors during
 * handler execution result in a 500 response.
 * 
 * @async
 * @function handler
 * @param {Object} req - The Next.js request object
 * @param {string[]} req.query.path - Array of path segments (e.g., ['mergeAudio'] for /api/mergeAudio)
 * @param {string} req.url - The full URL of the request
 * @param {string} req.method - The HTTP method (e.g., POST, GET)
 * @param {Object} res - The Next.js response object
 * @returns {Promise<void>} Resolves when the response is sent
 * @throws {Error} If an error occurs in the handler, caught and returned as a 500 response
 */
export default async function handler(req, res) {
    // Extract the path segments from the query
    const { path } = req.query;
    // Get the first path segment as the endpoint (e.g., 'mergeAudio')
    const endpoint = path && path.length > 0 ? path[0] : null;

    // Log the incoming request details for debugging
    devLog(`API request received: /api/${endpoint || ''}`);

    // Check if the endpoint is valid and has a handler
    if (!endpoint || !apiRoutes[endpoint]) {
        devError(`No handler for endpoint: ${endpoint || 'none'}`);
        return res.status(404).json({
            message: `API route /api/${endpoint || ''} not found`,
        });
    }

    try {
        // Route the request to the appropriate handler
        devLog(`Routing to handler`);
        await apiRoutes[endpoint](req, res);
    } catch (error) {
        // Log and return any errors from the handler
        devError(`Error in ${endpoint} handler: ${error.message}`);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
}