// context/storage.tsx
import { devLog, devError, devWarn } from '../utils/logUtils';
import { StorageServiceAPI, StorageMetadata, StorageConfig } from '../services/api/storageServiceAPI';

/**
 * @module storage
 * @description A collection of utility functions for managing client-side and server-side storage operations. Supports `localStorage`, `sessionStorage`, and `fileStorage` (server-side file operations). This module provides a high-level abstraction for storing, retrieving, updating, and removing data, delegating all server-side operations for `fileStorage` to the `StorageServiceAPI` (defined in `services/api/storageServiceAPI.tsx`).
 * 
 * **Relationship with `StorageServiceAPI`:**  
 * The `storage.tsx` module is responsible for client-side storage logic (e.g., `localStorage`, `sessionStorage`, input validation, quota management, and progress tracking) and orchestrating file operations. For `fileStorage`, it delegates all server interactions (e.g., uploading, downloading, deleting, or replacing files) to `StorageServiceAPI`, which is the sole interface for communicating with the file server or cloud storage backends (remote Python server, AWS S3, Google Cloud Storage). This separation ensures that `storage.tsx` focuses on client-side concerns, while `StorageServiceAPI` handles server-specific logic, such as correctly formatting `FormData` with the `'file'` key for metadata files like `audio_metadata.json` and ensuring `overwrite: true` to prevent duplicate files. By centralizing server interactions in `StorageServiceAPI`, the application avoids issues like inconsistent metadata handling or duplicate `audio_metadata_*.json` files.
 * 
 * @requires ../utils/logUtils - For logging utilities (`devLog`, `devError`, `devWarn`).
 * @requires ../services/api/storageServiceAPI - For server-side file operations in `fileStorage` mode.
 * @example
 * // Example: Saving a metadata file
 * import { saveToStorage } from './storage';
 * 
 * const metadata = JSON.stringify([{ id: 'audio1', name: 'Track 1' }]);
 * const blob = new Blob([metadata], { type: 'application/json' });
 * 
 * saveToStorage(
 *   'audio_metadata.json',
 *   blob,
 *   'fileStorage',
 *   { category: 'metadata', overwrite: true },
 *   (percent) => console.log(`Upload progress: ${percent}%`)
 * ).then(url => console.log(`Saved at: ${url}`));
 * 
 * // Example: Saving to localStorage
 * saveToStorage('userSettings', { theme: 'dark' }, 'localStorage')
 *   .then(() => console.log('Settings saved'));
 */

/**
 * @typedef {'sessionStorage' | 'localStorage' | 'fileStorage'} StorageType
 * @description Union type for supported storage types.
 */
export type StorageType = 'sessionStorage' | 'localStorage' | 'fileStorage';

/**
 * @interface RemoveFromStorageOptions
 * @description Options for `removeFromStorage`.
 * @property {boolean} [deleteConfig] - Whether to delete associated config file (for `fileStorage`).
 */
interface RemoveFromStorageOptions {
  deleteConfig?: boolean;
}

/**
 * @type {Object}
 * @description Global storage configuration for server-side operations.
 * @property {string} type - Storage type ('local', 'remote', 'service'; for backward compatibility).
 * @property {string} serverUrl - URL of the remote Python server (default: 'http://localhost:5000').
 * @property {string|null} serviceType - For future service-specific configurations (default: null).
 * @property {'remote' | 's3' | 'googleCloud'} fileStorageBackend - Backend for fileStorage (default: 'remote').
 */
let globalStorageConfig: StorageConfig & {
  type: string;
  serviceType: string | null;
} = {
  type: 'remote',
  serverUrl: 'http://localhost:5000',
  serviceType: null,
  fileStorageBackend: 'remote',
};

/**
 * Updates the global storage configuration.
 * @param config - Configuration object to merge with `globalStorageConfig`.
 * @returns {void}
 * @example
 * setGlobalStorageConfig({ serverUrl: 'https://api.example.com', fileStorageBackend: 's3' });
 */
export const setGlobalStorageConfig = (config: Partial<typeof globalStorageConfig>): void => {
  globalStorageConfig = { ...globalStorageConfig, ...config };
};

