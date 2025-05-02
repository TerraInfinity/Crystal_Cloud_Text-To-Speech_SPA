// utils/__tests__/fileUtils.test.ts

import {
    readTextFile,
    readAudioFile,
    downloadFile,
    isAudioFile,
    isTextFile,
    locate_sound_effect_file,
    delete_temporary_files,
  } from '../fileUtils';
  
  // Mock FileReader for browser-based file reading
const mockFileReader = {
  readAsText: jest.fn(function() {
    // Simulate async behavior with setTimeout
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }),
  readAsDataURL: jest.fn(function() {
    // Simulate async behavior with setTimeout
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }),
  onload: null,
  onerror: null,
  result: null,
};
  
global.FileReader = jest.fn(() => mockFileReader) as jest.Mock & {
  new (): FileReader;
  prototype: FileReader;
  readonly EMPTY: 0;
  readonly LOADING: 1;
  readonly DONE: 2;
};
  

  // Mock document for downloadFile
  const mockLink = {
    href: '',
    download: '',
    style: { display: '' },
    click: jest.fn(),
  };
  document.createElement = jest.fn().mockReturnValue(mockLink);
  document.body.appendChild = jest.fn();
  document.body.removeChild = jest.fn();
  
  // Mock fs/promises and path for Node.js-based functions
  jest.mock('fs/promises', () => ({
    readdir: jest.fn(),
    unlink: jest.fn(),
  }));
  jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
  }));
  
  const fs = require('fs/promises');
  const path = require('path');
  
  describe('fileUtils', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFileReader.onload = null;
      mockFileReader.onerror = null;
      mockFileReader.result = null;
    });
  
    describe('readTextFile', () => {
      test('reads text file successfully', async () => {
        const file = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
        mockFileReader.result = 'Hello, world!';
        
        const resultPromise = readTextFile(file);
        
        expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);
        const result = await resultPromise;
        expect(result).toBe('Hello, world!');
      });
  
      test('handles file reading error', async () => {
        const file = new File(['Hello, world!'], 'test.txt', { type: 'text/plain' });
        
        // Override readAsText to trigger error
        mockFileReader.readAsText.mockImplementationOnce(function() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Read error'));
            }
          }, 0);
        });
        
        await expect(readTextFile(file)).rejects.toThrow('Error reading file');
        expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);
      });
    });
  
    describe('readAudioFile', () => {
      test('reads audio file successfully', async () => {
        const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
        mockFileReader.result = 'data:audio/mp3;base64,abc123';
        
        const resultPromise = readAudioFile(file);
        
        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file);
        const result = await resultPromise;
        expect(result).toBe('data:audio/mp3;base64,abc123');
      });
  
      test('handles audio file reading error', async () => {
        const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
        
        // Override readAsDataURL to trigger error
        mockFileReader.readAsDataURL.mockImplementationOnce(function() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Read error'));
            }
          }, 0);
        });
        
        await expect(readAudioFile(file)).rejects.toThrow('Error reading audio file');
        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file);
      });
    });
  
    describe('downloadFile', () => {
      test('downloads file with correct URL and filename', () => {
        const url = 'http://localhost/test.mp3';
        const filename = 'test.mp3';
  
        downloadFile(url, filename);
  
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(mockLink.href).toBe(url);
        expect(mockLink.download).toBe(filename);
        expect(mockLink.style.display).toBe('none');
        expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
        expect(mockLink.click).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
      });
    });
  
    describe('isAudioFile', () => {
      test('returns true for audio file', () => {
        const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
        expect(isAudioFile(file)).toBe(true);
      });
  
      test('returns false for non-audio file', () => {
        const file = new File(['text'], 'test.txt', { type: 'text/plain' });
        expect(isAudioFile(file)).toBe(false);
      });
    });
  
    describe('isTextFile', () => {
      test('returns true for text/plain file', () => {
        const file = new File(['text'], 'test.txt', { type: 'text/plain' });
        expect(isTextFile(file)).toBe(true);
      });
  
      test('returns true for .txt file with unknown type', () => {
        const file = new File(['text'], 'test.txt', { type: '' });
        expect(isTextFile(file)).toBe(true);
      });
  
      test('returns false for non-text file', () => {
        const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
        expect(isTextFile(file)).toBe(false);
      });
    });
  
    describe('locate_sound_effect_file', () => {
      test('locates sound effect files with specified extensions', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['sound1.mp3', 'sound2.wav', 'image.png', 'sound3.ogg']);
        (path.join as jest.Mock)
          .mockReturnValueOnce('/path/to/sound1.mp3')
          .mockReturnValueOnce('/path/to/sound2.wav')
          .mockReturnValueOnce('/path/to/sound3.ogg');
  
        const result = await locate_sound_effect_file('/path/to', ['.mp3', '.wav', '.ogg']);
  
        expect(fs.readdir).toHaveBeenCalledWith('/path/to');
        expect(result).toEqual(['/path/to/sound1.mp3', '/path/to/sound2.wav', '/path/to/sound3.ogg']);
      });
  
      test('returns empty array if no matching files', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['image.png', 'doc.pdf']);
  
        const result = await locate_sound_effect_file('/path/to', ['.mp3', '.wav']);
  
        expect(fs.readdir).toHaveBeenCalledWith('/path/to');
        expect(result).toEqual([]);
      });
  
      test('handles file system errors', async () => {
        (fs.readdir as jest.Mock).mockRejectedValue(new Error('FS error'));
  
        await expect(locate_sound_effect_file('/path/to')).rejects.toThrow('FS error');
      });
    });
  
    describe('delete_temporary_files', () => {
      test('deletes temporary files with specified extensions', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['file1.tmp', 'file2.temp', 'file3.txt']);
        (fs.unlink as jest.Mock)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);
        (path.join as jest.Mock)
          .mockReturnValueOnce('/path/to/file1.tmp')
          .mockReturnValueOnce('/path/to/file2.temp');
  
        const result = await delete_temporary_files('/path/to', ['.tmp', '.temp']);
  
        expect(fs.readdir).toHaveBeenCalledWith('/path/to');
        expect(fs.unlink).toHaveBeenCalledTimes(2);
        expect(fs.unlink).toHaveBeenCalledWith('/path/to/file1.tmp');
        expect(fs.unlink).toHaveBeenCalledWith('/path/to/file2.temp');
        expect(result).toBe(2);
      });
  
      test('returns 0 if no temporary files found', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['file1.txt', 'file2.pdf']);
  
        const result = await delete_temporary_files('/path/to', ['.tmp', '.temp']);
  
        expect(fs.readdir).toHaveBeenCalledWith('/path/to');
        expect(fs.unlink).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });
  
      test('handles file deletion errors', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['file1.tmp']);
        (fs.unlink as jest.Mock).mockRejectedValue(new Error('Delete error'));
        (path.join as jest.Mock).mockReturnValue('/path/to/file1.tmp');
  
        await expect(delete_temporary_files('/path/to', ['.tmp'])).rejects.toThrow('Delete error');
      });
    });
  });