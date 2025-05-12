// services/api/mergeAudioAPI.tsx
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { StorageServiceAPI, StorageMetadata, UploadResponse } from './storageServiceAPI';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Development logging helper function
 * Only logs to console in non-production environments
 * @param args - Arguments to log to console
 */
const devLog = (...args: any[]): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mergeAudioAPI]', ...args);
  }
};

/**
 * Saves a data URL to a temporary file and normalizes audio format
 * @param dataUrl - The data URL containing the audio
 * @param index - The index of the file for naming
 * @returns The path to the normalized file
 */
async function saveDataUrlToTempFile(dataUrl: string, index: number): Promise<string> {
  try {
    const [header, base64Data] = dataUrl.split(',');
    const mimeTypeMatch = header.match(/:(.*?);/);
    if (!mimeTypeMatch) throw new Error('Invalid data URL format');
    const mimeType = mimeTypeMatch[1];
    const mimeToExt: { [key: string]: string } = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-pn-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/flac': 'flac',
    };
    const extension = mimeToExt[mimeType] || 'wav';
    const fileName = `input-${index}-${uuidv4()}.${extension}`;
    const tempDir = path.join(os.tmpdir(), 'audio-merge-temp');
    const tempFilePath = path.join(tempDir, fileName);
    const normalizedFilePath = path.join(tempDir, `normalized-${index}-${uuidv4()}.wav`);

    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tempFilePath, buffer);
    const stats = await fs.stat(tempFilePath);
    if (stats.size < 44) {
      throw new Error(`Temporary file is too small (possible invalid WAV): ${tempFilePath}`);
    }
    devLog(`Saved data URL ${index} to temp file: ${tempFilePath}, Size: ${stats.size} bytes`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempFilePath)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .on('error', (err) => {
          devLog(`Failed to normalize file ${index}:`, err);
          reject(err);
        })
        .on('end', () => {
          devLog(`Normalized file ${index} to: ${normalizedFilePath}`);
          resolve();
        })
        .save(normalizedFilePath);
    });

    return normalizedFilePath;
  } catch (error) {
    devLog(`Failed to save data URL ${index}:`, error);
    throw error;
  }
}

/**
 * Downloads a remote audio file and normalizes it
 * @param url - The URL of the remote audio file
 * @param index - The index of the file for naming
 * @returns The path to the normalized file
 */
async function downloadFileToTemp(url: string, index: number): Promise<string> {
  try {
    const fileName = `input-${index}-${uuidv4()}.wav`;
    const tempDir = path.join(os.tmpdir(), 'audio-merge-temp');
    const tempFilePath = path.join(tempDir, fileName);
    const normalizedFilePath = path.join(tempDir, `normalized-${index}-${uuidv4()}.wav`);

    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);
    const stats = await fs.stat(tempFilePath);
    if (stats.size < 44) {
      throw new Error(`Downloaded file is too small (possible invalid WAV): ${tempFilePath}`);
    }
    devLog(`Downloaded remote file ${index} to: ${tempFilePath}, Size: ${stats.size} bytes`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempFilePath)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .on('error', (err) => {
          devLog(`Failed to normalize file ${index}:`, err);
          reject(err);
        })
        .on('end', () => {
          devLog(`Normalized file ${index} to: ${normalizedFilePath}`);
          resolve();
        })
        .save(normalizedFilePath);
    });

    return normalizedFilePath;
  } catch (error) {
    devLog(`Failed to download file ${index} from ${url}:`, error);
    throw error;
  }
}

/**
 * Merges multiple audio files into a single WAV file
 * @param audioUrls - Array of audio URLs or file paths
 * @param metadata - Metadata for the merged file
 * @returns The path to the merged file
 */
