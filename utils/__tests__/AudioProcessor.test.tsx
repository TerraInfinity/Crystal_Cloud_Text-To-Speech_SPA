// utils/__tests__/AudioProcessor.test.tsx

import speechServiceAPI from '../../services/api/speechEngineAPIs/speechServiceAPI';
import * as AudioProcessor from '../AudioProcessor';


// Mock the AudioProcessor module to control devLog behavior
jest.mock('../AudioProcessor', () => {
  // Store the original module
  const originalModule = jest.requireActual('../AudioProcessor');
  
  // Create a mockable devLog function
  const mockDevLog = jest.fn();
  
  // Return a modified module with our mockable version of devLog
  return {
    ...originalModule,
    devLog: mockDevLog,
  };
});

// Mock speechServiceAPI
jest.mock('../../services/api/speechEngineAPIs/speechServiceAPI', () => ({
  convert_text_to_speech_and_upload: jest.fn(),
}));

// Mock fetch for mergeAllAudio
global.fetch = jest.fn();

// Access the mocked functions
const { generateAllAudio, mergeAllAudio, downloadAudio, getCredentials, devLog } = AudioProcessor;

describe('AudioProcessor', () => {
  // Mock dependencies and state
  const mockValidSections = [
    {
      id: 'section-1',
      title: 'Section 1',
      text: 'Hello world',
      voice: 'voice-1',
      language: 'en-US',
    },
    {
      id: 'section-2',
      title: 'Section 2',
      text: 'Test audio',
      voice: 'voice-2',
      language: 'en-US',
    },
  ];

  const mockPersistentState = {
    settings: {
      activeVoices: { provider: ['voice-1', 'voice-2'] },
      elevenLabsApiKeys: ['elevenlabs-key'],
      awsPollyCredentials: [{ accessKey: 'aws-access', secretKey: 'aws-secret' }],
      googleCloudCredentials: ['google-key'],
      azureTTSCredentials: ['azure-key'],
      ibmWatsonCredentials: ['ibm-key'],
    },
  };

  const mockGeneratedAudios = {
    'section-1': { url: 'http://localhost/audio1.mp3', duration: 5, sampleRate: 44100 },
    'section-2': { url: 'http://localhost/audio2.mp3', duration: 3, sampleRate: 44100 },
  };

  const mockSessionActions = {
    setError: jest.fn(),
    setProcessing: jest.fn(),
    setGeneratedAudio: jest.fn(),
    setMergedAudio: jest.fn(),
    setNotification: jest.fn(),
  };

  const mockSetIsGenerating = jest.fn();
  const mockSetIsAudioGenerated = jest.fn();
  const mockSetIsMerging = jest.fn();
  const mockSetIsAudioMerged = jest.fn();
  const mockSetIsDownloading = jest.fn();
  const mockSetIsAudioDownloaded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log and other console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Mock document.createElement for downloadAudio
    document.createElement = jest.fn().mockReturnValue({
      href: '',
      download: '',
      click: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateAllAudio', () => {
    test('handles empty valid sections', async () => {
      await generateAllAudio({
        validSections: [],
        speechEngine: 'googlecloud',
        persistentState: mockPersistentState,
        sessionActions: mockSessionActions,
        setIsGenerating: mockSetIsGenerating,
        setIsAudioGenerated: mockSetIsAudioGenerated,
      });

      expect(mockSessionActions.setError).toHaveBeenCalledWith('No valid text-to-speech sections with text');
      expect(mockSetIsGenerating).not.toHaveBeenCalled();
    });

    test('generates audio for all valid sections', async () => {
      (speechServiceAPI.convert_text_to_speech_and_upload as jest.Mock).mockResolvedValue({
        url: 'http://localhost/audio.mp3',
        duration: 5,
        sampleRate: 44100,
      });

      await generateAllAudio({
        validSections: mockValidSections,
        speechEngine: 'googlecloud',
        persistentState: mockPersistentState,
        sessionActions: mockSessionActions,
        setIsGenerating: mockSetIsGenerating,
        setIsAudioGenerated: mockSetIsAudioGenerated,
      });

      expect(mockSetIsGenerating).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(speechServiceAPI.convert_text_to_speech_and_upload).toHaveBeenCalledTimes(2);
      expect(mockSessionActions.setGeneratedAudio).toHaveBeenCalledTimes(2);
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'All audio generated successfully',
      });
      expect(mockSetIsAudioGenerated).toHaveBeenCalledWith(true);
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });

    test('handles failed sections', async () => {
      (speechServiceAPI.convert_text_to_speech_and_upload as jest.Mock)
        .mockResolvedValueOnce({ url: 'http://localhost/audio1.mp3', duration: 5, sampleRate: 44100 })
        .mockRejectedValueOnce(new Error('Speech synthesis failed'));

      await generateAllAudio({
        validSections: mockValidSections,
        speechEngine: 'googlecloud',
        persistentState: mockPersistentState,
        sessionActions: mockSessionActions,
        setIsGenerating: mockSetIsGenerating,
        setIsAudioGenerated: mockSetIsAudioGenerated,
      });

      expect(mockSessionActions.setError).toHaveBeenCalledWith('Failed to generate audio for sections: Section 2');
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });

    test('handles unexpected errors', async () => {
      (speechServiceAPI.convert_text_to_speech_and_upload as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      await generateAllAudio({
        validSections: mockValidSections,
        speechEngine: 'googlecloud',
        persistentState: mockPersistentState,
        sessionActions: mockSessionActions,
        setIsGenerating: mockSetIsGenerating,
        setIsAudioGenerated: mockSetIsAudioGenerated,
      });

      expect(mockSessionActions.setError).toHaveBeenCalledWith('Failed to generate audio for sections: Section 1, Section 2');
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  describe('mergeAllAudio', () => {
    test('handles missing audio for sections', async () => {
      await mergeAllAudio({
        validSections: mockValidSections,
        generatedAudios: {},
        sessionActions: mockSessionActions,
        setIsMerging: mockSetIsMerging,
        setIsAudioMerged: mockSetIsAudioMerged,
      });

      expect(mockSessionActions.setError).toHaveBeenCalledWith('Not all valid sections have audio');
      expect(mockSetIsMerging).not.toHaveBeenCalled();
    });

    test('merges audio successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ mergedAudioUrl: 'http://localhost/merged.mp3' }),
      });

      await mergeAllAudio({
        validSections: mockValidSections,
        generatedAudios: mockGeneratedAudios,
        sessionActions: mockSessionActions,
        setIsMerging: mockSetIsMerging,
        setIsAudioMerged: mockSetIsAudioMerged,
      });

      expect(mockSetIsMerging).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/mergeAudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrls: ['http://localhost/audio1.mp3', 'http://localhost/audio2.mp3'],
        }),
      });
      expect(mockSessionActions.setMergedAudio).toHaveBeenCalledWith('http://localhost/merged.mp3');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Audio merged successfully',
      });
      expect(mockSetIsAudioMerged).toHaveBeenCalledWith(true);
      expect(mockSetIsMerging).toHaveBeenCalledWith(false);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });

    test('handles merge failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ message: 'Merge failed' }),
      });

      await mergeAllAudio({
        validSections: mockValidSections,
        generatedAudios: mockGeneratedAudios,
        sessionActions: mockSessionActions,
        setIsMerging: mockSetIsMerging,
        setIsAudioMerged: mockSetIsAudioMerged,
      });

      expect(mockSessionActions.setError).toHaveBeenCalledWith('Merging failed: Merge failed');
      expect(mockSetIsMerging).toHaveBeenCalledWith(false);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  describe('downloadAudio', () => {
    test('does nothing if no merged audio', () => {
      downloadAudio({
        mergedAudio: null,
        setIsDownloading: mockSetIsDownloading,
        setIsAudioDownloaded: mockSetIsAudioDownloaded,
      });

      expect(mockSetIsDownloading).not.toHaveBeenCalled();
      expect(document.createElement).not.toHaveBeenCalled();
    });

    test('triggers download for merged audio', () => {
      jest.useFakeTimers();
      downloadAudio({
        mergedAudio: 'http://localhost/merged.mp3',
        setIsDownloading: mockSetIsDownloading,
        setIsAudioDownloaded: mockSetIsAudioDownloaded,
      });

      expect(mockSetIsDownloading).toHaveBeenCalledWith(true);
      expect(document.createElement).toHaveBeenCalledWith('a');
      const link = document.createElement('a');
      expect(link.href).toBe('http://localhost/merged.mp3');
      expect(link.download).toBe('tts-audio.wav');
      expect(link.click).toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(mockSetIsDownloading).toHaveBeenCalledWith(false);
      expect(mockSetIsAudioDownloaded).toHaveBeenCalledWith(true);

      jest.useRealTimers();
    });
  });

  describe('getCredentials', () => {
    test('returns ElevenLabs credentials', () => {
      const credentials = getCredentials('elevenlabs', mockPersistentState);
      expect(credentials).toEqual({ apiKey: 'elevenlabs-key' });
    });

    test('returns AWS Polly credentials', () => {
      const credentials = getCredentials('awspolly', mockPersistentState);
      expect(credentials).toEqual({ accessKey: 'aws-access', secretKey: 'aws-secret' });
    });

    test('returns Google Cloud credentials', () => {
      const credentials = getCredentials('googlecloud', mockPersistentState);
      expect(credentials).toEqual({ apiKey: 'google-key' });
    });

    test('returns Azure TTS credentials', () => {
      const credentials = getCredentials('azuretts', mockPersistentState);
      expect(credentials).toEqual({ apiKey: 'azure-key' });
    });

    test('returns IBM Watson credentials', () => {
      const credentials = getCredentials('ibmwatson', mockPersistentState);
      expect(credentials).toEqual({ apiKey: 'ibm-key' });
    });

    test('returns empty object for gTTS or unknown engine', () => {
      expect(getCredentials('gtts', mockPersistentState)).toEqual({});
      expect(getCredentials('unknown', mockPersistentState)).toEqual({});
    });
  });

  describe('devLog', () => {
    test('logs in development environment', () => {
      // Make devLog pass through to console.log
      (devLog as jest.Mock).mockImplementation((...args) => {
        console.log('[AudioProcessor]', ...args);
      });
      
      devLog('Test message', { data: 'test' });
      expect(console.log).toHaveBeenCalledWith('[AudioProcessor]', 'Test message', { data: 'test' });
    });

    test('does not log in production environment', () => {
      // Make devLog do nothing (simulating production environment)
      (devLog as jest.Mock).mockImplementation(() => {});
      
      devLog('Test message', { data: 'test' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});