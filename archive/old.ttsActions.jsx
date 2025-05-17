// context/ttsActions.jsx
import { saveToStorage, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';
import { initialPersistentState } from './ttsDefaults';

/**
 * Helper function to trigger notifications via custom events
 * @param {string} type - The notification type ('success', 'warning', 'error', 'info')
 * @param {string} message - The notification message
 */
const triggerNotification = (type, message) => {
  const event = new CustomEvent('trigger-notification', {
    detail: { type, message },
  });
  window.dispatchEvent(event);
};

/**
 * Creates and returns all TTS-related actions that can be dispatched
 * @param {Function} dispatch - The dispatch function from the TTS reducer context
 * @returns {Object} Object containing all TTS action functions
 */
export function createTtsActions(dispatch) {
  let currentState = null;
  const setCurrentState = (state, context = 'tts') => {
    if (context === 'tts') {
      currentState = state;
      devLog('Updated current state reference in ttsActions');
    }
  };

  return {
    /**
     * Sets the storage configuration for the TTS application
     * @param {Object} config - The storage configuration object
     */
    setStorageConfig: (config) => dispatch({ type: 'SET_STORAGE_CONFIG', payload: config }),

    /**
     * Sets the active speech engine
     * @param {string} engine - The speech engine to use
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
    setTheme: (theme) => {
      dispatch({ type: 'SET_THEME', payload: theme });
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
    },

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

    /**
     * Loads a history entry
     * @param {Object} historyEntry - The history entry to load
     * @returns {void}
     */
    loadHistoryEntry: (historyEntry) => {
      try {
        if (historyEntry?.audioUrl) {
          devLog('Loading history entry with audioUrl:', historyEntry);
          if (historyEntry.template === 'merged' || !historyEntry.template) {
            if (historyEntry.config) {
              const config = typeof historyEntry.config === 'string'
                ? JSON.parse(historyEntry.config)
                : historyEntry.config;
              if (window.ttsSessionDispatch) {
                window.ttsSessionDispatch({ type: 'RESET_SESSION' });
                if (Array.isArray(config.sections)) {
                  window.ttsSessionDispatch({ type: 'SET_SECTIONS', payload: config.sections });
                }
                if (config.description) {
                  window.ttsSessionDispatch({ type: 'SET_DESCRIPTION', payload: config.description });
                }
                if (config.title) {
                  window.ttsSessionDispatch({ type: 'SET_TITLE', payload: config.title });
                }
                triggerNotification('success', 'Configuration loaded successfully');
                window.ttsSessionDispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' });
              } else {
                const event = new CustomEvent('load-tts-config', { detail: { config } });
                window.dispatchEvent(event);
                setTimeout(() => {
                  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                  }
                }, 100);
              }
              return;
            }
            alert('This file can be played, but its configuration is not available for editing.');
            return;
          }
          alert('This template loading feature is currently being implemented.');
        } else {
          alert('This history entry has no associated audio file.');
        }
      } catch (error) {
        devLog('Error loading history entry:', error);
        alert(`Error loading configuration: ${error.message}`);
      }
    },

    updateCurrentState: setCurrentState,
  };
}