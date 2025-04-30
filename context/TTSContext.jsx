// context/TTSContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useState, useMemo } from 'react';
import { initialPersistentState } from './ttsDefaults';
import { saveToStorage, loadFromStorage, removeFromStorage, listFromStorage, setGlobalStorageConfig } from './storage';
import { ttsReducer } from './ttsReducer';
import { createTtsActions } from './ttsActions';
import { TTSSessionProvider } from './TTSSessionContext';
import { devLog } from '../utils/logUtils';

// Create the context
const TTSContext = createContext();

// Custom hook to use the context
export const useTTS = () => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};

// Provider component
export const TTSProvider = ({ children }) => {
  // Compute initial state with theme from localStorage
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return initialPersistentState;
    }
    const savedTheme = localStorage.getItem('theme');
    devLog('Loaded savedTheme from localStorage:', savedTheme);
    return {
      ...initialPersistentState,
      theme: savedTheme || initialPersistentState.theme,
    };
  };

  const [state, dispatch] = useReducer(ttsReducer, getInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [processingMode, setProcessingMode] = useState('local');
  const [remoteEndpoint, setRemoteEndpoint] = useState('https://tts.terrainfinity.ca');

  // Define actions using memoization
  const actions = useMemo(() => createTtsActions(dispatch), [dispatch]);

  // Function to fetch gTTS voices
  const fetchGttsVoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/gtts/voices');
      if (!response.ok) {
        throw new Error('Failed to fetch gTTS voices');
      }
      const { voices } = await response.json();
      devLog('Raw gTTS voices from API:', voices);

      // Transform the server's voice data
      const transformedVoices = voices.map((voice) => {
        const voiceId = `${voice.language}-${voice.tld}`;
        return {
          id: voiceId,
          name: voice.name,
          language: voice.language,
          tld: voice.tld,
          engine: 'gtts',
        };
      });

      devLog('Transformed gTTS voices:', transformedVoices);

      // Update defaultVoices.gtts in state
      dispatch({
        type: 'UPDATE_DEFAULT_VOICES',
        payload: {
          ...state.settings.defaultVoices,
          gtts: transformedVoices,
        },
      });
    } catch (error) {
      devLog('Error fetching gTTS voices:', error);
    }
  };

  // Load initial settings and audio library on mount
  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      if (typeof window !== 'undefined' && isMounted) {
        try {
          devLog('Starting app initialization');

          // Apply theme to document immediately
          document.documentElement.setAttribute('data-theme', state.theme);

          // Set global storage config
          setGlobalStorageConfig({
            type: 'local',
            serverUrl: 'http://localhost:5000',
            serviceType: null,
          });
          actions.setStorageConfig({
            type: 'local',
            serverUrl: 'http://localhost:5000',
            serviceType: null,
          });

          // Load persistent state
          const savedState = await loadFromStorage('tts_persistent_state', false, 'localStorage');
          devLog('Loaded persistent state:', savedState);
          if (savedState) {
            dispatch({ type: 'LOAD_PERSISTENT_STATE', payload: savedState });
          } else {
            devLog('No saved persistent state found, using initialPersistentState');
          }

          // Fetch audio library from server
          const files = await listFromStorage('fileStorage');
          const soundEffects = files.reduce((acc, file) => {
            acc[file.id] = {
              id: file.id,
              name: file.name,
              type: file.type,
              size: file.size,
              fileType: file.fileType,
              source: file.source,
              date: file.date,
              placeholder: file.placeholder,
              volume: file.volume,
              url: file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`,
              category: 'sound_effect',
            };
            return acc;
          }, {});
          dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: soundEffects });

          // Load templates
          const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
          devLog('Loaded templates:', templates);
          dispatch({ type: 'LOAD_TEMPLATES', payload: templates });

          // Load legacy keys for backward compatibility
          const activeVoices = await loadFromStorage('tts_active_voices', false, 'localStorage');
          devLog('Loaded activeVoices:', activeVoices);
          if (activeVoices) dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: activeVoices });

          const defaultVoice = await loadFromStorage('tts_default_voice', false, 'localStorage');
          devLog('Loaded defaultVoice:', defaultVoice);
          if (defaultVoice) dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoice });

          const customVoices = await loadFromStorage('tts_custom_voices', false, 'localStorage');
          devLog('Loaded customVoices:', customVoices);
          if (customVoices) dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: customVoices });

          const arrayKeys = [
            'elevenLabsApiKeys',
            'awsPollyCredentials',
            'googleCloudCredentials',
            'azureTTSCredentials',
            'ibmWatsonCredentials',
          ];
          for (const key of arrayKeys) {
            const value = await loadFromStorage(`tts_${key}`, false, 'localStorage');
            devLog(`Loaded ${key}:`, value);
            if (value) dispatch({ type: 'SET_API_KEY', payload: { keyName: key, value } });
          }

          const stringKeys = ['anthropicApiKey', 'openaiApiKey'];
          for (const key of stringKeys) {
            const value = await loadFromStorage(`tts_${key}`, true, 'localStorage');
            devLog(`Loaded ${key}:`, value);
            if (value) dispatch({ type: 'SET_API_KEY', payload: { keyName: key, value } });
          }

          const savedMode = await loadFromStorage('tts_mode', true, 'localStorage');
          devLog('Loaded savedMode:', savedMode);
          if (savedMode) dispatch({ type: 'SET_MODE', payload: savedMode });

          const savedStorageConfig = await loadFromStorage('tts_storage_config', false, 'localStorage');
          devLog('Loaded savedStorageConfig:', savedStorageConfig);
          if (savedStorageConfig) {
            dispatch({ type: 'SET_STORAGE_CONFIG', payload: savedStorageConfig });
          }

          // Fetch gTTS voices
          await fetchGttsVoices();

          devLog('App initialization completed');
        } catch (error) {
          devLog('Error during initialization:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    devLog('Initialization effect triggered');
    initApp();

    return () => {
      devLog('Initialization cleanup');
      isMounted = false;
    };
  }, [actions]); // Removed state.theme from dependencies to prevent looping

  // Save persistent state
  useEffect(() => {
    if (!isLoading) {
      saveToStorage('tts_persistent_state', state, 'localStorage')
        .then(() => devLog('Saved persistent state to localStorage'))
        .catch((error) => devLog('Error saving persistent state:', error));
    }
  }, [state, isLoading]);

  // Save theme and apply to document
  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoading) {
      devLog('Saving theme:', state.theme);
      saveToStorage('theme', state.theme, 'localStorage');
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme, isLoading]);

  // Save storageConfig
  useEffect(() => {
    if (!isLoading) {
      devLog('Saving storageConfig:', state.settings.storageConfig);
      saveToStorage('tts_storage_config', state.settings.storageConfig, 'localStorage');
    }
  }, [state.settings.storageConfig, isLoading]);

  // Save settings for backward compatibility
  useEffect(() => {
    if (!isLoading) {
      devLog('Saving activeVoices:', state.settings.activeVoices);
      saveToStorage('tts_active_voices', state.settings.activeVoices, 'localStorage');
    }
  }, [state.settings.activeVoices, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving defaultVoice:', state.settings.defaultVoice);
      saveToStorage('tts_default_voice', state.settings.defaultVoice, 'localStorage');
    }
  }, [state.settings.defaultVoice, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving customVoices:', state.settings.customVoices);
      saveToStorage('tts_custom_voices', state.settings.customVoices, 'localStorage');
    }
  }, [state.settings.customVoices, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving elevenLabsApiKeys:', state.settings.elevenLabsApiKeys);
      saveToStorage('tts_elevenLabsApiKeys', state.settings.elevenLabsApiKeys, 'localStorage');
    }
  }, [state.settings.elevenLabsApiKeys, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving awsPollyCredentials:', state.settings.awsPollyCredentials);
      saveToStorage('tts_awsPollyCredentials', state.settings.awsPollyCredentials, 'localStorage');
    }
  }, [state.settings.awsPollyCredentials, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving googleCloudCredentials:', state.settings.googleCloudCredentials);
      saveToStorage('tts_googleCloudCredentials', state.settings.googleCloudCredentials, 'localStorage');
    }
  }, [state.settings.googleCloudCredentials, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving azureTTSCredentials:', state.settings.azureTTSCredentials);
      saveToStorage('tts_azureTTSCredentials', state.settings.azureTTSCredentials, 'localStorage');
    }
  }, [state.settings.azureTTSCredentials, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving ibmWatsonCredentials:', state.settings.ibmWatsonCredentials);
      saveToStorage('tts_ibmWatsonCredentials', state.settings.ibmWatsonCredentials, 'localStorage');
    }
  }, [state.settings.ibmWatsonCredentials, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving anthropicApiKey:', state.settings.anthropicApiKey);
      saveToStorage('tts_anthropicApiKey', state.settings.anthropicApiKey, 'localStorage');
    }
  }, [state.settings.anthropicApiKey, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving openaiApiKey:', state.settings.openaiApiKey);
      saveToStorage('tts_openaiApiKey', state.settings.openaiApiKey, 'localStorage');
    }
  }, [state.settings.openaiApiKey, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      devLog('Saving mode:', state.settings.mode);
      saveToStorage('tts_mode', state.settings.mode, 'localStorage');
    }
  }, [state.settings.mode, isLoading]);

  // Save templates
  useEffect(() => {
    if (!isLoading) {
      devLog('Saving templates:', state.templates);
      saveToStorage('tts_templates', state.templates, 'localStorage');
    }
  }, [state.templates, isLoading]);

  // Save audio library
  useEffect(() => {
    if (!isLoading) {
      devLog('Saving audio library:', state.AudioLibrary);
      saveToStorage('tts_audio_library', state.AudioLibrary, 'localStorage');
    }
  }, [state.AudioLibrary, isLoading]);

  // Render loading state
  if (isLoading) {
    return <div>Loading persistent state...</div>;
  }

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

  return (
    <TTSContext.Provider value={value}>
      <TTSSessionProvider>{children}</TTSSessionProvider>
    </TTSContext.Provider>
  );
};

export { TTSContext };