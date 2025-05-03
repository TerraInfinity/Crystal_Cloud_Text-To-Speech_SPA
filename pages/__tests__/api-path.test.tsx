// pages/__tests__/api-path.test.tsx

import { createMocks } from 'node-mocks-http';
import handler from '../api/[...path]';

// Mock the API route handlers
jest.mock('../../services/api/mergeAudioAPI', () => jest.fn());
jest.mock('../../services/api/speechEngineAPIs/awsPollyAPI', () => jest.fn());
jest.mock('../../services/api/tools/extractTextFromUrlAPI', () => jest.fn());
jest.mock('../../services/api/speechEngineAPIs/elevenLabsAPI', () => jest.fn());
jest.mock('../../services/api/speechEngineAPIs/speechServiceAPI', () => jest.fn());
jest.mock('../../services/api/tools/aiServiceAPI', () => jest.fn());
jest.mock('../../services/api/storageServiceAPI', () => jest.fn());
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
  devError: jest.fn()
}));

describe('API Catch-All Route Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 404 for undefined endpoint', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { path: [] }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'API route /api/ not found'
    });
  });

  test('returns 404 for invalid endpoint', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['nonExistentEndpoint'] }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'API route /api/nonExistentEndpoint not found'
    });
  });

  test('routes to mergeAudio handler', async () => {
    const mergeAudioHandler = require('../../services/api/mergeAudioAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['mergeAudio'] }
    });

    await handler(req, res);

    expect(mergeAudioHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to awsPolly handler', async () => {
    const awsPollyHandler = require('../../services/api/speechEngineAPIs/awsPollyAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['awsPolly'] }
    });

    await handler(req, res);

    expect(awsPollyHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to extractTextFromUrl handler', async () => {
    const extractTextHandler = require('../../services/api/tools/extractTextFromUrlAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['extractTextFromUrl'] }
    });

    await handler(req, res);

    expect(extractTextHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to elevenLabs handler', async () => {
    const elevenLabsHandler = require('../../services/api/speechEngineAPIs/elevenLabsAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['elevenLabs'] }
    });

    await handler(req, res);

    expect(elevenLabsHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to speechService handler', async () => {
    const speechServiceHandler = require('../../services/api/speechEngineAPIs/speechServiceAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['speechService'] }
    });

    await handler(req, res);

    expect(speechServiceHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to aiService handler', async () => {
    const aiServiceHandler = require('../../services/api/tools/aiServiceAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['aiService'] }
    });

    await handler(req, res);

    expect(aiServiceHandler).toHaveBeenCalledWith(req, res);
  });

  test('routes to storageService handler', async () => {
    const storageServiceHandler = require('../../services/api/storageServiceAPI');
    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['storageService'] }
    });

    await handler(req, res);

    expect(storageServiceHandler).toHaveBeenCalledWith(req, res);
  });

  test('handles errors from route handlers', async () => {
    const mergeAudioHandler = require('../../services/api/mergeAudioAPI');
    mergeAudioHandler.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    const { req, res } = createMocks({
      method: 'POST',
      query: { path: ['mergeAudio'] }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Server error: Test error'
    });
  });
}); 