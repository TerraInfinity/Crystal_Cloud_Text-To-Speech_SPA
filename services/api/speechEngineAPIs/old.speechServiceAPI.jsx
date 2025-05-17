import { devLog } from '../../../utils/logUtils';
import elevenLabsAPI from './elevenLabsAPI';
import { useTTSContext } from '../../../context/TTSContext';
import { loadFromStorage } from '../../../context/storage';
import { v4 as uuidv4 } from 'uuid';

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
   * Get the TTS context, falling back to localStorage if context is unavailable.
   * 
   * @returns {Object} - TTS context or localStorage data.
   */
  getTTSState() {
    try {
      const context = useTTSContext();
      return context.state;
    } catch (error) {
      devLog('getTTSState: Context unavailable, falling back to localStorage', error);
      const savedState = loadFromStorage('tts_persistent_state', false, 'localStorage') || {};
      return savedState;
    }
  }

  /**
   * Generate a file name for an audio file based on the specified format.
   * 
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
   * 
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
   * Maps frontend voice IDs to backend voice IDs, handles voice validation, and uploads to storage.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {Array} [options.activeVoices] - List of active voices from TTSContext.
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
   * @throws {Error} - If API request fails or voice is invalid.
   */
  async gTTSTTS(text, options = {}) {
    devLog('gTTSTTS called', { text, options });
    try {
      const gttsUrl = process.env.GTTS_SERVER_URL || 'http://localhost:5000/gtts';
      const voice = options.voice;
      const activeVoices = options.activeVoices || [];
      const title = options.title || 'audio';
      const increment = options.increment || 1;

      const isValidVoice = voice && activeVoices.some(
        v => v.engine === 'gtts' && v.id === voice.id
      );
      const voiceId = isValidVoice ? voice.id : 'us';

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
        'en-US-Standard-A': 'us',
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
      const fileName = this.generateFileName(title, increment, text, 'gtts');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert data URL to Blob if necessary
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
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      return {
        ...normalized,
        url: normalized.blobUrl, // Use blob URL for merging
        fileName,
      };
    } catch (error) {
      devLog('gTTSTTS failed:', error);
      throw new Error(`gTTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using ElevenLabs API.
   * Retrieves API keys and active voices from TTSContext or localStorage.
   * Uploads generated audio to storage.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} options - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {Object} [options.voiceSettings] - Voice settings (stability, similarity_boost).
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
   * @throws {Error} - If no API key is available, no valid voice is provided, or request fails.
   */
  async elevenLabsTTS(text, options = {}) {
    devLog('elevenLabsTTS called', { text, options });

    // Get state from context or localStorage
    const state = this.getTTSState();
    const apiKeys = state?.settings?.elevenLabsApiKeys || [];
    const activeVoices = options.activeVoices || state?.settings?.activeVoices?.elevenlabs || [];
    const defaultVoice = state?.settings?.defaultVoice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

    if (!apiKeys.length) {
      devLog('elevenLabsTTS: No API keys found in state');
      throw new Error('No ElevenLabs API keys configured');
    }

    if (!activeVoices.length) {
      devLog('elevenLabsTTS: No active voices available');
      throw new Error('No active ElevenLabs voices configured');
    }

    const voice = options.voice;
    const voiceSettings = options.voiceSettings || {};
    let voiceId;

    // Validate voice
    const isValidVoice = voice && activeVoices.some(
      v => v.engine === 'elevenlabs' && v.id === voice.id
    );
    if (isValidVoice) {
      voiceId = voice.id;
      devLog('elevenLabsTTS: Using provided voice', voiceId);
    } else if (defaultVoice && defaultVoice.engine === 'elevenlabs' && activeVoices.some(
      v => v.engine === 'elevenlabs' && v.id === defaultVoice.voiceId
    )) {
      voiceId = defaultVoice.voiceId;
      devLog('elevenLabsTTS: Using default voice', voiceId);
    } else {
      devLog('elevenLabsTTS: No valid voice provided');
      throw new Error('No valid ElevenLabs voice provided');
    }

    try {
      const { audioBuffer, mimeType, text: returnedText, title: returnedTitle, increment: returnedIncrement } = await elevenLabsAPI.textToSpeech(text, {
        apiKeys,
        voiceId,
        stability: voiceSettings.stability || 0.75,
        similarity_boost: voiceSettings.similarity_boost || 0.75,
        title,
        increment,
      });

      devLog('elevenLabsTTS audioBuffer length:', audioBuffer.byteLength);

      // Create Blob and File
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      const fileName = this.generateFileName(returnedTitle, returnedIncrement, returnedText, 'elevenlabs');
      const audioFile = new File([audioBlob], fileName, { type: mimeType });

      // Upload to storage
      const audioData = {
        name: fileName,
        category: 'generated_audio',
        placeholder: text.slice(0, 50),
        volume: 1,
      };
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      // Create blob URL for merging
      const blobUrl = URL.createObjectURL(audioBlob);

      return {
        url: blobUrl, // Use blob URL for merging
        blobUrl,
        duration: 0,
        sampleRate: voiceSettings.sampleRate || 44100,
        fileName,
      };
    } catch (error) {
      devLog('elevenLabsTTS failed:', error);
      throw new Error(`ElevenLabs TTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using AWS Polly via an API endpoint.
   * Requires AWS credentials and validates the voice against activeVoices.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} options - Options for speech synthesis.
   * @param {string} options.accessKey - AWS access key (required).
   * @param {string} options.secretKey - AWS secret key (required).
   * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'Joanna' }).
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.outputFormat] - Audio output format (default: 'mp3').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
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
    const title = options.title || 'audio';
    const increment = options.increment || 1;

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
      const fileName = this.generateFileName(title, increment, text, 'awspolly');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob if necessary
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
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devLog('awsPollyTTS failed:', error);
      throw new Error(`AWS Polly failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using Google Cloud Text-to-Speech via an API endpoint.
   * Validates the voice against activeVoices and accepts an optional API key.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - Google Cloud API key.
   * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US-Wavenet-D' }).
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
   * @throws {Error} - If request fails.
   */
  async googleCloudTTS(text, options = {}) {
    devLog('googleCloudTTS called', { text, options });
    const activeVoices = options.activeVoices || [];
    const voice = options.voice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

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
      const fileName = this.generateFileName(title, increment, text, 'googlecloud');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob if necessary
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
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devLog('googleCloudTTS failed:', error);
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using Microsoft Azure Cognitive Services TTS via an API endpoint.
   * Validates the voice against activeVoices and accepts an optional API key.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - Azure API key.
   * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US-JennyNeural' }).
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
   * @throws {Error} - If request fails.
   */
  async azureTTS(text, options = {}) {
    devLog('azureTTS called', { text, options });
    const activeVoices = options.activeVoices || [];
    const voice = options.voice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

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
      const fileName = this.generateFileName(title, increment, text, 'azuretts');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob if necessary
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
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devLog('azureTTS failed:', error);
      throw new Error(`Azure TTS failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using IBM Watson TTS via an API endpoint.
   * Validates the voice against activeVoices and accepts an optional API key.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {Object} [options] - Options for speech synthesis.
   * @param {string} [options.apiKey] - IBM Watson API key.
   * @param {Object} [options.voice] - Voice object from activeVoices (default: { id: 'en-US_AllisonV3Voice' }).
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
   * @throws {Error} - If request fails.
   */
  async ibmWatsonTTS(text, options = {}) {
    devLog('ibmWatsonTTS called', { text, options });
    const activeVoices = options.activeVoices || [];
    const voice = options.voice;
    const title = options.title || 'audio';
    const increment = options.increment || 1;

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
      const fileName = this.generateFileName(title, increment, text, 'ibmwatson');
      data.fileName = fileName;

      const normalized = this.normalizeAudioResponse(data);

      // Convert to Blob if necessary
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
      await this.fileStorageActions.uploadAudio(audioFile, audioData); // Use this.fileStorageActions

      return {
        ...normalized,
        url: normalized.blobUrl || URL.createObjectURL(audioBlob),
        blobUrl: normalized.blobUrl || URL.createObjectURL(audioBlob),
        fileName,
      };
    } catch (error) {
      devLog('ibmWatsonTTS failed:', error);
      throw new Error(`IBM Watson TTS failed: ${error.message}`);
    }
  }

  /**
   * Get available voices for a specified speech engine, prioritizing activeVoices from TTSContext.
   * Falls back to fetching voices from the server or returns static lists for some engines.
   * 
   * @param {string} engine - Speech engine ('gtts', 'elevenlabs', 'awspolly', 'googlecloud', 'azuretts', 'ibmwatson').
   * @param {Object} [options] - Options for retrieving voices.
   * @param {Array} [options.activeVoices] - List of active voices from TTSContext.
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

    // Get API keys from context for ElevenLabs
    const state = this.getTTSState();
    const apiKeys = state?.settings?.elevenLabsApiKeys || [];

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
        if (!apiKeys.length) {
          devLog('getAvailableVoices elevenlabs: No API keys found');
          throw new Error('No ElevenLabs API keys configured');
        }
        try {
          const voices = await elevenLabsAPI.getVoices(apiKeys);
          devLog('getAvailableVoices elevenlabs data:', voices);
          return voices;
        } catch (error) {
          devLog('getAvailableVoices elevenlabs error:', error);
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
          devLog('getAvailableVoices googlecloud error:', error);
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
          devLog('getAvailableVoices azuretts error:', error);
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
          devLog('getAvailableVoices ibmwatson error:', error);
          return [];
        }
      default:
        devLog('getAvailableVoices: unsupported engine', engine);
        return [];
    }
  }

  /**
   * Convert text to speech using specified engine and upload the audio.
   * High-level method that delegates to specific engine methods based on the engine parameter.
   * 
   * @param {string} text - The text to convert to speech.
   * @param {string} engine - TTS engine ('gtts', 'awspolly', 'elevenlabs', 'googlecloud', 'azuretts', 'ibmwatson').
   * @param {Object} [options] - Options for speech synthesis.
   * @param {Object} [options.voice] - Voice object from activeVoices.
   * @param {Array} [options.activeVoices] - List of active voices for validation.
   * @param {string} [options.language] - Language code (default: 'en-US').
   * @param {string} [options.apiKey] - API key for engines requiring authentication.
   * @param {string} [options.accessKey] - AWS access key (for awspolly).
   * @param {string} [options.secretKey] - AWS secret key (for awspolly).
   * @param {string} [options.title] - Title for file naming.
   * @param {number} [options.increment] - Incremental number for file naming.
   * @returns {Promise<{url: string, blobUrl: string, duration: number, sampleRate: number, fileName: string}>} - Normalized audio response with server and blob URLs.
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
   * Generate audio segments from an array of scripts, orchestrating TTS, pauses, and sound effects.
   * Processes each script item in order, supporting multiple engines and file naming.
   * 
   * @param {Array} scripts - Array of script objects defining the audio sequence.
   * @param {Object} scripts[] - Script object.
   * @param {string} scripts[].type - Type of segment ('speech', 'pause', or 'sound').
   * @param {string} [scripts[].text] - Text to convert for 'speech' type.
   * @param {string} [scripts[].engine] - Engine for 'speech' type.
   * @param {Object} [scripts[].options] - Options for 'speech' type (includes voice, activeVoices, title).
   * @param {number} [scripts[].duration] - Duration in seconds for 'pause' or 'sound' type.
   * @param {string} [scripts[].url] - Audio URL for 'sound' type.
   * @returns {Promise<Array>} - Promise resolving to an array of audio segments with server and blob URLs.
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

export default SpeechServiceAPI; // Export the class, not an instance