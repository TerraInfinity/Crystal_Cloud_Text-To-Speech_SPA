// services/api/mergeAudioAPI.tsx
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { StorageServiceAPI, StorageMetadata, UploadResponse } from './storageServiceAPI';
import { NextApiRequest, NextApiResponse } from 'next';
import { devLog, devError } from '../../utils/logUtils';

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

  try {
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i];
      let tempFile: string;
      try {
        if (url.startsWith('data:')) {
          tempFile = await saveDataUrlToTempFile(url, i);
          devLog(`Processed data URL for input ${i}, saved to temp file:`, tempFile);
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
          tempFile = await downloadFileToTemp(url, i);
          devLog(`Downloaded URL for input ${i}, saved to temp file:`, tempFile);
        } else if (url.startsWith('blob:')) {
          devLog(`Blob URL detected for input ${i}, this is not supported server-side`);
          throw new Error(`Blob URLs are not supported server-side: ${url}`);
        } else {
          tempFile = url;
          devLog(`Assuming local file path for input ${i}:`, tempFile);
        }
        
        // Verify the file exists and has content
        if (!existsSync(tempFile)) {
          devLog(`Warning: Temp file does not exist for input ${i}: ${tempFile}`);
          continue; // Skip this file instead of failing the whole process
        }
        
        const stats = await fs.stat(tempFile);
        if (stats.size < 44) { // Minimum WAV header size
          devLog(`Warning: Temp file too small for input ${i}: ${tempFile} (${stats.size} bytes)`);
          continue; // Skip this file
        }
        
        tempFiles.push(tempFile);
      } catch (error) {
        devLog(`Error processing audio input ${i} (${url.substring(0, 30)}...): ${error.message}`);
        // Continue with other files rather than failing completely
      }
    }

    // Must have at least one valid file to continue
    if (tempFiles.length === 0) {
      throw new Error('No valid audio files were processed for merging');
    }

    devLog(`Proceeding with ${tempFiles.length} valid audio files for merge`);

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
              devError(`Failed to delete temp file ${file}:`, err);
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
        devError(`Failed to delete temp file ${file}:`, err);
      }
    }
    throw error;
  }
}

