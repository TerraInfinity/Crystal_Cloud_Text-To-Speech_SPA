import { devLog } from '../../../utils/logUtils';

/**
 * Utility module for interacting with the ElevenLabs API.
 * Provides functions for text-to-speech conversion and retrieving available voices.
 * @module elevenLabsAPI
 */

/**
 * Convert text to speech using the ElevenLabs API, trying multiple API keys if provided.
 * 
 * @param {string} text - The text to convert to speech.
 * @param {Object} options - Options for speech synthesis.
 * @param {string[]} options.apiKeys - Array of ElevenLabs API keys (required).
 * @param {string} options.voiceId - Voice ID (required).
 * @param {number} [options.stability=0.75] - Stability setting (0-1).
 * @param {number} [options.similarity_boost=0.75] - Similarity boost (0-1).
 * @param {string} [options.title] - Title for file naming (optional).
 * @param {number} [options.increment] - Incremental number for file naming.
 * @returns {Promise<{audioBuffer: ArrayBuffer, mimeType: string, text: string, title: string, increment: number}>} - Audio buffer, MIME type, and metadata.
 * @throws {Error} - If no valid API key is provided or all requests fail.
 */
async function textToSpeech(text, options: { 
    apiKeys?: any[]; 
    voiceId?: string; 
    stability?: number; 
    similarity_boost?: number; 
    title?: string; 
    increment?: number 
} = {}) {
    devLog('textToSpeech called', { 
        text, 
        optionsType: typeof options,
        hasApiKeys: !!options.apiKeys,
        apiKeysType: options.apiKeys ? typeof options.apiKeys : 'undefined',
        apiKeysIsArray: options.apiKeys ? Array.isArray(options.apiKeys) : false,
        apiKeysLength: options.apiKeys ? options.apiKeys.length : 0,
        voiceId: options.voiceId
    });
    
    const { 
        apiKeys = [], 
        voiceId, 
        stability = 0.75, 
        similarity_boost = 0.75, 
        title = 'audio', 
        increment = 1 
    } = options;

    if (!apiKeys.length) {
        devLog('textToSpeech: No API keys provided');
        throw new Error('At least one ElevenLabs API key is required');
    }

    if (!voiceId) {
        devLog('textToSpeech: No voice ID provided');
        throw new Error('Voice ID is required for ElevenLabs');
    }

    let lastError = null;

    // Log the API keys for debugging (masked)
    devLog('Processing API keys:', apiKeys.map(key => {
        if (typeof key === 'object' && key !== null) {
            // If we received an object with a key property, extract it
            if (key && 'key' in key && key.key) {
                const maskedKey = key.key.length > 8 ? 
                    `${key.key.substring(0, 4)}...${key.key.substring(key.key.length - 4)}` : 
                    '(short key)';
                return `Object with key property: ${maskedKey}`;
            }
            return 'Object without key property';
        } else if (typeof key === 'string') {
            // If it's a string, mask it for the logs
            const maskedKey = key.length > 8 ? 
                `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : 
                '(short key)';
            return `String key: ${maskedKey}`;
        }
        return `Unknown type: ${typeof key}`;
    }));

    for (let i = 0; i < apiKeys.length; i++) {
        let apiKey = apiKeys[i];
        const keyName = typeof apiKey === 'object' && apiKey?.name ? apiKey.name : `Key ${i}`;
        
        // Handle if apiKey is an object with a key property
        if (typeof apiKey === 'object' && apiKey !== null && 'key' in apiKey && apiKey.key) {
            const maskedOriginal = typeof apiKey.key === 'string' && apiKey.key.length > 8 ?
                `${apiKey.key.substring(0, 4)}...${apiKey.key.substring(apiKey.key.length - 4)}` :
                '(short or invalid key)';
            devLog(`Converting object with key property to string key: ${maskedOriginal}`);
            apiKey = apiKey.key;
        }
        
        if (typeof apiKey !== 'string') {
            devLog(`Skipping invalid API key at index ${i}, type: ${typeof apiKey}`);
            continue;
        }
        
        if (!apiKey || apiKey.trim() === '') {
            devLog(`Skipping empty API key at index ${i}`);
            continue;
        }
        
        try {
            const maskedKey = apiKey.length > 8 ?
                `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` :
                '(short key)';
            devLog(`Attempting API request with key ${keyName}: ${maskedKey} (length: ${apiKey.length})`);
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey,
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability,
                        similarity_boost,
                    },
                }),
            });

            devLog(`textToSpeech response status for key ${keyName}:`, response.status);

            if (!response.ok) {
                let errorDetail = '';
                try {
                    const errorJson = await response.json();
                    errorDetail = errorJson.detail?.message || errorJson.detail || JSON.stringify(errorJson);
                    devLog('textToSpeech error response JSON:', errorJson);
                } catch (jsonError) {
                    // If not JSON, try to get text
                    try {
                        errorDetail = await response.text();
                        devLog('textToSpeech error response text:', errorDetail);
                    } catch (textError) {
                        errorDetail = response.statusText;
                    }
                }
                
                // Create a more informative error message
                let errorMessage;
                if (response.status === 401) {
                    errorMessage = 'Invalid API key: Authentication failed';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded: Too many requests';
                } else if (response.status === 400) {
                    errorMessage = `Bad request: ${errorDetail}`;
                } else {
                    errorMessage = `ElevenLabs API error (${response.status}): ${errorDetail || response.statusText}`;
                }
                
                lastError = new Error(errorMessage);
                devLog(`textToSpeech failed for key ${keyName}:`, errorMessage);
                continue;
            }

            const audioBuffer = await response.arrayBuffer();
            devLog(`textToSpeech audioBuffer length for key ${keyName}:`, audioBuffer.byteLength);
            
            // Add token usage information to the response for client-side tracking
            return {
                audioBuffer,
                mimeType: 'audio/mpeg',
                text,
                title,
                increment,
                usedKey: keyName, // Return the key name for token updates
                usedKeyIndex: i,   // Return index for reference
                textLength: text.length // Return text length for token calculations
            };
        } catch (error) {
            devLog(`textToSpeech failed with API key ${keyName}:`, error);
            lastError = error;
        }
    }

    devLog('textToSpeech: All API keys failed');
    throw new Error(`ElevenLabs text-to-speech failed: ${lastError?.message || 'All API keys exhausted'}`);
}

/**
 * Retrieve available voices from the ElevenLabs API using the first valid API key.
 * 
 * @param {string[]} apiKeys - Array of ElevenLabs API keys (required).
 * @returns {Promise<Array>} - Promise resolving to an array of voice objects.
 * @throws {Error} - If no valid API key is provided or all requests fail.
 */
async function getVoices(apiKeys) {
    devLog('getVoices called');
    if (!apiKeys.length) {
        devLog('getVoices: No API keys provided');
        throw new Error('At least one ElevenLabs API key is required');
    }

    let lastError = null;

    // Log the API keys for debugging (masked)
    devLog('getVoices - Processing API keys:', apiKeys.map((key, index) => {
        if (typeof key === 'object' && key !== null) {
            // If we received an object with a key property, extract it
            if (key && 'key' in key && key.key) {
                const maskedKey = key.key.length > 8 ? 
                    `${key.key.substring(0, 4)}...${key.key.substring(key.key.length - 4)}` : 
                    '(short key)';
                return `Key ${index}: Object with key property: ${maskedKey}`;
            }
            return `Key ${index}: Object without key property`;
        } else if (typeof key === 'string') {
            // If it's a string, mask it for the logs
            const maskedKey = key.length > 8 ? 
                `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : 
                '(short key)';
            return `Key ${index}: String key: ${maskedKey}`;
        }
        return `Key ${index}: Unknown type: ${typeof key}`;
    }));

    for (let i = 0; i < apiKeys.length; i++) {
        let apiKey = apiKeys[i];
        const keyName = typeof apiKey === 'object' && apiKey?.name ? apiKey.name : `Key ${i}`;
        
        // Handle if apiKey is an object with a key property
        if (typeof apiKey === 'object' && apiKey !== null && 'key' in apiKey && apiKey.key) {
            const maskedOriginal = typeof apiKey.key === 'string' && apiKey.key.length > 8 ?
                `${apiKey.key.substring(0, 4)}...${apiKey.key.substring(apiKey.key.length - 4)}` :
                '(short or invalid key)';
            devLog(`getVoices: Converting object with key property to string key: ${maskedOriginal}`);
            apiKey = apiKey.key;
        }
        
        if (typeof apiKey !== 'string') {
            devLog(`getVoices: Skipping invalid API key at index ${i}, type: ${typeof apiKey}`);
            continue;
        }
        
        if (!apiKey || apiKey.trim() === '') {
            devLog(`getVoices: Skipping empty API key at index ${i}`);
            continue;
        }
        
        try {
            const maskedKey = apiKey.length > 8 ?
                `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` :
                '(short key)';
            devLog(`getVoices: Attempting API request with key ${keyName}: ${maskedKey}`);
            
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey,
                },
            });

            devLog(`getVoices response status for key ${keyName}:`, response.status);

            if (!response.ok) {
                let errorDetail = '';
                try {
                    const errorJson = await response.json();
                    errorDetail = errorJson.detail?.message || errorJson.detail || JSON.stringify(errorJson);
                } catch (jsonError) {
                    // If not JSON, try to get text
                    try {
                        errorDetail = await response.text();
                    } catch (textError) {
                        errorDetail = response.statusText;
                    }
                }
                
                // Create a more informative error message
                let errorMessage;
                if (response.status === 401) {
                    errorMessage = 'Invalid API key: Authentication failed';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded: Too many requests';
                } else {
                    errorMessage = `ElevenLabs API error (${response.status}): ${errorDetail || response.statusText}`;
                }
                
                lastError = new Error(errorMessage);
                devLog(`getVoices failed for key ${keyName}:`, errorMessage);
                continue;
            }

            const data = await response.json();
            devLog('getVoices data:', data);
            return (data.voices || []).map(voice => ({
                id: voice.voice_id,
                name: voice.name,
                language: voice.labels?.language || 'en',
                engine: 'elevenlabs',
            }));
        } catch (error) {
            devLog(`getVoices failed with API key ${keyName}:`, error);
            lastError = error;
        }
    }

    devLog('getVoices: All API keys failed');
    throw new Error(`ElevenLabs get voices failed: ${lastError?.message || 'All API keys exhausted'}`);
}

export default {
    textToSpeech,
    getVoices,
};