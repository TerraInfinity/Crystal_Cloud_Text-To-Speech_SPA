import { loadDemoContent } from '../demoContentLoader';
import { devLog } from '../../utils/logUtils';

// Mock logUtils
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('demoContentLoader', () => {
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch = jest.fn();
    (global.fetch as jest.Mock).mockClear();
  });

  test('successfully loads demo content and dispatches actions', async () => {
    const demoData = {
      sections: [
        {
          id: 'section-1',
          title: 'Tuning In',
          type: 'text-to-speech',
          text: 'Tune in text',
        },
        {
          id: 'section-2',
          title: 'Warm-Up',
          type: 'audio-only',
          audioId: 'audio-1',
        },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(demoData),
    });

    await loadDemoContent(mockDispatch);

    expect(global.fetch).toHaveBeenCalledWith('/demo_kundalini_kriya.json');

    // Check dispatches in order
    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET_PROCESSING',
      payload: true,
    });

    // Load demo content
    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'LOAD_DEMO_CONTENT',
      payload: expect.objectContaining({
        currentTemplate: 'yogaKriya',
        sections: expect.any(Array),
        mode: 'demo',
        speechEngine: 'gtts',
      }),
    });

    // Success notification
    expect(mockDispatch).toHaveBeenNthCalledWith(3, {
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: 'Demo content loaded successfully!' },
    });

    // Set processing to false
    expect(mockDispatch).toHaveBeenNthCalledWith(4, {
      type: 'SET_PROCESSING',
      payload: false,
    });

    expect(devLog).toHaveBeenCalledWith('Normalized demo sections:', expect.any(Array));
  });

  test('handles fetch error and dispatches error action', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    await loadDemoContent(mockDispatch);

    expect(global.fetch).toHaveBeenCalledWith('/demo_kundalini_kriya.json');

    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET_PROCESSING',
      payload: true,
    });

    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'SET_ERROR',
      payload: 'Error loading demo content: Failed to load demo content',
    });

    expect(mockDispatch).toHaveBeenNthCalledWith(3, {
      type: 'SET_PROCESSING',
      payload: false,
    });
  });

  test('handles network error and dispatches error action', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await loadDemoContent(mockDispatch);

    expect(global.fetch).toHaveBeenCalledWith('/demo_kundalini_kriya.json');

    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: 'SET_PROCESSING',
      payload: true,
    });

    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'SET_ERROR',
      payload: 'Error loading demo content: Network error',
    });

    expect(mockDispatch).toHaveBeenNthCalledWith(3, {
      type: 'SET_PROCESSING',
      payload: false,
    });
  });

  test('normalizeSection adds default voice and settings for text-to-speech', async () => {
    const demoData = {
      sections: [
        {
          id: 'section-1',
          title: 'Test Section',
          type: 'text-to-speech',
          text: 'Test text',
        },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(demoData),
    });

    await loadDemoContent(mockDispatch);

    // Using toHaveBeenNthCalledWith instead of toHaveBeenCalledWith
    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'LOAD_DEMO_CONTENT',
      payload: expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'section-1',
            title: 'Test Section',
            type: 'text-to-speech',
            text: 'Test text',
          }),
        ]),
      }),
    });

    expect(devLog).toHaveBeenCalledWith('Normalized section:', expect.any(Object));
  });

  test('normalizeSection removes voice and settings for audio-only', async () => {
    const demoData = {
      sections: [
        {
          id: 'section-1',
          title: 'Audio Section',
          type: 'audio-only',
          audioId: 'audio-1',
          voice: { id: 'en-com' },
          voiceSettings: { volume: 1 },
        },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(demoData),
    });

    await loadDemoContent(mockDispatch);

    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'LOAD_DEMO_CONTENT',
      payload: expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'section-1',
            title: 'Audio Section',
            type: 'audio-only',
            audioId: 'audio-1',
          }),
        ]),
      }),
    });
  });

  test('normalizeSection generates id if missing', async () => {
    const demoData = {
      sections: [
        {
          title: 'No ID Section',
          type: 'text-to-speech',
          text: 'Test',
        },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(demoData),
    });

    await loadDemoContent(mockDispatch);

    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'LOAD_DEMO_CONTENT',
      payload: expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: 'No ID Section',
            type: 'text-to-speech',
            text: 'Test',
          }),
        ]),
      }),
    });
  });
});