/**
 * File Utilities Module
 * 
 * Provides utilities for file operations including:
 * - Reading text and audio files
 * - Downloading files
 * - File type validation
 * - Server-side file operations (for Node.js environments)
 * 
 * @module fileUtils
 */

/**
 * Read a text file into a string
 * 
 * Uses the FileReader API to asynchronously read a file object's contents.
 * 
 * @param {File} file - File object to read
 * @returns {Promise<string>} - Promise resolving to file contents as a string
 * @throws {Error} If file reading fails
 */
export function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(new Error(`Error reading file: ${error}`));
        };

        reader.readAsText(file);
    });
}

/**
 * Read an audio file into a data URL
 * 
 * Uses the FileReader API to asynchronously read a file object and convert
 * it to a data URL that can be used as an audio source.
 * 
 * @param {File} file - File object to read
 * @returns {Promise<string>} - Promise resolving to audio data URL
 * @throws {Error} If file reading fails
 */
export function readAudioFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(new Error(`Error reading audio file: ${error}`));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Download a file from a URL or data URL
 * 
 * Creates a temporary anchor element and triggers a download.
 * Works with both server URLs and data URLs.
 * 
 * @param {string} url - URL or data URL of the file to download
 * @param {string} filename - Name for the downloaded file
 */
export function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Check if a file is an audio file based on its MIME type
 * 
 * @param {File} file - File to check
 * @returns {boolean} - True if file has an audio MIME type
 */
export function isAudioFile(file) {
    return file.type.startsWith('audio/');
}

/**
 * Check if a file is a text file based on MIME type or extension
 * 
 * Validates that a file is a text file either by checking its MIME type
 * or by verifying it has a .txt extension.
 * 
 * @param {File} file - File to check
 * @returns {boolean} - True if file is a text file
 */
export function isTextFile(file) {
    return file.type === 'text/plain' || file.name.endsWith('.txt');
}

/**
 * Locate sound effect files in a directory
 * 
 * Server-side function that searches a directory for audio files with specified extensions.
 * Requires Node.js environment with fs/promises and path modules.
 * 
 * @param {string} dirPath - Directory path to search
 * @param {Array<string>} [extensions=['.mp3', '.wav', '.ogg']] - Array of allowed sound effect file extensions
 * @returns {Promise<Array<string>>} - Promise resolving to array of full file paths
 * @throws {Error} If directory reading fails or in client-side environment
 */
export async function locate_sound_effect_file(dirPath, extensions = ['.mp3', '.wav', '.ogg']) {
    // Node.js required
    const fs = await
    import ('fs/promises');
    const path = await
    import ('path');
    const files = await fs.readdir(dirPath);
    return files
        .filter(file => extensions.some(ext => file.toLowerCase().endsWith(ext)))
        .map(file => path.join(dirPath, file));
}

/**
 * Delete temporary files in a directory
 * 
 * Server-side function that removes files with specified extensions from a directory.
 * Requires Node.js environment with fs/promises and path modules.
 * 
 * @param {string} dirPath - Directory path to clean
 * @param {Array<string>} [extensions=['.tmp', '.temp']] - Array of file extensions to delete
 * @returns {Promise<number>} - Promise resolving to number of files deleted
 * @throws {Error} If directory reading/deleting fails or in client-side environment
 */
export async function delete_temporary_files(dirPath, extensions = ['.tmp', '.temp']) {
    // Node.js required
    const fs = await
    import ('fs/promises');
    const path = await
    import ('path');
    const files = await fs.readdir(dirPath);
    let deletedCount = 0;
    for (const file of files) {
        if (extensions.some(ext => file.toLowerCase().endsWith(ext))) {
            await fs.unlink(path.join(dirPath, file));
            deletedCount++;
        }
    }
    return deletedCount;
}