// services/api/storageServiceAPI.tsx
import { RemoteStorageService } from './remoteStorageServiceAPI';
import { S3StorageService } from './s3StorageServiceAPI';
import { GcsStorageService } from './gcsStorageServiceAPI';
import { devLog, devError, devWarn } from '../../utils/logUtils';
import { syncMetadata, MetadataAction } from 'context/fileStorageMetadataActions';
import { AudioFileMetaDataEntry } from 'context/types/types';
/**
 * @module StorageServiceAPI
 * @description The main storage service class that provides a unified interface for file storage operations.
 * This is the primary entry point for all storage operations in the application.
 * 
 * The storage service follows a facade pattern, delegating actual storage operations to specialized
 * implementation classes based on the configured backend:
 * - {@link RemoteStorageService} - Handles storage on a remote Python server
 * - {@link S3StorageService} - Handles storage on Amazon S3
 * - {@link GcsStorageService} - Handles storage on Google Cloud Storage
 * 
 * The architecture follows a strategy pattern where the specific storage implementation is selected
 * at runtime based on configuration. This allows for easy switching between storage backends without
 * changing client code.
 */
interface StorageConfig {
  fileStorageBackend?: 'remote' | 's3' | 'googleCloud';
  serverUrl?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
  s3Bucket?: string;
  gcsKeyFile?: string;
  gcsProjectId?: string;
  gcsBucket?: string;
}

interface StorageMetadata {
  category?: string;
  overwrite?: boolean;
  name?: string;
  date?: string;
  skipMerge?: boolean; // Add this
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

class StorageServiceAPI {
  private backend: 'remote' | 's3' | 'googleCloud';
  private serverUrl: string;
  private storageClient: RemoteStorageService | S3StorageService | GcsStorageService;

  /**
   * Initializes the storage service with the provided configuration.
   * @param config - Configuration object.
   * @throws {Error} If an unsupported backend is specified.
   */
  constructor(config: StorageConfig = {}) {
    const backend = config.fileStorageBackend || process.env.FILE_STORAGE_BACKEND || 'remote';
    this.backend = (['remote', 's3', 'googleCloud'] as const).includes(backend as any)
      ? (backend as 'remote' | 's3' | 'googleCloud')
      : 'remote'; // Default to 'remote' if invalid
    this.serverUrl = config.serverUrl || process.env.SERVER_URL || 'http://localhost:5000';

    const supportedBackends: ('remote' | 's3' | 'googleCloud')[] = ['remote', 's3', 'googleCloud'];
    if (!supportedBackends.includes(this.backend)) {
      throw new Error(`Unsupported backend: ${this.backend}. Supported: ${supportedBackends.join(', ')}`);
    }

    if (this.backend === 'remote') {
      this.storageClient = new RemoteStorageService({ serverUrl: this.serverUrl });
    } else if (this.backend === 's3') {
      this.storageClient = new S3StorageService(config);
    } else {
      this.storageClient = new GcsStorageService(config);
    }
  }

