import { getDefaultVoices, yogaKriyaTemplate, initialPersistentState, initialSessionState } from '../ttsDefaults';

// Mock logUtils to prevent side effects (consistent with ttsReducer.test.ts)
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

describe('ttsDefaults', () => {
  // Test 1: getDefaultVoices returns correct voice lists
  test('getDefaultVoices returns correct voice lists for all engines', () => {
    const voices = getDefaultVoices();

    // Check gtts voices
    expect(voices.gtts).toBeDefined();
    expect(voices.gtts).toHaveLength(13); // 13 voices in gtts
    expect(voices.gtts[0]).toEqual({
      name: 'American English',
      id: 'en-com',
      language: 'en',
      tld: 'com',
      engine: 'gtts',
    });

    // Check elevenLabs voices
    expect(voices.elevenLabs).toBeDefined();
    expect(voices.elevenLabs).toHaveLength(19); // 19 voices in elevenLabs
    expect(voices.elevenLabs[0]).toEqual({
      name: 'Rachel',
      id: '21m00Tcm4TlvDq8ikWAM',
      language: 'en',
      engine: 'elevenLabs',
    });

    // Check awsPolly voices
    expect(voices.awsPolly).toBeDefined();
    expect(voices.awsPolly).toHaveLength(21); // 21 voices in awsPolly
    expect(voices.awsPolly[0]).toEqual({
      name: 'Joanna (US English)',
      id: 'Joanna',
      language: 'en-US',
      engine: 'awsPolly',
    });

    // Check googleCloud voices
    expect(voices.googleCloud).toBeDefined();
    expect(voices.googleCloud).toHaveLength(17); // 17 voices in googleCloud
    expect(voices.googleCloud[0]).toEqual({
      name: 'en-US-Wavenet-A',
      id: 'en-US-Wavenet-A',
      language: 'en-US',
      engine: 'googleCloud',
    });

    // Check azureTTS voices
    expect(voices.azureTTS).toBeDefined();
    expect(voices.azureTTS).toHaveLength(20); // 20 voices in azureTTS
    expect(voices.azureTTS[0]).toEqual({
      name: 'Jenny (US English)',
      id: 'en-US-JennyNeural',
      language: 'en-US',
      engine: 'azureTTS',
    });

    // Check ibmWatson voices
    expect(voices.ibmWatson).toBeDefined();
    expect(voices.ibmWatson).toHaveLength(13); // 13 voices in ibmWatson
    expect(voices.ibmWatson[0]).toEqual({
      name: 'Allison (US English)',
      id: 'en-US_AllisonV3Voice',
      language: 'en-US',
      engine: 'ibmWatson',
    });
  });

  // Test 2: yogaKriyaTemplate has correct structure
  test('yogaKriyaTemplate has correct structure and sections', () => {
    expect(yogaKriyaTemplate).toEqual({
      id: 'yogaKriya',
      name: 'Yoga Kriya',
      description: 'Pre-defined sections for Yoga practice with Tuning In, Warm-Up, Kriya Sequence, Relaxation, Meditation, and Closing sections.',
      sections: expect.arrayContaining([
        expect.objectContaining({
          id: 'section-tuning',
          title: 'Tuning In (Intro)',
          type: 'audio-only',
          text: '',
          voice: null,
        }),
        expect.objectContaining({
          id: 'section-warmup',
          title: 'Warm-Up',
          type: 'text-to-speech',
          text: '',
          voice: null,
        }),
        expect.objectContaining({
          id: 'section-kriya',
          title: 'Kriya Sequence',
          type: 'text-to-speech',
          text: '',
          voice: null,
        }),
        expect.objectContaining({
          id: 'section-relaxation',
          title: 'Relaxation',
          type: 'text-to-speech',
          text: '',
          voice: null,
        }),
        expect.objectContaining({
          id: 'section-meditation',
          title: 'Meditation',
          type: 'text-to-speech',
          text: '',
          voice: null,
        }),
        expect.objectContaining({
          id: 'section-closing',
          title: 'Closing',
          type: 'audio-only',
          text: '',
          voice: null,
        }),
      ]),
    });
    expect(yogaKriyaTemplate.sections).toHaveLength(6); // 6 sections
  });

  // Test 3: initialPersistentState has correct default values
  test('initialPersistentState has correct default values', () => {
    expect(initialPersistentState).toEqual({
      theme: 'glitch',
      fileHistory: [],
      templates: {
        yogaKriya: expect.objectContaining({
          id: 'yogaKriya',
          name: 'Yoga Kriya',
          sections: expect.arrayContaining([expect.any(Object)]),
        }),
      },
      settings: {
        speechEngine: 'gtts',
        selectedVoices: {},
        defaultVoices: expect.objectContaining({
          gtts: expect.arrayContaining([expect.any(Object)]),
          elevenLabs: expect.arrayContaining([expect.any(Object)]),
          awsPolly: expect.arrayContaining([expect.any(Object)]),
          googleCloud: expect.arrayContaining([expect.any(Object)]),
          azureTTS: expect.arrayContaining([expect.any(Object)]),
          ibmWatson: expect.arrayContaining([expect.any(Object)]),
        }),
        customVoices: {},
        activeVoices: {
          gtts: expect.arrayContaining([
            expect.objectContaining({ id: 'en-com', name: 'American English' }),
            expect.objectContaining({ id: 'en-com.au', name: 'Australian English' }),
            expect.objectContaining({ id: 'en-co.uk', name: 'British English' }),
          ]),
        },
        defaultVoice: { engine: 'gtts', voiceId: 'en-com' },
        elevenLabsApiKeys: [],
        awsPollyCredentials: [],
        googleCloudCredentials: [],
        azureTTSCredentials: [],
        ibmWatsonCredentials: [],
        anthropicApiKey: '',
        openaiApiKey: '',
        mode: 'demo',
      },
      AudioLibrary: {},
      storageConfig: {
        type: 'local',
        serverUrl: 'http://localhost:5000',
        serviceType: null,
      },
    });
    expect(initialPersistentState.settings.activeVoices.gtts).toHaveLength(3); // 3 gtts voices
  });

  // Test 4: initialSessionState has correct default values
  test('initialSessionState has correct default values', () => {
    expect(initialSessionState).toEqual({
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
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: 'Section 1',
            type: 'text-to-speech',
            text: '',
            voice: null,
            voiceSettings: { pitch: 1, rate: 1, volume: 1 },
          }),
        ]),
        editingTemplate: null,
      },
    });
    expect(initialSessionState.templateCreation.sections).toHaveLength(1); // 1 section
  });
});