import { parseTextFromHtml } from '../../../utils/textUtils';

/**
 * API handler for extracting text content from a URL
 * 
 * This endpoint fetches content from a provided URL and extracts the text content.
 * It handles different content types (HTML, plain text) appropriately.
 * 
 * @route POST /api/extractTextFromUrl
 * @param {Object} req - The request object
 * @param {Object} req.body - The request body
 * @param {string} req.body.url - The URL to fetch and process
 * @param {Object} res - The response object
 * @returns {Object} JSON response with the extracted text or error message
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ message: 'URL is required' });
    }

    try {
        // Fetch the URL content
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        // Get the content type
        const contentType = response.headers.get('content-type') || '';

        // Handle different content types
        if (contentType.includes('text/html')) {
            // Parse HTML content
            const html = await response.text();
            const text = parseTextFromHtml(html);

            return res.status(200).json({ text });
        } else if (contentType.includes('text/plain')) {
            // Return plain text directly
            const text = await response.text();

            return res.status(200).json({ text });
        } else {
            throw new Error(`Unsupported content type: ${contentType}`);
        }
    } catch (error) {
        return res.status(500).json({ message: `Error processing URL: ${error.message}` });
    }
}