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
