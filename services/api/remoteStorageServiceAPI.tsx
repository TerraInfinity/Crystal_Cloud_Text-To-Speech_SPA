// services/api/remoteStorageServiceAPI.tsx
import axios from 'axios';
import { devLog, devError, devWarn } from '../../utils/logUtils';
import { AudioFileMetaDataEntry } from 'context/types/types';
/**
 * @module RemoteStorageService
 * @description A specialized storage service implementation for managing files on a remote Python server.
 * This class is one of several storage implementations used by the main {@link StorageServiceAPI}.
 * 
 * The remote storage service handles all file operations by making HTTP requests to a Python backend server.
 * It provides a consistent interface that matches other storage implementations, allowing it to be used
 * interchangeably through the main storage service facade.
 * 
 * @requires axios - For HTTP requests
 */
interface RemoteStorageConfig {
  serverUrl?: string;
}

interface StorageMetadata {
  category?: string;
  overwrite?: boolean;
  name?: string;
  date?: string;
  [key: string]: any;
}

interface UploadResponse {
  url: string;
}

interface DeleteResponse {
  success: boolean;
  deletedConfig?: boolean;
  message?: string;
}

/**
 * @class RemoteStorageService
 * @description Manages file operations on a remote Python server.
 */
class RemoteStorageService {
  private serverUrl: string;

  /**
   * Initializes the remote storage service with the provided configuration.
   * @param config - Configuration object.
   */
  constructor(config: RemoteStorageConfig = {}) {
    this.serverUrl = config.serverUrl || process.env.SERVER_URL || 'http://localhost:5000';
    // Bind saveConfigFileRemote to ensure correct 'this' context
    this.saveConfigFileRemote = this.saveConfigFileRemote.bind(this);
  }

  /**
   * Validates that the input is a valid file object or blob.
   * @private
   * @param input - The input to validate.
   * @throws {Error} If the input is not a File or Blob.
   */
  private validateFileInput(input: any): void {
    if (!(input instanceof File) && !(input instanceof Blob)) {
      throw new Error('Input must be a File or Blob for file operations');
    }
  }

