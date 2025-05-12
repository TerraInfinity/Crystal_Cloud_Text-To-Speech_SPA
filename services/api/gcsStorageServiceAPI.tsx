// services/api/gcsStorageServiceAPI.tsx
import { devWarn } from '../../utils/logUtils';

/**
 * @module GcsStorageService
 * @description A specialized storage service implementation for managing files on Google Cloud Storage.
 * This class is one of several storage implementations used by the main {@link StorageServiceAPI}.
 *
 * The GCS storage service handles all file operations by interacting with a Google Cloud Storage bucket.
 * It provides a consistent interface that matches other storage implementations, allowing it to be used
 * interchangeably through the main storage service facade.
 *
 * @requires @google-cloud/storage - For interacting with Google Cloud Storage
 * @note This module is intended for server-side use only (e.g., API routes, getServerSideProps).
 *       Do not import directly into client-side components or contexts.
 */

interface GcsStorageConfig {
    gcsKeyFile?: string;
    gcsProjectId?: string;
    gcsBucket?: string;
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
  
  // Ensure server-side only execution
  let Storage: any;
  if (typeof window === 'undefined') {
    Storage = require('@google-cloud/storage').Storage;
  }
  
  class GcsStorageService {
    private gcsClient: any;
    private gcsBucket: string;
  
    /**
     * Initializes the GCS storage service with the provided configuration.
     * @param config - Configuration object.
     * @throws {Error} If required GCS configuration is missing or if used client-side.
     */
    constructor(config: GcsStorageConfig = {}) {
      if (typeof window !== 'undefined') {
        throw new Error('GcsStorageService cannot be used in a client-side context');
      }
  
      this.gcsClient = new Storage({
        keyFilename: config.gcsKeyFile || process.env.GCS_KEY_FILE,
        projectId: config.gcsProjectId || process.env.GCS_PROJECT_ID,
      });
      this.gcsBucket = config.gcsBucket || process.env.GCS_BUCKET_NAME || '';
      if (!this.gcsBucket) {
        throw new Error('Missing Google Cloud configuration: GCS_BUCKET_NAME');
      }
  
      // Optionally validate credentials by attempting a lightweight operation
      try {
        this.gcsClient.getBuckets(); // This will throw if credentials are invalid
      } catch (error) {
        throw new Error('Invalid Google Cloud credentials: Unable to initialize client');
      }
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
     * Uploads a file to a Google Cloud Storage bucket.
     * @param input - The file or blob to upload.
     * @param filename - The desired filename.
     * @param contentType - The MIME type (e.g., 'audio/wav').
     * @param metadata - Metadata to associate with the file.
     * @param onProgress - Optional callback for upload progress (not supported for GCS).
     * @returns The response data with the URL.
     * @throws {Error} If the upload fails.
     */
    async uploadGoogleCloud(
      input: File | Blob,
      filename: string,
      contentType: string,
      metadata: StorageMetadata = {},
      onProgress?: (percentComplete: number) => void
    ): Promise<UploadResponse> {
      this.validateFileInput(input);
      const key = `${Date.now()}-${filename}`;
      const bucket = this.gcsClient.bucket(this.gcsBucket);
      const blob = bucket.file(key);
      try {
        const buffer = await input.arrayBuffer();
        await blob.save(Buffer.from(buffer), {
          contentType,
          metadata: { metadata },
        });
        return { url: `https://storage.googleapis.com/${this.gcsBucket}/${key}` };
      } catch (error: any) {
        throw new Error(`Failed to upload file to Google Cloud: ${error.message}`);
      }
    }
  
    /**
     * Retrieves a file from a Google Cloud Storage bucket.
     * @param key - The file key in the bucket.
     * @returns The file contents as a Blob.
     * @throws {Error} If the retrieval fails.
     */
    async getGoogleCloud(key: string): Promise<Blob> {
      const bucket = this.gcsClient.bucket(this.gcsBucket);
      const file = bucket.file(key);
      try {
        const [contents] = await file.download();
        const [metadata] = await file.getMetadata();
        return new Blob([contents], { type: metadata.contentType || 'application/octet-stream' });
      } catch (error: any) {
        throw new Error(`Failed to retrieve file from Google Cloud: ${error.message}`);
      }
    }
  
    /**
     * Deletes a file from a Google Cloud Storage bucket.
     * @param key - The file key in the bucket.
     * @param options - Additional options for deletion.
     * @returns Result object with deletion details.
     * @throws {Error} If the deletion fails.
     */
    async deleteGoogleCloud(key: string, options: { deleteConfig?: boolean } = {}): Promise<DeleteResponse> {
      const bucket = this.gcsClient.bucket(this.gcsBucket);
      const file = bucket.file(key);
      try {
        await file.delete();
        let deletedConfig = false;
        if (options.deleteConfig) {
          try {
            const baseName = key.split('.').slice(0, -1).join('.');
            const configKey = `configs/${baseName}.json`;
            const configFile = bucket.file(configKey);
            const [exists] = await configFile.exists();
            if (exists) {
              await configFile.delete();
              deletedConfig = true;
            }
          } catch (configDeleteError) {
            devWarn(`Failed to delete config for ${key}:`, configDeleteError);
          }
        }
        return {
          success: true,
          deletedConfig,
          message: 'File deleted',
        };
      } catch (error: any) {
        throw new Error(`Failed to delete file from Google Cloud: ${error.message}`);
      }
    }
  
    /**
     * Replaces a file in a Google Cloud Storage bucket.
     * @param input - The file or blob to upload.
     * @param filename - The desired filename.
     * @param contentType - The MIME type (e.g., 'audio/wav').
     * @param metadata - Metadata to associate with the file.
     * @param onProgress - Optional callback for upload progress (not supported for GCS).
     * @returns The response data with the URL.
     * @throws {Error} If the replacement fails.
     */
    async replaceGoogleCloud(
      input: File | Blob,
      filename: string,
      contentType: string,
      metadata: StorageMetadata = {},
      onProgress?: (percentComplete: number) => void
    ): Promise<UploadResponse> {
      this.validateFileInput(input);
      const bucket = this.gcsClient.bucket(this.gcsBucket);
      const blob = bucket.file(filename);
      try {
        const buffer = await input.arrayBuffer();
        await blob.save(Buffer.from(buffer), {
          contentType,
          metadata: { metadata },
        });
        return { url: `https://storage.googleapis.com/${this.gcsBucket}/${filename}` };
      } catch (error: any) {
        throw new Error(`Failed to replace file in Google Cloud: ${error.message}`);
      }
    }
  
    /**
     * Saves a configuration file to a Google Cloud Storage bucket.
     * @param content - The config content as a Blob.
     * @param filename - The desired filename.
     * @param contentType - The MIME type.
     * @param metadata - Metadata.
     * @param onProgress - Optional callback for upload progress (not supported for GCS).
     * @returns The response data with the URL.
     * @throws {Error} If the save fails.
     */
    async saveConfigFileGoogleCloud(
      content: Blob,
      filename: string,
      contentType: string = 'application/json',
      metadata: StorageMetadata = {},
      onProgress?: (percentComplete: number) => void
    ): Promise<UploadResponse> {
      this.validateFileInput(content);
      return this.uploadGoogleCloud(content, `configs/${filename}`, contentType, { ...metadata, isConfig: true }, onProgress);
    }
  }
  
  export { GcsStorageService };
  export type { GcsStorageConfig, StorageMetadata, UploadResponse, DeleteResponse };