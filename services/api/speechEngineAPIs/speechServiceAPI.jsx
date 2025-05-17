// src/services/api/speechEngineAPIs/speechServiceAPI.jsx
import { devLog, devWarn } from '../../../utils/logUtils'; // Note: Ensure logUtils.ts exists
import { Voice, validateVoice } from '../../../utils/voiceUtils'; // Note: Ensure voiceUtils.tsx exists
import elevenLabsAPI from './elevenLabsAPI'; // Note: Ensure elevenLabsAPI.js exists
import { loadFromStorage } from '../../../context/storage'; // Note: Ensure storage.js exists
import { refreshApiKeyTokens, getApiKeys, updateRemainingTokensAfterGeneration, saveApiKeys } from '../../../utils/apiKeyManagement';

// Create a global variable to hold the API key confirmation callback
let apiKeyConfirmHandler = null;

// Function to register the API key confirmation handler
export const registerApiKeyConfirmHandler = (handler) => {
  apiKeyConfirmHandler = handler;
};

/**
 * Speech service to handle different text-to-speech engines.
 * Supports gTTS, ElevenLabs, AWS Polly, Google Cloud TTS, Azure TTS, and IBM Watson TTS for text-to-speech conversion.
 * Provides a unified interface for converting text to speech, managing voices, and generating audio segments.
 * @module speechServiceAPI
 */
class SpeechServiceAPI {
  constructor(fileStorageActions) {
    this.fileStorageActions = fileStorageActions; // Store fileStorageActions
  }

  /**
   * Get the TTS state from localStorage.
   * @returns {Object} - TTS state from localStorage.
   */
  getTTSState() {
    const savedState = loadFromStorage('tts_persistent_state', false, 'localStorage') || {};
    
    // Log detailed information about the loaded state
    devLog('getTTSState: State from localStorage', {
      hasSettings: !!savedState.settings,
      hasActiveVoices: !!savedState.settings?.activeVoices,
      activeVoicesCount: savedState.settings?.activeVoices?.length || 0,
      hasDefaultVoice: !!savedState.settings?.defaultVoice,
      defaultVoiceEngine: savedState.settings?.defaultVoice?.engine || 'none',
      hasElevenLabsApiKeys: !!savedState.settings?.elevenLabsApiKeys,
      elevenLabsApiKeysCount: savedState.settings?.elevenLabsApiKeys?.length || 0
    });
    
    // Ensure settings object exists
    if (!savedState.settings) {
      savedState.settings = {};
      devLog('getTTSState: Created empty settings object');
    }
    
    // Ensure activeVoices array exists
    if (!savedState.settings.activeVoices) {
      savedState.settings.activeVoices = [];
      devLog('getTTSState: Created empty activeVoices array');
    }
    
    return savedState;
  }

