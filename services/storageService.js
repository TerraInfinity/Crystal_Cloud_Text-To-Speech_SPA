/**
 * Storage service for handling settings and audio storage
 */
class StorageService {
  /**
   * Save settings to localStorage
   * @param {Object} settings - Settings object to save
   * @returns {boolean} - Success status
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
   * Load settings from localStorage
   * @returns {Object|null} - Retrieved settings or null if not found
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
   * Save template to localStorage
   * @param {string} templateName - Name of the template
   * @param {Object} templateData - Template data to save
   * @returns {boolean} - Success status
   */
  saveTemplate(templateName, templateData) {
    try {
      // Get existing templates
      const templates = this.loadTemplates() || {};
      
      // Add or update template
      templates[templateName] = templateData;
      
      // Save templates
      localStorage.setItem('tts-app-templates', JSON.stringify(templates));
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      return false;
    }
  }

  /**
   * Load templates from localStorage
   * @returns {Object|null} - Retrieved templates or null if not found
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
   * Load specific template from localStorage
   * @param {string} templateName - Name of the template to load
   * @returns {Object|null} - Retrieved template or null if not found
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
   * Delete template from localStorage
   * @param {string} templateName - Name of the template to delete
   * @returns {boolean} - Success status
   */
  deleteTemplate(templateName) {
    try {
      // Get existing templates
      const templates = this.loadTemplates();
      
      if (!templates || !templates[templateName]) {
        return false;
      }
      
      // Remove template
      delete templates[templateName];
      
      // Save updated templates
      localStorage.setItem('tts-app-templates', JSON.stringify(templates));
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  /**
   * Save section to localStorage (for auto-recovery)
   * @param {string} sectionId - ID of the section
   * @param {Object} sectionData - Section data to save
   * @returns {boolean} - Success status
   */
  saveSection(sectionId, sectionData) {
    try {
      // Get existing sections
      const sections = this.loadSections() || {};
      
      // Add or update section
      sections[sectionId] = sectionData;
      
      // Save sections
      localStorage.setItem('tts-app-sections', JSON.stringify(sections));
      return true;
    } catch (error) {
      console.error('Error saving section:', error);
      return false;
    }
  }

  /**
   * Load sections from localStorage
   * @returns {Object|null} - Retrieved sections or null if not found
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
   * Save audio to IndexedDB for offline use
   * @param {string} audioId - ID for the audio
   * @param {Blob} audioBlob - Audio blob to save
   * @returns {Promise<boolean>} - Promise resolving to success status
   */
  saveAudio(audioId, audioBlob) {
    return new Promise((resolve, reject) => {
      try {
        // Open IndexedDB
        const request = indexedDB.open('tts-app-db', 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('audio')) {
            db.createObjectStore('audio', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['audio'], 'readwrite');
          const store = transaction.objectStore('audio');
          
          // Store audio blob
          const storeRequest = store.put({
            id: audioId,
            blob: audioBlob,
            timestamp: Date.now()
          });
          
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
   * Load audio from IndexedDB
   * @param {string} audioId - ID of the audio to load
   * @returns {Promise<Blob|null>} - Promise resolving to audio blob or null if not found
   */
  loadAudio(audioId) {
    return new Promise((resolve, reject) => {
      try {
        // Open IndexedDB
        const request = indexedDB.open('tts-app-db', 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('audio')) {
            db.createObjectStore('audio', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['audio'], 'readonly');
          const store = transaction.objectStore('audio');
          
          // Get audio blob
          const getRequest = store.get(audioId);
          
          getRequest.onsuccess = () => {
            const result = getRequest.result;
            resolve(result ? result.blob : null);
          };
          
          getRequest.onerror = (error) => reject(error);
        };
        
        request.onerror = (error) => reject(error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Delete audio from IndexedDB
   * @param {string} audioId - ID of the audio to delete
   * @returns {Promise<boolean>} - Promise resolving to success status
   */
  deleteAudio(audioId) {
    return new Promise((resolve, reject) => {
      try {
        // Open IndexedDB
        const request = indexedDB.open('tts-app-db', 1);
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['audio'], 'readwrite');
          const store = transaction.objectStore('audio');
          
          // Delete audio
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
   * Save API keys securely (as secure as possible in the browser)
   * @param {Object} keys - API keys object to save
   * @returns {boolean} - Success status
   */
  saveApiKeys(keys) {
    try {
      // Encrypt keys before saving (simple encoding for demo)
      const encryptedKeys = btoa(JSON.stringify(keys));
      localStorage.setItem('tts-app-api-keys', encryptedKeys);
      return true;
    } catch (error) {
      console.error('Error saving API keys:', error);
      return false;
    }
  }

  /**
   * Load API keys
   * @returns {Object|null} - Retrieved API keys or null if not found
   */
  loadApiKeys() {
    try {
      const encryptedKeys = localStorage.getItem('tts-app-api-keys');
      if (!encryptedKeys) return null;
      
      // Decrypt keys
      const keys = JSON.parse(atob(encryptedKeys));
      return keys;
    } catch (error) {
      console.error('Error loading API keys:', error);
      return null;
    }
  }

  /**
   * Clear all stored data (for reset)
   * @returns {boolean} - Success status
   */
  clearAllData() {
    try {
      // Clear localStorage
      localStorage.removeItem('tts-app-settings');
      localStorage.removeItem('tts-app-templates');
      localStorage.removeItem('tts-app-sections');
      localStorage.removeItem('tts-app-api-keys');
      
      // Clear IndexedDB
      const request = indexedDB.deleteDatabase('tts-app-db');
      
      request.onerror = (error) => {
        console.error('Error clearing IndexedDB:', error);
      };
      
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }
}

// Export a singleton instance
export default new StorageService();
