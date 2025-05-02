import { createTtsActions } from '../ttsActions';

// Mock storage module (loads from __mocks__/storage.ts)
jest.mock('../storage');

// Mock logUtils to prevent side effects
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

import { saveToStorage, removeFromStorage } from '../storage';

// Cast mocks to jest.Mock to avoid TypeScript errors
const mockedSaveToStorage = saveToStorage as jest.Mock<Promise<string>>;
const mockedRemoveFromStorage = removeFromStorage as jest.Mock<Promise<void>>;

describe('ttsActions', () => {
  let dispatch: jest.Mock;
  let actions: ReturnType<typeof createTtsActions>;

  // Reset mocks before each test
  beforeEach(() => {
    dispatch = jest.fn();
    actions = createTtsActions(dispatch);
    jest.clearAllMocks();
  });

  // Test 1: setTheme dispatches correct action
  test('setTheme dispatches SET_THEME with payload', () => {
    actions.setTheme('dark');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_THEME', payload: 'dark' });
  });

  // Test 2: setSpeechEngine dispatches correct action
  test('setSpeechEngine dispatches SET_SPEECH_ENGINE with payload', () => {
    actions.setSpeechEngine('elevenLabs');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SPEECH_ENGINE',
      payload: 'elevenLabs',
    });
  });

  // Test 3: uploadAudio saves to storage and dispatches SAVE_AUDIO
  test('uploadAudio saves file and dispatches SAVE_AUDIO', async () => {
    mockedSaveToStorage.mockResolvedValue('http://example.com/audio.mp3');
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
    const audioData = {
      id: 'audio-1',
      name: 'Test Audio',
      category: 'sound_effect',
      placeholder: 'test placeholder',
      volume: 0.8,
    };

    await actions.uploadAudio(file, audioData);

    expect(mockedSaveToStorage).toHaveBeenCalledTimes(1);
    expect(mockedSaveToStorage).toHaveBeenCalledWith(
      'test.mp3',
      file,
      'fileStorage',
      {
        category: 'sound_effect',
        name: 'Test Audio',
        placeholder: 'test placeholder',
        volume: '0.8',
      }
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SAVE_AUDIO',
      payload: {
        ...audioData,
        url: 'http://example.com/audio.mp3',
      },
    });
  });

  // Test 4: uploadAudio handles errors
  test('uploadAudio throws error when saveToStorage fails', async () => {
    mockedSaveToStorage.mockRejectedValue(new Error('Storage error'));
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
    const audioData = {
      id: 'audio-1',
      name: 'Test Audio',
      category: 'sound_effect',
      placeholder: 'test placeholder',
      volume: 0.8,
    };

    await expect(actions.uploadAudio(file, audioData)).rejects.toThrow('Storage error');
    expect(dispatch).not.toHaveBeenCalled();
  });

  // Test 5: deleteAudioFromStorage removes file and dispatches DELETE_AUDIO
  test('deleteAudioFromStorage removes file and dispatches DELETE_AUDIO', async () => {
    mockedRemoveFromStorage.mockResolvedValue(undefined);
    const audioId = 'audio-1';
    const filename = 'test.mp3';

    await actions.deleteAudioFromStorage(audioId, filename);

    expect(mockedRemoveFromStorage).toHaveBeenCalledTimes(1);
    expect(mockedRemoveFromStorage).toHaveBeenCalledWith(filename, 'fileStorage');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'DELETE_AUDIO',
      payload: audioId,
    });
  });
});