  /**
   * Generate a file name for an audio file based on the specified format.
   * @param {string} title - Title for the file (e.g., script name).
   * @param {number} increment - Incremental number for uniqueness.
   * @param {string} text - Text content for the first 15 characters.
   * @param {string} engine - TTS engine (e.g., 'elevenlabs', 'gtts').
   * @returns {string} - File name (e.g., 'generated_script_001_hello-world_elevenlabs.mp3').
   */
  generateFileName(title, increment, text, engine) {
    const sanitizedText = (text || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toLowerCase() || 'untitled';
    const paddedIncrement = increment.toString().padStart(3, '0');
    return `generated_${title}_${paddedIncrement}_${sanitizedText}_${engine}.mp3`;
  }

  /**
   * Normalize audio response to a standard format regardless of source TTS engine.
   * @param {Object} data - The response data from TTS API.
   * @returns {{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}} Normalized audio data with server and blob URLs.
   * @throws {Error} If invalid audio response format is provided.
   */
  normalizeAudioResponse(data) {
    devLog('normalizeAudioResponse called', data);
    if (data.audioUrl) {
      devLog('normalizeAudioResponse: using audioUrl');
      return {
        url: data.audioUrl,
        blobUrl: null,
        duration: data.duration || 0,
        sampleRate: data.sampleRate || 44100,
        fileName: data.fileName || '',
      };
    } else if (data.audioBase64) {
      devLog('normalizeAudioResponse: using audioBase64');
      const blobUrl = `data:audio/wav;base64,${data.audioBase64}`;
      return {
        url: blobUrl,
        blobUrl,
        duration: data.duration || 0,
        sampleRate: data.sampleRate || 44100,
        fileName: data.fileName || '',
      };
    } else if (data.audioBuffer) {
      devLog('normalizeAudioResponse: using audioBuffer');
      const audioBlob = new Blob([data.audioBuffer], { type: data.mimeType || 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(audioBlob);
      return {
        url: blobUrl,
        blobUrl,
        duration: 0,
        sampleRate: data.sampleRate || 44100,
        fileName: data.fileName || '',
      };
    }
    devLog('normalizeAudioResponse: Invalid audio response format', data);
    throw new Error('Invalid audio response format');
  }

  /**
   * Convert text to speech using gTTS via a Python server endpoint.
   * Validates the voice against activeVoices and uploads to storage.
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If API request fails or voice is invalid.
   */
  async gTTSTTS(text, options = {}) {
    devLog('gTTSTTS called', { text, options });

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    // Validate voice
    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('gTTSTTS: Validated voice', validatedVoice);

    try {
      const gttsUrl = process.env.GTTS_SERVER_URL || 'http://localhost:5000/gtts';

      const voiceMap = {
        'en-com': 'us',
        'en-com.au': 'au',
        'en-co.uk': 'uk',
        'en-ca': 'ca',
        'en-co.in': 'in',
        'de-de': 'de',
        'es-es': 'es',
        'es-com.mx': 'es-mx',
        'fr-fr': 'fr',
        'it-it': 'it',
        'ja-co.jp': 'ja',
        'pt-pt': 'pt',
        'pt-com.br': 'pt-br',
      };

      const backendVoiceId = voiceMap[validatedVoice.id] || validatedVoice.id;
      devLog('gTTSTTS: Mapped voice ID', { frontend: validatedVoice.id, backend: backendVoiceId });

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
      const fileName = this.generateFileName(title, increment, text, 'gtts');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert data URL to Blob
      let audioBlob;
      if (data.audioBase64) {
        const response = await fetch(normalized.blobUrl);
        audioBlob = await response.blob();
      } else {
        throw new Error('gTTS response must include audioBase64');
      }

      // Create File object and upload
      const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData);

      return {
        ...normalized,
        url: normalized.blobUrl,
        fileName,
      };
    } catch (error) {
      devWarn('gTTSTTS failed:', error);
      throw new Error(`gTTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using ElevenLabs API.
   * Validates the voice and uploads generated audio to storage.
   * @param {string} text - The text to convert to speech.
   * @param {Object} options - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {Object} [options.voiceSettings] - Voice settings (stability, similarity_boost).
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If no API key is available or request fails.
   */
  async elevenLabsTTS(text, options = {}) {
    devLog('elevenLabsTTS called', { 
      textLength: text?.length || 0,
      voiceOption: options.voice ? {
        id: options.voice.id,
        name: options.voice.name,
        engine: options.voice.engine
      } : 'not provided'
    });

    const state = this.getTTSState();
    let apiKeys = options.apiKeys || (state?.settings?.elevenLabsApiKeys || []);
    
    if (!apiKeys.length) {
      devLog('elevenLabsTTS: No keys in options or state, fetching from tts_api_key_elevenlabs');
      try {
        apiKeys = await getApiKeys('elevenlabs');
        devLog('elevenLabsTTS: Fetched keys from localStorage:', {
          keyCount: apiKeys.length,
          hasKeys: apiKeys.length > 0
        });
      } catch (error) {
        devLog('elevenLabsTTS: Error fetching keys:', error);
        throw new Error('Failed to fetch ElevenLabs API keys');
      }
    }

    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice || {
      engine: 'gtts', voiceId: 'en-com', id: 'en-com', name: 'American English', language: 'en', tld: 'com'
    };
    
    devLog('elevenLabsTTS: State info', {
      hasSettings: !!state?.settings,
      activeVoicesCount: activeVoices.length,
      defaultVoiceEngine: defaultVoice?.engine
    });

    const title = options.title || 'audio';
    const increment = options.increment || 1;
    const voiceSettings = options.voiceSettings || {};

    if (!apiKeys.length) {
      devWarn('elevenLabsTTS: No API keys available after fetch');
      throw new Error('No ElevenLabs API keys configured');
    }

    // Check voice before validation
    if (!options.voice || options.voice.engine !== 'elevenlabs') {
      devWarn('elevenLabsTTS: Invalid voice provided, must be an ElevenLabs voice', options.voice);
      throw new Error('Voice must be an ElevenLabs voice'); 
    }

    // Make sure the voice has the required fields
    if (!options.voice.id || !options.voice.name || !options.voice.language) {
      devWarn('elevenLabsTTS: Incomplete voice object provided', options.voice);
      throw new Error('Incomplete voice object, missing required fields'); 
    }

    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('elevenLabsTTS: After validation', {
      originalVoice: options.voice ? { id: options.voice.id, engine: options.voice.engine } : 'none',
      validatedVoice: validatedVoice ? { id: validatedVoice.id, engine: validatedVoice.engine } : 'none'
    });
    
    if (validatedVoice.engine !== 'elevenlabs') {
      devWarn('elevenLabsTTS: Validated voice is not an ElevenLabs voice', validatedVoice);
      throw new Error('Selected voice is not an ElevenLabs voice');
    }

    let lastError;
    let skipConfirmation = false;
    
    // Get current stored keys to ensure we're working with the most up-to-date data
    const latestStoredKeys = await getApiKeys('elevenlabs');
    
    // Create a map of keys by name for easy reference
    const storedKeysMap = {};
    latestStoredKeys.forEach((key, index) => {
      storedKeysMap[key.name || `Key ${index}`] = { key, index };
    });
    
    for (let i = 0; i < apiKeys.length; i++) {
      const keyObj = apiKeys[i];
      const keyName = keyObj.name || `Key ${i}`;
      
      if (!keyObj.key) {
        devWarn(`elevenLabsTTS: Key ${keyName} has no key value`);
        continue;
      }

      // Refresh token count if necessary
      let currentTokens = keyObj.remaining_tokens;
      if (typeof currentTokens === 'undefined' || currentTokens < 0) {
        devLog(`elevenLabsTTS: Refreshing tokens for key ${keyName}`);
        try {
          // Find the key in the stored keys by name
          const storedKeyInfo = storedKeysMap[keyName];
          if (storedKeyInfo) {
            await refreshApiKeyTokens('elevenlabs', storedKeyInfo.index);
            const updatedKeys = await getApiKeys('elevenlabs');
            currentTokens = updatedKeys[storedKeyInfo.index].remaining_tokens;
            keyObj.remaining_tokens = currentTokens;
            devLog(`elevenLabsTTS: Updated tokens:`, {
              keyName,
              tokens: currentTokens
            });
          } else {
            devWarn(`elevenLabsTTS: Could not find key ${keyName} in stored keys`);
            continue;
          }
        } catch (refreshError) {
          devWarn(`elevenLabsTTS: Token refresh failed:`, {
            keyName,
            error: refreshError.message
          });
          continue;
        }
      }

      // Check if there are enough tokens for the text
      const textLength = text.length;
      if (currentTokens <= 0 || (currentTokens < textLength && currentTokens >= 0)) {
        devLog(`elevenLabsTTS: Insufficient tokens for key ${keyName}: ${currentTokens} tokens remaining, text length: ${textLength}`);
        
        // If we have more keys to try and a confirmation handler, ask the user
        if (i < apiKeys.length - 1 && apiKeyConfirmHandler && !skipConfirmation) {
          try {
            const nextKeyName = apiKeys[i+1].name || `Key ${i+1}`;
            const requestDetails = {
              url: 'https://api.elevenlabs.io/v1/text-to-speech',
              method: 'POST',
              engine: 'elevenlabs',
              voice: {
                id: validatedVoice.id,
                name: validatedVoice.name,
                language: validatedVoice.language
              },
              textLength,
              requiredTokens: textLength,
              availableTokens: currentTokens,
              stability: voiceSettings.stability || 0.75,
              similarity_boost: voiceSettings.similarity_boost || 0.75
            };
            
            const confirmResult = await apiKeyConfirmHandler({
              failedKeyName: keyName,
              errorMessage: `Insufficient tokens: ${currentTokens} tokens remaining, but text requires approximately ${textLength} tokens.`,
              nextKeyName: nextKeyName,
              apiKey: keyObj.key, // Will be masked in UI
              requestDetails
            });
            
            if (!confirmResult.proceed) {
              throw new Error(`Operation canceled by user due to insufficient tokens for key ${keyName}`);
            }
            
            if (confirmResult.dontAskAgain) {
              skipConfirmation = true;
            }
            
            // If user provides an override key, use it
            if (confirmResult.proceed && confirmResult.overrideKey) {
              devLog('elevenLabsTTS: Using override key provided by user for insufficient tokens');
              // Process override key separately
              try {
                const actualOverrideKey = typeof confirmResult.overrideKey === 'string' ? confirmResult.overrideKey : null;
                if (!actualOverrideKey) {
                  devWarn(`elevenLabsTTS: Invalid override key format, type: ${typeof confirmResult.overrideKey}`);
                  continue;
                }
                
                const maskedOverrideKey = actualOverrideKey.length > 8 ? 
                  `${actualOverrideKey.substring(0, 4)}...${actualOverrideKey.substring(actualOverrideKey.length - 4)}` : '(short key)';
                devLog(`elevenLabsTTS: Using override key ${maskedOverrideKey} (length: ${actualOverrideKey.length})`);
                
                const { audioBuffer, mimeType, text: returnedText, title: returnedTitle, increment: returnedIncrement, usedKey, usedKeyIndex, textLength } = await elevenLabsAPI.textToSpeech(text, {
                  apiKeys: [actualOverrideKey], // Pass string key directly
                  voiceId: validatedVoice.id,
                  stability: voiceSettings.stability || 0.75,
                  similarity_boost: voiceSettings.similarity_boost || 0.75,
                  title,
                  increment,
                });
                
                // Update the tokens for the key after successful generation
                try {
                  // Try to find if this override key matches any saved key and update its tokens
                  const matchingStoredKey = latestStoredKeys.find(k => k.key === actualOverrideKey);
                  if (matchingStoredKey) {
                    const keyIndex = latestStoredKeys.indexOf(matchingStoredKey);
                    await refreshApiKeyTokens('elevenlabs', keyIndex);
                  }
                } catch (tokenUpdateError) {
                  devWarn('elevenLabsTTS: Failed to update tokens after generation with override key:', tokenUpdateError);
                }
                
                const audioBlob = new Blob([audioBuffer], { type: mimeType });
                const fileName = this.generateFileName(returnedTitle, returnedIncrement, returnedText, 'elevenlabs');
                const audioFile = new File([audioBlob], fileName, { type: mimeType });
                
                const audioData = {
                  name: fileName,
                  category: 'generated_audio',
                  placeholder: text.slice(0, 50),
                  volume: 1,
                };
                await this.fileStorageActions.uploadAudio(audioFile, audioData);
                
                const blobUrl = URL.createObjectURL(audioBlob);
                return {
                  url: blobUrl,
                  blobUrl,
                  duration: 0,
                  sampleRate: voiceSettings.sampleRate || 44100,
                  fileName,
                };
              } catch (overrideError) {
                devWarn('elevenLabsTTS: Override key failed:', overrideError);
              }
            }
          } catch (confirmError) {
            devWarn('elevenLabsTTS: Error during API key confirmation for insufficient tokens:', confirmError);
          }
        }
        
        continue; // Skip to the next key
      }

      devLog(`elevenLabsTTS: Attempting key ${keyName} with ${currentTokens} tokens for text length ${textLength}`);

      try {
        // Define request details for transparency
        const requestDetails = {
          url: 'https://api.elevenlabs.io/v1/text-to-speech',
          method: 'POST',
          engine: 'elevenlabs',
          voice: {
            id: validatedVoice.id,
            name: validatedVoice.name,
            language: validatedVoice.language
          },
          textLength: text.length,
          stability: voiceSettings.stability || 0.75,
          similarity_boost: voiceSettings.similarity_boost || 0.75
        };

        // Ensure we have a valid string key, not an object
        const actualKey = typeof keyObj.key === 'string' ? keyObj.key : null;
        if (!actualKey) {
          devWarn(`elevenLabsTTS: Invalid key format for ${keyName}, type: ${typeof keyObj.key}`);
          continue;
        }
        
        // Log a sanitized version of the key for debugging
        const maskedKey = actualKey.length > 8 ? 
          `${actualKey.substring(0, 4)}...${actualKey.substring(actualKey.length - 4)}` : '(short key)';
        devLog(`elevenLabsTTS: Using key ${maskedKey} (length: ${actualKey.length})`);

        const { audioBuffer, mimeType, text: returnedText, title: returnedTitle, increment: returnedIncrement, usedKey, usedKeyIndex, textLength } = await elevenLabsAPI.textToSpeech(text, {
          apiKeys: [actualKey], // Pass the string key directly
          voiceId: validatedVoice.id,
          stability: voiceSettings.stability || 0.75,
          similarity_boost: voiceSettings.similarity_boost || 0.75,
          title,
          increment,
        });

        devLog('elevenLabsTTS: Audio generated successfully', { 
          keyName,
          audioBufferLength: audioBuffer.byteLength,
          usedKey,
          textLength
        });

        // Update remaining tokens after successful generation
        try {
          // Update tokens directly since we now have the exact used key info
          await updateRemainingTokensAfterGeneration('elevenlabs', usedKey || keyName, textLength || text.length);
          devLog(`elevenLabsTTS: Updated tokens after generation for key ${usedKey || keyName}`);
        } catch (tokenUpdateError) {
          devWarn('elevenLabsTTS: Failed to update tokens after generation:', tokenUpdateError);
          // Continue with audio processing even if token update fails
        }

        const audioBlob = new Blob([audioBuffer], { type: mimeType });
        const fileName = this.generateFileName(returnedTitle, returnedIncrement, returnedText, 'elevenlabs');
        const audioFile = new File([audioBlob], fileName, { type: mimeType });

        const audioData = {
          name: fileName,
          category: 'generated_audio',
          placeholder: text.slice(0, 50),
          volume: 1,
        };
        await this.fileStorageActions.uploadAudio(audioFile, audioData);

        const blobUrl = URL.createObjectURL(audioBlob);
        return {
          url: blobUrl,
          blobUrl,
          duration: 0,
          sampleRate: voiceSettings.sampleRate || 44100,
          fileName,
        };
      } catch (error) {
        devWarn(`elevenLabsTTS: Key ${keyName} failed:`, {
          error: error.message,
          stack: error.stack
        });
        lastError = error;
        
        // Check if there are more keys to try
        if (i < apiKeys.length - 1 && apiKeyConfirmHandler && !skipConfirmation) {
          try {
            const nextKeyName = apiKeys[i+1].name || `Key ${i+1}`;
            // Create request details for display in modal
            const requestDetails = {
              url: 'https://api.elevenlabs.io/v1/text-to-speech',
              method: 'POST',
              engine: 'elevenlabs',
              voice: {
                id: validatedVoice.id,
                name: validatedVoice.name,
                language: validatedVoice.language
              },
              textLength: text.length,
              stability: voiceSettings.stability || 0.75,
              similarity_boost: voiceSettings.similarity_boost || 0.75
            };
            
            const confirmResult = await apiKeyConfirmHandler({
              failedKeyName: keyName,
              errorMessage: error.message,
              nextKeyName: nextKeyName,
              apiKey: keyObj.key, // Pass the key for display in the UI (will be masked)
              requestDetails: requestDetails // Pass details for display
            });
            
            // If user provides an override key, use it instead of the next key
            if (confirmResult.proceed && confirmResult.overrideKey) {
              devLog('elevenLabsTTS: Using override key provided by user');
              try {
                // Ensure we have a valid string key, not an object
                const actualOverrideKey = typeof confirmResult.overrideKey === 'string' ? confirmResult.overrideKey : null;
                if (!actualOverrideKey) {
                  devWarn(`elevenLabsTTS: Invalid override key format, type: ${typeof confirmResult.overrideKey}`);
                  continue;
                }
                
                // Log a sanitized version of the key for debugging
                const maskedOverrideKey = actualOverrideKey.length > 8 ? 
                  `${actualOverrideKey.substring(0, 4)}...${actualOverrideKey.substring(actualOverrideKey.length - 4)}` : '(short key)';
                devLog(`elevenLabsTTS: Using override key ${maskedOverrideKey} (length: ${actualOverrideKey.length})`);
                
                const { audioBuffer, mimeType, text: returnedText, title: returnedTitle, increment: returnedIncrement } = await elevenLabsAPI.textToSpeech(text, {
                  apiKeys: [actualOverrideKey], // Pass the string key directly
                  voiceId: validatedVoice.id,
                  stability: voiceSettings.stability || 0.75,
                  similarity_boost: voiceSettings.similarity_boost || 0.75,
                  title,
                  increment,
                });
                
                devLog('elevenLabsTTS: Audio generated successfully with override key');
                
                // Try to update token count for override key if it matches a known key
                try {
                  const matchingStoredKey = latestStoredKeys.find(k => k.key === actualOverrideKey);
                  if (matchingStoredKey) {
                    const keyIndex = latestStoredKeys.indexOf(matchingStoredKey);
                    await refreshApiKeyTokens('elevenlabs', keyIndex);
                  }
                } catch (tokenUpdateError) {
                  devWarn('elevenLabsTTS: Failed to update tokens for override key:', tokenUpdateError);
                }
                
                const audioBlob = new Blob([audioBuffer], { type: mimeType });
                const fileName = this.generateFileName(returnedTitle, returnedIncrement, returnedText, 'elevenlabs');
                const audioFile = new File([audioBlob], fileName, { type: mimeType });
                
                const audioData = {
                  name: fileName,
                  category: 'generated_audio',
                  placeholder: text.slice(0, 50),
                  volume: 1,
                };
                await this.fileStorageActions.uploadAudio(audioFile, audioData);
                
                const blobUrl = URL.createObjectURL(audioBlob);
                return {
                  url: blobUrl,
                  blobUrl,
                  duration: 0,
                  sampleRate: voiceSettings.sampleRate || 44100,
                  fileName,
                };
              } catch (overrideError) {
                devWarn('elevenLabsTTS: Override key failed:', overrideError);
                // Continue to the next key if the override key fails
              }
            }
            
            if (!confirmResult.proceed) {
              // User canceled the operation
              throw new Error(`Operation canceled by user after API key ${keyName} failed`);
            }
            
            if (confirmResult.dontAskAgain) {
              skipConfirmation = true;
            }
          } catch (confirmError) {
            // If the confirmation throws, continue anyway but log it
            devWarn('elevenLabsTTS: Error during API key confirmation:', confirmError);
          }
        }
        
        continue;
      }
    }

    devWarn('elevenLabsTTS: All API keys failed:', lastError);
    throw new Error(`Failed to generate audio with ElevenLabs: ${lastError?.message || 'All API keys failed'}`);
  }

  /**
   * Convert text to speech using AWS Polly via an API endpoint.
   * Validates the voice and uploads generated audio.
   * @param {string} text - The text to convert to speech.
   * @param {Object} options - Options for speech synthesis.
   * @param {string} options.accessKey - AWS access key (required).
   * @param {string} options.secretKey - AWS secret key (required).
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.outputFormat] - Audio output format (default: 'mp3').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If credentials are missing or request fails.
   */
  async awsPollyTTS(text, options = {}) {
    devLog('awsPollyTTS called', { text, options });

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const { accessKey, secretKey } = options;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    if (!accessKey || !secretKey) {
      devWarn('awsPollyTTS: Missing credentials');
      throw new Error('AWS credentials are required');
    }

    // Validate voice
    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('awsPollyTTS: Validated voice', validatedVoice);

    if (validatedVoice.engine !== 'awspolly') {
      devWarn('awsPollyTTS: Invalid engine for voice', validatedVoice);
      throw new Error('Selected voice is not an AWS Polly voice');
    }

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
          voice: validatedVoice.id,
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
      const fileName = this.generateFileName(title, increment, text, 'awspolly');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob
      let audioBlob;
      if (data.audioBase64 || data.audioUrl) {
        const response = await fetch(normalized.url);
        audioBlob = await response.blob();
      } else if (data.audioBuffer) {
        audioBlob = new Blob([data.audioBuffer], { type: data.mimeType || 'audio/mpeg' });
      } else {
        throw new Error('AWS Polly response must include audio data');
      }

      // Create File object and upload
      const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData);

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devWarn('awsPollyTTS failed:', error);
      throw new Error(`AWS Polly failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using Google Cloud Text-to-Speech via an API endpoint.
   * Validates the voice and uploads generated audio.
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - Google Cloud API key.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If request fails.
   */
  async googleCloudTTS(text, options = {}) {
    devLog('googleCloudTTS called', { text, options });

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    // Validate voice
    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('googleCloudTTS: Validated voice', validatedVoice);

    if (validatedVoice.engine !== 'googlecloud') {
      devWarn('googleCloudTTS: Invalid engine for voice', validatedVoice);
      throw new Error('Selected voice is not a Google Cloud TTS voice');
    }

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
          voice: validatedVoice.id,
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
      const fileName = this.generateFileName(title, increment, text, 'googlecloud');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob
      let audioBlob;
      if (data.audioBase64 || data.audioUrl) {
        const response = await fetch(normalized.url);
        audioBlob = await response.blob();
      } else if (data.audioBuffer) {
        audioBlob = new Blob([data.audioBuffer], { type: data.mimeType || 'audio/mpeg' });
      } else {
        throw new Error('Google Cloud TTS response must include audio data');
      }

      // Create File object and upload
      const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData);

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devWarn('googleCloudTTS failed:', error);
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using Microsoft Azure Cognitive Services TTS via an API endpoint.
   * Validates the voice and uploads generated audio.
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - Azure API key.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If request fails.
   */
  async azureTTS(text, options = {}) {
    devLog('azureTTS called', { text, options });

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    // Validate voice
    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('azureTTS: Validated voice', validatedVoice);

    if (validatedVoice.engine !== 'azuretts') {
      devWarn('azureTTS: Invalid engine for voice', validatedVoice);
      throw new Error('Selected voice is not an Azure TTS voice');
    }

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
          voice: validatedVoice.id,
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
      const fileName = this.generateFileName(title, increment, text, 'azuretts');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob
      let audioBlob;
      if (data.audioBase64 || data.audioUrl) {
        const response = await fetch(normalized.url);
        audioBlob = await response.blob();
      } else if (data.audioBuffer) {
        audioBlob = new Blob([data.audioBuffer], { type: data.mimeType || 'audio/mpeg' });
      } else {
        throw new Error('Azure TTS response must include audio data');
      }

      // Create File object and upload
      const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData);

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devWarn('azureTTS failed:', error);
      throw new Error(`Azure TTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using IBM Watson TTS via an API endpoint.
   * Validates the voice and uploads generated audio.
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - IBM Watson API key.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
   * @throws {Error} - If request fails.
   */
  async ibmWatsonTTS(text, options = {}) {
    devLog('ibmWatsonTTS called', { text, options });

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    // Validate voice
    const validatedVoice = validateVoice(options.voice, activeVoices, defaultVoice);
    devLog('ibmWatsonTTS: Validated voice', validatedVoice);

    if (validatedVoice.engine !== 'ibmwatson') {
      devWarn('ibmWatsonTTS: Invalid engine for voice', validatedVoice);
      throw new Error('Selected voice is not an IBM Watson TTS voice');
    }

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
          voice: validatedVoice.id,
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
      const fileName = this.generateFileName(title, increment, text, 'ibmwatson');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob
      let audioBlob;
      if (data.audioBase64 || data.audioUrl) {
        const response = await fetch(normalized.url);
        audioBlob = await response.blob();
      } else if (data.audioBuffer) {
        audioBlob = new Blob([data.audioBuffer], { type: data.mimeType || 'audio/mpeg' });
      } else {
        throw new Error('IBM Watson TTS response must include audio data');
      }

      // Create File object and upload
      const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData);

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devWarn('ibmWatsonTTS failed:', error);
      throw new Error(`IBM Watson TTS failed: ${error.message}`);
    }
  }

  /**
   * Get available voices for a specified speech engine, prioritizing activeVoices from ttsState.
   * @param {string} engine - Speech engine ('gtts', 'elevenlabs', 'awspolly', 'googlecloud', 'azuretts', 'ibmwatson').
   * @param {Object} [options] - Options for retrieving voices.
   * @returns {Promise<Array>} - Array of available voices.
   * @throws {Error} - If API request fails for dynamic fetching.
   */
  async getAvailableVoices(engine, options = {}) {
    devLog('getAvailableVoices called', { engine, options });
    engine = engine.toLowerCase();

    // Get state
    const state = this.getTTSState();
    const activeVoices = state?.settings?.activeVoices || [];
    const apiKeys = state?.settings?.elevenLabsApiKeys || [];

    // Return active voices for the engine
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
          return (data.voices || []).map(voice => ({
            ...voice,
            engine: 'gtts',
          }));
        } catch (error) {
          devWarn('getAvailableVoices gTTS error:', error);
          return [
            { id: 'en-com', name: 'American English', language: 'en', tld: 'com', engine: 'gtts' },
            { id: 'en-com.au', name: 'Australian English', language: 'en', tld: 'com.au', engine: 'gtts' },
            { id: 'en-co.uk', name: 'British English', language: 'en', tld: 'co.uk', engine: 'gtts' },
            { id: 'en-ca', name: 'Canadian English', language: 'en', tld: 'ca', engine: 'gtts' },
            { id: 'en-co.in', name: 'Indian English', language: 'en', tld: 'co.in', engine: 'gtts' },
          ];
        }
      case 'elevenlabs':
        if (!apiKeys.length) {
          devWarn('getAvailableVoices elevenlabs: No API keys found');
          throw new Error('No ElevenLabs API keys configured');
        }
        try {
          const voices = await elevenLabsAPI.getVoices(apiKeys);
          devLog('getAvailableVoices elevenlabs data:', voices);
          return voices.map(voice => ({
            ...voice,
            engine: 'elevenlabs',
          }));
        } catch (error) {
          devWarn('getAvailableVoices elevenlabs error:', error);
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
          devLog('getAvailableVoices googlecloud response status:', response.status);
          if (!response.ok) throw new Error('Failed to fetch Google Cloud voices');
          const data = await response.json();
          devLog('getAvailableVoices googlecloud data:', data);
          return (data.voices || []).map(voice => ({
            ...voice,
            engine: 'googlecloud',
          }));
        } catch (error) {
          devWarn('getAvailableVoices googlecloud error:', error);
          return [];
        }
      case 'azuretts':
        try {
          const response = await fetch('/api/getVoices?engine=azuretts', {
            headers: { 'Content-Type': 'application/json' },
          });
          devLog('getAvailableVoices azuretts response status:', response.status);
          if (!response.ok) throw new Error('Failed to fetch Azure TTS voices');
          const data = await response.json();
          devLog('getAvailableVoices azuretts data:', data);
          return (data.voices || []).map(voice => ({
            ...voice,
            engine: 'azuretts',
          }));
        } catch (error) {
          devWarn('getAvailableVoices azuretts error:', error);
          return [];
        }
      case 'ibmwatson':
        try {
          const response = await fetch('/api/getVoices?engine=ibmwatson', {
            headers: { 'Content-Type': 'application/json' },
          });
          devLog('getAvailableVoices ibmwatson response status:', response.status);
          if (!response.ok) throw new Error('Failed to fetch IBM Watson voices');
          const data = await response.json();
          devLog('getAvailableVoices ibmwatson data:', data);
          return (data.voices || []).map(voice => ({
            ...voice,
            engine: 'ibmwatson',
          }));
        } catch (error) {
          devWarn('getAvailableVoices ibmwatson error:', error);
          return [];
        }
      default:
        devWarn('getAvailableVoices: unsupported engine', engine);
        return [];
    }
  }

  /**
   * Convert text to speech using specified engine and upload the audio.
   * @param {string} text - The text to convert to speech.
   * @param {string} engine - TTS engine ('gtts', 'awspolly', 'elevenlabs', 'googlecloud', 'azuretts', 'ibmwatson').
   * @param {Object} [options] - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.apiKey] - API key for engines requiring authentication.
   * @param {string} [options.accessKey] - AWS access key (for awspolly).
   * @param {string} [options.secretKey] - AWS secret key (for awspolly).
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response.
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
      devWarn('convert_text_to_speech_and_upload: Unsupported engine', engine);
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
      devWarn('convert_text_to_speech_and_upload failed:', error);
      throw new Error(`Failed to generate audio with ${engine}: ${error.message}`);
    }
  }

  /**
   * Generate audio segments from an array of scripts.
   * @param {Array} scripts - Array of script objects defining the audio sequence.
   * @param {Object} scripts[] - Script object.
   * @param {string} scripts[].type - Type of segment ('speech', 'pause', or 'sound').
   * @param {string} [scripts[].text] - Text to convert for 'speech' type.
   * @param {string} [scripts[].engine] - Engine for 'speech' type.
   * @param {Object} [scripts[].options] - Options for 'speech' type (includes voice, title).
   * @param {number} [scripts[].duration] - Duration in seconds for 'pause' or 'sound' type.
   * @param {string} [scripts[].url] - Audio URL for 'sound' type.
   * @returns {Promise<Array>} - Array of audio segments with server and blob URLs.
   * @throws {Error} - If an unsupported script item type is encountered.
   */
  async generate_audio_segments(scripts) {
    devLog('generate_audio_segments called', scripts);
    const segments = [];
    let increment = 1;

    for (const item of scripts) {
      devLog('generate_audio_segments processing item:', item);
      if (item.type === 'speech') {
        const options = {
          ...item.options,
          voice: typeof item.options.voice === 'string' 
            ? { id: item.options.voice, name: item.options.voiceName, language: item.options.language, engine: item.engine } 
            : item.options.voice,
          title: item.options?.title || 'audio',
          increment: increment++,
        };
        const { url, blobUrl, duration, sampleRate, fileName } = await this.convert_text_to_speech_and_upload(
          item.text,
          item.engine,
          options
        );
        devLog('generate_audio_segments got audio:', { url, blobUrl, duration, sampleRate, fileName });
        segments.push({ type: 'audio', url, blobUrl, duration, sampleRate, fileName });
      } else if (item.type === 'pause') {
        segments.push({ type: 'pause', duration: item.duration });
      } else if (item.type === 'sound') {
        segments.push({ type: 'audio', url: item.url, blobUrl: null, duration: item.duration, fileName: item.fileName || '' });
      } else {
        throw new Error(`Unsupported script item type: ${item.type}`);
      }
    }

    devLog('generate_audio_segments returning segments:', segments);
    return segments;
  }
}

export default SpeechServiceAPI; // Export the class