  /**
   * Gets the server URL for external use.
   * @returns The server URL.
   */
  public getServerUrl(): string {
    return this.serverUrl;
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
   * Uploads a file to the configured storage backend.
   * @param key - The filename.
   * @param value - The file or blob to upload.
   * @param collection - The collection or category (e.g., 'audio', 'configs').
   * @param metadata - Metadata.
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data.
   * @throws {Error} If the upload fails.
   */
  async uploadFile(
    key: string,
    value: File | Blob,
    collection: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    try {
      this.validateFileInput(value);
      const isConfigOrMetadata = collection === 'configs' || metadata.category === 'metadata' || key.endsWith('.json');
      const contentType = isConfigOrMetadata ? 'application/json' : (value.type || 'audio/wav');

      if (isConfigOrMetadata) {
        return await this.saveConfigFile(value, key, contentType, metadata, onProgress);
      } else {
        return await this.saveFile(value, key, contentType, metadata, onProgress);
      }
    } catch (error: any) {
      devError(`Error uploading ${key} to ${this.backend}:`, error);
      throw new Error(`Failed to upload ${key}: ${error.message}`);
    }
  }

  /**
   * Saves a file to the configured storage backend.
   * @param input - The file or blob to upload.
   * @param filename - The desired filename.
   * @param contentType - The MIME type.
   * @param metadata - Optional metadata.
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the upload fails.
   */
  private async saveFile(
    input: File | Blob,
    filename: string,
    contentType: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    return this.delegate('upload', input, filename, contentType, metadata, onProgress);
  }

  /**
   * Loads a file from the configured storage backend.
   * @param key - The identifier of the file.
   * @param isConfig - Whether the file is a configuration file (default: false).
   * @returns The file contents as a Blob.
   * @throws {Error} If the retrieval fails.
   */
  async loadFile(key: string, isConfig: boolean = false): Promise<Blob> {
    devLog(`loadFile called with key: ${key}, isConfig: ${isConfig}`);
    return this.delegate('get', key, isConfig);
  }
  /**
   * Removes a file from the configured storage backend.
   * @param key - The identifier of the file.
   * @param options - Additional options for deletion.
   * @returns Result object with deletion details.
   * @throws {Error} If the deletion fails.
   */
  async removeFile(key: string, options: { deleteConfig?: boolean } = {}): Promise<DeleteResponse> {
    return this.delegate('delete', key, options);
  }

  /**
   * Replaces a file in the configured storage backend.
   * @param key - The filename.
   * @param value - The file or blob to upload.
   * @param collection - The collection or category.
   * @param metadata - Metadata.
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the replacement fails.
   */
  async replaceFile(
    key: string,
    value: File | Blob,
    collection: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    try {
      this.validateFileInput(value);
      const isConfigOrMetadata = collection === 'configs' || metadata.category === 'metadata' || key.endsWith('.json');
      const contentType = isConfigOrMetadata ? 'application/json' : (value.type || 'audio/wav');

      if (isConfigOrMetadata) {
        return await this.saveConfigFile(value, key, contentType, { ...metadata, overwrite: true }, onProgress);
      } else {
        return await this.delegate('replace', value, key, contentType, metadata, onProgress);
      }
    } catch (error: any) {
      devError(`Error replacing ${key} in ${this.backend}:`, error);
      throw new Error(`Failed to replace ${key}: ${error.message}`);
    }
  }

   /**
   * Updates metadata for an audio file in the storage backend.
   * @param audioId - The UUID of the audio file.
   * @param metadata - The metadata to update.
   * @returns The response data with the updated metadata URL.
   * @throws {Error} If the update fails.
   */
  async updateMetadata(audioId: string, metadata: Record<string, any>): Promise<{ success: boolean; config_url: string }> {
    try {
      devLog('Starting updateMetadata for audioId:', audioId);
      devLog('Metadata to update:', JSON.stringify(metadata, null, 2));

      // Normalize metadata URLs
      const serverUrl = this.getServerUrl();
      const normalizedMetadata: Partial<AudioFileMetaDataEntry> = { ...metadata };

      if (normalizedMetadata.audio_url && normalizedMetadata.audio_url.startsWith(serverUrl)) {
        normalizedMetadata.audio_url = normalizedMetadata.audio_url.replace(serverUrl, '');
      }

      if (normalizedMetadata.config_url && normalizedMetadata.config_url.startsWith(serverUrl)) {
        normalizedMetadata.config_url = normalizedMetadata.config_url.replace(serverUrl, '');
      }

      devLog('Normalized metadata before sync:', JSON.stringify(normalizedMetadata, null, 2));

      // Use syncMetadata to update the metadata entry
      const action: MetadataAction = {
        type: 'append',
        payload: normalizedMetadata as AudioFileMetaDataEntry,
      };

      const syncedCount = await syncMetadata(serverUrl, action);
      devLog('Synced metadata with', syncedCount, 'entries');

      if (syncedCount === 0) {
        throw new Error('No entries synced to audio_metadata.json');
      }

      devLog('Metadata update request completed successfully');
      return { success: true, config_url: `${serverUrl}/configs/audio_metadata.json` };
    } catch (error: any) {
      devLog('Error in updateMetadata:', error.message, error.stack);
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }


  /**
   * Lists all files in the storage backend.
   * @returns A list of file metadata.
   * @throws {Error} If the listing fails.
   */
  async listFiles(): Promise<any[]> {
    try {
      const blob = await this.loadFile('audio_metadata.json', true); // Use isConfig: true
      const text = await blob.text();
      const metadata = JSON.parse(text);
      return Array.isArray(metadata) ? metadata : [];
    } catch (error) {
      devWarn('Metadata not found, returning empty array');
      return [];
    }
  }

  /**
   * Saves a configuration file to the configured storage backend.
   * @param content - The JSON content.
   * @param filename - The desired filename.
   * @param contentType - The MIME type.
   * @param metadata - Optional metadata.
   * @param onProgress - Optional callback for upload progress.
   * @returns The response data with the URL.
   * @throws {Error} If the save fails.
   */
  private async saveConfigFile(
    content: Blob,
    filename: string,
    contentType: string = 'application/json',
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    return this.delegate('saveConfigFile', content, filename, contentType, metadata, onProgress);
  }

  /**
   * Delegates an operation to the appropriate backend-specific method.
   * @private
   * @param operation - The operation to perform.
   * @param args - Arguments to pass.
   * @returns The result of the backend-specific method.
   * @throws {Error} If the operation is not supported.
   */
  private async delegate<T>(operation: string, ...args: any[]): Promise<T> {
    const methodName = `${operation}${this.backend.charAt(0).toUpperCase() + this.backend.slice(1)}` as keyof typeof this.storageClient;
    const method = this.storageClient[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Operation ${operation} not supported for backend: ${this.backend}`);
    }
    return (method as (...args: any[]) => Promise<T>).bind(this.storageClient)(...args);
  }
}

export { StorageServiceAPI };
export type { StorageConfig, StorageMetadata, UploadResponse, DeleteResponse };