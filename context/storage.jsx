import axios from 'axios';

// Global storage configuration
let globalStorageConfig = {
  type: 'local',
  serverUrl: 'http://localhost:5000',
  serviceType: null
};

/**
 * Updates the global storage configuration.
 * @param {Object} config - Configuration object to merge with globalStorageConfig.
 */
export const setGlobalStorageConfig = (config) => {
  globalStorageConfig = { ...globalStorageConfig, ...config };
};

// Helper Functions for File Operations
/**
 * Uploads a file to the server and returns the absolute URL.
 * @param {File} file - The file to upload.
 * @param {string} serverUrl - The server URL.
 * @returns {string} The absolute URL of the uploaded file.
 */
const uploadFile = async (file, serverUrl, metadata = {}) => {
  const formData = new FormData();
  formData.append('audio', file);
  // Include metadata fields in FormData
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });

  try {
    const response = await axios.post(`${serverUrl}/upload`, formData);
    return `${serverUrl}${response.data.url}`;
  } catch (error) {
    throw new Error('Failed to upload file');
  }
};

/**
 * Retrieves a file from the server as a Blob.
 * @param {string} key - The file identifier (filename).
 * @param {string} serverUrl - The server URL.
 * @returns {Blob} The file data as a Blob.
 */
const getFile = async (key, serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/audio/${key}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to retrieve file');
  }
};

/**
 * Lists all audio files available on the server.
 * @param {string} serverUrl - The server URL.
 * @returns {Array} A list of file metadata.
 */
const listFiles = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/audio/list`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to list files');
  }
};

/**
 * Deletes an audio file from the server.
 * @param {string} key - The file identifier (filename).
 * @param {string} serverUrl - The server URL.
 * @returns {boolean} True if deletion is successful.
 */
const deleteFile = async (key, serverUrl) => {
  try {
    await axios.delete(`${serverUrl}/audio/${key}`);
    return true;
  } catch (error) {
    throw new Error('Failed to delete file');
  }
};

/**
 * Replaces an existing file on the server.
 * @param {string} key - The file identifier.
 * @param {File} file - The new file to upload.
 * @param {string} serverUrl - The server URL.
 * @returns {string} The updated URL of the file.
 */
const replaceFile = async (key, file, serverUrl) => {
  const formData = new FormData();
  formData.append('audio', file);
  try {
    const response = await axios.put(`${serverUrl}/audio/${key}`, formData);
    return response.data.url;
  } catch (error) {
    throw new Error('Failed to replace file');
  }
};

/**
 * Updates metadata for an audio file on the server.
 * @param {string} audioId - The UUID of the audio file.
 * @param {Object} metadata - The metadata to update (e.g., { name, placeholder, volume }).
 * @param {string} serverUrl - The server URL.
 * @returns {Object} The updated metadata from the server.
 */
export const updateFileMetadata = async (audioId, metadata, serverUrl = globalStorageConfig.serverUrl) => {
    try {
      console.log('Sending PATCH request to:', `${serverUrl}/audio/${audioId}`, 'with metadata:', metadata);
      const response = await axios.patch(`${serverUrl}/audio/${audioId}`, metadata);
      return response.data;
    } catch (error) {
      console.error('Failed to update file metadata:', {
        audioId,
        metadata,
        serverUrl,
        error: error.response ? {
          status: error.response.status,
          data: error.response.data,
        } : error.message,
      });
      throw new Error(`Failed to update file metadata: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
  };

// Main Storage Functions
/**
 * Saves data to the specified storage type.
 * @param {string} key - The key to store the value under.
 * @param {any} value - The value to store (string, object, or File).
 * @param {string} [storageType='localStorage'] - The storage type to use.
 * @returns {Promise<string|undefined>} URL for fileStorage, undefined otherwise.
 */
export const saveToStorage = async (key, value, storageType = 'localStorage', metadata = {}) => {
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
            storage.setItem(key, serialized);
          } catch (error) {
            console.error(`Failed to serialize value for ${key} in ${storageType}:`, value, error);
            throw error;
          }
        }
        break;
      case 'fileStorage':
        if (!(value instanceof File)) {
          throw new Error('Value must be a File for fileStorage');
        }
        switch (globalStorageConfig.type) {
          case 'local':
          case 'remote':
            return await uploadFile(value, globalStorageConfig.serverUrl, metadata);
          case 'service':
            throw new Error(`Unsupported service type: ${globalStorageConfig.serviceType}`);
          default:
            throw new Error(`Unsupported storage config type: ${globalStorageConfig.type}`);
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    console.error(`Failed to save ${key} to ${storageType}:`, error);
    throw error;
  }
};

