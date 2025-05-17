import { initialPersistentState } from './ttsDefaults';
import { removeFromStorage } from './storage';
import { devLog } from '../utils/logUtils';
import { Voice, validateVoiceObject, getDefaultVoices, validateVoice } from '../utils/voiceUtils';

interface TTSState {
  theme: string;
  templates: Record<string, any>;
  settings: {
    speechEngine: string;
    availableVoices: Record<string, Voice[]>;
    customVoices: Record<string, Voice[]>;
    activeVoices: Voice[];
    defaultVoice: Voice | null;
    mode: string;
    storageConfig: {
      type: string;
      serverUrl: string;
      serviceType: string | null;
    };
  };
}

type TTSAction =
  | { type: 'LOAD_PERSISTENT_STATE'; payload: TTSState }
  | { type: 'SET_THEME'; payload: string }
  | { type: 'SET_SPEECH_ENGINE'; payload: string }
  | { type: 'ADD_CUSTOM_VOICE'; payload: { engine: string; voice: Voice } }
  | { type: 'REMOVE_CUSTOM_VOICE'; payload: { engine: string; voiceId: string } }
  | { type: 'ADD_ACTIVE_VOICE'; payload: Voice }
  | { type: 'REMOVE_ACTIVE_VOICE'; payload: { engine: string; voiceId: string } }
  | { type: 'SET_DEFAULT_VOICE'; payload: Voice }
  | { type: 'SET_MODE'; payload: string }
  | { type: 'SAVE_TEMPLATE'; payload: { id: string; [key: string]: any } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'LOAD_TEMPLATES'; payload: Record<string, any> }
  | { type: 'LOAD_ACTIVE_VOICES'; payload: Voice[] }
  | { type: 'LOAD_CUSTOM_VOICES'; payload: Record<string, Voice[]> }
  | { type: 'RESET_STATE' }
  | { type: 'SET_STORAGE_CONFIG'; payload: { type: string; serverUrl: string; serviceType: string | null } }
  | { type: 'LOAD_AVAILABLE_VOICES'; payload: Record<string, Voice[]> };