async function mergeAudioFiles(audioUrls: string[], metadata: StorageMetadata = {}): Promise<string> {
  const tempFiles: string[] = [];
  let outputFilePath: string;

  const baseName = metadata.name
    ? metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').replace(/\.+/g, '').substring(0, 50)
    : `merged-audio-${Date.now()}`;
  outputFilePath = path.join(os.tmpdir(), `${baseName}.wav`);

  devLog('Temporary output file path:', outputFilePath);

  try {
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i];
      let tempFile: string;
      if (url.startsWith('data:')) {
        tempFile = await saveDataUrlToTempFile(url, i);
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        tempFile = await downloadFileToTemp(url, i);
      } else {
        tempFile = url;
        devLog(`Assuming local file path for input ${i} (may fail):`, tempFile);
      }
      tempFiles.push(tempFile);
    }

    for (const file of tempFiles) {
      if (!existsSync(file)) {
        throw new Error(`Temporary file does not exist: ${file}`);
      }
      const stats = await fs.stat(file);
      devLog('Validated temp file:', file, 'Size:', stats.size);
    }

    const ffmpegPromise = new Promise<string>((resolve, reject) => {
      const command = ffmpeg();
      tempFiles.forEach((file) => {
        command.input(file);
      });
      const filterComplex = tempFiles.map((_, i) => `[${i}:a]`).join('') + `concat=n=${tempFiles.length}:v=0:a=1[outa]`;
      command
        .complexFilter(filterComplex, 'outa')
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .format('wav')
        .on('start', (cmdLine) => devLog('FFmpeg started:', cmdLine))
        .on('error', (err, stdout, stderr) => {
          devLog('FFmpeg error:', err);
          devLog('FFmpeg stdout:', stdout);
          devLog('FFmpeg stderr:', stderr);
          reject(err);
        })
        .on('end', async () => {
          devLog('FFmpeg merge finished, output:', outputFilePath);
          for (const file of tempFiles) {
            try {
              await fs.unlink(file);
              devLog(`Deleted temp file: ${file}`);
            } catch (err) {
              console.error(`Failed to delete temp file ${file}:`, err);
            }
          }
          resolve(outputFilePath);
        })
        .save(outputFilePath);
    });

    return ffmpegPromise;
  } catch (error) {
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
        devLog(`Deleted temp file on error: ${file}`);
      } catch (err) {
        console.error(`Failed to delete temp file ${file}:`, err);
      }
    }
    throw error;
  }
}

/**
 * Updates audio_metadata.json with the new entry, ensuring no stale data.
 * @param storageService - The storage service instance
 * @param newEntry - The new metadata entry to add
 */
