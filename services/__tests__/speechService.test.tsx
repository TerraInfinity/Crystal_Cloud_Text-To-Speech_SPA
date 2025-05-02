import SpeechService from '../speechService';

// Mock the global fetch function
global.fetch = jest.fn();
// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

// Mock console.log to suppress development logs
const originalConsoleLog = console.log;
console.log = jest.fn();

describe('SpeechService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default successful response for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        audioUrl: 'https://example.com/audio.mp3',
        duration: 10,
        sampleRate: 44100
      })
    });
  });

  afterAll(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
  });

  describe('normalizeAudioResponse', () => {
    it('should normalize response with audioUrl', () => {
      const data = {
        audioUrl: 'https://example.com/audio.mp3',
        duration: 10,
        sampleRate: 44100
      };
      
      const result = SpeechService.normalizeAudioResponse(data);
      
      expect(result).toEqual({
        url: 'https://example.com/audio.mp3',
        duration: 10,
        sampleRate: 44100
      });
    });

    it('should normalize response with audioBase64', () => {
      const data = {
        audioBase64: 'base64data',
        duration: 5,
        sampleRate: 22050
      };
      
      const result = SpeechService.normalizeAudioResponse(data);
      
      expect(result).toEqual({
        url: 'data:audio/wav;base64,base64data',
        duration: 5,
        sampleRate: 22050
      });
    });

    it('should throw error for invalid data', () => {
      const data = { invalid: 'data' };
      
      expect(() => SpeechService.normalizeAudioResponse(data)).toThrow('Invalid audio response format');
    });
  });

  describe('gTTSTTS', () => {
    it('should convert text to speech using gTTS', async () => {
      const text = 'Hello world';
      const options = {
        voice: { id: 'en-com', engine: 'gtts' },
        activeVoices: [{ id: 'en-com', engine: 'gtts' }]
      };
      
      const result = await SpeechService.gTTSTTS(text, options);
      
      expect(fetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'us',
        })
      });
      
      expect(result).toEqual({
        url: 'https://example.com/audio.mp3',
        duration: 10,
        sampleRate: 44100
      });
    });

    it('should handle error from gTTS API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          message: 'gTTS error message'
        })
      });
      
      await expect(SpeechService.gTTSTTS('error text')).rejects.toThrow('gTTS failed: gTTS error message');
    });
  });

  describe('elevenLabsTTS', () => {
    it('should throw error if API key is missing', async () => {
      await expect(SpeechService.elevenLabsTTS('test')).rejects.toThrow('ElevenLabs API key is required');
    });

    it('should convert text to speech using ElevenLabs', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer)
      });
      
      const text = 'Hello world';
      const options = {
        apiKey: 'test-api-key',
        voice: { id: 'test-voice-id', engine: 'elevenlabs' },
        activeVoices: [{ id: 'test-voice-id', engine: 'elevenlabs' }],
        stability: 0.5,
        similarity_boost: 0.8
      };
      
      const result = await SpeechService.elevenLabsTTS(text, options);
      
      expect(fetch).toHaveBeenCalledWith(`https://api.elevenlabs.io/v1/text-to-speech/test-voice-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': 'test-api-key',
        },
        body: expect.any(String)
      });
      
      expect(result).toEqual({
        url: 'blob:mock-url',
        duration: 0,
        sampleRate: 44100
      });
    });
  });

  describe('awsPollyTTS', () => {
    it('should throw error if AWS credentials are missing', async () => {
      await expect(SpeechService.awsPollyTTS('test')).rejects.toThrow('AWS credentials are required');
    });

    it('should convert text to speech using AWS Polly', async () => {
      const text = 'Hello world';
      const options = {
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        voice: { id: 'Joanna', engine: 'awspolly' },
        activeVoices: [{ id: 'Joanna', engine: 'awspolly' }],
        language: 'en-US',
        outputFormat: 'mp3'
      };
      
      const result = await SpeechService.awsPollyTTS(text, options);
      
      expect(fetch).toHaveBeenCalledWith('/api/textToSpeech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-aws-access-key': 'test-access-key',
          'x-aws-secret-key': 'test-secret-key',
        },
        body: JSON.stringify({
          text,
          engine: 'awspolly',
          voice: 'Joanna',
          language: 'en-US',
          outputFormat: 'mp3',
        })
      });
      
      expect(result).toEqual({
        url: 'https://example.com/audio.mp3',
        duration: 10,
        sampleRate: 44100
      });
    });
  });

  describe('getAvailableVoices', () => {
    it('should return activeVoices for the engine if provided', async () => {
      const activeVoices = [
        { id: 'voice1', engine: 'gtts', name: 'Voice 1' },
        { id: 'voice2', engine: 'elevenlabs', name: 'Voice 2' }
      ];
      
      const result = await SpeechService.getAvailableVoices('gtts', { activeVoices });
      
      expect(result).toEqual([activeVoices[0]]);
    });

    it('should fetch gTTS voices if activeVoices are not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          voices: [
            { id: 'us', name: 'American English', language: 'en', tld: 'com', engine: 'gtts' }
          ]
        })
      });
      
      const result = await SpeechService.getAvailableVoices('gtts');
      
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/gtts/voices');
      expect(result).toEqual([
        { id: 'us', name: 'American English', language: 'en', tld: 'com', engine: 'gtts' }
      ]);
    });

    it('should fall back to static list for gTTS if fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await SpeechService.getAvailableVoices('gtts');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].engine).toBe('gtts');
    });

    it('should return static list for awspolly', async () => {
      const result = await SpeechService.getAvailableVoices('awspolly');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].engine).toBe('awspolly');
    });
  });

  describe('convert_text_to_speech_and_upload', () => {
    it('should throw error for unsupported engine', async () => {
      await expect(SpeechService.convert_text_to_speech_and_upload('test', 'unsupported')).rejects.toThrow('Unsupported engine');
    });

    it('should call the appropriate method for each engine', async () => {
      // Spy on each TTS method
      const gTTSspy = jest.spyOn(SpeechService, 'gTTSTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const elevenLabsSpy = jest.spyOn(SpeechService, 'elevenLabsTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const awsPollySppy = jest.spyOn(SpeechService, 'awsPollyTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const googleCloudSpy = jest.spyOn(SpeechService, 'googleCloudTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const azureSpy = jest.spyOn(SpeechService, 'azureTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const ibmWatsonSpy = jest.spyOn(SpeechService, 'ibmWatsonTTS').mockResolvedValue({
        url: 'mock-url',
        duration: 5,
        sampleRate: 44100
      });
      
      // Test each engine
      await SpeechService.convert_text_to_speech_and_upload('test', 'gtts', {});
      expect(gTTSspy).toHaveBeenCalled();
      
      await SpeechService.convert_text_to_speech_and_upload('test', 'elevenlabs', {});
      expect(elevenLabsSpy).toHaveBeenCalled();
      
      await SpeechService.convert_text_to_speech_and_upload('test', 'awspolly', {});
      expect(awsPollySppy).toHaveBeenCalled();
      
      await SpeechService.convert_text_to_speech_and_upload('test', 'googlecloud', {});
      expect(googleCloudSpy).toHaveBeenCalled();
      
      await SpeechService.convert_text_to_speech_and_upload('test', 'azuretts', {});
      expect(azureSpy).toHaveBeenCalled();
      
      await SpeechService.convert_text_to_speech_and_upload('test', 'ibmwatson', {});
      expect(ibmWatsonSpy).toHaveBeenCalled();
    });
  });

  describe('generate_audio_segments', () => {
    it('should generate segments from a mixed script', async () => {
      // Spy on convert_text_to_speech_and_upload
      jest.spyOn(SpeechService, 'convert_text_to_speech_and_upload').mockResolvedValue({
        url: 'mock-audio-url',
        duration: 5,
        sampleRate: 44100
      });
      
      const script = [
        { type: 'speech', text: 'Hello', engine: 'gtts', options: {} },
        { type: 'pause', duration: 2 },
        { type: 'sound', url: 'sound-effect.mp3', duration: 3 }
      ];
      
      const result = await SpeechService.generate_audio_segments(script);
      
      expect(result).toEqual([
        { type: 'audio', url: 'mock-audio-url', duration: 5 },
        { type: 'pause', duration: 2 },
        { type: 'audio', url: 'sound-effect.mp3', duration: 3 }
      ]);
    });

    it('should throw error for unsupported script item type', async () => {
      const script = [
        { type: 'unsupported', text: 'Invalid' }
      ];
      
      await expect(SpeechService.generate_audio_segments(script)).rejects.toThrow('Unsupported script item type');
    });
  });

  describe('Other TTS methods', () => {
    it('should define googleCloudTTS method', () => {
      expect(typeof SpeechService.googleCloudTTS).toBe('function');
    });

    it('should define azureTTS method', () => {
      expect(typeof SpeechService.azureTTS).toBe('function');
    });

    it('should define ibmWatsonTTS method', () => {
      expect(typeof SpeechService.ibmWatsonTTS).toBe('function');
    });
  });
});
