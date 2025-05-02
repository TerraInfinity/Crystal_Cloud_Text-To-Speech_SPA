import { createMocks } from 'node-mocks-http';
import handler from '../processUrl';
import { parseTextFromHtml } from '../../../utils/textUtils';

// Mock dependencies
jest.mock('../../../utils/textUtils', () => ({
  parseTextFromHtml: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('processUrl API Handler', () => {
  let req, res;

  beforeEach(() => {
    // Create mock request and response objects
    ({ req, res } = createMocks({
      method: 'POST',
      body: {},
    }));

    jest.clearAllMocks();
    // Setup default mocks
    (global.fetch as jest.Mock).mockReset();
    (parseTextFromHtml as jest.Mock).mockReset();
  });

  describe('handler', () => {
    test('returns 405 for non-POST methods', async () => {
      req.method = 'GET';

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(res._getJSONData()).toEqual({ message: 'Method not allowed' });
    });

    test('returns 400 if URL is missing', async () => {
      req.body = {};

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual({ message: 'URL is required' });
    });

    test('processes HTML content successfully', async () => {
      req.body = { url: 'https://example.com' };
      const mockHtml = '<html><body>Hello World</body></html>';
      const mockText = 'Hello World';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValue(mockHtml),
      });
      (parseTextFromHtml as jest.Mock).mockReturnValue(mockText);

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com');
      expect(parseTextFromHtml).toHaveBeenCalledWith(mockHtml);
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ text: mockText });
    });

    test('processes plain text content successfully', async () => {
      req.body = { url: 'https://example.com/plain.txt' };
      const mockText = 'Plain text content';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue(mockText),
      });

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/plain.txt');
      expect(parseTextFromHtml).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ text: mockText });
    });

    test('returns 500 on fetch failure', async () => {
      req.body = { url: 'https://example.com' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com');
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing URL: Failed to fetch URL: Not Found' });
    });

    test('returns 500 for unsupported content type', async () => {
      req.body = { url: 'https://example.com/image.png' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        text: jest.fn().mockResolvedValue(''),
      });

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.png');
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing URL: Unsupported content type: image/png' });
    });

    test('returns 500 on parseTextFromHtml error', async () => {
      req.body = { url: 'https://example.com' };
      const mockHtml = '<html><body>Hello World</body></html>';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValue(mockHtml),
      });
      (parseTextFromHtml as jest.Mock).mockImplementation(() => {
        throw new Error('Parsing error');
      });

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com');
      expect(parseTextFromHtml).toHaveBeenCalledWith(mockHtml);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing URL: Parsing error' });
    });

    test('handles network error during fetch', async () => {
      req.body = { url: 'https://example.com' };
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com');
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ message: 'Error processing URL: Network error' });
    });
  });
});