export const ttsReducer = (state: TTSState = initialPersistentState, action: TTSAction): TTSState => {
  switch (action.type) {
    case 'LOAD_PERSISTENT_STATE': {
      // Check if this is the second call during initialization that's overriding our mode
      // This specific payload structure is used in TTSContextInitialization.tsx line ~138
      if (
        action.payload &&
        action.payload.settings &&
        action.payload.settings.availableVoices &&
        action.payload === initialPersistentState // This checks if it's using initialPersistentState as base
      ) {
        // This is the second initialization call that's only meant to update availableVoices
        const mergedAvailableVoices = {
          ...getDefaultVoices(),
          ...action.payload.settings.availableVoices,
        };
        
        // Preserve the current state (including mode) and only update availableVoices
        return {
          ...state,
          settings: {
            ...state.settings,
            availableVoices: mergedAvailableVoices,
          },
        };
      }
      
      // For all other cases, do a proper merge but preserve the mode if it exists in localStorage
      const savedMode = typeof window !== 'undefined' ? localStorage.getItem('tts_mode') : null;
      
      const mergedAvailableVoices = {
        ...getDefaultVoices(),
        ...action.payload.settings?.availableVoices,
      };
      
      const newState = {
        ...initialPersistentState,
        ...action.payload,
        settings: {
          ...initialPersistentState.settings,
          ...action.payload.settings,
          availableVoices: mergedAvailableVoices,
        },
      };
      
      // If there's a saved mode in localStorage, use it instead of the default
      if (savedMode) {
        newState.settings.mode = savedMode;
      }
      
      return newState;
    }

    case 'SET_MODE': {
      // When mode is set, also save it to localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('tts_mode', action.payload);
      }
      
      return {
        ...state,
        settings: {
          ...state.settings,
          mode: action.payload,
          // Handle the demo mode specific settings
          ...(action.payload === 'demo' ? {
            speechEngine: 'gtts',
            activeVoices: state.settings.activeVoices.filter(voice => voice.engine === 'gtts'),
          } : {}),
        },
      };
    }

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

    case 'ADD_CUSTOM_VOICE': {
      const { engine, voice } = action.payload;
      const validatedVoice = validateVoiceObject({ ...voice, engine });
      if (!validatedVoice.id) {
        devLog(`Invalid custom voice for engine ${engine}:`, validatedVoice, true);
        return state;
      }
      const currentCustom = state.settings.customVoices[engine] || [];
      if (currentCustom.some((v) => v.id === validatedVoice.id)) {
        devLog(`Custom voice already exists for engine ${engine}:`, validatedVoice);
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          customVoices: {
            ...state.settings.customVoices,
            [engine]: [...currentCustom, validatedVoice],
          },
          availableVoices: {
            ...state.settings.availableVoices,
            [engine]: [...(state.settings.availableVoices[engine] || []), validatedVoice],
          },
        },
      };
    }

    case 'REMOVE_CUSTOM_VOICE': {
      const { engine, voiceId } = action.payload;
      const updatedCustom = (state.settings.customVoices[engine] || []).filter((v) => v.id !== voiceId);
      const updatedAvailable = {
        ...state.settings.availableVoices,
        [engine]: (state.settings.availableVoices[engine] || []).filter((v) => v.id !== voiceId),
      };
      const updatedActive = state.settings.activeVoices.filter((v) => v.id !== voiceId || v.engine !== engine);
      let newDefaultVoice = state.settings.defaultVoice;
      if (newDefaultVoice?.id === voiceId && newDefaultVoice.engine === engine) {
        newDefaultVoice = updatedActive.length > 0 ? updatedActive[0] : null;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          customVoices: { ...state.settings.customVoices, [engine]: updatedCustom },
          availableVoices: updatedAvailable,
          activeVoices: updatedActive,
          defaultVoice: newDefaultVoice,
        },
      };
    }

    case 'ADD_ACTIVE_VOICE': {
      const voice = action.payload;
      if (!voice.id || !voice.name || !voice.language || !voice.engine) {
        devLog('Invalid voice for ADD_ACTIVE_VOICE:', voice, true);
        return state;
      }
      const validatedVoice = validateVoiceObject(voice);
      if (state.settings.activeVoices.some((v) => v.id === validatedVoice.id && v.engine === validatedVoice.engine)) {
        devLog(`Voice already active: ${validatedVoice.id} (${validatedVoice.engine})`);
        return state;
      }
      const newActive = [...state.settings.activeVoices, validatedVoice];
      return {
        ...state,
        settings: {
          ...state.settings,
          activeVoices: newActive,
          defaultVoice: state.settings.activeVoices.length === 0 ? validatedVoice : state.settings.defaultVoice,
        },
      };
    }

    case 'REMOVE_ACTIVE_VOICE': {
      const { engine, voiceId } = action.payload;
      const updatedActive = state.settings.activeVoices.filter((v) => v.id !== voiceId || v.engine !== engine);
      let newDefaultVoice = state.settings.defaultVoice;
      if (newDefaultVoice?.id === voiceId && newDefaultVoice.engine === engine) {
        newDefaultVoice = updatedActive.length > 0 ? updatedActive[0] : null;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          activeVoices: updatedActive,
          defaultVoice: newDefaultVoice,
        },
      };
    }

    case 'SET_DEFAULT_VOICE': {
      const voice = action.payload;
      if (!voice.id || !voice.engine) {
        devLog('Invalid voice for SET_DEFAULT_VOICE:', voice, true);
        return state;
      }
      const validatedVoice = validateVoice(voice, state.settings.activeVoices, state.settings.defaultVoice, true);
      if (validatedVoice && state.settings.activeVoices.some((v) => v.id === validatedVoice.id && v.engine === validatedVoice.engine)) {
        return {
          ...state,
          settings: { ...state.settings, defaultVoice: validatedVoice },
        };
      }
      devLog(`Voice not in activeVoices for SET_DEFAULT_VOICE: ${voice.id} (${voice.engine})`);
      return state;
    }

    case 'LOAD_ACTIVE_VOICES': {
      const voices = action.payload || [];
      const validatedVoices = voices
        .map((voice) => validateVoiceObject(voice))
        .filter((voice) => voice.id && voice.engine);
      const uniqueVoices = validatedVoices.filter(
        (voice, index, self) =>
          index === self.findIndex((v) => v.id === voice.id && v.engine === voice.engine)
      );
      return {
        ...state,
        settings: {
          ...state.settings,
          activeVoices: uniqueVoices,
          defaultVoice:
            state.settings.defaultVoice &&
            uniqueVoices.some(
              (v) => v.id === state.settings.defaultVoice?.id && v.engine === state.settings.defaultVoice?.engine
            )
              ? state.settings.defaultVoice
              : uniqueVoices.length > 0
              ? uniqueVoices[0]
              : null,
        },
      };
    }

    case 'SAVE_TEMPLATE': {
      const template = action.payload;
      // Validate template structure
      if (!template.id || !template.name || !Array.isArray(template.sections)) {
        devLog('Invalid template format:', template, true);
        return state;
      }
      return {
        ...state,
        templates: {
          ...state.templates,
          [template.id]: template,
        },
      };
    }

    case 'DELETE_TEMPLATE': {
      const { [action.payload]: removedTemplate, ...remainingTemplates } = state.templates;
      return { ...state, templates: remainingTemplates };
    }

    case 'LOAD_TEMPLATES': {
      const loadedTemplates = action.payload && typeof action.payload === 'object' ? action.payload : {};
      return {
        ...state,
        templates: { ...state.templates, ...loadedTemplates },
      };
    }

    case 'LOAD_CUSTOM_VOICES': {
      const customVoices = action.payload || {};
      const validatedCustomVoices: Record<string, Voice[]> = {};
      for (const engine in customVoices) {
        validatedCustomVoices[engine] = (customVoices[engine] || []).map((voice: any) =>
          validateVoiceObject(voice)
        );
      }
      const updatedAvailableVoices = { ...state.settings.availableVoices };
      for (const [engine, voices] of Object.entries(validatedCustomVoices)) {
        updatedAvailableVoices[engine] = [
          ...(state.settings.availableVoices[engine] || []),
          ...voices.filter(
            (v) => !(state.settings.availableVoices[engine] || []).some((av) => av.id === v.id)
          ),
        ];
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          customVoices: validatedCustomVoices,
          availableVoices: updatedAvailableVoices,
        },
      };
    }

    case 'RESET_STATE':
      devLog('Resetting state to initial values');
      if (typeof window !== 'undefined') {
        removeFromStorage('tts_persistent_state', 'localStorage');
        removeFromStorage('tts_available_voices', 'localStorage');
        removeFromStorage('tts_active_voices', 'localStorage');
        removeFromStorage('tts_custom_voices', 'localStorage');
        removeFromStorage('tts_default_voice', 'localStorage');
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

    case 'LOAD_AVAILABLE_VOICES': {
      return {
        ...state,
        settings: {
          ...state.settings,
          availableVoices: action.payload,
        },
      };
    }

    default:
      devLog(`Unhandled action type: ${(action as any).type}`, action);
      return state;
  }
};