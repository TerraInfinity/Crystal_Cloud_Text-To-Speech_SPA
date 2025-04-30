/**
 * Speech service to handle different text-to-speech engines.
 * Supports gTTS, ElevenLabs, AWS Polly, Google Cloud TTS, Azure TTS, and IBM Watson TTS for text-to-speech conversion.
 */
const devLog = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[speechService]', ...args);
    }
};

class SpeechService {
    /**
     * Normalize audio response to { url, duration, sampleRate }
     * @param {Object} data - The response data from TTS API
     * @returns {{url: string, duration: number, sampleRate: number}}
     */
    normalizeAudioResponse(data) {
        devLog('normalizeAudioResponse called', data);
        if (data.audioUrl) {
            devLog('normalizeAudioResponse: using audioUrl');
            return {
                url: data.audioUrl,
                duration: data.duration || 0,
                sampleRate: data.sampleRate || 44100,
            };
        } else if (data.audioBase64) {
            devLog('normalizeAudioResponse: using audioBase64');
            return {
                url: `data:audio/wav;base64,${data.audioBase64}`,
                duration: data.duration || 0,
                sampleRate: data.sampleRate || 44100,
            };
        }
        devLog('normalizeAudioResponse: Invalid audio response format', data);
        throw new Error('Invalid audio response format');
    }