async function updateAudioMetadata(storageService: StorageServiceAPI, newEntry: StorageMetadata): Promise<void> {
  const metadataFilePath = path.join(os.tmpdir(), 'audio_metadata.json');
  const maxRetries = 3;
  let attempt = 1;

  // Delete local temp file if it exists to prevent stale data
  try {
    await fs.access(metadataFilePath);
    await fs.unlink(metadataFilePath);
    devLog('Deleted local temp audio_metadata.json for fresh start');
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      devLog('Failed to delete local temp audio_metadata.json:', err.message);
    } else {
      devLog('No local temp audio_metadata.json found, proceeding with fresh metadata');
    }
  }

  while (attempt <= maxRetries) {
    try {
      // Fetch existing metadata
      let existingMetadata: StorageMetadata[] = [];
      try {
        const response = await fetch(`${storageService.getServerUrl()}/configs/audio_metadata.json`);
        if (response.ok) {
          existingMetadata = await response.json();
          if (!Array.isArray(existingMetadata)) {
            devLog('Existing metadata is not an array, initializing as empty');
            existingMetadata = [];
          }
        } else {
          devLog('No existing metadata found or failed to fetch, starting fresh');
        }
      } catch (fetchError: any) {
        devLog('Error fetching existing metadata:', fetchError.message);
      }

      // Append new entry, ensuring no duplicates
      const metadata = [
        ...existingMetadata.filter((entry) => entry.id !== newEntry.id),
        newEntry,
      ];

      // Save metadata locally
      await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));
      devLog('Successfully updated local audio_metadata.json');

      // Upload to server
      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metadataUrl = await storageService.uploadFile(
        'audio_metadata.json',
        metadataBlob,
        'configs',
        { name: 'Audio Metadata', category: 'metadata', overwrite: true }
      );
      devLog('Uploaded audio_metadata.json to server:', metadataUrl);
      return;
    } catch (error: any) {
      devLog(`Attempt ${attempt} failed to update audio_metadata.json:`, error.message);
      if (attempt === maxRetries) {
        throw new Error(`Failed to update audio_metadata.json after ${maxRetries} attempts: ${error.message}`);
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * API handler for merging multiple audio files
 * @param req - The Next.js API request
 * @param res - The Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  devLog('Request received:', req.method, { headers: req.headers, body: req.body });

  if (req.method !== 'POST') {
    devLog('Invalid method:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!req.body) {
    devLog('Request body is missing');
    return res.status(400).json({ message: 'Request body is missing' });
  }

  const { audioUrls, metadata = {}, config }: { audioUrls?: string[]; metadata?: StorageMetadata; config?: any } = req.body;
  devLog('audioUrls:', audioUrls?.map(url => url.slice(0, 30) + (url.length > 30 ? '..' : '')) || 'undefined');
  devLog('metadata:', metadata);
  devLog('config:', config);

  if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
    devLog('Invalid or missing audioUrls');
    return res.status(400).json({ message: 'audioUrls array is required and must be non-empty' });
  }

  let mergedFilePath: string | undefined;
  try {
    devLog('Calling mergeAudioFiles...');
    mergedFilePath = await mergeAudioFiles(audioUrls, metadata);

    const audioId = uuidv4();
    let uploadedAudioUrl: string | null = null;
    let uploadedConfigUrl: string = 'none';

    // Validate fileStorageBackend
    const backend = process.env.FILE_STORAGE_BACKEND || 'remote';
    const validBackends = ['remote', 's3', 'googleCloud'] as const;
    const fileStorageBackend: 'remote' | 's3' | 'googleCloud' = validBackends.includes(backend as any)
      ? backend as 'remote' | 's3' | 'googleCloud'
      : 'remote';

    const storageService = new StorageServiceAPI({
      fileStorageBackend,
      serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
    });

    const fileBuffer = await fs.readFile(mergedFilePath);
    if (fileBuffer.length === 0) {
      throw new Error('Merged audio file is empty');
    }

    // Convert Buffer to Blob
    const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });

    const baseName = metadata.name
      ? metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').replace(/\.+/g, '').substring(0, 50)
      : `merged-audio-${Date.now()}`;
    const audioFilename = `${baseName}.wav`;
    const configFilename = `${baseName}.json`;

    const mergedMetadata: StorageMetadata = {
      id: audioId,
      url: `/audio/${audioFilename}`,
      type: 'audio/wav',
      size: fileBuffer.length,
      category: 'merged_audio',
      name: metadata.name || 'Merged Audio',
      placeholder: baseName,
      volume: 1.0,
      date: new Date().toISOString(),
      source: {
        type: 'local',
        metadata: {
          name: audioFilename,
          type: 'audio/wav',
          size: fileBuffer.length,
        },
      },
      config_url: 'none',
    };

    devLog('Saving merged audio with metadata:', JSON.stringify(mergedMetadata, null, 2));
    uploadedAudioUrl = (await storageService.uploadFile(audioFilename, fileBlob, 'audio', {})).url;
    devLog('Successfully uploaded merged audio:', uploadedAudioUrl);

    // Update metadata with actual URL
    mergedMetadata.url = uploadedAudioUrl.replace(storageService.getServerUrl(), '');

    if (config) {
      try {
        const configData = {
          ...config,
          audioId,
          createdAt: new Date().toISOString(),
          title: metadata.name || 'Merged Audio',
          sections: Array.isArray(config.sections)
            ? config.sections.map((section: any, index: number) => ({
                ...section,
                id: section.id || `section-${index}`,
              }))
            : [],
        };

        const configBlob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
        devLog('Saving config file:', configFilename);
        uploadedConfigUrl = (await storageService.uploadFile(
          configFilename,
          configBlob,
          'configs',
          { audioId, name: metadata.name || 'Merged Audio', category: 'merged_audio_config' }
        )).url;
        mergedMetadata.config_url = uploadedConfigUrl.replace(storageService.getServerUrl(), '');
        devLog('Successfully saved config file:', uploadedConfigUrl);
      } catch (configError: any) {
        devLog('Failed to save config file:', configError.message);
        uploadedConfigUrl = 'none';
        mergedMetadata.config_url = 'none';
      }
    }

    devLog('Updating audio metadata with final entry:', JSON.stringify(mergedMetadata, null, 2));
    await updateAudioMetadata(storageService, mergedMetadata);

    devLog('Merging successful, uploaded URL:', uploadedAudioUrl);
    return res.status(200).json({
      uploadedAudioUrl,
      uploadedConfigUrl: uploadedConfigUrl !== 'none' ? uploadedConfigUrl : undefined,
      mergedAudioUrl: `/merged/${audioFilename}`,
      audioId,
    });
  } catch (error: any) {
    devLog('Error merging audio:', error.message, error.stack);
    return res.status(500).json({ message: `Error merging audio: ${error.message}` });
  } finally {
    if (mergedFilePath && existsSync(mergedFilePath)) {
      try {
        await fs.unlink(mergedFilePath);
        devLog('Temporary merged file deleted:', mergedFilePath);
      } catch (err) {
        console.error(`Failed to delete temp file ${mergedFilePath}:`, err);
      }
    }
  }
}