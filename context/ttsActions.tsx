import { saveToStorage, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';
import { initialPersistentState } from './ttsDefaults';
import { Voice, validateVoiceObject } from '../utils/voiceUtils';
import { TTSAction } from './types/types';

interface Notification {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

interface HistoryEntry {
  audioUrl?: string;
  template?: string;
  config?: string | { sections?: any[]; description?: string; title?: string };
}

export function createTtsActions(
  dispatch: React.Dispatch<TTSAction>,
  addNotification: (notification: Notification) => void
) {
  return {
    /**
     * Sets the storage configuration for the TTS application.
     * @param config - The storage configuration object.
     */
    setStorageConfig: (config: { type: string; serverUrl: string; serviceType: string | null }) => {
      dispatch({ type: 'SET_STORAGE_CONFIG', payload: config });
      addNotification({ type: 'success', message: 'Storage configuration updated' });
    },

    /**
     * Sets the active speech engine.
     * @param engine - The speech engine to use (e.g., 'elevenlabs', 'gtts').
     */
    setSpeechEngine: (engine: string) => {
      dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine });
      addNotification({ type: 'success', message: `Switched to ${engine} engine` });
    },

    /**
     * Adds a custom voice to the specified engine.
     * @param engine - The speech engine (e.g., 'elevenlabs', 'gtts').
     * @param voice - The custom voice object to add.
     */
    addCustomVoice: (engine: string, voice: Voice) => {
      const validatedVoice = validateVoiceObject(voice);
      if (!validatedVoice.id) {
        addNotification({ type: 'error', message: 'Invalid custom voice provided' });
        return;
      }
      dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice: validatedVoice } });
      addNotification({ type: 'success', message: `Added custom voice: ${validatedVoice.name}` });
    },

    /**
     * Removes a custom voice from the specified engine.
     * @param engine - The speech engine (e.g., 'elevenlabs', 'gtts').
     * @param voiceId - The ID of the voice to remove.
     */
    removeCustomVoice: (engine: string, voiceId: string) => {
      dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } });
      addNotification({ type: 'success', message: 'Custom voice removed' });
    },

    /**
     * Adds a voice to the active voices list.
     * @param voice - The voice object to add to active voices.
     */
    addActiveVoice: (voice: Voice) => {
      const validatedVoice = validateVoiceObject(voice);
      if (!validatedVoice.id) {
        addNotification({ type: 'error', message: 'Invalid voice provided' });
        return;
      }
      dispatch({ type: 'ADD_ACTIVE_VOICE', payload: validatedVoice });
      addNotification({ type: 'success', message: `Activated voice: ${validatedVoice.name}` });
    },

    /**
     * Removes a voice from the active voices list.
     * @param engine - The speech engine (e.g., 'elevenlabs', 'gtts').
     * @param voiceId - The ID of the voice to remove.
     */
    removeActiveVoice: (engine: string, voiceId: string) => {
      dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } });
      addNotification({ type: 'success', message: 'Active voice removed' });
    },

    /**
     * Sets the entire active voices list.
     * @param voices - The array of voices to set as active.
     */
    setActiveVoices: (voices: Voice[]) => {
      const validatedVoices = voices.map(validateVoiceObject).filter((voice) => voice.id);
      dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: validatedVoices });
      addNotification({ type: 'success', message: 'Active voices updated' });
    },

    /**
     * Loads custom voices for all engines.
     * @param voices - Record of engine-specific custom voices (e.g., { elevenlabs: Voice[], gtts: Voice[] }).
     */
    loadCustomVoices: (voices: Record<string, Voice[]>) => {
      dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: voices });
      addNotification({ type: 'success', message: 'Custom voices loaded' });
    },

    /**
     * Sets the default voice.
     * @param voice - The voice object to set as default.
     */
    setDefaultVoice: (voice: Voice) => {
      const validatedVoice = validateVoiceObject(voice);
      if (!validatedVoice.id) {
        addNotification({ type: 'error', message: 'Invalid default voice provided' });
        return;
      }
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: validatedVoice });
      addNotification({ type: 'success', message: `Set default voice: ${validatedVoice.name}` });
    },

    /**
     * Sets the application mode.
     * @param mode - The mode to set ('demo' or 'production').
     */
    setMode: (mode: string) => {
      dispatch({ type: 'SET_MODE', payload: mode });
      addNotification({ type: 'success', message: `Switched to ${mode} mode` });
    },

    /**
     * Sets the application theme.
     * @param theme - The theme to apply.
     */
    setTheme: (theme: string) => {
      dispatch({ type: 'SET_THEME', payload: theme });
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
      addNotification({ type: 'success', message: `Theme set to ${theme}` });
    },

    /**
     * Resets the application state to initial values.
     */
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
      saveToStorage('tts_persistent_state', initialPersistentState, 'localStorage');
      addNotification({ type: 'success', message: 'Settings reset to defaults' });
    },

    /**
     * Saves a template to state and localStorage.
     * @param template - The template to save.
     */
    saveTemplate: async (template: { id: string; [key: string]: any }) => {
      dispatch({ type: 'SAVE_TEMPLATE', payload: template });
      try {
        const persistentState = (await loadFromStorage('tts_persistent_state', false, 'localStorage')) || {};
        persistentState.templates = persistentState.templates || {};
        persistentState.templates[template.id] = template;
        await saveToStorage('tts_persistent_state', persistentState, 'localStorage');
        addNotification({ type: 'success', message: `Template ${template.id} saved` });
      } catch (error) {
        devLog('Error saving template:', error);
        addNotification({ type: 'error', message: 'Failed to save template' });
        throw error;
      }
    },

    /**
     * Deletes a template from state and localStorage.
     * @param templateId - The ID of the template to delete.
     */
    deleteTemplate: async (templateId: string) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      try {
        const persistentState = (await loadFromStorage('tts_persistent_state', false, 'localStorage')) || {};
        if (persistentState.templates) {
          delete persistentState.templates[templateId];
          await saveToStorage('tts_persistent_state', persistentState, 'localStorage');
        }
        addNotification({ type: 'success', message: `Template ${templateId} deleted` });
      } catch (error) {
        devLog('Error deleting template:', error);
        addNotification({ type: 'error', message: 'Failed to delete template' });
        throw error;
      }
    },

    /**
     * Loads templates from localStorage.
     */
    loadTemplates: async () => {
      try {
        const persistentState = await loadFromStorage('tts_persistent_state', false, 'localStorage');
        if (persistentState?.templates) {
          dispatch({ type: 'LOAD_TEMPLATES', payload: persistentState.templates });
          addNotification({ type: 'success', message: 'Templates loaded' });
        }
      } catch (error) {
        devLog('Error loading templates:', error);
        addNotification({ type: 'error', message: 'Failed to load templates' });
        throw error;
      }
    },

    /**
     * Loads a history entry.
     * @param historyEntry - The history entry to load.
     */
    loadHistoryEntry: async (historyEntry: HistoryEntry) => {
      try {
        if (!historyEntry?.audioUrl) {
          addNotification({ type: 'error', message: 'History entry has no associated audio file' });
          return;
        }

        if (historyEntry.template === 'merged' || !historyEntry.template) {
          if (!historyEntry.config) {
            addNotification({
              type: 'info',
              message: 'This file can be played, but its configuration is not available for editing',
            });
            return;
          }

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
            addNotification({ type: 'success', message: 'Configuration loaded successfully' });
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

        addNotification({ type: 'info', message: 'Template loading feature is under development' });
      } catch (error) {
        devLog('Error loading history entry:', error);
        addNotification({ type: 'error', message: `Error loading configuration: ${(error as Error).message}` });
      }
    },
  };
}