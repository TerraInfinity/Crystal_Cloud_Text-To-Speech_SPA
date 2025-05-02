import { ttsReducer } from '../ttsReducer';
import { initialPersistentState } from '../ttsDefaults';

// Mock logUtils to prevent side effects
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Mock storage to prevent side effects in RESET_STATE (loads from __mocks__/storage.ts)
jest.mock('../storage');

// Import the mocked removeFromStorage
import { removeFromStorage } from '../storage';

// Cast mock to jest.Mock to avoid TypeScript errors
const mockedRemoveFromStorage = removeFromStorage as jest.Mock<Promise<void>>;

// Define accurate state type for TypeScript, matching ttsDefaults.ts
interface State {
  theme: string;
  fileHistory: any[];
  templates: {
    yogaKriya: {
      id: string;
      name: string;
      description: string;
      sections: {
        id: string;
        title: string;
        type: string;
        text: string;
        voice: any;
      }[];
    };
  };
  settings: {
    speechEngine: string;
    customVoices: { [key: string]: { id: string; name: string }[] };
    selectedVoices: { [key: string]: string };
    defaultVoices: {
      gtts: { name: string; id: string; language: string; tld: string; engine: string }[];
      elevenLabs: { name: string; id: string; language: string; engine: string }[];
      awsPolly: { name: string; id: string; language: string; engine: string }[];
      googleCloud: { name: string; id: string; language: string; engine: string }[];
      azureTTS: { name: string; id: string; language: string; engine: string }[];
      ibmWatson: { name: string; id: string; language: string; engine: string }[];
    };
    activeVoices: {
      gtts: { name: string; id: string; language: string; tld: string; engine: string }[];
      [key: string]: { name: string; id: string; language: string; tld?: string; engine: string }[];
    };
    defaultVoice: { engine: string; voiceId: string };
    elevenLabsApiKeys: string[];
    awsPollyCredentials: { accessKey: string; secretKey: string }[];
    googleCloudCredentials: string[];
    azureTTSCredentials: string[];
    ibmWatsonCredentials: string[];
    anthropicApiKey: string;
    openaiApiKey: string;
    mode: 'demo' | 'production';
  };
  AudioLibrary: Record<string, any>;
  storageConfig: {
    type: string;
    serverUrl: string;
    serviceType: string | null;
  };
}

interface Action {
  type: string;
  payload?: any;
}

describe('ttsReducer', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Unknown action returns initial state
  test('returns initial state when action type is unknown', () => {
    const action: Action = { type: 'SOMETHING_UNKNOWN' };
    const result: State = ttsReducer(undefined, action);
    expect(result).toEqual(initialPersistentState);
  });

  // Test 2: SET_THEME updates the theme
  test('handles SET_THEME by updating theme', () => {
    const action: Action = { type: 'SET_THEME', payload: 'dark' };
    const result: State = ttsReducer(initialPersistentState, action);
    expect(result.theme).toBe('dark');
    expect(result.settings).toEqual(initialPersistentState.settings);
  });

  // Test 3: SET_SPEECH_ENGINE updates speechEngine
  test('handles SET_SPEECH_ENGINE by updating speechEngine', () => {
    const action: Action = { type: 'SET_SPEECH_ENGINE', payload: 'awsPolly' };
    const result: State = ttsReducer(initialPersistentState, action);
    expect(result.settings.speechEngine).toBe('awsPolly');
    expect(result.settings.customVoices).toEqual(initialPersistentState.settings.customVoices);
  });

  // Test 4: ADD_CUSTOM_VOICE adds a voice
  test('handles ADD_CUSTOM_VOICE by adding a voice', () => {
    const action: Action = {
      type: 'ADD_CUSTOM_VOICE',
      payload: { engine: 'gtts', voice: { id: 'test-voice', name: 'Test Voice' } },
    };
    const result: State = ttsReducer(initialPersistentState, action);
    expect(result.settings.customVoices['gtts']).toEqual([
      { id: 'test-voice', name: 'Test Voice' },
    ]);
  });

  // Test 5: RESET_STATE resets to initial state
  test('handles RESET_STATE by resetting to initial state', () => {
    mockedRemoveFromStorage.mockResolvedValue(undefined);
    const modifiedState: State = {
      ...initialPersistentState,
      theme: 'dark',
      settings: {
        ...initialPersistentState.settings,
        speechEngine: 'awsPolly',
        mode: initialPersistentState.settings.mode as 'demo' | 'production', // Explicit type assertion
      },
    };
    const action: Action = { type: 'RESET_STATE' };
    const result: State = ttsReducer(modifiedState, action);
    expect(result).toEqual(initialPersistentState);
    expect(mockedRemoveFromStorage).toHaveBeenCalledWith('tts_persistent_state', 'localStorage');
  });
});