/**
 * Updates metadata for an audio file using the configured storage backend.
 * Delegates to `StorageServiceAPI.updateMetadata` for server-side metadata updates.
 * 
 * @param audioId - The UUID of the audio file.
 * @param metadata - The metadata to update (e.g., { name, placeholder, volume }).
 * @param serverUrl - The server URL (for backward compatibility; defaults to globalStorageConfig.serverUrl).
 * @returns The updated metadata from the backend.
 * @throws If the metadata update fails.
 * @example
 * await updateFileMetadata('123e4567', { name: 'Song', volume: 0.8 });
 */
export const updateFileMetadata = async (
  audioId: string,
  metadata: Record<string, any>,
  serverUrl: string = globalStorageConfig.serverUrl
): Promise<any> => {
  try {
    devLog('Updating metadata for:', audioId, 'with metadata:', metadata);
    const response = await new StorageServiceAPI({ serverUrl, fileStorageBackend: globalStorageConfig.fileStorageBackend }).updateMetadata(audioId, metadata);
    devLog('Metadata updated successfully:', response);
    return response;
  } catch (error: any) {
    devError('Failed to update file metadata:', {
      audioId,
      metadata,
      serverUrl,
      error: error.message,
    });
    throw new Error(`Failed to update file metadata: ${error.message}`);
  }
};

/**
 * Helper function to estimate storage size usage for `localStorage` or `sessionStorage`.
 * @private
 * @param storage - The storage object (`localStorage` or `sessionStorage`).
 * @returns Estimated size in bytes.
 */
const estimateStorageSize = (storage: Storage): number => {
  let totalSize = 0;
  for (const key in storage) {
    if (Object.prototype.hasOwnProperty.call(storage, key)) {
      totalSize += (key.length + (storage[key] ? storage[key].length : 0)) * 2; // UTF-16 characters (2 bytes each)
    }
  }
  return totalSize;
};

/**
 * Handles quota exceeded errors by attempting to free up space in `localStorage` or `sessionStorage`.
 * @private
 * @param storage - The storage object (`localStorage` or `sessionStorage`).
 * @param key - The key being saved.
 * @param value - The value being saved.
 * @returns True if successfully handled, false otherwise.
 */
const handleQuotaExceeded = (storage: Storage, key: string, value: string): boolean => {
  try {
    const currentKeys = Object.keys(storage).filter((k) => k !== key);
    if (currentKeys.length > 0) {
      devLog(`Storage quota exceeded. Trying to free up space by removing ${currentKeys.length} items`);
      currentKeys.forEach((k) => storage.removeItem(k));
      storage.setItem(key, value);
      return true;
    }

    devLog('Still not enough space. Clearing all storage');
    storage.clear();
    storage.setItem(key, value);
    return true;
  } catch (error: any) {
    devError('Failed to handle quota exceeded error:', error);
    return false;
  }
};

/**
 * Saves data to the specified storage type.
 * For `fileStorage`, delegates to `StorageServiceAPI.uploadFile` to handle server-side uploads.
 * 
 * @param key - The key to store the value under.
 * @param value - The value to store (string or object for `localStorage`/`sessionStorage`, File/Blob for `fileStorage`).
 * @param storageType - The storage type to use.
 * @param metadata - Optional metadata for `fileStorage` (e.g., { category: 'metadata', overwrite: true }).
 * @param onProgress - Optional callback for upload progress (percentage from 0 to 100, for `fileStorage`).
 * @returns URL for `fileStorage` uploads, undefined for other storage types.
 * @throws If the save operation fails or the storage type is unsupported.
 * @example
 * // Save to localStorage
 * await saveToStorage('userSettings', { theme: 'dark' });
 * 
 * // Save audio file to fileStorage
 * await saveToStorage('song.mp3', audioFile, 'fileStorage', { category: 'audio' }, (progress) => console.log(`${progress}%`));
 * 
 * // Save metadata file to fileStorage
 * await saveToStorage('audio_metadata.json', metadataBlob, 'fileStorage', { category: 'metadata', overwrite: true });
 */
