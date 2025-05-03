/**
 * Storage service for handling settings, audio, and extensible cloud storage.
 * Provides a unified interface for data persistence across different storage mechanisms:
 * - localStorage for settings, templates, sections, and API keys
 * - IndexedDB for audio files and larger binary data
 * - Amazon S3 for cloud storage and file sharing
 * 
 * @module storageServiceAPI
 */
class storageServiceAPI {
    /**
     * Initializes the storage service with default provider configurations.
     * Sets up storage provider mapping for different data types.
     */
    constructor() {
        // Default storage provider configuration (extensible for S3, Google Drive, etc.)
        this.storageProvider = {
            audio: 'indexeddb', // Default for audio remains IndexedDB
            settings: 'localstorage', // Default for settings, templates, sections
            cloud: 's3' // Default cloud provider for new methods
        };
    }

    /**
     * Save settings to localStorage.
     * Serializes the settings object to JSON and stores it using a known key.
     * 
     * @param {Object} settings - Settings object to save
     * @returns {boolean} - True if saved successfully, false otherwise
     */
    saveSettings(settings) {
        try {
            localStorage.setItem('tts-app-settings', JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    /**
     * Load settings from localStorage.
     * Retrieves and deserializes the settings object from storage.
     * 
     * @returns {Object|null} - Retrieved settings object or null if not found or on error
     */
    loadSettings() {
        try {
            const settings = localStorage.getItem('tts-app-settings');
            return settings ? JSON.parse(settings) : null;
        } catch (error) {
            console.error('Error loading settings:', error);
            return null;
        }
    }

    /**
     * Save template to localStorage.
     * Adds or updates a named template in the templates collection.
     * 
     * @param {string} templateName - Unique name of the template
     * @param {Object} templateData - Template data to save
     * @returns {boolean} - True if saved successfully, false otherwise
     */
    saveTemplate(templateName, templateData) {
        try {
            const templates = this.loadTemplates() || {};
            templates[templateName] = templateData;
            localStorage.setItem('tts-app-templates', JSON.stringify(templates));
            return true;
        } catch (error) {
            console.error('Error saving template:', error);
            return false;
        }
    }

    /**
     * Load all templates from localStorage.
     * Retrieves and deserializes all templates as a collection.
     * 
     * @returns {Object|null} - Object containing all templates or null if not found or on error
     */
    loadTemplates() {
        try {
            const templates = localStorage.getItem('tts-app-templates');
            return templates ? JSON.parse(templates) : null;
        } catch (error) {
            console.error('Error loading templates:', error);
            return null;
        }
    }

    /**
     * Load a specific template from localStorage.
     * Retrieves a single named template from the templates collection.
     * 
     * @param {string} templateName - Name of the template to load
     * @returns {Object|null} - Retrieved template object or null if not found or on error
     */
    loadTemplate(templateName) {
        try {
            const templates = this.loadTemplates();
            return templates && templates[templateName] ? templates[templateName] : null;
        } catch (error) {
            console.error('Error loading template:', error);
            return null;
        }
    }

    /**
     * Delete a template from localStorage.
     * Removes a named template from the templates collection if it exists.
     * 
     * @param {string} templateName - Name of the template to delete
     * @returns {boolean} - True if deleted successfully, false if not found or on error
     */
    deleteTemplate(templateName) {
        try {
            const templates = this.loadTemplates();
            if (!templates || !templates[templateName]) {
                return false;
            }
            delete templates[templateName];
            localStorage.setItem('tts-app-templates', JSON.stringify(templates));
            return true;
        } catch (error) {
            console.error('Error deleting template:', error);
            return false;
        }
    }

    /**
     * Save section to localStorage for auto-recovery.
     * Adds or updates a section in the sections collection using a unique ID.
     * 
     * @param {string} sectionId - Unique ID of the section
     * @param {Object} sectionData - Section data to save
     * @returns {boolean} - True if saved successfully, false otherwise
     */
    saveSection(sectionId, sectionData) {
        try {
            const sections = this.loadSections() || {};
            sections[sectionId] = sectionData;
            localStorage.setItem('tts-app-sections', JSON.stringify(sections));
            return true;
        } catch (error) {
            console.error('Error saving section:', error);
            return false;
        }
    }

    /**
     * Load all sections from localStorage.
     * Retrieves and deserializes all sections as a collection.
     * 
     * @returns {Object|null} - Object containing all sections or null if not found or on error
     */
    loadSections() {
        try {
            const sections = localStorage.getItem('tts-app-sections');
            return sections ? JSON.parse(sections) : null;
        } catch (error) {
            console.error('Error loading sections:', error);
            return null;
        }
    }

    /**
     * Save audio to IndexedDB for offline use.
     * Creates or updates IndexedDB database as needed and stores the audio blob.
     * 
     * @param {string} audioId - Unique ID for the audio
     * @param {Blob} audioBlob - Audio data as a Blob
     * @returns {Promise<boolean>} - Resolves to true on success, rejects with error on failure
     */
    async saveAudio(audioId, audioBlob) {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('tts-app-db', 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('audio')) {
                        db.createObjectStore('audio', { keyPath: 'id' });
                    }
                };
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['audio'], 'readwrite');
                    const store = transaction.objectStore('audio');
                    const storeRequest = store.put({ id: audioId, blob: audioBlob, timestamp: Date.now() });
                    storeRequest.onsuccess = () => resolve(true);
                    storeRequest.onerror = (error) => reject(error);
                };
                request.onerror = (error) => reject(error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load audio from IndexedDB.
     * Retrieves a stored audio blob by its ID, creating the database if it doesn't exist.
     * 
     * @param {string} audioId - ID of the audio to load
     * @returns {Promise<Blob|null>} - Resolves to audio Blob or null if not found, rejects on error
     */
    async loadAudio(audioId) {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('tts-app-db', 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('audio')) {
                        db.createObjectStore('audio', { keyPath: 'id' });
                    }
                };
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['audio'], 'readonly');
                    const store = transaction.objectStore('audio');
                    const getRequest = store.get(audioId);
                    getRequest.onsuccess = () => resolve(getRequest.result ? getRequest.result.blob : null);
                    getRequest.onerror = (error) => reject(error);
                };
                request.onerror = (error) => reject(error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Delete audio from IndexedDB.
     * Removes a stored audio blob by its ID if it exists.
     * 
     * @param {string} audioId - ID of the audio to delete
     * @returns {Promise<boolean>} - Resolves to true on success, rejects with error on failure
     */
    async deleteAudio(audioId) {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('tts-app-db', 1);
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['audio'], 'readwrite');
                    const store = transaction.objectStore('audio');
                    const deleteRequest = store.delete(audioId);
                    deleteRequest.onsuccess = () => resolve(true);
                    deleteRequest.onerror = (error) => reject(error);
                };
                request.onerror = (error) => reject(error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save API keys securely (basic encoding, not true encryption).
     * Encodes the keys using base64 for basic obfuscation before storing in localStorage.
     * Note: This is not secure encryption and should not be relied on for high-security needs.
     * 
     * @param {Object} keys - API keys object to save
     * @returns {boolean} - True if saved successfully, false otherwise
     */
    saveApiKeys(keys) {
        try {
            const encryptedKeys = btoa(JSON.stringify(keys));
            localStorage.setItem('tts-app-api-keys', encryptedKeys);
            return true;
        } catch (error) {
            console.error('Error saving API keys:', error);
            return false;
        }
    }

    /**
     * Load API keys from localStorage.
     * Retrieves and decodes the API keys from basic obfuscation.
     * 
     * @returns {Object|null} - Retrieved API keys object or null if not found or on error
     */
    loadApiKeys() {
        try {
            const encryptedKeys = localStorage.getItem('tts-app-api-keys');
            if (!encryptedKeys) return null;
            return JSON.parse(atob(encryptedKeys));
        } catch (error) {
            console.error('Error loading API keys:', error);
            return null;
        }
    }

    /**
     * Clear all stored data from localStorage and IndexedDB.
     * Removes all application data for a clean state or for privacy purposes.
     * 
     * @returns {boolean} - True if cleared successfully, false on error
     */
    clearAllData() {
        try {
            localStorage.removeItem('tts-app-settings');
            localStorage.removeItem('tts-app-templates');
            localStorage.removeItem('tts-app-sections');
            localStorage.removeItem('tts-app-api-keys');
            const request = indexedDB.deleteDatabase('tts-app-db');
            request.onerror = (error) => console.error('Error clearing IndexedDB:', error);
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    /**
     * Upload a file to Amazon S3.
     * Uses AWS SDK to put an object in the specified S3 bucket and returns its URL.
     * 
     * @param {File|Blob} file - File or Blob to upload
     * @param {string} bucket - S3 bucket name
     * @param {string} key - S3 object key (path)
     * @returns {Promise<string>} - Resolves to the S3 URL of the uploaded file
     * @throws {Error} - Throws on upload failure
     */
    async upload_file_to_s3(file, bucket, key) {
        try {
            const s3 = new AWS.S3(); // Assumes AWS SDK is configured
            const params = {
                Bucket: bucket,
                Key: key,
                Body: file,
                ContentType: file.type,
            };
            await s3.putObject(params).promise();
            return `https://${bucket}.s3.amazonaws.com/${key}`;
        } catch (error) {
            console.error('Error uploading file to S3:', error);
            throw error;
        }
    }

    /**
     * Write data (string or JSON) to Amazon S3.
     * Serializes objects to JSON if needed and uploads to S3 with appropriate content type.
     * 
     * @param {string|Object} data - Data to write (string or object to be JSON-stringified)
     * @param {string} bucket - S3 bucket name
     * @param {string} key - S3 object key (path)
     * @returns {Promise<string>} - Resolves to the S3 URL of the written data
     * @throws {Error} - Throws on write failure or unsupported data type
     */
    async write_data_to_s3(data, bucket, key) {
        try {
            const s3 = new AWS.S3();
            let body, contentType;
            if (typeof data === 'string') {
                body = data;
                contentType = 'text/plain';
            } else if (typeof data === 'object') {
                body = JSON.stringify(data);
                contentType = 'application/json';
            } else {
                throw new Error('Unsupported data type');
            }
            const params = {
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            };
            await s3.putObject(params).promise();
            return `https://${bucket}.s3.amazonaws.com/${key}`;
        } catch (error) {
            console.error('Error writing data to S3:', error);
            throw error;
        }
    }

    /**
     * Download audio files from Amazon S3.
     * Retrieves multiple audio files from S3 and converts them to Blobs.
     * 
     * @param {string} bucket - S3 bucket name
     * @param {string[]} keys - Array of S3 object keys to download
     * @returns {Promise<Blob[]>} - Resolves to an array of audio Blobs
     * @throws {Error} - Throws on download failure
     */
    async download_audio_files_from_s3(bucket, keys) {
        try {
            const s3 = new AWS.S3();
            const downloadPromises = keys.map(async(key) => {
                const params = { Bucket: bucket, Key: key };
                const data = await s3.getObject(params).promise();
                return new Blob([data.Body], { type: data.ContentType });
            });
            return Promise.all(downloadPromises);
        } catch (error) {
            console.error('Error downloading audio files from S3:', error);
            throw error;
        }
    }

    /**
     * Create a presigned URL for an Amazon S3 object.
     * Generates a time-limited URL that allows temporary access to the object.
     * 
     * @param {string} bucket - S3 bucket name
     * @param {string} key - S3 object key (path)
     * @param {number} [expires=3600] - URL expiration time in seconds (default: 1 hour)
     * @returns {Promise<string>} - Resolves to the presigned URL
     * @throws {Error} - Throws on URL creation failure
     */
    async create_presigned_s3_url(bucket, key, expires = 3600) {
        try {
            const s3 = new AWS.S3();
            const params = { Bucket: bucket, Key: key, Expires: expires };
            return await s3.getSignedUrlPromise('getObject', params);
        } catch (error) {
            console.error('Error creating presigned S3 URL:', error);
            throw error;
        }
    }

    /**
     * Configure the storage provider (for future extensibility).
     * Updates the storage provider mapping to use different backends for different data types.
     * 
     * @param {Object} providerConfig - Configuration object (e.g., { audio: 's3', settings: 'googledrive' })
     */
    configureProvider(providerConfig) {
        this.storageProvider = {...this.storageProvider, ...providerConfig };
        // Future: Implement logic to switch providers dynamically
    }
}

// Export a singleton instance
export default new storageServiceAPI();