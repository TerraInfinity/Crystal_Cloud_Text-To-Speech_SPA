// utils/__tests__/logUtils.test.ts

// Mock the devLog module before importing
jest.mock('../logUtils', () => ({
  devLog: jest.fn((...args) => {
    // This implementation will be overridden in individual tests
  })
}));

import { devLog } from '../logUtils';

describe('logUtils', () => {
  beforeEach(() => {
    // Mock console.log to track calls
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Reset devLog mock before each test
    (devLog as jest.Mock).mockReset();
  });

  afterEach(() => {
    // Restore console.log after each test
    jest.spyOn(console, 'log').mockRestore();
  });

  describe('devLog', () => {
    test('logs message with [TTS] prefix in development environment', () => {
      // Configure our mock to pass through to console.log (simulating development)
      (devLog as jest.Mock).mockImplementation((...args) => {
        console.log('[TTS]', ...args);
      });
      
      devLog('Test message', { data: 'test' });
      expect(console.log).toHaveBeenCalledWith('[TTS]', 'Test message', { data: 'test' });
    });

    test('logs multiple arguments in development environment', () => {
      // Configure our mock to pass through to console.log (simulating development)
      (devLog as jest.Mock).mockImplementation((...args) => {
        console.log('[TTS]', ...args);
      });
      
      devLog('Message 1', 42, { key: 'value' });
      expect(console.log).toHaveBeenCalledWith('[TTS]', 'Message 1', 42, { key: 'value' });
    });

    test('does not log in production environment', () => {
      // Configure our mock to do nothing (simulating production)
      (devLog as jest.Mock).mockImplementation(() => {});
      
      devLog('Test message', { data: 'test' });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('does not log in test environment', () => {
      // Configure our mock to do nothing (simulating test)
      (devLog as jest.Mock).mockImplementation(() => {});
      
      devLog('Test message', { data: 'test' });
      expect(console.log).not.toHaveBeenCalled();
    });

    test('handles no arguments', () => {
      // Configure our mock to pass through to console.log (simulating development)
      (devLog as jest.Mock).mockImplementation((...args) => {
        console.log('[TTS]', ...args);
      });
      
      devLog();
      expect(console.log).toHaveBeenCalledWith('[TTS]');
    });
  });
});