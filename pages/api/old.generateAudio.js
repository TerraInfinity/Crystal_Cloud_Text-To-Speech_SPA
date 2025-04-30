import speechService from '../../services/speechService';
import axios from 'axios';

/**
 * API handler for generating audio segments from a script.
 * Supports both local and remote processing modes.
 * 
 * @async
 * @function handler
 * @param {Object} req - The incoming HTTP request object.
 * @param {Object} req.body - The request body containing script, processingMode, remoteEndpoint, and other config options.
 * @param {string} [req.body.processingMode='local'] - The processing mode ('local' or 'remote').
 * @param {string} [req.body.remoteEndpoint] - The remote server endpoint for remote processing.
 * @param {Array<string>} [req.body.script] - The array of script lines for audio generation (required for local processing).
 * @param {Object} [req.body] - Additional configuration options for audio generation.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>} Responds with generated audio segments or an error message.
 */
export default async function handler(req, res) {
    // Restrict to POST requests only
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Extract processingMode, remoteEndpoint, script, and other config from request body
        const { processingMode = 'local', remoteEndpoint, script, ...config } = req.body;

        // Handle remote processing mode
        if (processingMode === 'remote') {
            // Validate remoteEndpoint presence
            if (!remoteEndpoint) {
                return res.status(400).json({ error: 'Missing remoteEndpoint for remote processing.' });
            }
            // Forward request to remote server
            const response = await axios.post(`${remoteEndpoint}/generate-audio`, { script, ...config });
            return res.status(200).json(response.data);
        } else {
            // Handle local processing mode
            // Validate script as an array
            if (!Array.isArray(script)) {
                return res.status(400).json({ error: 'Missing or invalid "script" array in request body.' });
            }
            // Generate audio segments using local speech service
            const segments = await speechService.generate_audio_segments(script);
            return res.status(200).json({ segments });
        }
    } catch (error) {
        // Log and handle any errors during processing
        console.error('Error in generateAudio API:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}