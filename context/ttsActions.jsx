// context/ttsActions.jsx
import { saveToStorage, removeFromStorage, listFromStorage, updateFileMetadata, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';

/**
 * Creates and returns all TTS-related actions that can be dispatched
 * @param {Function} dispatch - The dispatch function from the TTS reducer context
 * @returns {Object} Object containing all TTS action functions
 */
export function createTtsActions(dispatch) {
  return {
    /**
     * Sets the storage configuration for the TTS application
     * @param {Object} config - The storage configuration object
     */
    setStorageConfig: (config) => dispatch({ type: 'SET_STORAGE_CONFIG', payload: config }),
    
    /**
     * Sets the active speech engine
     * @param {string} engine - The speech engine to use (e.g., 'gtts', 'elevenLabs')
     */
    setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
    
    /**
     * Sets the selected voice for a specific engine
     * @param {string} engine - The speech engine 
     * @param {Object} voice - The voice object to set as selected
     */
    setSelectedVoice: (engine, voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: { engine, voice } }),
    
    /**
     * Adds a custom voice to the specified engine
     * @param {string} engine - The speech engine
     * @param {Object} voice - The custom voice object to add
     */
    addCustomVoice: (engine, voice) => dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice } }),
    
    /**
     * Removes a custom voice from the specified engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to remove
     */
    removeCustomVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } }),
    
    /**
     * Adds a voice to the active voices list for the specified engine
     * @param {string} engine - The speech engine
     * @param {Object} voice - The voice object to add to active voices
     */
    addActiveVoice: (engine, voice) => dispatch({ type: 'ADD_ACTIVE_VOICE', payload: { engine, voice } }),
    
    /**
     * Removes a voice from the active voices list for the specified engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to remove
     */
    removeActiveVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } }),
    
    /**
     * Sets an API key for a specific service
     * @param {string} keyName - The name of the API key to set
     * @param {string} value - The API key value
     */
    setApiKey: (keyName, value) => dispatch({ type: 'SET_API_KEY', payload: { keyName, value } }),
    
    /**
     * Adds an API key to an array of keys
     * @param {string} keyArray - The name of the array to add the key to
     * @param {Object} keyValue - The key value object to add
     */
    addApiKey: (keyArray, keyValue) => dispatch({ type: 'ADD_API_KEY', payload: { keyArray, keyValue } }),
    
    /**
     * Removes an API key from an array of keys
     * @param {string} keyArray - The name of the array to remove from
     * @param {number} index - The index of the key to remove
     */
    removeApiKey: (keyArray, index) => dispatch({ type: 'REMOVE_API_KEY', payload: { keyArray, index } }),
    
    /**
     * Sets the application mode
     * @param {string} mode - The mode to set ('demo' or 'production')
     */
    setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
    
    /**
     * Sets the application theme
     * @param {string} theme - The theme to apply
     */
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),

    /**
     * Uploads an audio file to storage and adds it to state
     * @param {File} file - The audio file to upload
     * @param {Object} audioData - Metadata for the audio file
     * @returns {Promise<void>}
     */
    uploadAudio: async (file, audioData) => {
      try {
        // Extract metadata to send to the server
        const metadata = {
          category: audioData.category || 'sound_effect',
          name: audioData.name,
          placeholder: audioData.placeholder,
          volume: audioData.volume.toString(),
        };
        const url = await saveToStorage(file.name, file, 'fileStorage', metadata);
        const updatedAudioData = { ...audioData, url };
        dispatch({ type: 'SAVE_AUDIO', payload: updatedAudioData });
      } catch (error) {
        devLog('Error uploading audio:', error);
        throw error;
      }
    },

    /**
     * Deletes an audio file from storage and state
     * @param {string} audioId - The ID of the audio to delete
     * @param {string} filename - The filename of the audio file
     * @returns {Promise<void>}
     */
    deleteAudioFromStorage: async (audioId, filename) => {
      try {
        await removeFromStorage(filename, 'fileStorage');
        dispatch({ type: 'DELETE_AUDIO', payload: audioId });
      } catch (error) {
        devLog('Error deleting audio:', error);
        throw error;
      }
    },

    /**
     * Lists all items from the specified storage type
     * @param {string} storageType - The storage type to list from
     * @returns {Promise<Array>} A list of items from storage
     */
    listFromStorage: async (storageType) => {
      try {
        return await listFromStorage(storageType);
      } catch (error) {
        devLog('Error listing from storage:', error);
        throw error;
      }
    },

    /**
     * Updates audio metadata on the server and in state
     * @param {string} audioId - The ID of the audio to update
     * @param {Object} updatedAudioData - The updated audio data
     * @returns {Promise<void>}
     */
    updateAudio: async (audioId, updatedAudioData) => {
      try {
        devLog('Updating audio with ID:', audioId, 'Data:', updatedAudioData);
        // Update metadata on server using audioId (UUID)
        const updatedMetadata = await updateFileMetadata(audioId, {
          name: updatedAudioData.name || '',
          placeholder: updatedAudioData.placeholder || '',
          volume: typeof updatedAudioData.volume === 'number' ? updatedAudioData.volume : 1,
        });
        
        // Update local state with server response
        dispatch({ type: 'SAVE_AUDIO', payload: { ...updatedAudioData, ...updatedMetadata } });
      } catch (error) {
        devLog('Error updating audio metadata:', error);
        throw error;
      }
    },

    /**
     * Loads the audio library into state
     * @param {Object} audioLibrary - The audio library to load
     */
    loadAudioLibrary: (audioLibrary) => {
      dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audioLibrary });
    },

    /**
     * Saves audio data to state
     * @param {Object} audioData - The audio data to save
     */
    saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
    
    /**
     * Deletes audio from state by ID
     * @param {string} audioId - The ID of the audio to delete
     */
    deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),

    /**
     * Resets the application state to initial values
     */
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
      saveToStorage('tts_persistent_state', initialPersistentState, 'localStorage');
    },

    /**
     * Saves a template to state and localStorage
     * @param {Object} template - The template to save
     * @returns {Promise<void>}
     */
    saveTemplate: async (template) => {
      dispatch({ type: 'SAVE_TEMPLATE', payload: template });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        templates[template.id] = template;
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        devLog('Error saving template:', error);
        throw error;
      }
    },

    /**
     * Deletes a template from state and localStorage
     * @param {string} templateId - The ID of the template to delete
     * @returns {Promise<void>}
     */
    deleteTemplate: async (templateId) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        delete templates[templateId];
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        devLog('Error deleting template:', error);
        throw error;
      }
    },

    /**
     * Loads templates from localStorage
     * @returns {Promise<void>}
     */
    loadTemplates: async () => {
      try {
        const templates = await loadFromStorage('tts_templates', false, 'localStorage');
        if (templates) {
          dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
        }
      } catch (error) {
        devLog('Error loading templates:', error);
        throw error;
      }
    },

    /**
     * Sets the default voice for a specific engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to set as default
     */
    setDefaultVoice: (engine, voiceId) =>
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: { engine, voiceId } }),
    
  };
  
}