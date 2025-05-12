// context/ttsReducer.jsx
import { initialPersistentState } from './ttsDefaults';
import { removeFromStorage } from './storage';
import { devLog } from '../utils/logUtils';

/**
 * Reducer function for the TTS global state
 * Handles state updates for non-file storage operations
 * 
 * @param {Object} state - Current state object (defaults to initialPersistentState)
 * @param {Object} action - Action object with type and payload
 * @returns {Object} The new state after applying the action
 */
export function ttsReducer(state = initialPersistentState, action) {
  switch (action.type) {
    case 'LOAD_PERSISTENT_STATE':
      return { ...initialPersistentState, ...action.payload };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_SPEECH_ENGINE':
      return {
        ...state,
        settings: {
          ...state.settings,
          speechEngine: action.payload,
        },
      };

    case 'SET_SELECTED_VOICE':
      {
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
        const { engine, voice } = action.payload;
        const currentCustomVoices = state.settings.customVoices[engine] || [];
        return {
          ...state,
          settings: {
            ...state.settings,
            customVoices: {
              ...state.settings.customVoices,
              [engine]: [...currentCustomVoices, voice],
            },
          },
        };
      }

    case 'REMOVE_CUSTOM_VOICE':
      {
        const { engine, voiceId } = action.payload;
        const updatedCustomVoices = (state.settings.customVoices[engine] || []).filter(
          (v) => v.id !== voiceId
        );
        const updatedActiveVoices = {
          ...state.settings.activeVoices,
          [engine]: (state.settings.activeVoices[engine] || []).filter(
            (v) => v.id !== voiceId
          ),
        };
        return {
          ...state,
          settings: {
            ...state.settings,
            customVoices: {
              ...state.settings.customVoices,
              [engine]: updatedCustomVoices,
            },
            activeVoices: updatedActiveVoices,
          },
        };
      }

    case 'ADD_ACTIVE_VOICE':
      {
        const { engine, voice } = action.payload;
        const currentActiveVoices = state.settings.activeVoices[engine] || [];
        const voiceWithEngine = { ...voice, engine };
        if (!currentActiveVoices.some((v) => v.id === voiceWithEngine.id)) {
          let newDefaultVoice = state.settings.defaultVoice;
          const allActiveVoices = Object.values(state.settings.activeVoices).flat();
          if (allActiveVoices.length === 0) {
            newDefaultVoice = { engine, voiceId: voiceWithEngine.id };
          }
          return {
            ...state,
            settings: {
              ...state.settings,
              activeVoices: {
                ...state.settings.activeVoices,
                [engine]: [...currentActiveVoices, voiceWithEngine],
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
        const { engine, voiceId } = action.payload;
        const activeForEngine = state.settings.activeVoices[engine] || [];
        const updatedActiveForEngine = activeForEngine.filter((v) => v.id !== voiceId);
        const newActiveVoices = {
          ...state.settings.activeVoices,
          [engine]: updatedActiveForEngine,
        };
        let newDefaultVoice = state.settings.defaultVoice;
        if (
          state.settings.defaultVoice?.engine === engine &&
          state.settings.defaultVoice?.voiceId === voiceId
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
        const { keyArray, index } = action.payload;
        return {
          ...state,
          settings: {
            ...state.settings,
            [keyArray]: state.settings[keyArray].filter((_, i) => i !== index),
          },
        };
      }

    case 'SET_MODE':
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

    case 'SAVE_TEMPLATE':
      return {
        ...state,
        templates: {
          ...state.templates,
          [action.payload.id]: action.payload,
        },
      };

    case 'DELETE_TEMPLATE':
      {
        const { [action.payload]: removedTemplate, ...remainingTemplates } = state.templates;
        return { ...state, templates: remainingTemplates };
      }

    case 'LOAD_TEMPLATES':
      {
        const loadedTemplates = action.payload && typeof action.payload === 'object' ? action.payload : {};
        return {
          ...state,
          templates: { ...state.templates, ...loadedTemplates },
        };
      }

    case 'SET_DEFAULT_VOICE':
      return {
        ...state,
        settings: { ...state.settings, defaultVoice: action.payload },
      };

    case 'LOAD_ACTIVE_VOICES':
      return {
        ...state,
        settings: { ...state.settings, activeVoices: action.payload },
      };

    case 'LOAD_CUSTOM_VOICES':
      return {
        ...state,
        settings: { ...state.settings, customVoices: action.payload },
      };

    case 'UPDATE_DEFAULT_VOICES':
      return {
        ...state,
        settings: { ...state.settings, defaultVoices: action.payload },
      };

    case 'RESET_STATE':
      devLog('Processing RESET_STATE');
      if (typeof window !== 'undefined') {
        removeFromStorage('tts_persistent_state', 'localStorage');
        removeFromStorage('tts_templates', 'localStorage');
      }
      return initialPersistentState;

    case 'SET_STORAGE_CONFIG':
      return {
        ...state,
        settings: {
          ...state.settings,
          storageConfig: action.payload,
        },
      };

    default:
      devLog('Unhandled action type in ttsReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}