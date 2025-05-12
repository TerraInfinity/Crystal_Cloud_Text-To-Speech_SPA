import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  listFromStorage,
  replaceInStorage,
  setGlobalStorageConfig,
  updateFileMetadata,
} from '../storage';
import axios from 'axios';
import { File } from 'buffer';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the logUtil functions to prevent console output during tests
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
  error: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  store: {} as { [key: string]: string },
  getItem: jest.fn((key: string) => localStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  store: {} as { [key: string]: string },
  getItem: jest.fn((key: string) => sessionStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    sessionStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key: string) => {
    delete sessionStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    sessionStorageMock.store = {};
  }),
};
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });

describe('storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.patch.mockReset();
    setGlobalStorageConfig({
      type: 'remote',
      serverUrl: 'http://localhost:5000',
      serviceType: null,
    });
  });

  // setGlobalStorageConfig
  test('setGlobalStorageConfig updates global storage configuration', () => {
    setGlobalStorageConfig({ type: 'remote', serverUrl: 'https://example.com' });
    expect(saveToStorage('test', new File([''], 'test.mp3'), 'fileStorage')).rejects.toThrow(
      'Failed to save test to fileStorage'
    );
  });

  // saveToStorage
  test('saveToStorage saves string to localStorage', async () => {
    await saveToStorage('testKey', 'testValue', 'localStorage');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', 'testValue');
  });

  test('saveToStorage saves object to localStorage', async () => {
    const obj = { name: 'Test' };
    await saveToStorage('testKey', obj, 'localStorage');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(obj));
  });

  test('saveToStorage saves to sessionStorage', async () => {
    await saveToStorage('testKey', 'testValue', 'sessionStorage');
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('testKey', 'testValue');
  });

  test('saveToStorage uploads merged_audio file with metadata', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: '/audio/test.wav' } });
    const file = new File(['content'], 'test.wav', { type: 'audio/wav' });
    const metadata = {
      category: 'merged_audio',
      name: 'Merged Test',
      date: '2025-05-03T12:00:00Z',
      volume: '1',
      placeholder: 'merged_test',
    };
    const url = await saveToStorage('test.wav', file, 'fileStorage', metadata);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/storageService/upload',
      expect.any(FormData),
      expect.any(Object)
    );
    const formData = mockedAxios.mock.calls[0][1] as FormData;
    expect(formData.get('audio')).toBe(file);
    expect(formData.get('category')).toBe('merged_audio');
    expect(formData.get('name')).toBe('Merged Test');
    expect(formData.get('date')).toBe('2025-05-03T12:00:00Z');
    expect(formData.get('volume')).toBe('1');
    expect(formData.get('placeholder')).toBe('merged_test');
    expect(url).toBe('http://localhost:5000/audio/test.wav');
  });

  test('saveToStorage uploads sound_effect file with metadata', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: '/audio/bird.mp3' } });
    const file = new File(['content'], 'bird.mp3', { type: 'audio/mpeg' });
    const metadata = {
      category: 'sound_effect',
      name: 'Bird Sound',
      volume: '0.8',
    };
    const url = await saveToStorage('bird.mp3', file, 'fileStorage', metadata);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/storageService/upload',
      expect.any(FormData),
      expect.any(Object)
    );
    const formData = mockedAxios.mock.calls[0][1] as FormData;
    expect(formData.get('audio')).toBe(file);
    expect(formData.get('category')).toBe('sound_effect');
    expect(formData.get('name')).toBe('Bird Sound');
    expect(formData.get('volume')).toBe('0.8');
    expect(url).toBe('http://localhost:5000/audio/bird.mp3');
  });

  test('saveToStorage throws error for non-WAV merged_audio file', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { data: { error: 'Merged audio must be a WAV file' }, status: 400 },
    });
    const file = new File(['content'], 'test.mp3', { type: 'audio/mpeg' });
    const metadata = { category: 'merged_audio' };

    await expect(saveToStorage('test.mp3', file, 'fileStorage', metadata)).rejects.toThrow(
      'Failed to save test.mp3 to fileStorage'
    );
  });

  test('saveToStorage throws error for empty file', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { data: { error: 'Uploaded file is empty' }, status: 400 },
    });
    const file = new File([], 'test.wav', { type: 'audio/wav' });
    const metadata = { category: 'merged_audio' };

    await expect(saveToStorage('test.wav', file, 'fileStorage', metadata)).rejects.toThrow(
      'Failed to save test.wav to fileStorage'
    );
  });

  test('saveToStorage throws error for non-File in fileStorage', async () => {
    await expect(saveToStorage('testKey', 'notAFile', 'fileStorage')).rejects.toThrow(
      'Value must be a File or Blob for fileStorage'
    );
  });

  test('saveToStorage throws error for unsupported storage type', async () => {
    await expect(saveToStorage('testKey', 'value', 'invalidStorage')).rejects.toThrow(
      'Unsupported storage type: invalidStorage'
    );
  });

  // loadFromStorage
  test('loadFromStorage retrieves string from localStorage', async () => {
    localStorageMock.getItem.mockReturnValueOnce('testValue');
    const value = await loadFromStorage('testKey', true, 'localStorage');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('testKey');
    expect(value).toBe('testValue');
  });

  test('loadFromStorage retrieves object from localStorage', async () => {
    const obj = { name: 'Test' };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(obj));
    const value = await loadFromStorage('testKey', false, 'localStorage');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('testKey');
    expect(value).toEqual(obj);
  });

  test('loadFromStorage retrieves from sessionStorage', async () => {
    sessionStorageMock.getItem.mockReturnValueOnce('testValue');
    const value = await loadFromStorage('testKey', true, 'sessionStorage');
    expect(sessionStorageMock.getItem).toHaveBeenCalledWith('testKey');
    expect(value).toBe('testValue');
  });

  test('loadFromStorage retrieves file for fileStorage', async () => {
    const blob = new Blob(['content'], { type: 'audio/mpeg' });
    mockedAxios.get.mockResolvedValue({ data: blob });
    const result = await loadFromStorage('test.mp3', false, 'fileStorage');
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5000/audio/test.mp3', {
      responseType: 'blob',
    });
    expect(result).toBe(blob);
  });

  test('loadFromStorage returns null for missing key', async () => {
    localStorageMock.getItem.mockReturnValueOnce(null);
    const value = await loadFromStorage('missingKey', false, 'localStorage');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('missingKey');
    expect(value).toBeNull();
  });

  test('loadFromStorage returns null for invalid JSON', async () => {
    localStorageMock.getItem.mockReturnValueOnce('invalid JSON');
    const value = await loadFromStorage('testKey', false, 'localStorage');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('testKey');
    expect(value).toBeNull();
  });

  // removeFromStorage
  test('removeFromStorage removes from localStorage', async () => {
    await removeFromStorage('testKey', 'localStorage');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('testKey');
  });

  test('removeFromStorage removes from sessionStorage', async () => {
    await removeFromStorage('testKey', 'sessionStorage');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('testKey');
  });

  test('removeFromStorage deletes file for fileStorage', async () => {
    mockedAxios.delete.mockResolvedValue({});
    await removeFromStorage('test.mp3', 'fileStorage');
    expect(mockedAxios.delete).toHaveBeenCalledWith('http://localhost:5000/audio/test.mp3');
  });

  test('removeFromStorage throws error for unsupported storage type', async () => {
    await expect(removeFromStorage('testKey', 'invalidStorage')).rejects.toThrow(
      'Unsupported storage type: invalidStorage'
    );
  });

  // listFromStorage
  test('listFromStorage lists localStorage keys', async () => {
    const mockItems = {
      key1: 'value1',
      key2: 'value2',
    };
    localStorageMock.getItem.mockImplementation((key) => mockItems[key] || null);
    jest.spyOn(Object, 'keys').mockReturnValueOnce(Object.keys(mockItems));

    const result = await listFromStorage('localStorage');
    expect(Object.keys).toHaveBeenCalledWith(localStorage);
    expect(result.length).toBe(2);
    expect(result[0].key).toBe('key1');
    expect(result[1].key).toBe('key2');
  });

  test('listFromStorage lists sessionStorage keys', async () => {
    const mockItems = {
      key1: 'value1',
    };
    sessionStorageMock.getItem.mockImplementation((key) => mockItems[key] || null);
    jest.spyOn(Object, 'keys').mockReturnValueOnce(Object.keys(mockItems));

    const result = await listFromStorage('sessionStorage');
    expect(Object.keys).toHaveBeenCalledWith(sessionStorage);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe('key1');
  });

  test('listFromStorage lists files for fileStorage', async () => {
    const files = [{ id: 'test.mp3', name: 'Test Audio' }];
    mockedAxios.get.mockResolvedValue({ data: files });
    const result = await listFromStorage('fileStorage');
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5000/audio/list');
    expect(result).toBe(files);
  });

  test('listFromStorage throws error for unsupported storage type', async () => {
    await expect(listFromStorage('invalidStorage')).rejects.toThrow(
      'Unsupported storage type: invalidStorage'
    );
  });

  // replaceInStorage
  test('replaceInStorage replaces string in localStorage', async () => {
    await replaceInStorage('testKey', 'newValue', 'localStorage');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', 'newValue');
  });

  test('replaceInStorage replaces object in localStorage', async () => {
    const newObj = { name: 'New' };
    await replaceInStorage('testKey', newObj, 'localStorage');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(newObj));
  });

  test('replaceInStorage replaces file for fileStorage', async () => {
    mockedAxios.put.mockResolvedValue({ data: { url: '/audio/test.mp3' } });
    const file = new File(['new content'], 'test.mp3', { type: 'audio/mpeg' });
    const url = await replaceInStorage('test.mp3', file, 'fileStorage');
    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://localhost:5000/audio/test.mp3',
      expect.any(FormData),
      expect.any(Object)
    );
    expect(url).toBe('/audio/test.mp3');
  });

  test('replaceInStorage throws error for non-File in fileStorage', async () => {
    await expect(replaceInStorage('testKey', 'notAFile', 'fileStorage')).rejects.toThrow(
      'Value must be a File or Blob for fileStorage'
    );
  });

  // updateFileMetadata
  test('updateFileMetadata updates metadata for fileStorage', async () => {
    const metadata = { name: 'Updated Audio', volume: 0.9 };
    mockedAxios.patch.mockResolvedValue({ data: metadata });
    const result = await updateFileMetadata('audio-1', metadata);
    expect(mockedAxios.patch).toHaveBeenCalledWith('http://localhost:5000/audio/audio-1', metadata);
    expect(result).toBe(metadata);
  });

  test('updateFileMetadata throws error on failure', async () => {
    mockedAxios.patch.mockRejectedValue(new Error('Patch failed'));
    await expect(updateFileMetadata('audio-1', { name: 'Test' })).rejects.toThrow(
      'Failed to update file metadata: Patch failed'
    );
  });
});