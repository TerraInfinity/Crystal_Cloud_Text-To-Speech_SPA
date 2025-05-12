import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { StorageServiceAPI } from './storageServiceAPI';

// Promisify fs functions
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

/**
 * Development logging helper function
 * Only logs to console in non-production environments
 * 
 * @param {...any} args - Arguments to log to console
 */
const devLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mergeAudioAPI]', ...args);
  }
};

/**
 * Saves a data URL to a temporary file and normalizes audio format
 */
async function saveDataUrlToTempFile(dataUrl, index) {
  try {
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)[1];
    const mimeToExt = {
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

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await writeFileAsync(tempFilePath, buffer);
    const stats = await fs.promises.stat(tempFilePath);
    if (stats.size < 44) {
      throw new Error(`Temporary file is too small (possible invalid WAV): ${tempFilePath}`);
    }
    devLog(`Saved data URL ${index} to temp file: ${tempFilePath}, Size: ${stats.size} bytes`);

    await new Promise((resolve, reject) => {
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
 */
async function downloadFileToTemp(url, index) {
  try {
    const fileName = `input-${index}-${uuidv4()}.wav`;
    const tempDir = path.join(os.tmpdir(), 'audio-merge-temp');
    const tempFilePath = path.join(tempDir, fileName);
    const normalizedFilePath = path.join(tempDir, `normalized-${index}-${uuidv4()}.wav`);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFileAsync(tempFilePath, buffer);
    const stats = await fs.promises.stat(tempFilePath);
    if (stats.size < 44) {
      throw new Error(`Downloaded file is too small (possible invalid WAV): ${tempFilePath}`);
    }
    devLog(`Downloaded remote file ${index} to: ${tempFilePath}, Size: ${stats.size} bytes`);

    await new Promise((resolve, reject) => {
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
 */
async function mergeAudioFiles(audioUrls, metadata = {}) {
  const tempFiles = [];
  let outputFilePath;

  const baseName = metadata.name
    ? metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').replace(/\.+/g, '').substring(0, 50)
    : `merged-audio-${Date.now()}`;
  outputFilePath = path.join(os.tmpdir(), `${baseName}.wav`);

  devLog('Temporary output file path:', outputFilePath);

  try {
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i];
      let tempFile;
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
      if (!fs.existsSync(file)) {
        throw new Error(`Temporary file does not exist: ${file}`);
      }
      const stats = await fs.promises.stat(file);
      devLog('Validated temp file:', file, 'Size:', stats.size);
    }

    const ffmpegPromise = new Promise((resolve, reject) => {
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
              await unlinkAsync(file);
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
        await unlinkAsync(file);
        devLog(`Deleted temp file on error: ${file}`);
      } catch (err) {
        console.error(`Failed to delete temp file ${file}:`, err);
      }
    }
    throw error;
  }
}

/**
 * Updates audio_metadata.json on the server
 */
async function updateAudioMetadata(storageService, newEntry) {
  const maxRetries = 3;
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(`${storageService.serverUrl}/audio/audio_metadata.json`);
      let metadata = [];
      if (response.ok) {
        metadata = await response.json();
      } else if (response.status === 404) {
        devLog('audio_metadata.json not found, starting with empty array');
      } else {
        throw new Error(`Failed to fetch audio_metadata.json: ${response.statusText}`);
      }

      // Remove any existing entry with the same id to avoid duplicates
      metadata = metadata.filter(entry => entry.id !== newEntry.id);
      metadata.push(newEntry);

      const updateResponse = await fetch(`${storageService.serverUrl}/api/storageService/update-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update audio_metadata.json: ${updateResponse.statusText}`);
      }

      devLog('Successfully updated audio_metadata.json with new entry:', newEntry);
      return;
    } catch (error) {
      devLog(`Attempt ${attempt} failed to update audio_metadata.json:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to update audio_metadata.json after ${maxRetries} attempts: ${error.message}`);
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}

/**
 * API handler for merging multiple audio files
 */
export default async function handler(req, res) {
  devLog('Request received:', req.method, { headers: req.headers, body: req.body });

  if (req.method !== 'POST') {
    devLog('Invalid method:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!req.body) {
    devLog('Request body is missing');
    return res.status(400).json({ message: 'Request body is missing' });
  }

  const { audioUrls, metadata = {}, config } = req.body;
  devLog('audioUrls:', audioUrls?.map(url => url.slice(0, 30) + (url.length > 30 ? '..' : '')) || 'undefined');
  devLog('metadata:', metadata);
  devLog('config:', config);

  if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
    devLog('Invalid or missing audioUrls');
    return res.status(400).json({ message: 'audioUrls array is required and must be non-empty' });
  }

  let mergedFilePath;
  try {
    devLog('Calling mergeAudioFiles...');
    mergedFilePath = await mergeAudioFiles(audioUrls, metadata);

    const audioId = uuidv4();
    let uploadedAudioUrl = null;
    let uploadedConfigUrl = 'none';

    const storageService = new StorageServiceAPI({
      fileStorageBackend: process.env.FILE_STORAGE_BACKEND || 'remote',
      serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
    });

    const fileBuffer = await readFileAsync(mergedFilePath);
    if (fileBuffer.length === 0) {
      throw new Error('Merged audio file is empty');
    }

    const baseName = metadata.name
      ? metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').replace(/\.+/g, '').substring(0, 50)
      : `merged-audio-${Date.now()}`;
    const audioFilename = `${baseName}.wav`;
    const configFilename = `${baseName}.json`;

    const mergedMetadata = {
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
      config_url: 'none', // Default to 'none'
    };

    uploadedAudioUrl = await storageService.saveFile(fileBuffer, audioFilename, 'audio/wav', mergedMetadata);
    devLog('Successfully uploaded merged audio:', uploadedAudioUrl);

    if (config) {
      try {
        const configData = {
          ...config,
          audioId,
          createdAt: new Date().toISOString(),
          title: metadata.name || 'Merged Audio',
          sections: Array.isArray(config.sections)
            ? config.sections.map((section, index) => ({
                ...section,
                id: section.id || `section-${index}`,
              }))
            : [],
        };

        const configBuffer = Buffer.from(JSON.stringify(configData, null, 2));
        uploadedConfigUrl = await storageService.saveConfigFile(configBuffer, configFilename, 'application/json', {
          audioId,
          name: metadata.name || 'Merged Audio',
          category: 'merged_audio_config',
        });
        mergedMetadata.config_url = `/configs/${configFilename}`;
        devLog('Successfully saved config file:', uploadedConfigUrl);
      } catch (configError) {
        devLog('Failed to save config file:', configError);
        uploadedConfigUrl = 'none';
        mergedMetadata.config_url = 'none';
      }
    }

    await updateAudioMetadata(storageService, mergedMetadata);

    devLog('Merging successful, uploaded URL:', uploadedAudioUrl);
    return res.status(200).json({
      uploadedAudioUrl,
      uploadedConfigUrl: uploadedConfigUrl !== 'none' ? uploadedConfigUrl : undefined,
      mergedAudioUrl: `/merged/${audioFilename}`,
      audioId,
    });
  } catch (error) {
    devLog('Error merging audio:', error.message);
    return res.status(500).json({ message: `Error merging audio: ${error.message}` });
  } finally {
    if (mergedFilePath && fs.existsSync(mergedFilePath)) {
      try {
        await unlinkAsync(mergedFilePath);
        devLog('Temporary merged file deleted:', mergedFilePath);
      } catch (err) {
        console.error(`Failed to delete temp file ${mergedFilePath}:`, err);
      }
    }
  }
}