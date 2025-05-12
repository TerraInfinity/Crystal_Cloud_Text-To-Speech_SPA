// Import the API handler (default export)
import storageServiceAPIHandler from '../api/storageServiceAPI';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { File } from 'buffer';

// Access the StorageServiceAPI class directly using require
const { StorageServiceAPI } = require('../api/storageServiceAPI');

// Mock axios
const mockAxios = new MockAdapter(axios);

// Mock AWS S3
const s3Mock = {
  upload: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  getObject: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue({ Body: new Uint8Array([]), ContentType: 'audio/mp3' }),
  })),
  listObjectsV2: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue({ Contents: [{ Key: 'file1.mp3', LastModified: new Date(), Size: 100 }] }),
  })),
  deleteObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  copyObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
};

// Mock AWS namespace
(global as any).AWS = {
  S3: jest.fn(() => s3Mock),
};

// Mock Google Cloud Storage
const gcsFileMock = {
  save: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue([Buffer.from('file content'), { contentType: 'audio/mp3' }]),
  delete: jest.fn().mockResolvedValue(undefined),
  setMetadata: jest.fn().mockResolvedValue(undefined),
};
const gcsBucketMock = {
  file: jest.fn(() => gcsFileMock),
  getFiles: jest.fn().mockResolvedValue([[{ name: 'file1.mp3', metadata: { updated: new Date(), size: '100' } }]]),
};
const gcsStorageMock = {
  bucket: jest.fn(() => gcsBucketMock),
};
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => gcsStorageMock),
}));

// Mock multer for API handler tests
jest.mock('multer', () => {
  const multerMock = () => ({
    single: () => (req: any, res: any, callback: any) => {
      req.file = req.mockFile;
      req.body = req.mockBody || {};
      callback(null); // Simulate successful middleware execution
    },
  });
  multerMock.memoryStorage = jest.fn();
  return multerMock;
});

// Mock console.error to prevent cluttering test output
const originalConsoleError = console.error;
console.error = jest.fn();

