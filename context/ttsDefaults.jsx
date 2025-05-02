/**
 * Function to define default voices for each speech engine
 * @returns {Object} Object containing lists of default voices organized by engine
 */
const defaultVoiceList = () => ({
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
    elevenLabs: [
        { name: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM', language: 'en', engine: 'elevenLabs' },
        { name: 'Drew', id: '29vD33N1CtxCmqQRPOHJ', language: 'en', engine: 'elevenLabs' },
        { name: 'Adam', id: 'pNInz6obpgDQGcFmaJgB', language: 'en', engine: 'elevenLabs' },
        { name: 'Antoni', id: 'ErXwobaYiN019PkySvjV', language: 'en', engine: 'elevenLabs' },
        { name: 'Bella', id: 'EXAVITQu4vr4xnSDxMaL', language: 'en', engine: 'elevenLabs' },
        { name: 'Arnold', id: 'VR6AewLTigWG4xSOukaG', language: 'en', engine: 'elevenLabs' },
        { name: 'Domi', id: 'AZnzlk1XvdvUeBnXmlld', language: 'en', engine: 'elevenLabs' },
        { name: 'Elli', id: 'MF3mGyEYCl7XYWbV9V6O', language: 'en', engine: 'elevenLabs' },
        { name: 'Josh', id: 'TxGEqnHWrfWFTfGW9XjX', language: 'en', engine: 'elevenLabs' },
        { name: 'Sam', id: 'yoZ06aMxZJJ28mfd3POQ', language: 'en', engine: 'elevenLabs' },
        { name: 'Clyde', id: '2EiwWnXFnvU5JabPnv8n', language: 'en', engine: 'elevenLabs' },
        { name: 'Fin', id: 'D38z5RcWu1voky8WS1ja', language: 'en', engine: 'elevenLabs' },
        { name: 'Lily', id: 'pFZP5JQG7iQjIQuo4tMq', language: 'en', engine: 'elevenLabs' },
        { name: 'Glinda', id: 'z9fAnlkpzviPz146aGWa', language: 'en', engine: 'elevenLabs' },
        { name: 'Charlotte', id: 'XB0fDUnXU5powFXDhCwa', language: 'en', engine: 'elevenLabs' },
        { name: 'Daniel', id: 'onwK4e9ZLuTAKqWW03F9', language: 'en', engine: 'elevenLabs' },
        { name: 'Thomas', id: 'GBv7mTt0atIp3Br8iCZE', language: 'en', engine: 'elevenLabs' },
        { name: 'Freya', id: 'jsCqWAovK2LkecY7zXl4', language: 'en', engine: 'elevenLabs' },
        { name: 'River', id: 'SAz9YHcvj6GT2YYXdXww', language: 'en', engine: 'elevenLabs' },
    ],
    awsPolly: [
        { name: 'Joanna (US English)', id: 'Joanna', language: 'en-US', engine: 'awsPolly' },
        { name: 'Matthew (US English)', id: 'Matthew', language: 'en-US', engine: 'awsPolly' },
        { name: 'Amy (British English)', id: 'Amy', language: 'en-GB', engine: 'awsPolly' },
        { name: 'Brian (British English)', id: 'Brian', language: 'en-GB', engine: 'awsPolly' },
        { name: 'Nicole (Australian English)', id: 'Nicole', language: 'en-AU', engine: 'awsPolly' },
        { name: 'Russell (Australian English)', id: 'Russell', language: 'en-AU', engine: 'awsPolly' },
        { name: 'Lucia (Spanish)', id: 'Lucia', language: 'es-ES', engine: 'awsPolly' },
        { name: 'Enrique (Spanish)', id: 'Enrique', language: 'es-ES', engine: 'awsPolly' },
        { name: 'Celine (French)', id: 'Celine', language: 'fr-FR', engine: 'awsPolly' },
        { name: 'Mathieu (French)', id: 'Mathieu', language: 'fr-FR', engine: 'awsPolly' },
        { name: 'Marlene (German)', id: 'Marlene', language: 'de-DE', engine: 'awsPolly' },
        { name: 'Hans (German)', id: 'Hans', language: 'de-DE', engine: 'awsPolly' },
        { name: 'Carla (Italian)', id: 'Carla', language: 'it-IT', engine: 'awsPolly' },
        { name: 'Giorgio (Italian)', id: 'Giorgio', language: 'it-IT', engine: 'awsPolly' },
        { name: 'Vitoria (Portuguese)', id: 'Vitoria', language: 'pt-PT', engine: 'awsPolly' },
        { name: 'Ricardo (Portuguese)', id: 'Ricardo', language: 'pt-PT', engine: 'awsPolly' },
        { name: 'Tatyana (Russian)', id: 'Tatyana', language: 'ru-RU', engine: 'awsPolly' },
        { name: 'Maxim (Russian)', id: 'Maxim', language: 'ru-RU', engine: 'awsPolly' },
        { name: 'Zhiyu (Chinese)', id: 'Zhiyu', language: 'zh-CN', engine: 'awsPolly' },
        { name: 'Takumi (Japanese)', id: 'Takumi', language: 'ja-JP', engine: 'awsPolly' },
        { name: 'Seoyeon (Korean)', id: 'Seoyeon', language: 'ko-KR', engine: 'awsPolly' },
    ],
    googleCloud: [
        { name: 'en-US-Wavenet-A', id: 'en-US-Wavenet-A', language: 'en-US', engine: 'googleCloud' },
        { name: 'en-US-Wavenet-B', id: 'en-US-Wavenet-B', language: 'en-US', engine: 'googleCloud' },
        { name: 'en-GB-Wavenet-A', id: 'en-GB-Wavenet-A', language: 'en-GB', engine: 'googleCloud' },
        { name: 'en-GB-Wavenet-B', id: 'en-GB-Wavenet-B', language: 'en-GB', engine: 'googleCloud' },
        { name: 'es-ES-Wavenet-A', id: 'es-ES-Wavenet-A', language: 'es-ES', engine: 'googleCloud' },
        { name: 'es-ES-Standard-A', id: 'es-ES-Standard-A', language: 'es-ES', engine: 'googleCloud' },
        { name: 'fr-FR-Wavenet-A', id: 'fr-FR-Wavenet-A', language: 'fr-FR', engine: 'googleCloud' },
        { name: 'fr-FR-Standard-A', id: 'fr-FR-Standard-A', language: 'fr-FR', engine: 'googleCloud' },
        { name: 'de-DE-Wavenet-A', id: 'de-DE-Wavenet-A', language: 'de-DE', engine: 'googleCloud' },
        { name: 'de-DE-Standard-A', id: 'de-DE-Standard-A', language: 'de-DE', engine: 'googleCloud' },
        { name: 'it-IT-Wavenet-A', id: 'it-IT-Wavenet-A', language: 'it-IT', engine: 'googleCloud' },
        { name: 'it-IT-Standard-A', id: 'it-IT-Standard-A', language: 'it-IT', engine: 'googleCloud' },
        { name: 'pt-BR-Wavenet-A', id: 'pt-BR-Wavenet-A', language: 'pt-BR', engine: 'googleCloud' },
        { name: 'pt-BR-Standard-A', id: 'pt-BR-Standard-A', language: 'pt-BR', engine: 'googleCloud' },
        { name: 'ja-JP-Wavenet-A', id: 'ja-JP-Wavenet-A', language: 'ja-JP', engine: 'googleCloud' },
        { name: 'ko-KR-Wavenet-A', id: 'ko-KR-Wavenet-A', language: 'ko-KR', engine: 'googleCloud' },
        { name: 'zh-CN-Wavenet-A', id: 'zh-CN-Wavenet-A', language: 'zh-CN', engine: 'googleCloud' },
    ],
    azureTTS: [
        { name: 'Jenny (US English)', id: 'en-US-JennyNeural', language: 'en-US', engine: 'azureTTS' },
        { name: 'Guy (US English)', id: 'en-US-GuyNeural', language: 'en-US', engine: 'azureTTS' },
        { name: 'Aria (US English)', id: 'en-US-AriaNeural', language: 'en-US', engine: 'azureTTS' },
        { name: 'Davis (US English)', id: 'en-US-DavisNeural', language: 'en-US', engine: 'azureTTS' },
        { name: 'Amber (British English)', id: 'en-GB-AmberNeural', language: 'en-GB', engine: 'azureTTS' },
        { name: 'Ryan (British English)', id: 'en-GB-RyanNeural', language: 'en-GB', engine: 'azureTTS' },
        { name: 'Elvira (Spanish)', id: 'es-ES-ElviraNeural', language: 'es-ES', engine: 'azureTTS' },
        { name: 'Alvaro (Spanish)', id: 'es-ES-AlvaroNeural', language: 'es-ES', engine: 'azureTTS' },
        { name: 'Denise (French)', id: 'fr-FR-DeniseNeural', language: 'fr-FR', engine: 'azureTTS' },
        { name: 'Henri (French)', id: 'fr-FR-HenriNeural', language: 'fr-FR', engine: 'azureTTS' },
        { name: 'Katja (German)', id: 'de-DE-KatjaNeural', language: 'de-DE', engine: 'azureTTS' },
        { name: 'Conrad (German)', id: 'de-DE-ConradNeural', language: 'de-DE', engine: 'azureTTS' },
        { name: 'Isabella (Italian)', id: 'it-IT-IsabellaNeural', language: 'it-IT', engine: 'azureTTS' },
        { name: 'Diego (Italian)', id: 'it-IT-DiegoNeural', language: 'it-IT', engine: 'azureTTS' },
        { name: 'Francisca (Portuguese)', id: 'pt-BR-FranciscaNeural', language: 'pt-BR', engine: 'azureTTS' },
        { name: 'Antonio (Portuguese)', id: 'pt-BR-AntonioNeural', language: 'pt-BR', engine: 'azureTTS' },
        { name: 'Xiaoxiao (Chinese)', id: 'zh-CN-XiaoxiaoNeural', language: 'zh-CN', engine: 'azureTTS' },
        { name: 'Yunyang (Chinese)', id: 'zh-CN-YunyangNeural', language: 'zh-CN', engine: 'azureTTS' },
        { name: 'Sakura (Japanese)', id: 'ja-JP-SakuraNeural', language: 'ja-JP', engine: 'azureTTS' },
        { name: 'Keita (Japanese)', id: 'ja-JP-KeitaNeural', language: 'ja-JP', engine: 'azureTTS' },
    ],
    ibmWatson: [
        { name: 'Allison (US English)', id: 'en-US_AllisonV3Voice', language: 'en-US', engine: 'ibmWatson' },
        { name: 'Michael (US English)', id: 'en-US_MichaelV3Voice', language: 'en-US', engine: 'ibmWatson' },
        { name: 'Emily (British English)', id: 'en-GB_EmilyV3Voice', language: 'en-GB', engine: 'ibmWatson' },
        { name: 'Laura (Spanish)', id: 'es-ES_LauraV3Voice', language: 'es-ES', engine: 'ibmWatson' },
        { name: 'Enrique (Spanish)', id: 'es-ES_EnriqueV3Voice', language: 'es-ES', engine: 'ibmWatson' },
        { name: 'Renee (French)', id: 'fr-FR_ReneeV3Voice', language: 'fr-FR', engine: 'ibmWatson' },
        { name: 'Birgit (German)', id: 'de-DE_BirgitV3Voice', language: 'de-DE', engine: 'ibmWatson' },
        { name: 'Dieter (German)', id: 'de-DE_DieterV3Voice', language: 'de-DE', engine: 'ibmWatson' },
        { name: 'Francesca (Italian)', id: 'it-IT_FrancescaV3Voice', language: 'it-IT', engine: 'ibmWatson' },
        { name: 'Isabela (Portuguese)', id: 'pt-BR_IsabelaV3Voice', language: 'pt-BR', engine: 'ibmWatson' },
        { name: 'Sofia (Portuguese)', id: 'pt-BR_SofiaV3Voice', language: 'pt-BR', engine: 'ibmWatson' },
        { name: 'Omar (Arabic)', id: 'ar-MS_OmarVoice', language: 'ar-MS', engine: 'ibmWatson' },
        { name: 'Wenwen (Chinese)', id: 'zh-CN_WenwenVoice', language: 'zh-CN', engine: 'ibmWatson' },
    ],
});



/**
 * Get the default voices for all TTS engines
 * @returns {Object} Object containing voice lists for all supported engines
 */
export const getDefaultVoices = () => {
    return defaultVoiceList();
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
    sections: [{
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
    fileHistory: [],
    templates: {
        yogaKriya: yogaKriyaTemplate,
    },
    settings: {
        speechEngine: 'gtts', // Default engine set to 'gtts'
        selectedVoices: {}, // Object to store selected voices per engine // this might not be in use.
        defaultVoices: getDefaultVoices(),
        customVoices: {}, // Object to store custom voices per engine
        activeVoices: {
            gtts: 
            [
                getDefaultVoices().gtts[0], // Initializes with "American English (en) - gtts"
                getDefaultVoices().gtts[1], 
                getDefaultVoices().gtts[2]
            ], 
        },
        defaultVoice: { 
            engine: 'gtts', 
            voiceId: getDefaultVoices().gtts[0].id // e.g., 'us'
        },
        elevenLabsApiKeys: [], // Array of API keys
        awsPollyCredentials: [], // Array of { accessKey, secretKey }
        googleCloudCredentials: [], // Array of API keys
        azureTTSCredentials: [], // Array of API keys
        ibmWatsonCredentials: [], // Array of API keys
        anthropicApiKey: '',
        openaiApiKey: '',
        mode: 'demo', // 'demo' or 'production'
    },
    AudioLibrary: {},
    storageConfig: {
        type: 'local', // Options: 'local', 'remote', 'service'
        serverUrl: 'http://localhost:5000', // Used for local or remote
        serviceType: null // e.g., 's3', 'googleCloud' when type is 'service'
    }
    
};

/**
 * Initial session state for the TTS application
 * Contains temporary state for the current working session
 * @type {Object}
 */
export const initialSessionState = {
    inputText: '',
    inputType: 'text', // 'text' or 'audio'
    currentTemplate: 'general',
    sections: [],
    activeTab: 'main', // 'main', 'tools', or 'settings'
    isProcessing: false,
    errorMessage: null,
    notification: null,
    mergedAudio: null,
    isPlaying: false,
    selectedAudioLibraryId: null,
    generatedTTSAudios: {},
    selectedInputVoice: null, // Add this field
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
};