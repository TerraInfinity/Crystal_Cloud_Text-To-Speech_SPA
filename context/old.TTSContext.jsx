import React, { createContext, useContext, useReducer, useEffect, useState, useMemo } from 'react';
import { initialState } from './ttsDefaults';

// Helper function for development logging
const devLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[TTSContext]', ...args);
  }
};

// Storage abstraction functions
const saveToStorage = (key, value) => {
  try {
    if (typeof value === 'string') {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
};

const loadFromStorage = (key, isString = false) => {
  try {
    const value = localStorage.getItem(key);
    if (value) {
      return isString ? value : JSON.parse(value);
    }
    return null;
  } catch (error) {
    console.error(`Error loading ${key} from storage:`, error);
    return null;
  }
};

const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove ${key}:`, error);
  }
};

// Reducer to handle state changes
function ttsReducer(state, action) {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };
    case 'SET_INPUT_TYPE':
      return { ...state, inputType: action.payload };
    case 'SET_TEMPLATE':
      return { ...state, currentTemplate: action.payload };
    case 'SET_SECTIONS':
      return { ...state, sections: action.payload };
    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.payload] };
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.id ? action.payload : section
        ),
      };
    case 'REMOVE_SECTION':
      return {
        ...state,
        sections: state.sections.filter(section => section.id !== action.payload),
      };
    case 'REORDER_SECTIONS':
      return { ...state, sections: action.payload };
    case 'SET_SPEECH_ENGINE':
      return {
        ...state,
        settings: {
          ...state.settings,
          speechEngine: action.payload,
        },
      };
    case 'SET_SELECTED_VOICE': {
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
    case 'ADD_CUSTOM_VOICE': {
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
    case 'REMOVE_CUSTOM_VOICE': {
      const { engine: removeEngine, voiceId } = action.payload;
      const updatedCustomVoices = (state.settings.customVoices[removeEngine] || []).filter(v => v.id !== voiceId);
      const updatedActiveVoices = {
        ...state.settings.activeVoices,
        [removeEngine]: (state.settings.activeVoices[removeEngine] || []).filter(v => v.id !== voiceId),
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
    case 'ADD_ACTIVE_VOICE': {
      const { engine: activeEngine, voice: activeVoice } = action.payload;
      const currentActiveVoices = state.settings.activeVoices[activeEngine] || [];
      const voiceWithEngine = { ...activeVoice, engine: activeEngine };
      if (!currentActiveVoices.some(v => v.id === voiceWithEngine.id)) {
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
      return state;
    }
    case 'REMOVE_ACTIVE_VOICE': {
      const { engine: removeActiveEngine, voiceId } = action.payload;
      const activeForEngine = state.settings.activeVoices[removeActiveEngine] || [];
      const updatedActiveForEngine = activeForEngine.filter(v => v.id !== voiceId);
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
        newDefaultVoice = allRemainingVoices.length > 0
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
    case 'SET_API_KEY': {
      const { keyName, value } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          [keyName]: value,
        },
      };
    }
    case 'ADD_API_KEY': {
      const { keyArray, keyValue } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          [keyArray]: [...(state.settings[keyArray] || []), keyValue],
        },
      };
    }
    case 'REMOVE_API_KEY': {
      const { keyArray: removeKeyArray, index: removeIndex } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          [removeKeyArray]: state.settings[removeKeyArray].filter((_, i) => i !== removeIndex),
        },
      };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
    case 'SET_GENERATED_AUDIO':
      devLog('Reducer: SET_GENERATED_AUDIO', action.payload);
      return {
        ...state,
        generatedAudios: {
          ...state.generatedAudios,
          [action.payload.sectionId]: action.payload.audioUrl,
        },
      };
    case 'SET_MERGED_AUDIO':
      devLog('Reducer: SET_MERGED_AUDIO', action.payload);
      return { ...state, mergedAudio: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SAVE_AUDIO':
      return {
        ...state,
        savedAudios: {
          ...state.savedAudios,
          [action.payload.id]: action.payload,
        },
      };
    case 'DELETE_AUDIO':
      const { [action.payload]: removedAudio, ...remainingAudios } = state.savedAudios;
      return { ...state, savedAudios: remainingAudios };
    case 'LOAD_AUDIO_LIBRARY':
      return {
        ...state,
        savedAudios: action.payload && typeof action.payload === 'object' ? action.payload : {},
      };
    case 'SET_SELECTED_AUDIO':
      return { ...state, selectedAudioId: action.payload };
    case 'SET_MODE':
      const newMode = action.payload;
      if (newMode === 'demo') {
        const filteredActiveVoices = {};
        Object.keys(state.settings.activeVoices).forEach(engine => {
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
    case 'LOAD_DEMO_CONTENT': {
      const { mode, speechEngine, ...rest } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          ...(mode !== undefined ? { mode } : {}),
          ...(speechEngine !== undefined ? { speechEngine } : {}),
        },
        ...rest,
      };
    }
    case 'RESET_STATE':
      if (typeof window !== 'undefined') {
        removeFromStorage('tts_active_voices');
        removeFromStorage('tts_default_voice');
        removeFromStorage('tts_custom_voices');
        removeFromStorage('tts_elevenLabsApiKeys');
        removeFromStorage('tts_awsPollyCredentials');
        removeFromStorage('tts_googleCloudCredentials');
        removeFromStorage('tts_azureTTSCredentials');
        removeFromStorage('tts_ibmWatsonCredentials');
        removeFromStorage('tts_anthropicApiKey');
        removeFromStorage('tts_openaiApiKey');
        removeFromStorage('tts_mode');
      }
      return {
        ...state, // Preserve the current state
        settings: initialState.settings, // Reset only the settings object
        activeTab: 'settings', // Set activeTab to 'settings'

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
      const { [action.payload]: removedTemplate, ...remainingTemplates } = state.templates;
      return { ...state, templates: remainingTemplates };
    case 'LOAD_TEMPLATES':
      return {
        ...state,
        templates: action.payload && typeof action.payload === 'object' ? action.payload : {},
      };
    case 'SET_DEFAULT_VOICE':
      return { ...state, settings: { ...state.settings, defaultVoice: action.payload } };
    case 'LOAD_ACTIVE_VOICES':
      return { ...state, settings: { ...state.settings, activeVoices: action.payload } };
    case 'LOAD_CUSTOM_VOICES':
      return { ...state, settings: { ...state.settings, customVoices: action.payload } };
    default:
      return state;
  }
}

// Create context
const TTSContext = createContext();

// Provider component
export const TTSProvider = ({ children }) => {
  const [state, dispatch] = useReducer(ttsReducer, initialState);
  const [processingMode, setProcessingMode] = useState('local');
  const [remoteEndpoint, setRemoteEndpoint] = useState('https://tts.terrainfinity.ca');

  // Load initial settings, including theme, on mount
  useEffect(() => {
    let isMounted = true;

    const initApp = () => {
      if (typeof window !== 'undefined' && isMounted) {
        const audios = loadFromStorage('tts_audio_library') || {};
        dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audios });

        const templates = loadFromStorage('tts_templates') || {};
        dispatch({ type: 'LOAD_TEMPLATES', payload: templates });

        const activeVoices = loadFromStorage('tts_active_voices');
        if (activeVoices) dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: activeVoices });

        const defaultVoice = loadFromStorage('tts_default_voice');
        if (defaultVoice) dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoice });

        const customVoices = loadFromStorage('tts_custom_voices');
        if (customVoices) dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: customVoices });

        const arrayKeys = [
          'elevenLabsApiKeys',
          'awsPollyCredentials',
          'googleCloudCredentials',
          'azureTTSCredentials',
          'ibmWatsonCredentials',
        ];
        arrayKeys.forEach((key) => {
          const value = loadFromStorage(`tts_${key}`);
          if (value) dispatch({ type: 'SET_API_KEY', payload: { keyName: key, value } });
        });

        const stringKeys = ['anthropicApiKey', 'openaiApiKey'];
        stringKeys.forEach((key) => {
          const value = loadFromStorage(`tts_${key}`, true);
          if (value) dispatch({ type: 'SET_API_KEY', payload: { keyName: key, value } });
        });

        const savedMode = loadFromStorage('tts_mode', true);
        if (savedMode) dispatch({ type: 'SET_MODE', payload: savedMode });

        // Load theme using loadFromStorage
        const savedTheme = loadFromStorage('theme', true);
        if (savedTheme) {
          dispatch({ type: 'SET_THEME', payload: savedTheme });
        } else {
          dispatch({ type: 'SET_THEME', payload: 'light' }); // Default to 'light'
        }
      }
    };

    initApp();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save theme to local storage and apply to document when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      saveToStorage('theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  // Load demo content
  const loadDemoContent = async () => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      const response = await fetch('/demo_kundalini_kriya.json');
      if (!response.ok) throw new Error('Failed to load demo content');
      const demoData = await response.json();
      dispatch({
        type: 'LOAD_DEMO_CONTENT',
        payload: {
          currentTemplate: 'yogaKriya',
          sections: demoData.sections,
          mode: 'demo',
          speechEngine: 'gtts',
        },
      });
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'success', message: 'Demo content loaded successfully!' },
      });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: `Error loading demo content: ${error.message}`,
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  // Clear notifications after 5 seconds
  useEffect(() => {
    if (state.notification) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: null });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.notification]);

  // Save effects for other state
  useEffect(() => saveToStorage('tts_active_voices', state.settings.activeVoices), [state.settings.activeVoices]);
  useEffect(() => saveToStorage('tts_default_voice', state.settings.defaultVoice), [state.settings.defaultVoice]);
  useEffect(() => saveToStorage('tts_custom_voices', state.settings.customVoices), [state.settings.customVoices]);
  useEffect(() => saveToStorage('tts_elevenLabsApiKeys', state.settings.elevenLabsApiKeys), [state.settings.elevenLabsApiKeys]);
  useEffect(() => saveToStorage('tts_awsPollyCredentials', state.settings.awsPollyCredentials), [state.settings.awsPollyCredentials]);
  useEffect(() => saveToStorage('tts_googleCloudCredentials', state.settings.googleCloudCredentials), [state.settings.googleCloudCredentials]);
  useEffect(() => saveToStorage('tts_azureTTSCredentials', state.settings.azureTTSCredentials), [state.settings.azureTTSCredentials]);
  useEffect(() => saveToStorage('tts_ibmWatsonCredentials', state.settings.ibmWatsonCredentials), [state.settings.ibmWatsonCredentials]);
  useEffect(() => saveToStorage('tts_anthropicApiKey', state.settings.anthropicApiKey), [state.settings.anthropicApiKey]);
  useEffect(() => saveToStorage('tts_openaiApiKey', state.settings.openaiApiKey), [state.settings.openaiApiKey]);
  useEffect(() => saveToStorage('tts_mode', state.settings.mode), [state.settings.mode]);

  // Memoized actions object
  const actions = useMemo(() => ({
    setInputText: (text) => dispatch({ type: 'SET_INPUT_TEXT', payload: text }),
    setInputType: (type) => dispatch({ type: 'SET_INPUT_TYPE', payload: type }),
    setTemplate: (template) => dispatch({ type: 'SET_TEMPLATE', payload: template }),
    addSection: (section) => dispatch({ type: 'ADD_SECTION', payload: section }),
    updateSection: (section) => dispatch({ type: 'UPDATE_SECTION', payload: section }),
    removeSection: (sectionId) => dispatch({ type: 'REMOVE_SECTION', payload: sectionId }),
    reorderSections: (sections) => dispatch({ type: 'REORDER_SECTIONS', payload: sections }),
    setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
    setSelectedVoice: (engine, voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: { engine, voice } }),
    addCustomVoice: (engine, voice) => dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice } }),
    removeCustomVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } }),
    addActiveVoice: (engine, voice) => dispatch({ type: 'ADD_ACTIVE_VOICE', payload: { engine, voice } }),
    removeActiveVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } }),
    setApiKey: (keyName, value) => dispatch({ type: 'SET_API_KEY', payload: { keyName, value } }),
    addApiKey: (keyArray, keyValue) => dispatch({ type: 'ADD_API_KEY', payload: { keyArray, keyValue } }),
    removeApiKey: (keyArray, index) => dispatch({ type: 'REMOVE_API_KEY', payload: { keyArray, index } }),
    setActiveTab: (tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
    loadDemoContent,
    setNotification: (notification) => dispatch({ type: 'SET_NOTIFICATION', payload: notification }),
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
    setProcessing: (isProcessing) => dispatch({ type: 'SET_PROCESSING', payload: isProcessing }),
    setGeneratedAudio: (sectionId, audioUrl) => {
      devLog('Action: setGeneratedAudio', { sectionId, audioUrl });
      dispatch({ type: 'SET_GENERATED_AUDIO', payload: { sectionId, audioUrl } });
    },
    setMergedAudio: (audioUrl) => {
      devLog('Action: setMergedAudio', audioUrl);
      dispatch({ type: 'SET_MERGED_AUDIO', payload: audioUrl });
    },
    setPlaying: (isPlaying) => dispatch({ type: 'SET_PLAYING', payload: isPlaying }),
    saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
    deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),
    setSelectedAudio: (audioId) => dispatch({ type: 'SET_SELECTED_AUDIO', payload: audioId }),
    updateAudio: (audioId, audioData) =>
      dispatch({ type: 'SAVE_AUDIO', payload: { ...audioData, id: audioId } }),
    addAudioToSection: (audio) => {
      const newSection = {
        id: `section-${Date.now()}`,
        title: `Audio: ${audio.name}`,
        type: 'audio-only',
        audioId: audio.id,
      };
      dispatch({ type: 'ADD_SECTION', payload: newSection });
      dispatch({
        type: 'SET_GENERATED_AUDIO',
        payload: { sectionId: newSection.id, audioUrl: audio.url },
      });
    },
    resetState: () => dispatch({ type: 'RESET_STATE' }),
    saveTemplate: (template) => {
      dispatch({ type: 'SAVE_TEMPLATE', payload: template });
      try {
        const templates = JSON.parse(localStorage.getItem('tts_templates') || '{}');
        templates[template.id] = template;
        localStorage.setItem('tts_templates', JSON.stringify(templates));
      } catch (error) {
        console.error('Error saving template:', error);
      }
    },
    deleteTemplate: (templateId) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      try {
        const templates = JSON.parse(localStorage.getItem('tts_templates') || '{}');
        delete templates[templateId];
        localStorage.setItem('tts_templates', JSON.stringify(templates));
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    },
    loadTemplates: () => {
      try {
        const savedTemplates = localStorage.getItem('tts_templates');
        if (savedTemplates) {
          const templates = JSON.parse(savedTemplates);
          dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    },
    setDefaultVoice: (engine, voiceId) =>
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: { engine, voiceId } }),
  }), [dispatch]);

  // Context value
  const value = {
    state,
    dispatch,
    actions,
    processingMode,
    setProcessingMode,
    remoteEndpoint,
    setRemoteEndpoint,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
};

// Custom hook to use the TTS context
export const useTTS = () => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};

// Export the context for advanced usage
export { TTSContext };