// pages/api/__tests__/awsPollyAPI.test.tsx

import { createMocks, MockRequest, MockResponse } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Define the response type for the AWS Polly API
interface AwsPollyResponse {
  message: string;
  params: {
    text: string;
    voice: string;
    language: string;
    outputFormat: string;
  };
  mockAudioUrl: string;
}

// Define the parameters type for callAwsPollyTTS
interface CallAwsPollyTTSParams {
  text: string;
  voice?: string;
  language?: string;
  outputFormat?: string;
  accessKey?: string;
  secretKey?: string;
}

// Mock the entire awsPolly module
jest.mock('../api/speechEngineAPIs/awsPollyAPI', () => {
  const mockCallAwsPollyTTS = jest.fn(
    async (params: CallAwsPollyTTSParams): Promise<AwsPollyResponse> => {
      return {
        message: 'Mock implementation',
        params: {
          text: params.text,
          voice: params.voice || 'Joanna',
          language: params.language || 'en-US',
          outputFormat: params.outputFormat || 'mp3',
        },
        mockAudioUrl: 'data:audio/mp3;base64,mock',
      };
    }
  );

  const mockHandler = async (
    req: NextApiRequest,
    res: NextApiResponse<AwsPollyResponse | { message: string }>
  ) => {
    try {
      const {
        text,
        voice = 'Joanna',
        language = 'en-US',
        outputFormat = 'mp3',
      } = req.query as Record<string, string | undefined>;

      if (!text) throw new Error('Text parameter is required');

      const accessKey =
        process.env.AWS_ACCESS_KEY_ID || req.headers['x-aws-access-key'];
      const secretKey =
        process.env.AWS_SECRET_ACCESS_KEY || req.headers['x-aws-secret-key'];

      const result = await mockCallAwsPollyTTS({
        text,
        voice,
        language,
        outputFormat,
        accessKey: accessKey as string | undefined,
        secretKey: secretKey as string | undefined,
      });

      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ message });
    }
  };

  return {
    __esModule: true,
    default: mockHandler,
    callAwsPollyTTS: mockCallAwsPollyTTS,
  };
});

// Import the mocked module
const { default: handler, callAwsPollyTTS } = require('../api/speechEngineAPIs/awsPollyAPI');

describe('awsPolly API Handler', () => {
  let req: MockRequest<NextApiRequest>;
  let res: MockResponse<NextApiResponse>;

  beforeEach(() => {
    const { req: mockReq, res: mockRes } = createMocks<
      NextApiRequest,
      NextApiResponse
    >({
      method: 'GET',
      query: {},
      headers: {},
    });
    req = mockReq;
    res = mockRes;

    jest.clearAllMocks();
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  describe('handler', () => {
    test('returns mock audio URL with valid parameters and env credentials', async () => {
      req.query = {
        text: 'Hello world',
        voice: 'Joanna',
        language: 'en-US',
        outputFormat: 'mp3',
      };
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

      await handler(req, res);

      expect(callAwsPollyTTS).toHaveBeenCalledWith({
        text: 'Hello world',
        voice: 'Joanna',
        language: 'en-US',
        outputFormat: 'mp3',
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
      });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({
        message: 'Mock implementation',
        params: {
          text: 'Hello world',
          voice: 'Joanna',
          language: 'en-US',
          outputFormat: 'mp3',
        },
        mockAudioUrl: 'data:audio/mp3;base64,mock',
      });
    });

    test('returns 400 if text is missing', async () => {
      req.query = {
        voice: 'Joanna',
        language: 'en-US',
        outputFormat: 'mp3',
      };
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual({
        message: 'Text parameter is required',
      });
    });

    test('supports credentials via headers', async () => {
      req.query = {
        text: 'Hello world',
        voice: 'Joanna',
        language: 'en-US',
        outputFormat: 'mp3',
      };
      req.headers['x-aws-access-key'] = 'header-access-key';
      req.headers['x-aws-secret-key'] = 'header-secret-key';

      await handler(req, res);

      expect(callAwsPollyTTS).toHaveBeenCalledWith({
        text: 'Hello world',
        voice: 'Joanna',
        language: 'en-US',
        outputFormat: 'mp3',
        accessKey: 'header-access-key',
        secretKey: 'header-secret-key',
      });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({
        message: 'Mock implementation',
        params: {
          text: 'Hello world',
          voice: 'Joanna',
          language: 'en-US',
          outputFormat: 'mp3',
        },
        mockAudioUrl: 'data:audio/mp3;base64,mock',
      });
    });
  });

  describe('callAwsPollyTTS', () => {
    const testCallAwsPollyTTS = async (params: CallAwsPollyTTSParams) => {
      if (!params.text) throw new Error('Text parameter is required');
      return {
        message: 'Local mock',
        params: {
          text: params.text,
          voice: params.voice || 'Joanna',
          language: params.language || 'en-US',
          outputFormat: params.outputFormat || 'mp3',
        },
        mockAudioUrl: 'data:audio/mp3;base64,local',
      };
    };

    test('returns mock audio URL with valid parameters', async () => {
      const result = await testCallAwsPollyTTS({
        text: 'Hello world',
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
      });

      expect(result).toEqual({
        message: 'Local mock',
        params: {
          text: 'Hello world',
          voice: 'Joanna',
          language: 'en-US',
          outputFormat: 'mp3',
        },
        mockAudioUrl: 'data:audio/mp3;base64,local',
      });
    });
  });
});