/**
 * Loads data from the specified storage type.
 * @param {string} key - The key to retrieve.
 * @param {boolean} [isString=false] - Whether to return the value as a string.
 * @param {string} [storageType='localStorage'] - The storage type to use.
 * @returns {Promise<any|null>} The retrieved value or null if not found.
 */
export const loadFromStorage = async (key, isString = false, storageType = 'localStorage') => {
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
        } catch (error) {
          console.error(`Failed to parse JSON for ${key} in ${storageType}:`, value, error);
          return null;
        }
      case 'fileStorage':
        switch (globalStorageConfig.type) {
          case 'local':
          case 'remote':
            return await getFile(key, globalStorageConfig.serverUrl);
          case 'service':
            throw new Error(`Unsupported service type: ${globalStorageConfig.serviceType}`);
          default:
            throw new Error(`Unsupported storage config type: ${globalStorageConfig.type}`);
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    console.error(`Failed to load ${key} from ${storageType}:`, error);
    throw error;
  }
};

/**
 * Removes data from the specified storage type.
 * @param {string} key - The key to remove.
 * @param {string} [storageType='localStorage'] - The storage type to use.
 * @returns {Promise<void>}
 */
export const removeFromStorage = async (key, storageType = 'localStorage') => {
  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        storage.removeItem(key);
        break;
      case 'fileStorage':
        switch (globalStorageConfig.type) {
          case 'local':
          case 'remote':
            await deleteFile(key, globalStorageConfig.serverUrl);
            break;
          case 'service':
            // ... service cases ...
          default:
            throw new Error(`Unsupported storage config type: ${globalStorageConfig.type}`);
        }
        break;
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    console.error(`Failed to remove ${key} from ${storageType}:`, error);
    throw error;
  }
};

/**
 * Lists all items in the specified storage type.
 * @param {string} [storageType='localStorage'] - The storage type to list from.
 * @returns {Promise<Array>} A list of items or metadata.
 */
export const listFromStorage = async (storageType = 'localStorage') => {
  try {
    switch (storageType) {
      case 'sessionStorage':
      case 'localStorage':
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        return Object.keys(storage).map(key => ({
          key,
          value: loadFromStorage(key, false, storageType)
        }));
      case 'fileStorage':
        switch (globalStorageConfig.type) {
          case 'local':
          case 'remote':
            return await listFiles(globalStorageConfig.serverUrl);
          case 'service':
            if (globalStorageConfig.serviceType === 's3') {
              throw new Error('S3 storage not implemented');
            } else if (globalStorageConfig.serviceType === 'googleCloud') {
              throw new Error('Google Cloud storage not implemented');
            } else {
              throw new Error(`Unsupported service type: ${globalStorageConfig.serviceType}`);
            }
          default:
            throw new Error(`Unsupported storage config type: ${globalStorageConfig.type}`);
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    console.error(`Failed to list from ${storageType}:`, error);
    throw error;
  }
};

/**
 * Replaces data in the specified storage type.
 * @param {string} key - The key to replace.
 * @param {any} value - The new value (string, object, or File).
 * @param {string} [storageType='localStorage'] - The storage type to use.
 * @returns {Promise<string|undefined>} URL for fileStorage, undefined otherwise.
 */
export const replaceInStorage = async (key, value, storageType = 'localStorage') => {
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
        if (!(value instanceof File)) {
          throw new Error('Value must be a File for fileStorage');
        }
        switch (globalStorageConfig.type) {
          case 'local':
          case 'remote':
            return await replaceFile(key, value, globalStorageConfig.serverUrl);
          case 'service':
            if (globalStorageConfig.serviceType === 's3') {
              throw new Error('S3 storage not implemented');
            } else if (globalStorageConfig.serviceType === 'googleCloud') {
              throw new Error('Google Cloud storage not implemented');
            } else {
              throw new Error(`Unsupported service type: ${globalStorageConfig.serviceType}`);
            }
          default:
            throw new Error(`Unsupported storage config type: ${globalStorageConfig.type}`);
        }
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    console.error(`Failed to replace ${key} in ${storageType}:`, error);
    throw error;
  }
};