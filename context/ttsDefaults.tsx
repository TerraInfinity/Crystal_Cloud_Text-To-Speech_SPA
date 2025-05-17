import { Voice } from '../utils/voiceUtils';

/**
 * Function to define default voices for each speech engine
 * @returns {Record<string, Voice[]>} Object containing lists of default voices organized by engine
 */
const defaultVoiceList = (): Record<string, Voice[]> => ({
  gtts: [
    { name: 'American English', id: 'en-com', language: 'en', tld: 'com', engine: 'gtts' },
    { name: 'Australian English', id: 'en-com.au', language: 'en', tld: 'com.au', engine: 'gtts' },
    { name: 'British English', id: 'en-co.uk', language: 'en', tld: 'co.uk', engine: 'gtts' },
    { name: 'Canadian English', id: 'en-ca', language: 'en', tld: 'ca', engine: 'gtts' },
    { name: 'Indian English', id: 'en-co.in', language: 'en', tld: 'co.in', engine: 'gtts' },
    { name: 'German (Germany)', id: 'de-de', language: 'de', tld: 'de', engine: 'gtts' },
    { name: 'Spanish (Spain)', id: 'es-es', language: 'es', tld: 'es', engine: 'gtts' },
    { name: 'Spanish (Mexico)', id: 'es-com.mx', language: 'es', tld: 'com.mx', engine: 'gtts' },
    { name: 'French (France)', id: 'fr-fr', language: 'fr', tld: 'fr', engine: 'gtts' },
    { name: 'Italian (Italy)', id: 'it-it', language: 'it', tld: 'it', engine: 'gtts' },
    { name: 'Japanese', id: 'ja-co.jp', language: 'ja', tld: 'co.jp', engine: 'gtts' },
    { name: 'Portuguese (Portugal)', id: 'pt-pt', language: 'pt', tld: 'pt', engine: 'gtts' },
    { name: 'Portuguese (Brazil)', id: 'pt-com.br', language: 'pt', tld: 'com.br', engine: 'gtts' },
  ],
  elevenlabs: [
    { name: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM', language: 'en', engine: 'elevenlabs' },
    { name: 'Drew', id: '29vD33N1CtxCmqQRPOHJ', language: 'en', engine: 'elevenlabs' },
    { name: 'Adam', id: 'pNInz6obpgDQGcFmaJgB', language: 'en', engine: 'elevenlabs' },
    { name: 'Antoni', id: 'ErXwobaYiN019PkySvjV', language: 'en', engine: 'elevenlabs' },
    { name: 'Bella', id: 'EXAVITQu4vr4xnSDxMaL', language: 'en', engine: 'elevenlabs' },
    { name: 'Arnold', id: 'VR6AewLTigWG4xSOukaG', language: 'en', engine: 'elevenlabs' },
    { name: 'Domi', id: 'AZnzlk1XvdvUeBnXmlld', language: 'en', engine: 'elevenlabs' },
    { name: 'Elli', id: 'MF3mGyEYCl7XYWbV9V6O', language: 'en', engine: 'elevenlabs' },
    { name: 'Josh', id: 'TxGEqnHWrfWFTfGW9XjX', language: 'en', engine: 'elevenlabs' },
    { name: 'Sam', id: 'yoZ06aMxZJJ28mfd3POQ', language: 'en', engine: 'elevenlabs' },
    { name: 'Clyde', id: '2EiwWnXFnvU5JabPnv8n', language: 'en', engine: 'elevenlabs' },
    { name: 'Fin', id: 'D38z5RcWu1voky8WS1ja', language: 'en', engine: 'elevenlabs' },
    { name: 'Lily', id: 'pFZP5JQG7iQjIQuo4tMq', language: 'en', engine: 'elevenlabs' },
    { name: 'Glinda', id: 'z9fAnlkpzviPz146aGWa', language: 'en', engine: 'elevenlabs' },
    { name: 'Charlotte', id: 'XB0fDUnXU5powFXDhCwa', language: 'en', engine: 'elevenlabs' },
    { name: 'Daniel', id: 'onwK4e9ZLuTAKqWW03F9', language: 'en', engine: 'elevenlabs' },
    { name: 'Thomas', id: 'GBv7mTt0atIp3Br8iCZE', language: 'en', engine: 'elevenlabs' },
    { name: 'Freya', id: 'jsCqWAovK2LkecY7zXl4', language: 'en', engine: 'elevenlabs' },
    { name: 'River', id: 'SAz9YHcvj6GT2YYXdXww', language: 'en', engine: 'elevenlabs' },
  ],
  aws_polly: [
    { name: 'Joanna (US English)', id: 'Joanna', language: 'en-US', engine: 'aws_polly' },
    { name: 'Matthew (US English)', id: 'Matthew', language: 'en-US', engine: 'aws_polly' },
    { name: 'Amy (British English)', id: 'Amy', language: 'en-GB', engine: 'aws_polly' },
    { name: 'Brian (British English)', id: 'Brian', language: 'en-GB', engine: 'aws_polly' },
    { name: 'Nicole (Australian English)', id: 'Nicole', language: 'en-AU', engine: 'aws_polly' },
    { name: 'Russell (Australian English)', id: 'Russell', language: 'en-AU', engine: 'aws_polly' },
    { name: 'Lucia (Spanish)', id: 'Lucia', language: 'es-ES', engine: 'aws_polly' },
    { name: 'Enrique (Spanish)', id: 'Enrique', language: 'es-ES', engine: 'aws_polly' },
    { name: 'Celine (French)', id: 'Celine', language: 'fr-FR', engine: 'aws_polly' },
    { name: 'Mathieu (French)', id: 'Mathieu', language: 'fr-FR', engine: 'aws_polly' },
    { name: 'Marlene (German)', id: 'Marlene', language: 'de-DE', engine: 'aws_polly' },
    { name: 'Hans (German)', id: 'Hans', language: 'de-DE', engine: 'aws_polly' },
    { name: 'Carla (Italian)', id: 'Carla', language: 'it-IT', engine: 'aws_polly' },
    { name: 'Giorgio (Italian)', id: 'Giorgio', language: 'it-IT', engine: 'aws_polly' },
    { name: 'Vitoria (Portuguese)', id: 'Vitoria', language: 'pt-PT', engine: 'aws_polly' },
    { name: 'Ricardo (Portuguese)', id: 'Ricardo', language: 'pt-PT', engine: 'aws_polly' },
    { name: 'Tatyana (Russian)', id: 'Tatyana', language: 'ru-RU', engine: 'aws_polly' },
    { name: 'Maxim (Russian)', id: 'Maxim', language: 'ru-RU', engine: 'aws_polly' },
    { name: 'Zhiyu (Chinese)', id: 'Zhiyu', language: 'zh-CN', engine: 'aws_polly' },
    { name: 'Takumi (Japanese)', id: 'Takumi', language: 'ja-JP', engine: 'aws_polly' },
    { name: 'Seoyeon (Korean)', id: 'Seoyeon', language: 'ko-KR', engine: 'aws_polly' },
  ],
  googlecloud: [
    { name: 'en-US-Wavenet-A', id: 'en-US-Wavenet-A', language: 'en-US', engine: 'googlecloud' },
    { name: 'en-US-Wavenet-B', id: 'en-US-Wavenet-B', language: 'en-US', engine: 'googlecloud' },
    { name: 'en-GB-Wavenet-A', id: 'en-GB-Wavenet-A', language: 'en-GB', engine: 'googlecloud' },
    { name: 'en-GB-Wavenet-B', id: 'en-GB-Wavenet-B', language: 'en-GB', engine: 'googlecloud' },
    { name: 'es-ES-Wavenet-A', id: 'es-ES-Wavenet-A', language: 'es-ES', engine: 'googlecloud' },
    { name: 'es-ES-Standard-A', id: 'es-ES-Standard-A', language: 'es-ES', engine: 'googlecloud' },
    { name: 'fr-FR-Wavenet-A', id: 'fr-FR-Wavenet-A', language: 'fr-FR', engine: 'googlecloud' },
    { name: 'fr-FR-Standard-A', id: 'fr-FR-Standard-A', language: 'fr-FR', engine: 'googlecloud' },
    { name: 'de-DE-Wavenet-A', id: 'de-DE-Wavenet-A', language: 'de-DE', engine: 'googlecloud' },
    { name: 'de-DE-Standard-A', id: 'de-DE-Standard-A', language: 'de-DE', engine: 'googlecloud' },
    { name: 'it-IT-Wavenet-A', id: 'it-IT-Wavenet-A', language: 'it-IT', engine: 'googlecloud' },
    { name: 'it-IT-Standard-A', id: 'it-IT-Standard-A', language: 'it-IT', engine: 'googlecloud' },
    { name: 'pt-BR-Wavenet-A', id: 'pt-BR-Wavenet-A', language: 'pt-BR', engine: 'googlecloud' },
    { name: 'pt-BR-Standard-A', id: 'pt-BR-Standard-A', language: 'pt-BR', engine: 'googlecloud' },
    { name: 'ja-JP-Wavenet-A', id: 'ja-JP-Wavenet-A', language: 'ja-JP', engine: 'googlecloud' },
    { name: 'ko-KR-Wavenet-A', id: 'ko-KR-Wavenet-A', language: 'ko-KR', engine: 'googlecloud' },
    { name: 'zh-CN-Wavenet-A', id: 'zh-CN-Wavenet-A', language: 'zh-CN', engine: 'googlecloud' },
  ],
  azuretts: [
    { name: 'Jenny (US English)', id: 'en-US-JennyNeural', language: 'en-US', engine: 'azuretts' },
    { name: 'Guy (US English)', id: 'en-US-GuyNeural', language: 'en-US', engine: 'azuretts' },
    { name: 'Aria (US English)', id: 'en-US-AriaNeural', language: 'en-US', engine: 'azuretts' },
    { name: 'Davis (US English)', id: 'en-US-DavisNeural', language: 'en-US', engine: 'azuretts' },
    { name: 'Amber (British English)', id: 'en-GB-AmberNeural', language: 'en-GB', engine: 'azuretts' },
    { name: 'Ryan (British English)', id: 'en-GB-RyanNeural', language: 'en-GB', engine: 'azuretts' },
    { name: 'Elvira (Spanish)', id: 'es-ES-ElviraNeural', language: 'es-ES', engine: 'azuretts' },
    { name: 'Alvaro (Spanish)', id: 'es-ES-AlvaroNeural', language: 'es-ES', engine: 'azuretts' },
    { name: 'Denise (French)', id: 'fr-FR-DeniseNeural', language: 'fr-FR', engine: 'azuretts' },
    { name: 'Henri (French)', id: 'fr-FR-HenriNeural', language: 'fr-FR', engine: 'azuretts' },
    { name: 'Katja (German)', id: 'de-DE-KatjaNeural', language: 'de-DE', engine: 'azuretts' },
    { name: 'Conrad (German)', id: 'de-DE-ConradNeural', language: 'de-DE', engine: 'azuretts' },
    { name: 'Isabella (Italian)', id: 'it-IT-IsabellaNeural', language: 'it-IT', engine: 'azuretts' },
    { name: 'Diego (Italian)', id: 'it-IT-DiegoNeural', language: 'it-IT', engine: 'azuretts' },
    { name: 'Francisca (Portuguese)', id: 'pt-BR-FranciscaNeural', language: 'pt-BR', engine: 'azuretts' },
    { name: 'Antonio (Portuguese)', id: 'pt-BR-AntonioNeural', language: 'pt-BR', engine: 'azuretts' },
    { name: 'Xiaoxiao (Chinese)', id: 'zh-CN-XiaoxiaoNeural', language: 'zh-CN', engine: 'azuretts' },
    { name: 'Yunyang (Chinese)', id: 'zh-CN-YunyangNeural', language: 'zh-CN', engine: 'azuretts' },
    { name: 'Sakura (Japanese)', id: 'ja-JP-SakuraNeural', language: 'ja-JP', engine: 'azuretts' },
    { name: 'Keita (Japanese)', id: 'ja-JP-KeitaNeural', language: 'ja-JP', engine: 'azuretts' },
  ],
  ibmwatson: [
    { name: 'Allison (US English)', id: 'en-US_AllisonV3Voice', language: 'en-US', engine: 'ibmwatson' },
    { name: 'Michael (US English)', id: 'en-US_MichaelV3Voice', language: 'en-US', engine: 'ibmwatson' },
    { name: 'Emily (British English)', id: 'en-GB_EmilyV3Voice', language: 'en-GB', engine: 'ibmwatson' },
    { name: 'Laura (Spanish)', id: 'es-ES_LauraV3Voice', language: 'es-ES', engine: 'ibmwatson' },
    { name: 'Enrique (Spanish)', id: 'es-ES_EnriqueV3Voice', language: 'es-ES', engine: 'ibmwatson' },
    { name: 'Renee (French)', id: 'fr-FR_ReneeV3Voice', language: 'fr-FR', engine: 'ibmwatson' },
    { name: 'Birgit (German)', id: 'de-DE_BirgitV3Voice', language: 'de-DE', engine: 'ibmwatson' },
    { name: 'Dieter (German)', id: 'de-DE_DieterV3Voice', language: 'de-DE', engine: 'ibmwatson' },
    { name: 'Francesca (Italian)', id: 'it-IT_FrancescaV3Voice', language: 'it-IT', engine: 'ibmwatson' },
    { name: 'Isabela (Portuguese)', id: 'pt-BR_IsabelaV3Voice', language: 'pt-BR', engine: 'ibmwatson' },
    { name: 'Sofia (Portuguese)', id: 'pt-BR_SofiaV3Voice', language: 'pt-BR', engine: 'ibmwatson' },
    { name: 'Omar (Arabic)', id: 'ar-MS_OmarVoice', language: 'ar-MS', engine: 'ibmwatson' },
    { name: 'Wenwen (Chinese)', id: 'zh-CN_WenwenVoice', language: 'zh-CN', engine: 'ibmwatson' },
  ],
});

/**
 * Get the default voices for all TTS engines
 * @returns {Record<string, Voice[]>} Object containing voice lists for all supported engines
 */
export const getDefaultVoices = (): Record<string, Voice[]> => {
  return defaultVoiceList();
};

/**
 * Get the initial active voices as a flat array
 * @returns {Voice[]} Array of initial active voices
 */
const getInitialActiveVoices = (): Voice[] => {
  const voices = getDefaultVoices();
  return [
    voices.gtts[0], // American English
    voices.gtts[1], // Australian English
    voices.gtts[2], // British English
  ];
};

/**
 * Template for Yoga Kriya TTS project
 * Includes pre-defined sections for a structured yoga practice
 * @type {Object}
 */
export const yogaKriyaTemplate = {
  id: 'yogaKriya',
  name: 'Yoga Kriya',
  description: 'Pre-defined sections for Yoga practice with Tuning In, Warm-Up, Kriya Sequence, Relaxation, Meditation, and Closing sections.',
  sections: [
    {
      id: 'section-tuning',
      title: 'Tuning In (Intro)',
      type: 'audio-only',
      text: '',
      voice: null,
    },
    {
      id: 'section-warmup',
      title: 'Warm-Up',
      type: 'text-to-speech',
      text: '',
      voice: null,
    },
    {
      id: 'section-kriya',
      title: 'Kriya Sequence',
      type: 'text-to-speech',
      text: '',
      voice: null,
    },
    {
      id: 'section-relaxation',
      title: 'Relaxation',
      type: 'text-to-speech',
      text: '',
      voice: null,
    },
    {
      id: 'section-meditation',
      title: 'Meditation',
      type: 'text-to-speech',
      text: '',
      voice: null,
    },
    {
      id: 'section-closing',
      title: 'Closing',
      type: 'audio-only',
      text: '',
      voice: null,
    },
  ],
};

/**
 * Initial persistent state for the TTS application
 * Contains default settings, voices, and configurations
 * @type {Object}
 */
export const initialPersistentState = {
  theme: 'glitch',
  templates: {
    yogaKriya: yogaKriyaTemplate,
  },
  settings: {
    speechEngine: 'gtts',
    availableVoices: getDefaultVoices(),
    customVoices: {},
    activeVoices: getInitialActiveVoices(),
    defaultVoice: {
      engine: 'gtts',
      voiceId: getDefaultVoices().gtts[0].id, // e.g., 'en-com'
      id: getDefaultVoices().gtts[0].id,
      name: getDefaultVoices().gtts[0].name,
      language: getDefaultVoices().gtts[0].language,
    },
    mode: 'demo',
    storageConfig: {
      type: 'local',
      serverUrl: 'http://localhost:5000',
      serviceType: null,
    },
  },
};

/**
 * Initial session state for the TTS application
 * Contains temporary state for the current working session
 * @type {Object}
 */
export const initialSessionState = {
  inputText: '',
  inputType: 'text',
  currentTemplate: 'general',
  sections: [],
  activeTab: 'main',
  isProcessing: false,
  errorMessage: null,
  notification: null,
  mergedAudio: null,
  isPlaying: false,
  selectedAudioLibraryId: null,
  generatedTTSAudios: {},
  selectedInputVoice: null,
  templateCreation: {
    templateName: '',
    templateDescription: '',
    sections: [
      {
        id: `section-${Date.now()}`,
        title: `Section 1`,
        type: 'text-to-speech',
        text: '',
        voice: null,
        voiceSettings: { pitch: 1, rate: 1, volume: 1 },
      },
    ],
    editingTemplate: null,
  },
  lastAudioInputSelection: { audioId: null, audioCategory: 'sound_effect' }, 
};