  /**
   * Uploads a file to the remote Python server using streaming.
   * @param input - The file or blob to upload.
   * @param filename - The desired filename.
   * @param contentType - The MIME type (e.g., 'audio/wav').
   * @param metadata - Metadata (e.g., { category: 'audio', overwrite: true }).
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the upload fails.
   */
  async uploadRemote(
    input: File | Blob,
    filename: string,
    contentType: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    this.validateFileInput(input);
    devLog('uploadRemote called with:', { filename, contentType, metadata });
    try {
      const formData = new FormData();
      const blobWithType = new Blob([input], { type: contentType });
      formData.append('audio', blobWithType, filename);

      if (typeof onProgress === 'function') {
        const xhr = new XMLHttpRequest();
        return new Promise((resolve, reject) => {
          xhr.open('POST', `${this.serverUrl}/upload`);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              onProgress(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve({ url: `${this.serverUrl}${data.url}` });
              } catch (parseError) {
                reject(new Error(`Failed to parse response: ${(parseError as Error).message}`));
              }
            } else {
              reject(new Error(`Server responded with status ${xhr.status}: ${xhr.responseText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          xhr.timeout = 300000; // 5 minutes
          xhr.send(formData);
        });
      } else {
        const response = await fetch(`${this.serverUrl}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          devError('Python server error response:', errorText);
          throw new Error(`Failed to upload file to Python server: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        devLog('Python server response:', data);
        return { url: `${this.serverUrl}${data.url}` };
      }
    } catch (error: any) {
      devError('Upload error:', error);
      throw new Error(`Failed to upload file to remote: ${error.message}`);
    }
  }

    /**
     * Retrieves a file from the remote Python server.
     * @param key - The filename.
     * @param isConfig - Whether the file is a configuration file (default: false).
     * @returns The file contents as a Blob.
     * @throws {Error} If the retrieval fails.
     */
    async getRemote(key: string, isConfig: boolean = false): Promise<Blob | null> {
      try {
        devLog(`getRemote called with key: ${key}, isConfig: ${isConfig}`);
        // Remove query parameters from key
        const cleanKey = key.split('?')[0];
        // Treat audio_metadata.json and .json files as config files
        const isConfigFile = isConfig || cleanKey === 'audio_metadata.json' || cleanKey.endsWith('.json');
        const endpoint = isConfigFile ? `/configs/${cleanKey}` : `/audio/${cleanKey}`;
        // Add cache-busting timestamp
        const timestamp = Date.now();
        const url = `${this.serverUrl}${endpoint}?t=${timestamp}`;
        devLog(`Fetching from URL: ${url}`);
        const response = await axios.get(url, {
          responseType: 'blob',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        return response.data;
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          devWarn(`File ${key} not found, returning null`);
          return null;
        }
        devError(`getRemote error: ${error.message}`);
        throw new Error(`Failed to retrieve file from remote: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
      }
    }

  /**
   * Deletes a file from the remote Python server.
   * @param key - The filename.
   * @param options - Additional options for deletion.
   * @returns Result object with deletion details.
   * @throws {Error} If the deletion fails.
   */
  async deleteRemote(key: string, options: { deleteConfig?: boolean } = {}): Promise<DeleteResponse> {
    try {
      const deleteConfig = options.deleteConfig === true;
      // Use /configs endpoint for config files, /audio for audio files
      const endpoint = deleteConfig ? 'configs' : 'audio';
      const url = `${this.serverUrl}/${endpoint}/${key}${deleteConfig ? '?delete_config=true' : ''}`;
      devLog(`Deleting file from server: ${url}`);
      const response = await axios.delete(url);
      devLog(`Delete response:`, response.data);
      return response.data || { success: true, deletedConfig: deleteConfig };
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        devLog(`File ${key} not found on server, treating as already deleted`);
        return { success: true, deletedConfig: options.deleteConfig || false };
      }
      devLog('Error in deleteRemote:', error);
      throw new Error(`Failed to delete file from remote: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
  }
  /**
   * Replaces a file in the remote Python server using streaming.
   * @param input - The file or blob to upload.
   * @param filename - The desired filename.
   * @param contentType - The MIME type.
   * @param metadata - Metadata (e.g., { category: 'audio', overwrite: true }).
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the replacement fails.
   */
  async replaceRemote(
    input: File | Blob,
    filename: string,
    contentType: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    this.validateFileInput(input);
    devLog('replaceRemote called with:', { filename, contentType, metadata });
    try {
      const formData = new FormData();
      const blobWithType = new Blob([input], { type: contentType });
      formData.append('audio', blobWithType, filename);

      if (typeof onProgress === 'function') {
        const xhr = new XMLHttpRequest();
        return new Promise((resolve, reject) => {
          xhr.open('PUT', `${this.serverUrl}/audio/${filename}`);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              onProgress(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve({ url: `${this.serverUrl}${data.url}` });
              } catch (parseError) {
                reject(new Error(`Failed to parse response: ${(parseError as Error).message}`));
              }
            } else {
              reject(new Error(`Server responded with status ${xhr.status}: ${xhr.responseText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during replace'));
          xhr.ontimeout = () => reject(new Error('Replace operation timed out'));
          xhr.timeout = 300000; // 5 minutes
          xhr.send(formData);
        });
      } else {
        const response = await fetch(`${this.serverUrl}/audio/${filename}`, {
          method: 'PUT',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          devError('Python server error response:', errorText);
          throw new Error(`Failed to replace file in Python server: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        devLog('Python server response:', data);
        return { url: `${this.serverUrl}${data.url}` };
      }
    } catch (error: any) {
      devError('Replace operation error:', error);
      throw new Error(`Failed to replace file in remote: ${error.message}`);
    }
  }

  /**
   * Saves a configuration file to the remote Python server.
   * @param content - The config content as a Blob.
   * @param filename - The desired filename.
   * @param contentType - The MIME type.
   * @param metadata - Metadata.
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the save fails.
   */
  async saveConfigFileRemote(
    content: Blob,
    filename: string,
    contentType: string = 'application/json',
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    try {
      this.validateFileInput(content);
      devLog('saveConfigFileRemote called with:', { filename, contentType, metadata });
  
      // Special handling for audio_metadata.json
      if (filename === 'audio_metadata.json' && !metadata.skipMerge) {
        // Parse new content
        const newText = await content.text();
        let newContent: AudioFileMetaDataEntry[] = [];
        try {
          newContent = JSON.parse(newText);
          if (!Array.isArray(newContent)) {
            devLog('New content is not an array');
            throw new Error('New metadata is not an array');
          }
          devLog('New metadata has', newContent.length, 'entries');
        } catch (error) {
          devLog('Error parsing new content:', error);
          throw new Error('Failed to parse new metadata content');
        }
  
        // If new content is empty, save it directly without merging
        if (newContent.length === 0) {
          devLog('New metadata is empty, saving directly without merging');
          const formData = new FormData();
          formData.append('file', content, filename);
          formData.append('overwrite', 'true');
  
          const uploadResponse = await fetch(`${this.serverUrl}/configs`, {
            method: 'POST',
            body: formData
          });
  
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            devLog('Failed to upload empty metadata:', errorText);
            throw new Error(`Failed to upload empty metadata: ${uploadResponse.status} ${errorText}`);
          }
  
          const result = await uploadResponse.json();
          devLog('Successfully saved empty metadata');
          return { url: `${this.serverUrl}${result.config_url}` };
        }
  
        // Load existing metadata for merging
        let existingMetadata: AudioFileMetaDataEntry[] = [];
        try {
          const timestamp = Date.now();
          const response = await fetch(`${this.serverUrl}/configs/audio_metadata.json?t=${timestamp}`, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
  
          if (response.ok) {
            const text = await response.text();
            devLog('Retrieved existing metadata, size:', text.length);
            try {
              existingMetadata = JSON.parse(text);
              if (!Array.isArray(existingMetadata)) {
                devLog('Existing metadata not an array, resetting');
                existingMetadata = [];
              } else {
                devLog('Loaded existing metadata with', existingMetadata.length, 'entries');
              }
            } catch (error) {
              devLog('Error parsing metadata JSON, resetting:', error);
              existingMetadata = [];
            }
          } else {
            devLog('No existing metadata file found, starting with empty array');
          }
        } catch (error) {
          devLog('Error fetching metadata:', error);
          existingMetadata = [];
        }
  
        // Filter out invalid entries from new content
        newContent = newContent.filter(entry => {
          return entry.id && (
            (entry.audio_url && entry.audio_url !== '') || 
            (entry.config_url && entry.config_url !== '')
          );
        });
  
        // Merge content: prioritize new content over existing
        let mergedMetadata = [...newContent];
        for (const existingEntry of existingMetadata) {
          if (!newContent.some(newEntry => newEntry.id === existingEntry.id)) {
            // Only include existing entries that are not in newContent if they have valid URLs
            if (existingEntry.audio_url || existingEntry.config_url) {
              mergedMetadata.push(existingEntry);
            }
          }
        }
  
        // Final validation
        mergedMetadata = mergedMetadata.filter(entry => 
          entry.id && (
            (entry.audio_url && entry.audio_url !== '') || 
            (entry.config_url && entry.config_url !== null && entry.config_url !== '')
          )
        );
  
        devLog('Merged metadata has', mergedMetadata.length, 'entries');
  
        // Create a form with the merged content
        const mergedContent = JSON.stringify(mergedMetadata, null, 2);
        const mergedBlob = new Blob([mergedContent], { type: 'application/json' });
  
        // Use the FormData API directly for the upload
        const formData = new FormData();
        formData.append('file', mergedBlob, filename);
        formData.append('overwrite', 'true');
  
        const uploadResponse = await fetch(`${this.serverUrl}/configs`, {
          method: 'POST',
          body: formData
        });
  
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          devLog('Failed to upload merged metadata:', errorText);
          throw new Error(`Failed to upload merged metadata: ${uploadResponse.status} ${errorText}`);
        }
  
        const result = await uploadResponse.json();
        devLog('Successfully saved merged metadata with', mergedMetadata.length, 'entries');
        return { url: `${this.serverUrl}${result.config_url}` };
      }
  
      // Normal handling for other files or when skipMerge is true
      const formData = new FormData();
      formData.append('file', content, filename);
      if (metadata.overwrite) {
        formData.append('overwrite', 'true');
      }
  
      const response = await fetch(`${this.serverUrl}/configs`, {
        method: 'POST',
        body: formData
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        devLog('Failed to save config file:', errorText);
        throw new Error(`Failed to save config file: ${response.status} ${errorText}`);
      }
  
      const result = await response.json();
      devLog('Config file saved successfully:', result);
      return { url: `${this.serverUrl}${result.config_url}` };
    } catch (error) {
      devLog('Error in saveConfigFileRemote:', error);
      throw error;
    }
  }

  
  
async getConfigFileRemote(key: string): Promise<Blob> {
    try {
      const response = await axios.get(`${this.serverUrl}/configs/${key}`, { responseType: 'blob' });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to retrieve config file from remote: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
  }
  
}

export { RemoteStorageService };
export type { RemoteStorageConfig, StorageMetadata, UploadResponse, DeleteResponse };