import { devLog } from '../../../utils/logUtils';


/**
 * Utility module for interacting with the ElevenLabs API.
 * Provides functions for text-to-speech conversion and retrieving available voices.
 * @module elevenLabsAPI
 */

/**
 * Convert text to speech using the ElevenLabs API.
 * 
 * @param {string} text - The text to convert to speech.
 * @param {Object} options - Options for speech synthesis.
 * @param {string} options.apiKey - ElevenLabs API key (required).
 * @param {string} [options.voiceId='21m00Tcm4TlvDq8ikWAM'] - Voice ID (default: Rachel).
 * @param {number} [options.stability=0.75] - Stability setting (0-1).
 * @param {number} [options.similarity_boost=0.75] - Similarity boost (0-1).
 * @returns {Promise<{audioBuffer: ArrayBuffer, mimeType: string}>} - Promise resolving to audio buffer and MIME type.
 * @throws {Error} - If API key is missing or request fails.
 */
async function textToSpeech(text, options = {}) {
    devLog('textToSpeech called', { text, options });
    const { apiKey, voiceId = '21m00Tcm4TlvDq8ikWAM', stability = 0.75, similarity_boost = 0.75 } = options;

    if (!apiKey) {
        devLog('textToSpeech: Missing API key');
        throw new Error('ElevenLabs API key is required');
    }

    try {
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

        devLog('textToSpeech response status:', response.status);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            devLog('textToSpeech error response:', error);
            throw new Error(error.detail ? .message || `ElevenLabs API error: ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        devLog('textToSpeech audioBuffer length:', audioBuffer.byteLength);
        return {
            audioBuffer,
            mimeType: 'audio/mpeg', // ElevenLabs typically returns MPEG
        };
    } catch (error) {
        devLog('textToSpeech failed:', error);
        throw new Error(`ElevenLabs text-to-speech failed: ${error.message}`);
    }
}

/**
 * Retrieve available voices from the ElevenLabs API.
 * 
 * @param {string} apiKey - ElevenLabs API key (required).
 * @returns {Promise<Array>} - Promise resolving to an array of voice objects.
 * @throws {Error} - If API key is missing or request fails.
 */
async function getVoices(apiKey) {
    devLog('getVoices called');
    if (!apiKey) {
        devLog('getVoices: Missing API key');
        throw new Error('ElevenLabs API key is required');
    }

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': apiKey,
            },
        });

        devLog('getVoices response status:', response.status);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            devLog('getVoices error response:', error);
            throw new Error(error.detail ? .message || `ElevenLabs API error: ${response.statusText}`);
        }

        const data = await response.json();
        devLog('getVoices data:', data);
        return (data.voices || []).map(voice => ({
            id: voice.voice_id,
            name: voice.name,
            language: voice.labels ? .language || 'en',
            engine: 'elevenlabs',
        }));
    } catch (error) {
        devLog('getVoices failed:', error);
        throw new Error(`ElevenLabs get voices failed: ${error.message}`);
    }
}

export default {
    textToSpeech,
    getVoices,
};