describe('StorageServiceAPI', () => {
  let storageService: typeof StorageServiceAPI;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockAxios.reset();

    // Initialize StorageServiceAPI with remote backend
    storageService = new StorageServiceAPI({
      fileStorageBackend: 'remote',
      serverUrl: 'http://localhost:5000',
    });
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('Remote Storage Methods', () => {
    it('should save a merged_audio file to remote server', async () => {
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
      const filename = 'test.wav';
      const contentType = 'audio/wav';
      const metadata = {
        category: 'merged_audio',
        name: 'Merged Test',
        date: '2025-05-03T12:00:00Z',
        volume: '1',
        placeholder: 'merged_test',
      };
      const responseUrl = '/audio/test.wav';

      mockAxios.onPost('http://localhost:5000/upload').reply(200, { url: responseUrl });

      const result = await storageService.saveFile(file, filename, contentType, metadata);

      expect(mockAxios.history.post.length).toBe(1);
      const formData = mockAxios.history.post[0].data;
      expect(formData.get('audio')).toBe(file);
      expect(formData.get('category')).toBe('merged_audio');
      expect(formData.get('name')).toBe('Merged Test');
      expect(formData.get('date')).toBe('2025-05-03T12:00:00Z');
      expect(formData.get('volume')).toBe('1');
      expect(formData.get('placeholder')).toBe('merged_test');
      expect(result).toBe('http://localhost:5000/audio/test.wav');
    });

    it('should save a sound_effect file to remote server', async () => {
      const file = new File(['audio'], 'bird.mp3', { type: 'audio/mp3' });
      const filename = 'bird.mp3';
      const contentType = 'audio/mp3';
      const metadata = { category: 'sound_effect', name: 'Bird Sound' };
      const responseUrl = '/audio/bird.mp3';

      mockAxios.onPost('http://localhost:5000/upload').reply(200, { url: responseUrl });

      const result = await storageService.saveFile(file, filename, contentType, metadata);

      expect(mockAxios.history.post.length).toBe(1);
      const formData = mockAxios.history.post[0].data;
      expect(formData.get('audio')).toBe(file);
      expect(formData.get('category')).toBe('sound_effect');
      expect(formData.get('name')).toBe('Bird Sound');
      expect(result).toBe('http://localhost:5000/audio/bird.mp3');
    });

    it('should throw error for non-audio file in saveFile', async () => {
      const file = new File(['text'], 'test.txt', { type: 'text/plain' });
      const filename = 'test.txt';
      const contentType = 'text/plain';
      const metadata = { category: 'merged_audio' };

      await expect(storageService.saveFile(file, filename, contentType, metadata)).rejects.toThrow(
        'Input must be a File or Buffer'
      );
    });

    it('should handle server error in saveFile', async () => {
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
      const filename = 'test.wav';
      const contentType = 'audio/wav';
      const metadata = { category: 'merged_audio' };

      mockAxios.onPost('http://localhost:5000/upload').reply(500, { error: 'Server error' });

      await expect(storageService.saveFile(file, filename, contentType, metadata)).rejects.toThrow(
        'Failed to upload file to remote: {"error":"Server error"}'
      );
    });

    it('should load a file from remote server', async () => {
      const key = 'test.wav';
      const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });

      mockAxios.onGet('http://localhost:5000/audio/test.wav').reply(200, mockBlob);

      const result = await storageService.loadFile(key);

      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe('http://localhost:5000/audio/test.wav');
      expect(result).toBe(mockBlob);
    });

    it('should list files from remote server', async () => {
      const mockFiles = [{ key: 'file1.mp3', name: 'File 1' }, { key: 'file2.wav', name: 'File 2' }];

      mockAxios.onGet('http://localhost:5000/audio/list').reply(200, mockFiles);

      const result = await storageService.listFiles();

      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe('http://localhost:5000/audio/list');
      expect(result).toEqual(mockFiles);
    });

    it('should delete a file from remote server', async () => {
      const key = 'test.wav';

      mockAxios.onDelete('http://localhost:5000/audio/test.wav').reply(200);

      const result = await storageService.removeFile(key);

      expect(mockAxios.history.delete.length).toBe(1);
      expect(mockAxios.history.delete[0].url).toBe('http://localhost:5000/audio/test.wav');
      expect(result).toBe(true);
    });

    it('should replace a file on remote server', async () => {
      const key = 'test.wav';
      const file = new File(['new audio'], 'test.wav', { type: 'audio/wav' });
      const responseUrl = '/audio/test.wav';

      mockAxios.onPut('http://localhost:5000/audio/test.wav').reply(200, { url: responseUrl });

      const result = await storageService.replaceFile(key, file);

      expect(mockAxios.history.put.length).toBe(1);
      expect(mockAxios.history.put[0].url).toBe('http://localhost:5000/audio/test.wav');
      expect(result).toBe('http://localhost:5000/audio/test.wav');
    });

    it('should update file metadata on remote server', async () => {
      const audioId = 'test.wav';
      const metadata = { name: 'Updated Name', category: 'updated' };
      const responseData = { key: audioId, metadata };

      mockAxios.onPatch('http://localhost:5000/audio/test.wav').reply(200, responseData);

      const result = await storageService.updateFileMetadata(audioId, metadata);

      expect(mockAxios.history.patch.length).toBe(1);
      expect(mockAxios.history.patch[0].url).toBe('http://localhost:5000/audio/test.wav');
      expect(result).toEqual(responseData);
    });
  });

  describe('S3 Storage Methods', () => {
    let s3StorageService: typeof StorageServiceAPI;

    beforeEach(() => {
      s3StorageService = new StorageServiceAPI({
        fileStorageBackend: 's3',
        s3Bucket: 'test-bucket',
      });
    });

    it('should upload file to S3', async () => {
      const file = new File(['test data'], 'test.txt', { type: 'text/plain' });
      const filename = 'test.txt';
      const contentType = 'text/plain';
      const metadata = { category: 'test' };

      const result = await s3StorageService.saveFile(file, filename, contentType, metadata);

      expect(s3Mock.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: expect.any(String),
        Body: file,
        ContentType: 'text/plain',
        Metadata: { category: 'test' },
      });
      expect(result).toContain('test.txt');
    });

    it('should load file from S3', async () => {
      const key = 'file1.mp3';
      const result = await s3StorageService.loadFile(key);

      expect(s3Mock.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file1.mp3',
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should list files from S3', async () => {
      const result = await s3StorageService.listFiles();

      expect(s3Mock.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
      });
      expect(result).toEqual([{ key: 'file1.mp3', lastModified: expect.any(Date), size: 100 }]);
    });

    it('should delete file from S3', async () => {
      const key = 'file1.mp3';
      const result = await s3StorageService.removeFile(key);

      expect(s3Mock.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file1.mp3',
      });
      expect(result).toBe(true);
    });

    it('should replace file in S3', async () => {
      const key = 'file1.mp3';
      const file = new File(['new data'], 'file1.mp3', { type: 'audio/mp3' });

      const result = await s3StorageService.replaceFile(key, file);

      expect(s3Mock.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file1.mp3',
        Body: file,
        ContentType: 'audio/mp3',
      });
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/file1.mp3');
    });

    it('should update file metadata in S3', async () => {
      const audioId = 'file1.mp3';
      const metadata = { category: 'updated' };

      const result = await s3StorageService.updateFileMetadata(audioId, metadata);

      expect(s3Mock.copyObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'file1.mp3',
        CopySource: 'test-bucket/file1.mp3',
        Metadata: { category: 'updated' },
        MetadataDirective: 'REPLACE',
      });
      expect(result).toEqual({ key: audioId, metadata });
    });
  });

  describe('API Handler Tests', () => {
    it('should handle API handler upload for merged_audio', async () => {
      const mockFile = {
        buffer: Buffer.from('audio'),
        originalname: 'test.wav',
        mimetype: 'audio/wav',
      };
      const mockBody = {
        category: 'merged_audio',
        name: 'Merged Test',
        date: '2025-05-03T12:00:00Z',
        volume: '1',
        placeholder: 'merged_test',
      };
      const req = {
        method: 'POST',
        query: { path: ['storageService', 'upload'] },
        mockFile,
        mockBody,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      mockAxios.onPost('http://localhost:5000/upload').reply(200, { url: '/audio/test.wav' });

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: 'http://localhost:5000/audio/test.wav' });
    });

    it('should handle API handler upload for sound_effect', async () => {
      const mockFile = {
        buffer: Buffer.from('audio'),
        originalname: 'bird.mp3',
        mimetype: 'audio/mp3',
      };
      const mockBody = {
        category: 'sound_effect',
        name: 'Bird Sound',
      };
      const req = {
        method: 'POST',
        query: { path: ['storageService', 'upload'] },
        mockFile,
        mockBody,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      mockAxios.onPost('http://localhost:5000/upload').reply(200, { url: '/audio/bird.mp3' });

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: 'http://localhost:5000/audio/bird.mp3' });
    });

    it('should reject non-audio files in API handler', async () => {
      const mockFile = {
        buffer: Buffer.from('text'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };
      const mockBody = { category: 'merged_audio' };
      const req = {
        method: 'POST',
        query: { path: ['storageService', 'upload'] },
        mockFile,
        mockBody,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No audio file uploaded' });
    });

    it('should handle file retrieval via API handler', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const req = {
        method: 'GET',
        query: { path: ['storageService', 'file', 'test.wav'] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      mockAxios.onGet('http://localhost:5000/audio/test.wav').reply(200, mockBlob);

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav');
      expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should handle file deletion via API handler', async () => {
      const req = {
        method: 'DELETE',
        query: { path: ['storageService', 'file', 'test.wav'] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockAxios.onDelete('http://localhost:5000/audio/test.wav').reply(200);

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should handle file replacement via API handler', async () => {
      const mockFile = {
        buffer: Buffer.from('new audio'),
        originalname: 'test.wav',
        mimetype: 'audio/wav',
      };
      const req = {
        method: 'PUT',
        query: { path: ['storageService', 'file', 'test.wav'] },
        mockFile,
        mockBody: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockAxios.onPut('http://localhost:5000/audio/test.wav').reply(200, { url: '/audio/test.wav' });

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: 'http://localhost:5000/audio/test.wav' });
    });

    it('should handle file list via API handler', async () => {
      const mockFiles = [{ key: 'file1.mp3', name: 'File 1' }, { key: 'file2.wav', name: 'File 2' }];
      const req = {
        method: 'GET',
        query: { path: ['storageService', 'list'] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockAxios.onGet('http://localhost:5000/audio/list').reply(200, mockFiles);

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockFiles);
    });

    it('should handle metadata update via API handler', async () => {
      const mockBody = { category: 'updated', name: 'Updated Name' };
      const req = {
        method: 'PATCH',
        query: { path: ['storageService', 'metadata', 'test.wav'] },
        body: mockBody,
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      mockAxios.onPatch('http://localhost:5000/audio/test.wav').reply(200, { key: 'test.wav', metadata: mockBody });

      await storageServiceAPIHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ key: 'test.wav', metadata: mockBody });
    });
  });
});