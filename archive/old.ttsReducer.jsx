// context/ttsReducer.jsx
import { initialPersistentState } from './ttsDefaults';
import { removeFromStorage } from './storage';
import { devLog } from '../utils/logUtils';

/**
 * Reducer function for the TTS global state
 * Handles all state updates for the persistent application state
 * 
 * @param {Object} state - Current state object (defaults to initialPersistentState)
 * @param {Object} action - Action object with type and payload
 * @returns {Object} The new state after applying the action
 */
export function ttsReducer(state = initialPersistentState, action) {
  switch (action.type) {
    case 'LOAD_PERSISTENT_STATE':
      // Load saved state from storage, merging with initialPersistentState
      return { ...initialPersistentState, ...action.payload };

    case 'SET_THEME':
      // Update application theme
      return { ...state, theme: action.payload };

    case 'SET_SPEECH_ENGINE':
      // Set the active speech engine (e.g., 'gtts', 'elevenLabs')
      return {
        ...state,
        settings: {
          ...state.settings,
          speechEngine: action.payload,
        },
      };

    case 'SET_SELECTED_VOICE':
      {
        // Set the selected voice for a specific engine
        const { engine, voice } = action.payload;
        return {
          ...state,
          settings: {
            ...state.settings,
            selectedVoices: {
              ...state.settings.selectedVoices,
              [engine]: voice,
            },
          },
        };
      }

    case 'ADD_CUSTOM_VOICE':
      {
        // Add a custom voice to the specified engine
        const { engine: customEngine, voice: customVoice } = action.payload;
        const currentCustomVoices = state.settings.customVoices[customEngine] || [];
        return {
          ...state,
          settings: {
            ...state.settings,
            customVoices: {
              ...state.settings.customVoices,
              [customEngine]: [...currentCustomVoices, customVoice],
            },
          },
        };
      }

    case 'REMOVE_CUSTOM_VOICE':
      {
        // Remove a custom voice from the specified engine
        const { engine: removeEngine, voiceId } = action.payload;
        const updatedCustomVoices = (state.settings.customVoices[removeEngine] || []).filter(
          (v) => v.id !== voiceId
        );
        const updatedActiveVoices = {
          ...state.settings.activeVoices,
          [removeEngine]: (state.settings.activeVoices[removeEngine] || []).filter(
            (v) => v.id !== voiceId
          ),
        };
        return {
          ...state,
          settings: {
            ...state.settings,
            customVoices: {
              ...state.settings.customVoices,
              [removeEngine]: updatedCustomVoices,
            },
            activeVoices: updatedActiveVoices,
          },
        };
      }

    case 'ADD_ACTIVE_VOICE':
      {
        // Add a voice to the active voices list for the specified engine
        const { engine: activeEngine, voice: activeVoice } = action.payload;
        const currentActiveVoices = state.settings.activeVoices[activeEngine] || [];
        const voiceWithEngine = { ...activeVoice, engine: activeEngine };
        if (!currentActiveVoices.some((v) => v.id === voiceWithEngine.id)) {
          let newDefaultVoice = state.settings.defaultVoice;
          const allActiveVoices = Object.values(state.settings.activeVoices).flat();
          if (allActiveVoices.length === 0) {
            newDefaultVoice = { engine: activeEngine, voiceId: voiceWithEngine.id };
          }
          return {
            ...state,
            settings: {
              ...state.settings,
              activeVoices: {
                ...state.settings.activeVoices,
                [activeEngine]: [...currentActiveVoices, voiceWithEngine],
              },
              defaultVoice: newDefaultVoice,
            },
          };
        }
        devLog('Voice already exists, state unchanged for ADD_ACTIVE_VOICE');
        return state;
      }

    case 'REMOVE_ACTIVE_VOICE':
      {
        // Remove a voice from the active voices list for the specified engine
        const { engine: removeActiveEngine, voiceId } = action.payload;
        const activeForEngine = state.settings.activeVoices[removeActiveEngine] || [];
        const updatedActiveForEngine = activeForEngine.filter((v) => v.id !== voiceId);
        const newActiveVoices = {
          ...state.settings.activeVoices,
          [removeActiveEngine]: updatedActiveForEngine,
        };
        let newDefaultVoice = state.settings.defaultVoice;
        if (
          state.settings.defaultVoice &&
          state.settings.defaultVoice.engine === removeActiveEngine &&
          state.settings.defaultVoice.voiceId === voiceId
        ) {
          const allRemainingVoices = Object.values(newActiveVoices).flat();
          newDefaultVoice =
            allRemainingVoices.length > 0
              ? { engine: allRemainingVoices[0].engine, voiceId: allRemainingVoices[0].id }
              : null;
        }
        return {
          ...state,
          settings: {
            ...state.settings,
            activeVoices: newActiveVoices,
            defaultVoice: newDefaultVoice,
          },
        };
      }

    case 'SET_API_KEY':
      {
        // Set an API key for a specific service
        const { keyName, value } = action.payload;
        return {
          ...state,
          settings: {
            ...state.settings,
            [keyName]: value,
          },
        };
      }

    case 'ADD_API_KEY':
      {
        // Add an API key to an array of keys
        const { keyArray, keyValue } = action.payload;
        return {
          ...state,
          settings: {
            ...state.settings,
            [keyArray]: [...(state.settings[keyArray] || []), keyValue],
          },
        };
      }

    case 'REMOVE_API_KEY':
      {
        // Remove an API key from an array of keys
        const { keyArray: removeKeyArray, index: removeIndex } = action.payload;
        return {
          ...state,
          settings: {
            ...state.settings,
            [removeKeyArray]: state.settings[removeKeyArray].filter((_, i) => i !== removeIndex),
          },
        };
      }

    case 'SET_MODE':
      // Set application mode (demo or production)
      const newMode = action.payload;
      if (newMode === 'demo') {
        const filteredActiveVoices = {};
        Object.keys(state.settings.activeVoices).forEach((engine) => {
          if (engine === 'gtts') {
            filteredActiveVoices[engine] = state.settings.activeVoices[engine];
          }
        });
        return {
          ...state,
          settings: {
            ...state.settings,
            mode: newMode,
            speechEngine: 'gtts',
            activeVoices: filteredActiveVoices,
          },
        };
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          mode: newMode,
        },
      };

    case 'SAVE_AUDIO':
      // Save audio data to the audio library
      return {
        ...state,
        AudioLibrary: { ...state.AudioLibrary, [action.payload.id]: action.payload },
      };

    case 'DELETE_AUDIO':
      // Remove an audio file from the AudioLibrary by ID
      const updatedAudioLibrary = { ...state.AudioLibrary };
      delete updatedAudioLibrary[action.payload];
      return {
        ...state,
        AudioLibrary: updatedAudioLibrary,
      };

    case 'LOAD_AUDIO_LIBRARY':
      // Load the entire audio library
      return {
        ...state,
        AudioLibrary:
          action.payload && typeof action.payload === 'object' ? action.payload : {},
      };

    case 'SAVE_TEMPLATE':
      // Save a template to the templates collection
      return {
        ...state,
        templates: {
          ...state.templates,
          [action.payload.id]: action.payload,
        },
      };

    case 'DELETE_TEMPLATE':
      // Delete a template from the templates collection
      const { [action.payload]: removedTemplate, ...remainingTemplates } = state.templates;
      return { ...state, templates: remainingTemplates };

    case 'LOAD_TEMPLATES':
      // Load all templates from storage
      const loadedTemplates =
        action.payload && typeof action.payload === 'object' ? action.payload : {};
      return {
        ...state,
        templates: { ...state.templates, ...loadedTemplates },
      };

    case 'SET_DEFAULT_VOICE':
      // Set the default voice for a specific engine
      return {
        ...state,
        settings: { ...state.settings, defaultVoice: action.payload },
      };

    case 'LOAD_ACTIVE_VOICES':
      // Load active voices from storage
      return {
        ...state,
        settings: { ...state.settings, activeVoices: action.payload },
      };

    case 'LOAD_CUSTOM_VOICES':
      // Load custom voices from storage
      return {
        ...state,
        settings: { ...state.settings, customVoices: action.payload },
      };

    case 'UPDATE_DEFAULT_VOICES':
      // Update the list of default voices
      return {
        ...state,
        settings: { ...state.settings, defaultVoices: action.payload },
      };

    case 'ADD_TO_FILE_HISTORY':
      // Add a new entry to the file history
      return {
        ...state,
        fileHistory: [...state.fileHistory, action.payload],
      };

    case 'LOAD_FILE_HISTORY':
      // Load file history entries from server
      return {
        ...state,
        fileHistory: Array.isArray(action.payload) ? action.payload : state.fileHistory,
      };

    case 'DELETE_HISTORY_ENTRY':
      // Remove a history entry by ID
      return {
        ...state,
        fileHistory: state.fileHistory.filter(entry => entry.id !== action.payload),
      };

    case 'UPDATE_HISTORY_ENTRY':
      // Update a history entry by ID
      {
        const updatedEntry = action.payload;
        if (!updatedEntry || !updatedEntry.id) {
          devLog('Invalid payload for UPDATE_HISTORY_ENTRY, missing ID');
          return state;
        }
        
        // Find the existing entry
        const existingEntryIndex = state.fileHistory.findIndex(entry => entry.id === updatedEntry.id);
        if (existingEntryIndex === -1) {
          // If entry doesn't exist, add it
          devLog(`Entry ${updatedEntry.id} not found, adding as new entry`);
          return {
            ...state,
            fileHistory: [...state.fileHistory, updatedEntry]
          };
        }
        
        const existingEntry = state.fileHistory[existingEntryIndex];
        
        // Check if this is a conversion from audio+config to config-only
        if (existingEntry.audioUrl && !updatedEntry.audioUrl && 
            (existingEntry.config || existingEntry.configFilename || 
             existingEntry.hasPotentialConfig || existingEntry.category === 'merged_audio')) {
          
          devLog(`Converting entry ${updatedEntry.id} from audio+config to config-only`);
          
          // Ensure proper category for config-only entries
          if (!updatedEntry.category || updatedEntry.category === 'merged_audio') {
            updatedEntry.category = 'merged_audio_config';
          }
          
          // Make sure we preserve any config info from the previous entry
          if (!updatedEntry.configFilename && existingEntry.configFilename) {
            updatedEntry.configFilename = existingEntry.configFilename;
          }
          
          if (!updatedEntry.config && existingEntry.config) {
            updatedEntry.config = existingEntry.config;
          }
        }
        
        // Create a new history array with the updated entry
        return {
          ...state,
          fileHistory: state.fileHistory.map(entry => 
            entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry
          )
        };
      }

    case 'CLEANUP_FILE_HISTORY':
      // Replace the file history with only the provided entries
      if (!Array.isArray(action.payload)) {
        devLog('Invalid payload for CLEANUP_FILE_HISTORY, expected array');
        return state;
      }
      return {
        ...state,
        fileHistory: action.payload,
      };

    case 'RESET_STATE':
      // Reset state to initial values and clear storage
      devLog('Processing RESET_STATE');
      if (typeof window !== 'undefined') {
        removeFromStorage('tts_persistent_state', 'localStorage');
        removeFromStorage('tts_audio_library', 'localStorage');
        removeFromStorage('tts_templates', 'localStorage');
      }
      return initialPersistentState;

    case 'SET_STORAGE_CONFIG':
      // Update storage configuration
      return {
        ...state,
        settings: {
          ...state.settings,
          storageConfig: action.payload,
        },
      };

    case 'ADD_HISTORY_ENTRIES':
      // Add multiple entries to the file history
      {
        if (!Array.isArray(action.payload) || action.payload.length === 0) {
          devLog('Invalid payload for ADD_HISTORY_ENTRIES, expected non-empty array');
          return state;
        }
        
        // Create an ID map of existing entries for efficient lookup
        const existingEntries = {};
        state.fileHistory.forEach(entry => {
          existingEntries[entry.id] = entry;
        });
        
        // Process new entries, merging with existing ones to avoid duplicates
        const newEntries = [];
        
        action.payload.forEach(newEntry => {
          // Skip entries without an ID
          if (!newEntry.id) {
            devLog('Skipping entry without ID:', newEntry);
            return;
          }
          
          const existingEntry = existingEntries[newEntry.id];
          
          // If entry doesn't exist at all, just add it
          if (!existingEntry) {
            newEntries.push(newEntry);
            return;
          }
          
          // If entry exists, don't add it again (it will be updated separately if needed)
          devLog(`Entry ${newEntry.id} already exists in history, will be updated separately if needed`);
        });
        
        if (newEntries.length === 0) {
          devLog('No new entries to add, all entries already exist in history');
          return state;
        }
        
        devLog(`Adding ${newEntries.length} new entries to file history`);
        
        return {
          ...state,
          fileHistory: [...state.fileHistory, ...newEntries]
        };
      }

    default:
      devLog('Unhandled action type in ttsReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}