/**
 * API handler for merging audio files
 * Merges multiple audio files into a single file
 * @param {Object} req - The Next.js request object
 * @param {Object} res - The Next.js response object
 * @returns {Promise<void>}
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

  const { audioUrls, metadata = {}, config, useSectionAudioUrl = false, sections = [] }: { 
    audioUrls?: string[]; 
    metadata?: StorageMetadata; 
    config?: any;
    useSectionAudioUrl?: boolean;
    sections?: { id: string; title: string; type: string; audioUrl: string; voice?: string; }[];
  } = req.body;
  
  devLog('audioUrls count:', audioUrls?.length || 0);
  devLog('sections count:', sections?.length || 0);
  devLog('useSectionAudioUrl:', useSectionAudioUrl);
  devLog('metadata:', metadata);
  devLog('config:', config);

  let finalAudioUrls: string[];

  // Choose audio URLs based on useSectionAudioUrl toggle
  if (useSectionAudioUrl) {
    // Validate sections when using section audio URLs
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      devLog('Invalid or missing sections');
      return res.status(400).json({ message: 'When useSectionAudioUrl is true, sections array is required and must be non-empty' });
    }

    // Extract audioUrl from each section 
    // - First check section.audioUrl (direct property)
    // - If not found, try to get from audioUrls array using section index
    finalAudioUrls = sections.map((section, index) => {
      // Prefer direct audioUrl in section if available
      if (section.audioUrl) {
        devLog(`Using audioUrl from section ${section.id}: ${section.audioUrl}`);
        return section.audioUrl;
      } else if (audioUrls && audioUrls[index]) {
        devLog(`No audioUrl in section ${section.id}, falling back to audioUrls[${index}]`);
        return audioUrls[index];
      }
      return null;
    }).filter(Boolean);
    
    // Check if all sections have audioUrl
    if (finalAudioUrls.length !== sections.length) {
      devLog('Some sections are missing audioUrl');
      return res.status(400).json({ message: 'When useSectionAudioUrl is true, all sections must have an audioUrl or a corresponding entry in audioUrls array' });
    }
    
    if (finalAudioUrls.length === 0) {
      devLog('No valid audioUrls found in sections');
      return res.status(400).json({ message: 'No valid audioUrls found in sections' });
    }
    
    devLog('Using audio URLs from sections:', finalAudioUrls.length);
  } else {
    // Use audioUrls as before (default behavior)
    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      devLog('Invalid or missing audioUrls');
      return res.status(400).json({ message: 'When useSectionAudioUrl is false, audioUrls array is required and must be non-empty' });
    }
    finalAudioUrls = audioUrls;
    devLog('Using provided audioUrls array:', finalAudioUrls.length);
  }

  let mergedFilePath: string | undefined;
  try {
    devLog('Starting audio merge process...');
    mergedFilePath = await mergeAudioFiles(finalAudioUrls, metadata);
    devLog('Audio files merged successfully:', mergedFilePath);

    // Check that the merged file exists and has content
    if (!existsSync(mergedFilePath)) {
      throw new Error('Merged audio file does not exist');
    }

    const fileStats = await fs.stat(mergedFilePath);
    if (fileStats.size === 0) {
      throw new Error('Merged audio file is empty');
    }
    devLog('Merged file size:', fileStats.size, 'bytes');

    const audioId = uuidv4();
    let uploadedAudioUrl: string | null = null;
    let uploadedConfigUrl: string | undefined = undefined;

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
      throw new Error('Merged audio file buffer is empty');
    }
    devLog('Merged file buffer size:', fileBuffer.length, 'bytes');

    // Convert Buffer to Blob
    const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });

    const baseName = metadata.name
      ? metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').replace(/\.+/g, '').substring(0, 50)
      : `merged-audio-${Date.now()}`;
    const audioFilename = `${baseName}.wav`;
    const configFilename = `${baseName}.json`;

    try {
      devLog('Saving merged audio to:', audioFilename);
      const uploadResponse = await storageService.uploadFile(audioFilename, fileBlob, 'audio', {
        category: 'merged_audio',
        name: metadata.name || 'Merged Audio',
      });
      
      if (!uploadResponse || !uploadResponse.url) {
        throw new Error('Failed to get URL from storage service after upload');
      }
      
      uploadedAudioUrl = uploadResponse.url;
      devLog('Successfully uploaded merged audio:', uploadedAudioUrl);
    } catch (uploadError: any) {
      devLog('Error uploading merged audio:', uploadError.message, uploadError.stack);
      throw new Error(`Failed to upload merged audio: ${uploadError.message}`);
    }

    // Extract relative URL paths from the absolute URLs
    const relativeAudioUrl = `/audio/${audioFilename}`;
    let relativeConfigUrl = null;

    // Create config file if provided
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
        devLog('Successfully saved config file:', uploadedConfigUrl);
        relativeConfigUrl = `/configs/${configFilename}`;
      } catch (configError: any) {
        devLog('Failed to save config file:', configError.message, configError.stack);
        // Don't fail the entire process if config save fails
        uploadedConfigUrl = undefined;
      }
    }

    // Update audio_metadata.json with the new merged audio entry
    let metadataEntry;
    devLog('Attempting to update metadata for audioId:', audioId);
    try {
      metadataEntry = {
        id: audioId,
        audio_url: relativeAudioUrl,
        type: 'audio/wav',
        size: fileBuffer.length,
        category: 'merged_audio',
        name: metadata.name || 'Merged Audio',
        placeholder: metadata.name?.toLowerCase().replace(/\s+/g, '_') || 'merged_audio',
        volume: 1,
        date: new Date().toISOString(),
        config_url: relativeConfigUrl,
        source: {
          type: 'merged',
          metadata: {
            name: audioFilename,
            type: 'audio/wav',
            size: fileBuffer.length
          }
        }
      };

      devLog('Metadata entry created:', JSON.stringify(metadataEntry, null, 2));
      try {
        const metadataResult = await storageService.updateMetadata(audioId, metadataEntry);
        devLog('Metadata update result:', metadataResult);
        if (!metadataResult.success) {
          devLog('Metadata update was not successful, but continuing');
        }
      } catch (metadataUpdateError: any) {
        devLog('Error during metadata update:', metadataUpdateError.message);
        // Continue even if metadata update fails
      }
    } catch (metadataError: any) {
      devLog('Failed to create or update audio_metadata.json:', metadataError.message, metadataError.stack);
      // Continue even if metadata creation fails
    }

    devLog('Merging successful, uploaded URL:', uploadedAudioUrl);
    return res.status(200).json({
      uploadedAudioUrl,
      uploadedConfigUrl,
      mergedAudioUrl: `/merged/${audioFilename}`,
      audioId,
      metadataEntry // Include metadata entry in response
    });
  } catch (error: any) {
    devLog('Error merging audio:', error.message, error.stack);
    return res.status(500).json({ 
      message: `Error merging audio: ${error.message}`,
      details: error.stack
    });
  } finally {
    if (mergedFilePath && existsSync(mergedFilePath)) {
      try {
        await fs.unlink(mergedFilePath);
        devLog('Temporary merged file deleted:', mergedFilePath);
      } catch (err) {
        devError(`Failed to delete temp file ${mergedFilePath}:`, err);
      }
    }
  }
}