    /**
     * Convert text to speech using gTTS via a Python server endpoint.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {Object} [options.voice] - Voice object from activeVoices (e.g., { id: 'in', engine: 'gtts', tld: 'co.in' }).
     * @param {Array} [options.activeVoices] - List of active voices from TTSContext for validation.
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If API request fails or voice is invalid.
     */
    async gTTSTTS(text, options = {}) {
        devLog('gTTSTTS called', { text, options });
        try {
            const gttsUrl = process.env.GTTS_SERVER_URL || 'http://localhost:5000/gtts';

            // Extract voice ID from options.voice
            const voice = options.voice;
            const activeVoices = options.activeVoices || [];

            // Validate voice against activeVoices
            const isValidVoice = voice && activeVoices.some(
                v => v.engine === 'gtts' && v.id === voice.id
            );
            const voiceId = isValidVoice ? voice.id : 'us'; // Fallback to 'us'

            // Map frontend voice IDs to backend voice IDs
            const voiceMap = {
                'en-com': 'us',         // American English
                'en-com.au': 'au',      // Australian English
                'en-co.uk': 'uk',       // British English
                'en-ca': 'ca',          // Canadian English
                'en-co.in': 'in',       // Indian English
                'de-de': 'de',          // German
                'es-es': 'es',          // Spanish
                'es-com.mx': 'es-mx',   // Spanish (Mexico)
                'fr-fr': 'fr',          // French
                'it-it': 'it',          // Italian
                'ja-co.jp': 'ja',       // Japanese
                'pt-pt': 'pt',          // Portuguese (Portugal)
                'pt-com.br': 'pt-br',   // Portuguese (Brazil)
                // Handle unsupported voices
                'en-US-Standard-A': 'us', // Fallback for en-US-Standard-A to American English
            };

            const backendVoiceId = voiceMap[voiceId] || 'us';
            devLog('Mapped voice ID:', { voiceId, backendVoiceId });

            const response = await fetch(gttsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    voice: backendVoiceId,
                }),
            });

            devLog('gTTSTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('gTTSTTS error response:', error);
                throw new Error(error.message || `gTTS error: ${response.statusText}`);
            }

            const data = await response.json();
            devLog('gTTSTTS success, data keys:', Object.keys(data));
            return this.normalizeAudioResponse(data);
        } catch (error) {
            devLog('gTTSTTS failed:', error);
            throw new Error(`gTTS failed: ${error.message}`);
        }
    }

    /**
     * Convert text to speech using ElevenLabs API.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {string} options.apiKey - ElevenLabs API key (required).
     * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: '21m00Tcm4TlvDq8ikWAM' }).
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {number} [options.stability] - Stability setting (0-1, default: 0.75).
     * @param {number} [options.similarity_boost] - Similarity boost (0-1, default: 0.75).
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If API key is missing or request fails.
     */
    async elevenLabsTTS(text, options = {}) {
        devLog('elevenLabsTTS called', { text, options });
        const apiKey = options.apiKey;
        if (!apiKey) {
            devLog('elevenLabsTTS: Missing API key');
            throw new Error('ElevenLabs API key is required');
        }

        const activeVoices = options.activeVoices || [];
        const voice = options.voice;
        const isValidVoice = voice && activeVoices.some(
            v => v.engine === 'elevenlabs' && v.id === voice.id
        );
        const voiceId = isValidVoice ? voice.id : '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel

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
                        stability: options.stability || 0.75,
                        similarity_boost: options.similarity_boost || 0.75,
                    },
                }),
            });

            devLog('elevenLabsTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('elevenLabsTTS error response:', error);
                throw new Error(error.detail?.message || `ElevenLabs API error: ${response.statusText}`);
            }

            const audioBuffer = await response.arrayBuffer();
            devLog('elevenLabsTTS audioBuffer length:', audioBuffer.byteLength);
            const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(audioBlob);
            return {
                url,
                duration: 0, // Duration estimation requires additional logic
                sampleRate: options.sampleRate || 44100,
            };
        } catch (error) {
            devLog('elevenLabsTTS failed:', error);
            throw error;
        }
    }

    /**
     * Convert text to speech using AWS Polly via an API endpoint.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {string} options.accessKey - AWS access key (required).
     * @param {string} options.secretKey - AWS secret key (required).
     * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'Joanna' }).
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {string} [options.language] - Language code (default: 'en-US').
     * @param {string} [options.outputFormat] - Audio output format (default: 'mp3').
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If credentials are missing or request fails.
     */
    async awsPollyTTS(text, options = {}) {
        devLog('awsPollyTTS called', { text, options });
        const { accessKey, secretKey } = options;
        if (!accessKey || !secretKey) {
            devLog('awsPollyTTS: Missing credentials');
            throw new Error('AWS credentials are required');
        }

        const activeVoices = options.activeVoices || [];
        const voice = options.voice;
        const isValidVoice = voice && activeVoices.some(
            v => v.engine === 'awspolly' && v.id === voice.id
        );
        const voiceId = isValidVoice ? voice.id : 'Joanna';

        try {
            const response = await fetch('/api/textToSpeech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-aws-access-key': accessKey,
                    'x-aws-secret-key': secretKey,
                },
                body: JSON.stringify({
                    text,
                    engine: 'awspolly',
                    voice: voiceId,
                    language: options.language || 'en-US',
                    outputFormat: options.outputFormat || 'mp3',
                }),
            });

            devLog('awsPollyTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('awsPollyTTS error response:', error);
                throw new Error(error.message || `AWS Polly error: ${response.statusText}`);
            }

            const data = await response.json();
            devLog('awsPollyTTS success, data keys:', Object.keys(data));
            return this.normalizeAudioResponse(data);
        } catch (error) {
            devLog('awsPollyTTS failed:', error);
            throw error;
        }
    }

    /**
     * Convert text to speech using Google Cloud Text-to-Speech via an API endpoint.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {string} [options.apiKey] - Google Cloud API key.
     * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US-Wavenet-D' }).
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {string} [options.language] - Language code (default: 'en-US').
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If request fails.
     */
    async googleCloudTTS(text, options = {}) {
        devLog('googleCloudTTS called', { text, options });
        const activeVoices = options.activeVoices || [];
        const voice = options.voice;
        const isValidVoice = voice && activeVoices.some(
            v => v.engine === 'googlecloud' && v.id === voice.id
        );
        const voiceId = isValidVoice ? voice.id : 'en-US-Wavenet-D';

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (options.apiKey) {
                headers['x-google-cloud-api-key'] = options.apiKey;
            }

            const response = await fetch('/api/textToSpeech', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text,
                    engine: 'googlecloud',
                    voice: voiceId,
                    language: options.language || 'en-US',
                }),
            });

            devLog('googleCloudTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('googleCloudTTS error response:', error);
                throw new Error(error.message || `Google Cloud TTS error: ${response.statusText}`);
            }

            const data = await response.json();
            devLog('googleCloudTTS success, data keys:', Object.keys(data));
            return this.normalizeAudioResponse(data);
        } catch (error) {
            devLog('googleCloudTTS failed:', error);
            throw error;
        }
    }

    /**
     * Convert text to speech using Microsoft Azure Cognitive Services TTS via an API endpoint.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {string} [options.apiKey] - Azure API key.
     * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US-JennyNeural' }).
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {string} [options.language] - Language code (default: 'en-US').
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If request fails.
     */
    async azureTTS(text, options = {}) {
        devLog('azureTTS called', { text, options });
        const activeVoices = options.activeVoices || [];
        const voice = options.voice;
        const isValidVoice = voice && activeVoices.some(
            v => v.engine === 'azuretts' && v.id === voice.id
        );
        const voiceId = isValidVoice ? voice.id : 'en-US-JennyNeural';

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (options.apiKey) {
                headers['x-azure-api-key'] = options.apiKey;
            }

            const response = await fetch('/api/textToSpeech', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text,
                    engine: 'azuretts',
                    voice: voiceId,
                    language: options.language || 'en-US',
                }),
            });

            devLog('azureTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('azureTTS error response:', error);
                throw new Error(error.message || `Azure TTS error: ${response.statusText}`);
            }

            const data = await response.json();
            devLog('azureTTS success, data keys:', Object.keys(data));
            return this.normalizeAudioResponse(data);
        } catch (error) {
            devLog('azureTTS failed:', error);
            throw error;
        }
    }

    /**
     * Convert text to speech using IBM Watson TTS via an API endpoint.
     * @param {string} text - The text to convert to speech.
     * @param {Object} options - Options for speech synthesis.
     * @param {string} [options.apiKey] - IBM Watson API key.
     * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US_AllisonV3Voice' }).
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {string} [options.language] - Language code (default: 'en-US').
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If request fails.
     */
    async ibmWatsonTTS(text, options = {}) {
        devLog('ibmWatsonTTS called', { text, options });
        const activeVoices = options.activeVoices || [];
        const voice = options.voice;
        const isValidVoice = voice && activeVoices.some(
            v => v.engine === 'ibmwatson' && v.id === voice.id
        );
        const voiceId = isValidVoice ? voice.id : 'en-US_AllisonV3Voice';

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (options.apiKey) {
                headers['x-ibm-watson-api-key'] = options.apiKey;
            }

            const response = await fetch('/api/textToSpeech', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text,
                    engine: 'ibmwatson',
                    voice: voiceId,
                    language: options.language || 'en-US',
                }),
            });

            devLog('ibmWatsonTTS response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                devLog('ibmWatsonTTS error response:', error);
                throw new Error(error.message || `IBM Watson TTS error: ${response.statusText}`);
            }

            const data = await response.json();
            devLog('ibmWatsonTTS success, data keys:', Object.keys(data));
            return this.normalizeAudioResponse(data);
        } catch (error) {
            devLog('ibmWatsonTTS failed:', error);
            throw error;
        }
    }

    /**
     * Get available voices for a specified speech engine, prioritizing activeVoices from TTSContext.
     * @param {string} engine - Speech engine ('gTTS', 'elevenLabs', 'awsPolly', 'googleCloud', 'azureTTS', 'ibmWatson').
     * @param {Object} [options] - Options for retrieving voices.
     * @param {Array} [options.activeVoices] - List of active voices from TTSContext.
     * @param {string} [options.apiKey] - API key for engines requiring authentication.
     * @returns {Promise<Array>} - Promise resolving to an array of available voices.
     * @throws {Error} - If API request fails for dynamic fetching.
     */
    async getAvailableVoices(engine, options = {}) {
        devLog('getAvailableVoices called', { engine, options });
        engine = engine.toLowerCase();
        const activeVoices = options.activeVoices || [];

        // Return active voices for the engine if provided
        const engineActiveVoices = activeVoices.filter(v => v.engine === engine);
        if (engineActiveVoices.length > 0) {
            devLog('getAvailableVoices: returning activeVoices for', engine, engineActiveVoices);
            return engineActiveVoices;
        }

        // Fallback to fetching or static lists
        switch (engine) {
            case 'gtts':
                try {
                    const response = await fetch('http://localhost:5000/gtts/voices');
                    devLog('getAvailableVoices gTTS response status:', response.status);
                    if (!response.ok) throw new Error('Failed to fetch gTTS voices');
                    const data = await response.json();
                    devLog('getAvailableVoices gTTS data:', data);
                    return data.voices || [
                        { id: 'us', name: 'American English', language: 'en', tld: 'com', engine: 'gtts' },
                        { id: 'au', name: 'Australian English', language: 'en', tld: 'com.au', engine: 'gtts' },
                        { id: 'uk', name: 'British English', language: 'en', tld: 'co.uk', engine: 'gtts' },
                        { id: 'ca', name: 'Canadian English', language: 'en', tld: 'ca', engine: 'gtts' },
                        { id: 'in', name: 'Indian English', language: 'en', tld: 'co.in', engine: 'gtts' },
                    ];
                } catch (error) {
                    devLog('getAvailableVoices gTTS error:', error);
                    return [
                        { id: 'us', name: 'American English', language: 'en', tld: 'com', engine: 'gtts' },
                        { id: 'au', name: 'Australian English', language: 'en', tld: 'com.au', engine: 'gtts' },
                        { id: 'uk', name: 'British English', language: 'en', tld: 'co.uk', engine: 'gtts' },
                        { id: 'ca', name: 'Canadian English', language: 'en', tld: 'ca', engine: 'gtts' },
                        { id: 'in', name: 'Indian English', language: 'en', tld: 'co.in', engine: 'gtts' },
                    ];
                }
            case 'elevenlabs':
                const apiKey = options.apiKey;
                if (!apiKey) {
                    devLog('getAvailableVoices elevenLabs: Missing API key');
                    throw new Error('ElevenLabs API key is required');
                }
                try {
                    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                        headers: { 'xi-api-key': apiKey },
                    });
                    devLog('getAvailableVoices elevenLabs response status:', response.status);
                    if (!response.ok) throw new Error(`ElevenLabs API error: ${response.statusText}`);
                    const data = await response.json();
                    devLog('getAvailableVoices elevenLabs data:', data);
                    return (data.voices || []).map(voice => ({
                        ...voice,
                        engine: 'elevenlabs',
                    }));
                } catch (error) {
                    devLog('getAvailableVoices elevenLabs error:', error);
                    return [];
                }
            case 'awspolly':
                devLog('getAvailableVoices awspolly: returning static list');
                return [
                    { id: 'Joanna', name: 'Joanna (Female, US English)', language: 'en-US', engine: 'awspolly' },
                    { id: 'Matthew', name: 'Matthew (Male, US English)', language: 'en-US', engine: 'awspolly' },
                    { id: 'Nicole', name: 'Nicole (Female, Australian English)', language: 'en-AU', engine: 'awspolly' },
                    { id: 'Russell', name: 'Russell (Male, Australian English)', language: 'en-AU', engine: 'awspolly' },
                    { id: 'Amy', name: 'Amy (Female, British English)', language: 'en-GB', engine: 'awspolly' },
                    { id: 'Brian', name: 'Brian (Male, British English)', language: 'en-GB', engine: 'awspolly' },
                    { id: 'Aditi', name: 'Aditi (Female, Indian English)', language: 'en-IN', engine: 'awspolly' },
                    { id: 'Raveena', name: 'Raveena (Female, Indian English)', language: 'en-IN', engine: 'awspolly' },
                ];
            case 'googlecloud':
                try {
                    const response = await fetch('/api/getVoices?engine=googlecloud', {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    devLog('getAvailableVoices googleCloud response status:', response.status);
                    if (!response.ok) throw new Error('Failed to fetch Google Cloud voices');
                    const data = await response.json();
                    devLog('getAvailableVoices googleCloud data:', data);
                    return (data.voices || []).map(voice => ({
                        ...voice,
                        engine: 'googlecloud',
                    }));
                } catch (error) {
                    devLog('getAvailableVoices googleCloud error:', error);
                    return [];
                }
            case 'azuretts':
                try {
                    const response = await fetch('/api/getVoices?engine=azuretts', {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    devLog('getAvailableVoices azureTTS response status:', response.status);
                    if (!response.ok) throw new Error('Failed to fetch Azure TTS voices');
                    const data = await response.json();
                    devLog('getAvailableVoices azureTTS data:', data);
                    return (data.voices || []).map(voice => ({
                        ...voice,
                        engine: 'azuretts',
                    }));
                } catch (error) {
                    devLog('getAvailableVoices azureTTS error:', error);
                    return [];
                }
            case 'ibmwatson':
                try {
                    const response = await fetch('/api/getVoices?engine=ibmwatson', {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    devLog('getAvailableVoices ibmWatson response status:', response.status);
                    if (!response.ok) throw new Error('Failed to fetch IBM Watson voices');
                    const data = await response.json();
                    devLog('getAvailableVoices ibmWatson data:', data);
                    return (data.voices || []).map(voice => ({
                        ...voice,
                        engine: 'ibmwatson',
                    }));
                } catch (error) {
                    devLog('getAvailableVoices ibmWatson error:', error);
                    return [];
                }
            default:
                devLog('getAvailableVoices: unsupported engine', engine);
                return [];
        }
    }

    /**
     * Convert text to speech using specified engine and upload the audio.
     * @param {string} text - The text to convert to speech.
     * @param {string} engine - TTS engine ('gTTS', 'awsPolly', 'elevenLabs', 'googleCloud', 'azureTTS', 'ibmWatson').
     * @param {Object} [options] - Options for speech synthesis.
     * @param {Object} [options.voice] - Voice object from activeVoices.
     * @param {Array} [options.activeVoices] - List of active voices for validation.
     * @param {string} [options.language] - Language code (default: 'en-US').
     * @param {string} [options.apiKey] - API key for engines requiring authentication.
     * @param {string} [options.accessKey] - AWS access key (for awsPolly).
     * @param {string} [options.secretKey] - AWS secret key (for awsPolly).
     * @returns {Promise<{url: string, duration: number, sampleRate: number}>} - Promise resolving to normalized audio response.
     * @throws {Error} - If engine is unsupported or request fails.
     */
    async convert_text_to_speech_and_upload(text, engine, options = {}) {
        devLog('convert_text_to_speech_and_upload called', { text, engine, options });
        engine = engine.toLowerCase();
        const supportedEngines = [
            'gtts',
            'awspolly',
            'elevenlabs',
            'googlecloud',
            'azuretts',
            'ibmwatson',
        ];
        if (!supportedEngines.includes(engine)) {
            devLog('convert_text_to_speech_and_upload: Unsupported engine', engine);
            throw new Error(`Unsupported engine: ${engine}. Supported: ${supportedEngines.join(', ')}`);
        }

        try {
            if (engine === 'gtts') {
                return await this.gTTSTTS(text, options);
            } else if (engine === 'elevenlabs') {
                return await this.elevenLabsTTS(text, options);
            } else if (engine === 'awspolly') {
                return await this.awsPollyTTS(text, options);
            } else if (engine === 'googlecloud') {
                return await this.googleCloudTTS(text, options);
            } else if (engine === 'azuretts') {
                return await this.azureTTS(text, options);
            } else if (engine === 'ibmwatson') {
                return await this.ibmWatsonTTS(text, options);
            }
        } catch (error) {
            devLog('convert_text_to_speech_and_upload failed:', error);
            throw new Error(`Failed to generate audio with ${engine}: ${error.message}`);
        }
    }

    /**
     * Generate audio segments from a script, orchestrating TTS, pauses, and sound effects.
     * @param {Array} script - Array of script items defining the audio sequence.
     * @param {Object} script[] - Script item object.
     * @param {string} script[].type - Type of segment ('speech', 'pause', or 'sound').
     * @param {string} [script[].text] - Text to convert for 'speech' type.
     * @param {string} [script[].engine] - Engine for 'speech' type.
     * @param {Object} [script[].options] - Options for 'speech' type (includes activeVoices).
     * @param {number} [script[].duration] - Duration in seconds for 'pause' or 'sound' type.
     * @param {string} [script[].url] - Audio URL for 'sound' type.
     * @returns {Promise<Array>} - Promise resolving to an array of audio segments.
     * @throws {Error} - If an unsupported script item type is encountered.
     */
    async generate_audio_segments(script) {
        devLog('generate_audio_segments called', script);
        const segments = [];

        for (const item of script) {
            devLog('generate_audio_segments processing item:', item);
            if (item.type === 'speech') {
                const { url, duration } = await this.convert_text_to_speech_and_upload(
                    item.text,
                    item.engine,
                    item.options
                );
                devLog('generate_audio_segments got audio:', { url, duration });
                segments.push({ type: 'audio', url, duration });
            } else if (item.type === 'pause') {
                devLog('generate_audio_segments adding pause:', item.duration);
                segments.push({ type: 'pause', duration: item.duration });
            } else if (item.type === 'sound') {
                devLog('generate_audio_segments adding sound:', item.url);
                segments.push({ type: 'audio', url: item.url, duration: item.duration });
            } else {
                devLog('generate_audio_segments: Unsupported script item type', item.type);
                throw new Error(`Unsupported script item type: ${item.type}`);
            }
        }

        devLog('generate_audio_segments returning segments:', segments);
        return segments;
    }
}

// Export a singleton instance
export default new SpeechService();