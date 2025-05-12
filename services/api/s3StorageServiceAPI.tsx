// services/api/s3StorageServiceAPI.tsx
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * @module S3StorageService
 * @description A specialized storage service implementation for managing files on Amazon S3.
 * This class is one of several storage implementations used by the main {@link StorageServiceAPI}.
 * 
 * The S3 storage service handles all file operations by interacting with an AWS S3 bucket.
 * It provides a consistent interface that matches other storage implementations, allowing it to be used
 * interchangeably through the main storage service facade.
 * 
 * @requires @aws-sdk/client-s3 - For interacting with AWS S3
 */
interface S3StorageConfig {
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
  s3Bucket?: string;
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

class S3StorageService {
  private s3Client: S3Client;
  private s3Bucket: string;

  /**
   * Initializes the S3 storage service with the provided configuration.
   * @param config - Configuration object.
   * @throws {Error} If required S3 configuration is missing.
   */
  constructor(config: S3StorageConfig = {}) {
    const credentials = {
      accessKeyId: config.s3AccessKey || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: config.s3SecretKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    };
    this.s3Client = new S3Client({
      credentials: credentials.accessKeyId && credentials.secretAccessKey ? credentials : undefined,
      region: config.s3Region || process.env.AWS_REGION || 'us-east-1',
    });
    this.s3Bucket = config.s3Bucket || process.env.S3_BUCKET_NAME || '';
    if (!credentials.accessKeyId || !credentials.secretAccessKey || !this.s3Bucket) {
      throw new Error('Missing S3 configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or S3_BUCKET_NAME');
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
   * Uploads a file to an AWS S3 bucket.
   * @param input - The file or blob to upload.
   * @param filename - The desired filename.
   * @param contentType - The MIME type (e.g., 'audio/wav').
   * @param metadata - Metadata to associate with the file.
   * @param onProgress - Optional callback for upload progress (not supported for S3).
   * @returns The response data with the URL.
   * @throws {Error} If the upload fails.
   */
  async uploadS3(
    input: File | Blob,
    filename: string,
    contentType: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    this.validateFileInput(input);
    const key = `${Date.now()}-${filename}`;
    const params = {
      Bucket: this.s3Bucket,
      Key: key,
      Body: input,
      ContentType: contentType,
      Metadata: Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)])),
    };
    try {
      await this.s3Client.send(new PutObjectCommand(params));
      return { url: `https://${this.s3Bucket}.s3.amazonaws.com/${key}` };
    } catch (error: any) {
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Retrieves a file from an AWS S3 bucket.
   * @param key - The file key in the S3 bucket.
   * @returns The file contents as a Blob.
   * @throws {Error} If the retrieval fails.
   */
  async getS3(key: string): Promise<Blob> {
    const params = {
      Bucket: this.s3Bucket,
      Key: key,
    };
    try {
      const data = await this.s3Client.send(new GetObjectCommand(params));
      const body = await data.Body?.transformToByteArray();
      if (!body) throw new Error('No data returned from S3');
      return new Blob([body], { type: data.ContentType || 'application/octet-stream' });
    } catch (error: any) {
      throw new Error(`Failed to retrieve file from S3: ${error.message}`);
    }
  }

  /**
   * Deletes a file from an AWS S3 bucket.
   * @param key - The file key in the S3 bucket.
   * @param options - Additional options for deletion.
   * @returns Result object with deletion details.
   * @throws {Error} If the deletion fails.
   */
  async deleteS3(key: string, options: { deleteConfig?: boolean } = {}): Promise<DeleteResponse> {
    const params = {
      Bucket: this.s3Bucket,
      Key: key,
    };
    try {
      await this.s3Client.send(new DeleteObjectCommand(params));
      let deletedConfig = false;
      if (options.deleteConfig) {
        try {
          const baseName = key.split('.').slice(0, -1).join('.');
          const configKey = `configs/${baseName}.json`;
          try {
            await this.s3Client.send(new HeadObjectCommand({ Bucket: this.s3Bucket, Key: configKey }));
            await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: configKey }));
            deletedConfig = true;
          } catch (configError) {
            // Config doesn't exist, ignore
          }
        } catch (configDeleteError) {
          console.warn(`Failed to delete config for ${key}:`, configDeleteError);
        }
      }
      return {
        success: true,
        deletedConfig,
        message: 'File deleted',
      };
    } catch (error: any) {
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Replaces a file in an AWS S3 bucket.
   * @param input - The file or blob to upload.
   * @param filename - The desired filename.
   * @param contentType - The MIME type (e.g., 'audio/wav').
   * @param metadata - Metadata to associate with the file.
   * @param onProgress - Optional callback for upload progress (not supported for S3).
   * @returns The response data with the URL.
   * @throws {Error} If the replacement fails.
   */
  async replaceS3(
    input: File | Blob,
    filename: string,
    contentType: string,
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    this.validateFileInput(input);
    const params = {
      Bucket: this.s3Bucket,
      Key: filename,
      Body: input,
      ContentType: contentType,
      Metadata: Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)])),
    };
    try {
      await this.s3Client.send(new PutObjectCommand(params));
      return { url: `https://${this.s3Bucket}.s3.amazonaws.com/${filename}` };
    } catch (error: any) {
      throw new Error(`Failed to replace file in S3: ${error.message}`);
    }
  }

  /**
   * Saves a configuration file to an AWS S3 bucket.
   * @param content - The config content as a Blob.
   * @param filename - The desired filename.
   * @param contentType - The MIME type.
   * @param metadata - Metadata.
   * @param onProgress - Optional callback for upload progress (not supported for S3).
   * @returns The response data with the URL.
   * @throws {Error} If the save fails.
   */
  async saveConfigFileS3(
    content: Blob,
    filename: string,
    contentType: string = 'application/json',
    metadata: StorageMetadata = {},
    onProgress?: (percentComplete: number) => void
  ): Promise<UploadResponse> {
    this.validateFileInput(content);
    return this.uploadS3(content, `configs/${filename}`, contentType, { ...metadata, isConfig: true }, onProgress);
  }
}

export { S3StorageService };
export type { S3StorageConfig, StorageMetadata, UploadResponse, DeleteResponse };