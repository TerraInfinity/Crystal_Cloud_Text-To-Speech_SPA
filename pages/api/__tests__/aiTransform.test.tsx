// pages/api/__tests__/aiTransform.test.ts

import handler from '../aiTransform';
import { createMocks } from 'node-mocks-http';

// Mock fetch
global.fetch = jest.fn();

describe('aiTransform API Handler', () => {
  let req, res;

  beforeEach(() => {
    // Create mock request and response objects
    ({ req, res } = createMocks({
      method: 'POST',
      headers: {},
      body: {},
    }));

    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('returns 405 for non-POST methods', async () => {
    req.method = 'GET';

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res._getJSONData()).toEqual({ message: 'Method not allowed' });
  });

  test('returns 400 if text is missing', async () => {
    req.body = { prompt: 'Transform text', provider: 'openai' };

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Text is required' });
  });

  test('returns 400 if prompt is missing', async () => {
    req.body = { text: 'Hello world', provider: 'openai' };

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Prompt is required' });
  });

  describe('OpenAI Provider', () => {
    test('returns 400 if OpenAI API key is missing', async () => {
      req.body = { text: 'Hello world', prompt: 'Transform text', provider: 'openai' };

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual({ message: 'OpenAI API key is required' });
    });

    test('transforms text successfully with OpenAI', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'openai' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Summary: Hello world' } }],
        }),
      });

      await handler(req, res);

      expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-openai-key',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that processes text based on instructions.',
            },
            {
              role: 'user',
              content: 'Summarize\n\nText to process:\nHello world',
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ result: 'Summary: Hello world' });
    });

    test('handles OpenAI API error', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'openai' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: { message: 'API error' } }),
      });

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing with AI: API error' });
    });
  });

  describe('Anthropic Provider', () => {
    test('returns 400 if Anthropic API key is missing', async () => {
      req.body = { text: 'Hello world', prompt: 'Transform text', provider: 'anthropic' };

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual({ message: 'Anthropic API key is required' });
    });

    test('transforms text successfully with Anthropic', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'anthropic' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ text: 'Summary: Hello world' }],
        }),
      });

      await handler(req, res);

      expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-anthropic-key',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-2',
          messages: [
            {
              role: 'user',
              content: 'Summarize\n\nText to process:\nHello world',
            },
          ],
          max_tokens: 2000,
        }),
      });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ result: 'Summary: Hello world' });
    });

    test('handles Anthropic API error', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'anthropic' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: { message: 'API error' } }),
      });

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing with AI: API error' });
    });
  });

  test('returns 400 for unsupported provider', async () => {
    req.body = { text: 'Hello world', prompt: 'Transform text', provider: 'unknown' };

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Unsupported AI provider' });
  });

  test('supports API key via headers for OpenAI', async () => {
    req.headers['x-openai-api-key'] = 'header-openai-key';
    req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'openai' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Summary: Hello world' } }],
      }),
    });

    await handler(req, res);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer header-openai-key',
        }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ result: 'Summary: Hello world' });
  });

  test('supports API key via headers for Anthropic', async () => {
    req.headers['x-anthropic-api-key'] = 'header-anthropic-key';
    req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'anthropic' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{ text: 'Summary: Hello world' }],
      }),
    });

    await handler(req, res);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'header-anthropic-key',
        }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ result: 'Summary: Hello world' });
  });

  test('handles unexpected errors', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    req.body = { text: 'Hello world', prompt: 'Summarize', provider: 'openai' };
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ message: 'Error processing with AI: Network error' });
  });
});