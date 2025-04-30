/**
 * Read a text file
 * @param {File} file - File object to read
 * @returns {Promise<string>} - Promise resolving to file contents
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
 * Read an audio file
 * @param {File} file - File object to read
 * @returns {Promise<string>} - Promise resolving to audio data URL
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
 * @param {string} url - URL or data URL of the file
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
 * Check if a file is an audio file
 * @param {File} file - File to check
 * @returns {boolean} - True if file is an audio file
 */
export function isAudioFile(file) {
    return file.type.startsWith('audio/');
}

/**
 * Check if a file is a text file
 * @param {File} file - File to check
 * @returns {boolean} - True if file is a text file
 */
export function isTextFile(file) {
    return file.type === 'text/plain' || file.name.endsWith('.txt');
}

/**
 * Locate sound effect files in a directory.
 * @param {string} dirPath - Directory path to search.
 * @param {Array<string>} extensions - Array of allowed sound effect file extensions (e.g., ['.mp3', '.wav']).
 * @returns {Promise<Array<string>>} - Promise resolving to array of file paths.
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
 * Delete temporary files in a directory.
 * @param {string} dirPath - Directory path to clean.
 * @param {Array<string>} extensions - Array of file extensions to delete (e.g., ['.tmp', '.temp']).
 * @returns {Promise<number>} - Promise resolving to number of files deleted.
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