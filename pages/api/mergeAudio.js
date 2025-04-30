import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Promisify fs functions
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

// Development logging helper
const devLog = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[mergeAudio API]', ...args);
    }
};

// Helper function to save a data URL to a temporary file
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

        // Normalize to 44100 Hz, 16-bit, mono
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

// Helper function to download a remote file to a temporary file
async function downloadFileToTemp(url, index) {
    try {
        const fileName = `input-${index}-${uuidv4()}.wav`;
        const tempDir = path.join(os.tmpdir(), 'audio-merge-temp');
        const tempFilePath = path.join(tempDir, fileName);
        const normalizedFilePath = path.join(tempDir, `normalized-${index}-${uuidv4()}.wav`);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        await writeFileAsync(tempFilePath, buffer);
        const stats = await fs.promises.stat(tempFilePath);
        if (stats.size < 44) {
            throw new Error(`Downloaded file is too small (possible invalid WAV): ${tempFilePath}`);
        }
        devLog(`Downloaded remote file ${index} to: ${tempFilePath}, Size: ${stats.size} bytes`);

        // Normalize to 44100 Hz, 16-bit, mono
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

// Helper function to merge audio files using FFmpeg
async function mergeAudioFiles(audioUrls) {
    const tempFiles = [];
    const outputFilePath = path.join(os.tmpdir(), `merged-${uuidv4()}.wav`);
    devLog('Temporary output file path:', outputFilePath);

    try {
        // Process audio URLs
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

        // Validate temporary files
        for (const file of tempFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Temporary file does not exist: ${file}`);
            }
            const stats = await fs.promises.stat(file);
            devLog('Validated temp file:', file, 'Size:', stats.size);
        }

        // Use filter_complex for concatenation
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
                .on('end', async() => {
                    devLog('FFmpeg merge finished, output:', outputFilePath);
                    // Clean up temporary files after FFmpeg completes
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
        // Clean up any created temp files on error
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

// Main handler
export default async function handler(req, res) {
    devLog('Request received:', req.method, req.body);

    if (req.method !== 'POST') {
        devLog('Invalid method:', req.method);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { audioUrls } = req.body;
    devLog('audioUrls:', audioUrls.map(url => url.slice(0, 50) + (url.length > 50 ? '...' : '')));

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
        devLog('Invalid or missing audioUrls');
        return res.status(400).json({ message: 'Audio URLs array is required' });
    }

    let mergedFilePath;
    try {
        devLog('Calling mergeAudioFiles...');
        mergedFilePath = await mergeAudioFiles(audioUrls);

        const filename = path.basename(mergedFilePath);
        let mergedAudioUrl;

        if (process.env.USE_CLOUD_STORAGE === 'true') {
            devLog('Cloud storage not implemented, using local storage');
            throw new Error('Cloud storage upload not implemented');
        } else {
            const publicDir = path.join(process.cwd(), 'public', 'merged');
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }
            const destPath = path.join(publicDir, filename);
            devLog('Copying merged file to:', destPath);
            await fs.promises.copyFile(mergedFilePath, destPath);
            mergedAudioUrl = `/merged/${filename}`;
        }

        devLog('Merging successful, URL:', mergedAudioUrl);
        return res.status(200).json({ mergedAudioUrl });
    } catch (error) {
        devLog('Error merging audio:', error);
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