export const saveToStorage = async (
  key: string,
  value: any,
  storageType: StorageType = 'localStorage',
  metadata: StorageMetadata = {},
  onProgress?: (percentComplete: number) => void
): Promise<string | undefined> => {
  const validStorageTypes: StorageType[] = ['sessionStorage', 'localStorage', 'fileStorage'];
  if (!validStorageTypes.includes(storageType)) {
    devError(`Invalid storage type: ${storageType}`);
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        if (value === undefined || value === null) {
          storage.removeItem(key);
        } else if (typeof value === 'string') {
          storage.setItem(key, value);
        } else {
          try {
            const serialized = JSON.stringify(value);
            const serializedSize = serialized.length * 2;
            const storageSize = estimateStorageSize(storage);

            devLog(
              `Saving ${key} to ${storageType}. Size: ${serializedSize} bytes, Current storage usage: ${storageSize} bytes`
            );

            storage.setItem(key, serialized);
          } catch (error: any) {
            if (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014) {
              devError(`Storage quota exceeded for ${key} in ${storageType}`);
              const serialized = JSON.stringify(value);
              if (handleQuotaExceeded(storage, key, serialized)) {
                devLog('Successfully recovered from quota exceeded error');
              } else {
                throw new Error(
                  `Storage quota exceeded for ${key}. The data is too large (${serialized.length * 2} bytes). Try reducing the amount of data stored.`
                );
              }
            } else {
              devError(`Failed to serialize value for ${key} in ${storageType}:`, error);
              throw error;
            }
          }
        }
        break;
      case 'fileStorage':
        if (!(value instanceof File) && !(value instanceof Blob)) {
          throw new Error('Value must be a File or Blob for fileStorage');
        }

        const isJsonFile = value.type === 'application/json';
        const isMetadataOrConfig =
          metadata.category === 'metadata' ||
          metadata.category === 'merged_audio_config' ||
          key === 'audio_metadata.json';
        const isValidFileType =
          value.type.startsWith('audio/') || (isJsonFile && isMetadataOrConfig);

        if (!isValidFileType) {
          throw new Error(
            `Invalid file type for fileStorage: ${value.type}. Must be an audio file or a JSON file with metadata/config category.`
          );
        }

        try {
          devLog(`Delegating upload of ${key} to StorageServiceAPI`);
          const collection = isJsonFile && isMetadataOrConfig ? 'configs' : 'audio';
          const response = await new StorageServiceAPI({
            serverUrl: globalStorageConfig.serverUrl,
            fileStorageBackend: globalStorageConfig.fileStorageBackend,
          }).uploadFile(key, value, collection, metadata, onProgress);
          devLog(`File uploaded successfully: ${response.url}`);
          return response.url;
        } catch (error: any) {
          devError('File upload error details:', error);
          throw new Error(`Failed to upload file: ${error.message}`);
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error: any) {
    devError(`Failed to save ${key} to ${storageType}:`, error);
    throw error;
  }
};

/**
 * Loads data from the specified storage type.
 * For `fileStorage`, delegates to `StorageServiceAPI.loadFile` to retrieve files from the server.
 * 
 * @param key - The key to retrieve.
 * @param isString - Whether to return the value as a string (for `sessionStorage`/`localStorage`).
 * @param storageType - The storage type to use.
 * @returns The retrieved value or null if not found.
 * @throws If the load operation fails or the storage type is unsupported.
 * @example
 * const settings = await loadFromStorage('userSettings');
 * const audioFile = await loadFromStorage('song.mp3', false, 'fileStorage');
 */
export const loadFromStorage = async (
  key: string,
  isString: boolean = false,
  storageType: StorageType = 'localStorage'
): Promise<any | null> => {
  const validStorageTypes: StorageType[] = ['sessionStorage', 'localStorage', 'fileStorage'];
  if (!validStorageTypes.includes(storageType)) {
    devError(`Invalid storage type: ${storageType}`);
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        const value = storage.getItem(key);
        if (value === null || value === 'undefined') {
          return null;
        }
        if (isString) {
          return value;
        }
        try {
          const parsed = JSON.parse(value);
          return parsed;
        } catch (error: any) {
          devError(`Failed to parse JSON for ${key} in ${storageType}:`, error);
          return null;
        }
      case 'fileStorage':
        // Strip query parameters from key for isConfig check
        const cleanKey = key.split('?')[0];
        const blob = await new StorageServiceAPI({
          serverUrl: globalStorageConfig.serverUrl,
          fileStorageBackend: globalStorageConfig.fileStorageBackend,
        }).loadFile(key, cleanKey === 'audio_metadata.json'); // Use cleanKey for isConfig
        return blob;
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error: any) {
    devError(`Failed to load ${key} from ${storageType}:`, error);
    throw error;
  }
};

/**
 * Removes data from the specified storage type.
 * For `fileStorage`, delegates to `StorageServiceAPI.removeFile` to handle server-side deletion.
 * 
 * @param key - The key to remove.
 * @param storageType - The storage type to use.
 * @param options - Additional options.
 * @returns For `fileStorage`, returns deletion result object; otherwise void.
 * @throws If the remove operation fails or the storage type is unsupported.
 * @example
 * await removeFromStorage('userSettings');
 * await removeFromStorage('song.mp3', 'fileStorage', { deleteConfig: true });
 */
export const removeFromStorage = async (
  key: string,
  storageType: StorageType = 'localStorage',
  options: RemoveFromStorageOptions = {}
): Promise<any | void> => {
  const validStorageTypes: StorageType[] = ['sessionStorage', 'localStorage', 'fileStorage'];
  if (!validStorageTypes.includes(storageType)) {
    devError(`Invalid storage type: ${storageType}`);
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        storage.removeItem(key);
        break;
      case 'fileStorage':
        const result = await new StorageServiceAPI({
          serverUrl: globalStorageConfig.serverUrl,
          fileStorageBackend: globalStorageConfig.fileStorageBackend,
        }).removeFile(key, options);
        devLog(`Successfully deleted file ${key} from fileStorage:`, result);
        return result;
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error: any) {
    devError(`Failed to remove ${key} from ${storageType}:`, error);
    throw error;
  }
};

/**
 * Cache for `fileStorage` list results to reduce server requests.
 * @private
 * @type {Object}
 * @property {any[]|null} list - Cached list of files.
 * @property {number|null} timestamp - Timestamp of the last cache update.
 * @property {number} expiryTime - Cache expiry time in milliseconds (default: 5000).
 */
const fileStorageCache: {
  list: any[] | null;
  timestamp: number | null;
  expiryTime: number;
} = {
  list: null,
  timestamp: null,
  expiryTime: 5000,
};

/**
 * Retries a function with exponential backoff to handle rate limits.
 * @private
 * @param fn - The function to retry.
 * @param retries - Maximum number of retries.
 * @param delay - Initial delay in milliseconds.
 * @returns The result of the function.
 * @throws If all retries fail.
 */
const retryWithBackoff = async function <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        devLog(`Rate limit hit (429), retrying after ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Retry limit reached');
};

/**
 * Lists all items in the specified storage type.
 * For `fileStorage`, fetches `audio_metadata.json` from the server to retrieve file history metadata.
 * 
 * @param storageType - The storage type to list from.
 * @returns A list of items or metadata (empty array if `audio_metadata.json` is not found or invalid).
 * @throws If the storage type is unsupported.
 * @example
 * const localItems = await listFromStorage('localStorage');
 * const fileList = await listFromStorage('fileStorage');
 */
export const listFromStorage = async function (storageType: StorageType = 'localStorage'): Promise<any[]> {
  const validStorageTypes: StorageType[] = ['sessionStorage', 'localStorage', 'fileStorage'];
  if (!validStorageTypes.includes(storageType)) {
    devError(`Invalid storage type: ${storageType}`);
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        return Object.keys(storage).map((key) => ({
          key,
          value: loadFromStorage(key, false, storageType),
        }));
      case 'fileStorage':
        try {
          const now = Date.now();
          if (fileStorageCache.list && fileStorageCache.timestamp && now - fileStorageCache.timestamp < fileStorageCache.expiryTime) {
            devLog('Using cached file list from storage service');
            return [...fileStorageCache.list];
          }

          const makeApiCall = async () => {
            const storageService = new StorageServiceAPI({
              serverUrl: globalStorageConfig.serverUrl,
              fileStorageBackend: globalStorageConfig.fileStorageBackend,
            });
            // Fetch audio_metadata.json from /configs/
            const metadataBlob = await storageService.loadFile('audio_metadata.json', true); // isConfig: true
            const metadataText = await metadataBlob.text();
            const metadata = JSON.parse(metadataText);
            
            if (!Array.isArray(metadata)) {
              devWarn('audio_metadata.json is not an array, returning empty array');
              return [];
            }
            
            return metadata;
          };

          const data = await retryWithBackoff(makeApiCall, 3, 1000);
          fileStorageCache.list = [...data];
          fileStorageCache.timestamp = now;
          devLog(`Fetched ${data.length} entries from audio_metadata.json`);
          return data;
        } catch (apiError: any) {
          if (apiError.message.includes('404')) {
            devLog('audio_metadata.json not found, returning empty array');
            return [];
          }
          devWarn('Error fetching audio_metadata.json, returning empty array:', apiError);
          return [];
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error: any) {
    devError(`Failed to list from ${storageType}:`, error);
    return [];
  }
};

/**
 * Replaces data in the specified storage type.
 * For `fileStorage`, delegates to `StorageServiceAPI.replaceFile` to handle server-side replacement.
 * 
 * @param key - The key to replace.
 * @param value - The new value (string or object for `localStorage`/`sessionStorage`, File/Blob for `fileStorage`).
 * @param storageType - The storage type to use.
 * @param metadata - Optional metadata for `fileStorage` (e.g., { category: 'audio' }).
 * @returns URL for `fileStorage` replacements, undefined for other storage types.
 * @throws If the replace operation fails or the storage type is unsupported.
 * @example
 * await replaceInStorage('userSettings', { theme: 'light' });
 * await replaceInStorage('song.mp3', newAudioFile, 'fileStorage', { category: 'audio' });
 */
export const replaceInStorage = async function (
  key: string,
  value: any,
  storageType: StorageType = 'localStorage',
  metadata: StorageMetadata = {}
): Promise<string | undefined> {
  const validStorageTypes: StorageType[] = ['sessionStorage', 'localStorage', 'fileStorage'];
  if (!validStorageTypes.includes(storageType)) {
    devError(`Invalid storage type: ${storageType}`);
    throw new Error(`Unsupported storage type: ${storageType}`);
  }

  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        if (typeof value === 'string') {
          storage.setItem(key, value);
        } else {
          storage.setItem(key, JSON.stringify(value));
        }
        break;
      case 'fileStorage':
        if (!(value instanceof File) && !(value instanceof Blob)) {
          throw new Error('Value must be a File or Blob for fileStorage');
        }
        const isJsonFile = value.type === 'application/json';
        const isMetadataOrConfig =
          metadata.category === 'metadata' ||
          metadata.category === 'merged_audio_config' ||
          key === 'audio_metadata.json';
        const isValidFileType =
          value.type.startsWith('audio/') || (isJsonFile && isMetadataOrConfig);

        if (!isValidFileType) {
          throw new Error(
            `Invalid file type for fileStorage: ${value.type}. Must be an audio file or a JSON file with metadata/config category.`
          );
        }

        try {
          devLog(`Delegating replacement of ${key} to StorageServiceAPI`);
          const collection = isJsonFile && isMetadataOrConfig ? 'configs' : 'audio';
          const response = await new StorageServiceAPI({
            serverUrl: globalStorageConfig.serverUrl,
            fileStorageBackend: globalStorageConfig.fileStorageBackend,
          }).replaceFile(key, value, collection, metadata);
          devLog(`File replaced successfully: ${response.url}`);
          return response.url;
        } catch (error: any) {
          devError(`Failed to replace ${key} in fileStorage:`, error);
          throw error;
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error: any) {
    devError(`Failed to replace ${key} in ${storageType}:`, error);
    throw error;
  }
};