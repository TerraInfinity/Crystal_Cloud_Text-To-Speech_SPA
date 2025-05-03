import storageServiceAPI from '../api/storageServiceAPI';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock indexedDB
const indexedDBMock = {
  open: jest.fn(),
  deleteDatabase: jest.fn().mockReturnValue({
    onerror: null
  }),
};
Object.defineProperty(window, 'indexedDB', { value: indexedDBMock });

// Mock AWS S3
const s3Mock = {
  putObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  getObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({ Body: new Uint8Array([]), ContentType: 'audio/mp3' }) })),
  getSignedUrlPromise: jest.fn().mockResolvedValue('https://presigned-url.example.com'),
};

// Mock AWS namespace
(global as any).AWS = {
  S3: jest.fn(() => s3Mock),
};

// Mock console.error to prevent cluttering test output
const originalConsoleError = console.error;
console.error = jest.fn();

describe('storageServiceAPI', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  afterAll(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  describe('Local Storage Methods', () => {
    it('should save and load settings', () => {
      const testSettings = { theme: 'dark', voice: 'en-US' };
      
      const saveResult = storageServiceAPI.saveSettings(testSettings);
      
      expect(saveResult).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tts-app-settings',
        JSON.stringify(testSettings)
      );
      
      // Setup mock for loading
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(testSettings));
      
      const loadedSettings = storageServiceAPI.loadSettings();
      
      expect(loadedSettings).toEqual(testSettings);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('tts-app-settings');
    });

    it('should handle errors when saving settings', () => {
      // Force an error by making setItem throw
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage error');
      });
      
      const saveResult = storageServiceAPI.saveSettings({ test: 'data' });
      
      expect(saveResult).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle errors when loading settings', () => {
      // Force an error by making getItem throw
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage error');
      });
      
      const loadedSettings = storageServiceAPI.loadSettings();
      
      expect(loadedSettings).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should save, load, and delete templates', () => {
      const testTemplate = { name: 'Test Template', content: 'Template content' };
      
      // Mock existing templates
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ 
        'existing-template': { name: 'Existing' } 
      }));
      
      const saveResult = storageServiceAPI.saveTemplate('test-template', testTemplate);
      
      expect(saveResult).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tts-app-templates',
        expect.stringContaining('test-template')
      );
      
      // Setup mock for loading all templates
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        'test-template': testTemplate,
        'another-template': { name: 'Another' }
      }));
      
      const allTemplates = storageServiceAPI.loadTemplates();
      
      expect(allTemplates).toEqual({
        'test-template': testTemplate,
        'another-template': { name: 'Another' }
      });
      
      // Setup mock for loading a specific template
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        'test-template': testTemplate
      }));
      
      const loadedTemplate = storageServiceAPI.loadTemplate('test-template');
      
      expect(loadedTemplate).toEqual(testTemplate);
      
      // Setup mock for deletion
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        'test-template': testTemplate,
        'other-template': { name: 'Other' }
      }));
      
      const deleteResult = storageServiceAPI.deleteTemplate('test-template');
      
      expect(deleteResult).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'tts-app-templates',
        expect.not.stringContaining('test-template')
      );
    });

    it('should handle non-existent template deletion', () => {
      // Setup mock for non-existent template
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        'existing-template': { name: 'Existing' }
      }));
      
      const deleteResult = storageServiceAPI.deleteTemplate('non-existent');
      
      expect(deleteResult).toBe(false);
    });

    it('should save and load sections', () => {
      const testSection = { id: 'test-section', content: 'Section content' };
      
      // Mock existing sections
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ 
        'existing-section': { id: 'existing-section' } 
      }));
      
      const saveResult = storageServiceAPI.saveSection('test-section', testSection);
      
      expect(saveResult).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tts-app-sections',
        expect.stringContaining('test-section')
      );
      
      // Setup mock for loading
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        'test-section': testSection
      }));
      
      const loadedSections = storageServiceAPI.loadSections();
      
      expect(loadedSections).toEqual({
        'test-section': testSection
      });
    });

    it('should save and load API keys', () => {
      const testKeys = { openai: 'abc123', elevenlabs: 'def456' };
      
      const saveResult = storageServiceAPI.saveApiKeys(testKeys);
      
      expect(saveResult).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tts-app-api-keys',
        expect.any(String)
      );
      
      // Setup mock for loading
      const encodedKeys = btoa(JSON.stringify(testKeys));
      localStorageMock.getItem.mockReturnValueOnce(encodedKeys);
      
      const loadedKeys = storageServiceAPI.loadApiKeys();
      
      expect(loadedKeys).toEqual(testKeys);
    });

    it('should handle missing API keys', () => {
      // Setup mock for missing keys
      localStorageMock.getItem.mockReturnValueOnce(null);
      
      const loadedKeys = storageServiceAPI.loadApiKeys();
      
      expect(loadedKeys).toBeNull();
    });
  });

  describe('IndexedDB Methods', () => {
    it('should attempt to save audio to IndexedDB', async () => {
      const mockBlob = new Blob(['test audio data'], { type: 'audio/wav' });
      const mockIDBOpenRequest = {
        onupgradeneeded: null as any,
        onsuccess: null as any,
        onerror: null as any,
        result: {
          transaction: jest.fn().mockReturnValue({
            objectStore: jest.fn().mockReturnValue({
              put: jest.fn().mockReturnValue({
                onsuccess: null as any,
                onerror: null as any
              })
            })
          }),
          objectStoreNames: {
            contains: jest.fn().mockReturnValue(true)
          }
        }
      };
      
      indexedDBMock.open.mockReturnValue(mockIDBOpenRequest);
      
      const savePromise = storageServiceAPI.saveAudio('test-audio-id', mockBlob);
      
      // Simulate successful indexedDB operations
      setTimeout(() => {
        // First trigger the onsuccess of opening the database
        if (mockIDBOpenRequest.onsuccess) {
          mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest });
        }
        
        // Then trigger the onsuccess of the put operation
        const putRequest = mockIDBOpenRequest.result.transaction().objectStore().put();
        if (putRequest.onsuccess) {
          putRequest.onsuccess({});
        }
      }, 0);
      
      const result = await savePromise;
      
      expect(result).toBe(true);
      expect(indexedDBMock.open).toHaveBeenCalledWith('tts-app-db', 1);
      expect(mockIDBOpenRequest.result.transaction).toHaveBeenCalledWith(['audio'], 'readwrite');
    });

    it('should attempt to load audio from IndexedDB', async () => {
      const mockBlob = new Blob(['test audio data'], { type: 'audio/wav' });
      const mockIDBOpenRequest = {
        onupgradeneeded: null as any,
        onsuccess: null as any,
        onerror: null as any,
        result: {
          transaction: jest.fn().mockReturnValue({
            objectStore: jest.fn().mockReturnValue({
              get: jest.fn().mockReturnValue({
                onsuccess: null as any,
                onerror: null as any,
                result: { blob: mockBlob }
              })
            })
          }),
          objectStoreNames: {
            contains: jest.fn().mockReturnValue(true)
          }
        }
      };
      
      indexedDBMock.open.mockReturnValue(mockIDBOpenRequest);
      
      const loadPromise = storageServiceAPI.loadAudio('test-audio-id');
      
      // Simulate successful indexedDB operations
      setTimeout(() => {
        // First trigger the onsuccess of opening the database
        if (mockIDBOpenRequest.onsuccess) {
          mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest });
        }
        
        // Then trigger the onsuccess of the get operation
        const getRequest = mockIDBOpenRequest.result.transaction().objectStore().get();
        if (getRequest.onsuccess) {
          getRequest.onsuccess({});
        }
      }, 0);
      
      const result = await loadPromise;
      
      expect(result).toBe(mockBlob);
      expect(indexedDBMock.open).toHaveBeenCalledWith('tts-app-db', 1);
      expect(mockIDBOpenRequest.result.transaction).toHaveBeenCalledWith(['audio'], 'readonly');
    });

    it('should attempt to delete audio from IndexedDB', async () => {
      const mockIDBOpenRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: {
          transaction: jest.fn().mockReturnValue({
            objectStore: jest.fn().mockReturnValue({
              delete: jest.fn().mockReturnValue({
                onsuccess: null as any,
                onerror: null as any
              })
            })
          })
        }
      };
      
      indexedDBMock.open.mockReturnValue(mockIDBOpenRequest);
      
      const deletePromise = storageServiceAPI.deleteAudio('test-audio-id');
      
      // Simulate successful indexedDB operations
      setTimeout(() => {
        // First trigger the onsuccess of opening the database
        if (mockIDBOpenRequest.onsuccess) {
          mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest });
        }
        
        // Then trigger the onsuccess of the delete operation
        const deleteRequest = mockIDBOpenRequest.result.transaction().objectStore().delete();
        if (deleteRequest.onsuccess) {
          deleteRequest.onsuccess({});
        }
      }, 0);
      
      const result = await deletePromise;
      
      expect(result).toBe(true);
      expect(indexedDBMock.open).toHaveBeenCalledWith('tts-app-db', 1);
      expect(mockIDBOpenRequest.result.transaction).toHaveBeenCalledWith(['audio'], 'readwrite');
    });
  });

  describe('Clear All Data', () => {
    it('should clear all stored data', () => {
      const result = storageServiceAPI.clearAllData();
      
      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tts-app-settings');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tts-app-templates');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tts-app-sections');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tts-app-api-keys');
      expect(indexedDBMock.deleteDatabase).toHaveBeenCalledWith('tts-app-db');
    });

    it('should handle errors when clearing data', () => {
      // Force an error
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('localStorage error');
      });
      
      const result = storageServiceAPI.clearAllData();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('S3 Methods', () => {
    it('should upload file to S3', async () => {
      const mockFile = new Blob(['test data'], { type: 'text/plain' });
      
      const result = await storageServiceAPI.upload_file_to_s3(
        mockFile, 
        'test-bucket', 
        'test-key.txt'
      );
      
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test-key.txt');
      expect(s3Mock.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
        Body: mockFile,
        ContentType: 'text/plain'
      });
    });

    it('should write string data to S3', async () => {
      const testData = 'Hello, world!';
      
      const result = await storageServiceAPI.write_data_to_s3(
        testData,
        'test-bucket',
        'test-key.txt'
      );
      
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test-key.txt');
      expect(s3Mock.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
        Body: testData,
        ContentType: 'text/plain'
      });
    });

    it('should write JSON data to S3', async () => {
      const testData = { hello: 'world' };
      
      const result = await storageServiceAPI.write_data_to_s3(
        testData,
        'test-bucket',
        'test-key.json'
      );
      
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test-key.json');
      expect(s3Mock.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.json',
        Body: JSON.stringify(testData),
        ContentType: 'application/json'
      });
    });

    it('should throw error for unsupported data type in write_data_to_s3', async () => {
      // @ts-ignore - Testing invalid input
      await expect(storageServiceAPI.write_data_to_s3(123, 'test-bucket', 'test-key'))
        .rejects.toThrow('Unsupported data type');
    });

    it('should download audio files from S3', async () => {
      const keys = ['file1.mp3', 'file2.mp3'];
      
      const result = await storageServiceAPI.download_audio_files_from_s3('test-bucket', keys);
      
      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Blob);
      expect(s3Mock.getObject).toHaveBeenCalledTimes(2);
      expect(s3Mock.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file1.mp3'
      });
    });

    it('should create presigned S3 URL', async () => {
      const result = await storageServiceAPI.create_presigned_s3_url(
        'test-bucket',
        'test-key.mp3',
        7200
      );
      
      expect(result).toBe('https://presigned-url.example.com');
      expect(s3Mock.getSignedUrlPromise).toHaveBeenCalledWith('getObject', {
        Bucket: 'test-bucket',
        Key: 'test-key.mp3',
        Expires: 7200
      });
    });
  });

  describe('Storage Provider Configuration', () => {
    it('should configure storage provider', () => {
      storageServiceAPI.configureProvider({ audio: 's3', settings: 'localstorage' });
      
      // Check that the provider configuration was updated
      // Note: This is accessing a private property for testing
      expect((storageServiceAPI as any).storageProvider).toEqual({
        audio: 's3',
        settings: 'localstorage',
        cloud: 's3'
      });
    });
  });
});
