import aiServiceAPI from '../api/tools/aiServiceAPI';

// Mock fetch globally
global.fetch = jest.fn();

describe('aiServiceAPI', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default successful response for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({})
    });
  });

  describe('transformWithOpenAI', () => {
    it('should throw an error if no API key is provided', async () => {
      await expect(aiServiceAPI.transformWithOpenAI('test text', 'test prompt', '')).rejects.toThrow('OpenAI API key is required');
    });

    it('should call OpenAI API with correct parameters', async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'transformed text' } }]
        })
      });

      const result = await aiServiceAPI.transformWithOpenAI('test text', 'test prompt', 'test-api-key');
      
      // Check fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        },
        body: expect.any(String)
      });
      
      // Verify the body contains expected data
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.model).toBe('gpt-3.5-turbo');
      expect(body.messages).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant that processes text based on instructions.'
        },
        {
          role: 'user',
          content: 'test prompt\n\nText to process:\ntest text'
        }
      ]);
      
      // Check result
      expect(result).toBe('transformed text');
    });

    it('should handle API errors properly', async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          error: { message: 'API error message' }
        })
      });

      await expect(aiServiceAPI.transformWithOpenAI('test text', 'test prompt', 'test-api-key'))
        .rejects.toThrow('API error message');
    });
  });

  describe('transformWithAnthropic', () => {
    it('should throw an error if no API key is provided', async () => {
      await expect(aiServiceAPI.transformWithAnthropic('test text', 'test prompt', '')).rejects.toThrow('Anthropic API key is required');
    });

    it('should call Anthropic API with correct parameters', async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ text: 'transformed by claude' }]
        })
      });

      const result = await aiServiceAPI.transformWithAnthropic('test text', 'test prompt', 'test-api-key');
      
      // Check fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01'
        },
        body: expect.any(String)
      });
      
      // Verify the body contains expected data
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.model).toBe('claude-2');
      expect(body.messages).toEqual([
        {
          role: 'user',
          content: 'test prompt\n\nText to process:\ntest text'
        }
      ]);
      
      // Check result
      expect(result).toBe('transformed by claude');
    });

    it('should handle API errors properly', async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          error: { message: 'Claude API error' }
        })
      });

      await expect(aiServiceAPI.transformWithAnthropic('test text', 'test prompt', 'test-api-key'))
        .rejects.toThrow('Claude API error');
    });
  });

  describe('extractSections', () => {
    it('should use the OpenAI provider when specified', async () => {
      // Spy on the transformWithOpenAI method
      const spy = jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('{"Section": "Content"}');
      
      const result = await aiServiceAPI.extractSections('test text', 'general', 'openai', { openaiApiKey: 'test-key' });
      
      expect(spy).toHaveBeenCalled();
      expect(result).toEqual({ Section: 'Content' });
    });

    it('should use the Anthropic provider when specified', async () => {
      // Spy on the transformWithAnthropic method
      const spy = jest.spyOn(aiServiceAPI, 'transformWithAnthropic').mockResolvedValue('{"Section": "Content"}');
      
      const result = await aiServiceAPI.extractSections('test text', 'general', 'anthropic', { anthropicApiKey: 'test-key' });
      
      expect(spy).toHaveBeenCalled();
      expect(result).toEqual({ Section: 'Content' });
    });

    it('should throw error for unsupported provider', async () => {
      await expect(aiServiceAPI.extractSections('test text', 'general', 'unsupported' as any, {}))
        .rejects.toThrow('Unsupported AI provider');
    });

    it('should use yoga-specific prompt for yoga preset', async () => {
      const spy = jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('{"Tuning In": "Content"}');
      
      await aiServiceAPI.extractSections('test text', 'yoga', 'openai', { openaiApiKey: 'test-key' });
      
      // Check that the yoga-specific prompt was used
      expect(spy.mock.calls[0][1]).toContain('Yoga Kriya practice');
      expect(spy.mock.calls[0][1]).toContain('Tuning In, Warm-Up, Kriya Sequence');
    });

    it('should handle JSON parsing errors', async () => {
      // Mock console.error to prevent test output pollution
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('Not valid JSON');
      
      const result = await aiServiceAPI.extractSections('test text', 'general', 'openai', { openaiApiKey: 'test-key' });
      
      expect(result).toEqual({ 'Extracted Text': 'Not valid JSON' });
    });

    it('should extract JSON from markdown code blocks', async () => {
      jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('```json\n{"Section": "Content"}\n```');
      
      const result = await aiServiceAPI.extractSections('test text', 'general', 'openai', { openaiApiKey: 'test-key' });
      
      expect(result).toEqual({ Section: 'Content' });
    });
  });

  describe('simplifyText', () => {
    it('should call the appropriate provider with correct prompt', async () => {
      const openAISpy = jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('simplified text');
      const anthropicSpy = jest.spyOn(aiServiceAPI, 'transformWithAnthropic').mockResolvedValue('simplified by claude');
      
      const openAIResult = await aiServiceAPI.simplifyText('test text', 'openai', { openaiApiKey: 'test-key' });
      const anthropicResult = await aiServiceAPI.simplifyText('test text', 'anthropic', { anthropicApiKey: 'test-key' });
      
      expect(openAISpy).toHaveBeenCalledWith('test text', expect.stringContaining('Simplify the following text'), 'test-key');
      expect(anthropicSpy).toHaveBeenCalledWith('test text', expect.stringContaining('Simplify the following text'), 'test-key');
      
      expect(openAIResult).toBe('simplified text');
      expect(anthropicResult).toBe('simplified by claude');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(aiServiceAPI.simplifyText('test text', 'unsupported' as any, {}))
        .rejects.toThrow('Unsupported AI provider');
    });
  });

  describe('formatForSpeech', () => {
    it('should call the appropriate provider with correct prompt', async () => {
      const openAISpy = jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('formatted text');
      const anthropicSpy = jest.spyOn(aiServiceAPI, 'transformWithAnthropic').mockResolvedValue('formatted by claude');
      
      const openAIResult = await aiServiceAPI.formatForSpeech('test text', 'openai', { openaiApiKey: 'test-key' });
      const anthropicResult = await aiServiceAPI.formatForSpeech('test text', 'anthropic', { anthropicApiKey: 'test-key' });
      
      expect(openAISpy).toHaveBeenCalledWith('test text', expect.stringContaining('Format the following text'), 'test-key');
      expect(anthropicSpy).toHaveBeenCalledWith('test text', expect.stringContaining('Format the following text'), 'test-key');
      
      expect(openAIResult).toBe('formatted text');
      expect(anthropicResult).toBe('formatted by claude');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(aiServiceAPI.formatForSpeech('test text', 'unsupported' as any, {}))
        .rejects.toThrow('Unsupported AI provider');
    });
  });

  describe('processWithCustomPrompt', () => {
    it('should call the appropriate provider with the custom prompt', async () => {
      const openAISpy = jest.spyOn(aiServiceAPI, 'transformWithOpenAI').mockResolvedValue('custom processed');
      const anthropicSpy = jest.spyOn(aiServiceAPI, 'transformWithAnthropic').mockResolvedValue('custom by claude');
      
      const openAIResult = await aiServiceAPI.processWithCustomPrompt('test text', 'custom prompt', 'openai', { openaiApiKey: 'test-key' });
      const anthropicResult = await aiServiceAPI.processWithCustomPrompt('test text', 'custom prompt', 'anthropic', { anthropicApiKey: 'test-key' });
      
      expect(openAISpy).toHaveBeenCalledWith('test text', 'custom prompt', 'test-key');
      expect(anthropicSpy).toHaveBeenCalledWith('test text', 'custom prompt', 'test-key');
      
      expect(openAIResult).toBe('custom processed');
      expect(anthropicResult).toBe('custom by claude');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(aiServiceAPI.processWithCustomPrompt('test text', 'custom prompt', 'unsupported' as any, {}))
        .rejects.toThrow('Unsupported AI provider');
    });
  });
});
