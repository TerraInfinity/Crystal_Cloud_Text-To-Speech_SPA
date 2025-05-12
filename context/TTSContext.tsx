// context/TTSContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useRef } from 'react';
import { initialPersistentState } from './ttsDefaults';
import { saveToStorage, loadFromStorage, listFromStorage, setGlobalStorageConfig } from './storage';
import { ttsReducer } from './ttsReducer';
import { fileStorageReducer, initialFileStorageState,  } from './fileStorageReducer';
import { createTtsActions } from './ttsActions';
import { createFileStorageActions } from './fileStorageActions';
import { TTSSessionProvider } from './TTSSessionContext';
import { devLog } from '../utils/logUtils';
import { FileStorageState, FileStorageActions } from './types/types';

// Define interfaces
interface TTSState {
  theme: string;
  settings: {
    speechEngine: string;
    selectedVoices: Record<string, any>;
    customVoices: Record<string, any[]>;
    activeVoices: Record<string, any[]>;
    defaultVoice: { engine: string; voiceId: string } | null;
    defaultVoices: Record<string, any[]>;
    mode: string;
    storageConfig: { type: string; serverUrl: string; serviceType: string | null };
    elevenLabsApiKeys: any[];
    awsPollyCredentials: any[];
    googleCloudCredentials: any[];
    azureTTSCredentials: any[];
    ibmWatsonCredentials: any[];
    anthropicApiKey: string;
    openaiApiKey: string;
  };
  templates: Record<string, any>;
}

interface TTSContextValue {
  state: TTSState;
  dispatch: React.Dispatch<any>;
  actions: ReturnType<typeof createTtsActions>;
  processingMode: string;
  setProcessingMode: React.Dispatch<React.SetStateAction<string>>;
  remoteEndpoint: string;
  setRemoteEndpoint: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
}

interface FileStorageContextValue {
  state: FileStorageState;
  dispatch: React.Dispatch<any>;
  actions: ReturnType<typeof createFileStorageActions>;
}

const TTSContext = createContext<TTSContextValue | undefined>(undefined);
const FileStorageContext = createContext<FileStorageContextValue | undefined>(undefined);

export const useTTSContext = (): TTSContextValue => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};

export const useFileStorage = (): FileStorageContextValue => {
  const context = useContext(FileStorageContext);
  if (context === undefined) {
    throw new Error('useFileStorage must be used within a TTSProvider');
  }
  return context;
};

// Singleton cache for HMR
let cachedState: TTSState | null = null;

function throttle<T extends (...args: any[]) => any>(func: T, delay: number) {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      return func(...args);
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        func(...args);
      }, delay - timeSinceLastCall);
    }
  };
}

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state with singleton cache
  const getInitialState = (): TTSState => {
    if (cachedState) {
      devLog('Using cached state for HMR');
      return cachedState;
    }
    return initialPersistentState;
  };

  const [state, dispatch] = useReducer(ttsReducer, getInitialState());
  const [fileStorageState, fileStorageDispatch] = useReducer(fileStorageReducer, initialFileStorageState);
  const [isLoading, setIsLoading] = useState(true);
  const [processingMode, setProcessingMode] = useState('local');
  const [remoteEndpoint, setRemoteEndpoint] = useState('https://tts.terrainfinity.ca');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStateRef = useRef<TTSState | null>(null);
  const previousFileStorageStateRef = useRef<FileStorageState | null>(null);
  const hasFetchedAudioLibrary = useRef(false);


  const actions = useMemo(() => createTtsActions(dispatch), []);
  const fileStorageActions = useMemo(() => createFileStorageActions(fileStorageDispatch), []);

  // Throttle fetchAudioLibrary to prevent rapid calls
  const throttledFetchAudioLibrary = useMemo(
    () => throttle(() => fileStorageActions.fetchAudioLibrary(), 2000),
    [fileStorageActions]
  );

  const resetAudioLibraryFetch = () => {
    hasFetchedAudioLibrary.current = false;

    fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
    throttledFetchAudioLibrary();
  };

  // Load theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      devLog('Loaded savedTheme from localStorage:', savedTheme);
      if (savedTheme && savedTheme !== state.theme) {
        dispatch({ type: 'SET_THEME', payload: savedTheme });
      }
      cachedState = { ...state, theme: savedTheme || state.theme };
      document.documentElement.setAttribute('data-theme', savedTheme || state.theme);
    }
  }, []); // Run only once on mount

  // Update current state reference with debounced updates
  useEffect(() => {
    if (isLoading) return;

    const updateState = () => {
      if (actions.updateCurrentState) {
        actions.updateCurrentState(state);
      }
      if (fileStorageActions.updateCurrentState) {
        fileStorageActions.updateCurrentState(fileStorageState);
      }
    };

    const timeoutId = setTimeout(updateState, 500); // Debounce updates
    return () => clearTimeout(timeoutId);
  }, [
    state.theme,
    state.templates,
    state.settings,
    fileStorageState.fileHistory,
    fileStorageState.audioLibrary,
    isLoading,
    actions,
    fileStorageActions,
  ]);

  // Fetch gTTS voices
  const fetchGttsVoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/gtts/voices');
      if (!response.ok) {
        throw new Error('Failed to fetch gTTS voices');
      }
      const { voices } = await response.json();
      devLog('Raw gTTS voices from API:', voices);

      const transformedVoices = voices.map((voice: any) => {
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

      dispatch({
        type: 'UPDATE_DEFAULT_VOICES',
        payload: {
          ...state.settings.defaultVoices,
          gtts: transformedVoices,
        },
      });
    } catch (error) {
      devLog('Error fetching gTTS voices:', error, true);
    }
  };

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      if (typeof window === 'undefined') return;

      try {
        devLog('Starting app initialization');

        // Set global storage config
        setGlobalStorageConfig({
          type: 'local',
          serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
          serviceType: null,
        });
        actions.setStorageConfig({
          type: 'local',
          serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
          serviceType: null,
        });

        // Load persistent state
        const savedState = await loadFromStorage('tts_persistent_state', false, 'localStorage');
        devLog('Loaded persistent state:', savedState);
        if (savedState) dispatch({ type: 'LOAD_PERSISTENT_STATE', payload: savedState });

        // Load file history from localStorage
        const savedFileHistory = await loadFromStorage('file_server_file_history', false, 'localStorage');
        if (savedFileHistory && Array.isArray(savedFileHistory) && savedFileHistory.length > 0) {
          devLog(`Found existing file history with ${savedFileHistory.length} entries`);
          fileStorageDispatch({ type: 'SET_FILE_HISTORY', payload: savedFileHistory });
        }

        // Load audio library from localStorage
        const savedAudioLibrary = await loadFromStorage('file_server_audio_library', false, 'localStorage');
        if (savedAudioLibrary && Array.isArray(savedAudioLibrary) && savedAudioLibrary.length > 0) {
          devLog(`Found existing audio library with ${savedAudioLibrary.length} entries`);
          fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: savedAudioLibrary });
        }

        // Fetch audio library only if empty and not fetched before
        if (
          (!fileStorageState.audioLibrary || fileStorageState.audioLibrary.length === 0) &&
          !hasFetchedAudioLibrary.current
        ) {
          try {
            await throttledFetchAudioLibrary();
            hasFetchedAudioLibrary.current = true;
            devLog('Audio library loaded');
          } catch (error) {
            devLog('Error loading audio library:', error, true);
            fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
          }
        } else {
          devLog('Audio library already loaded or fetched, skipping fetch');
        }

        // Load templates
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        devLog('Loaded templates:', templates);
        dispatch({ type: 'LOAD_TEMPLATES', payload: templates });

        // Load voices
        const activeVoices = await loadFromStorage('tts_active_voices', false, 'localStorage');
        devLog('Loaded activeVoices:', activeVoices);
        if (activeVoices) dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: activeVoices });

        const defaultVoice = await loadFromStorage('tts_default_voice', false, 'localStorage');
        devLog('Loaded defaultVoice:', defaultVoice);
        if (defaultVoice) dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoice });

        const customVoices = await loadFromStorage('tts_custom_voices', false, 'localStorage');
        devLog('Loaded customVoices:', customVoices);
        if (customVoices) dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: customVoices });

        // Load API keys and credentials
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

        // Load mode and storage config
        const savedMode = await loadFromStorage('tts_mode', true, 'localStorage');
        devLog('Loaded savedMode:', savedMode);
        if (savedMode) dispatch({ type: 'SET_MODE', payload: savedMode });

        const savedStorageConfig = await loadFromStorage('tts_storage_config', false, 'localStorage');
        devLog('Loaded savedStorageConfig:', savedStorageConfig);
        if (savedStorageConfig) dispatch({ type: 'SET_STORAGE_CONFIG', payload: savedStorageConfig });

        // Load merged audio
        const loadMergedAudio = async () => {
          try {
            if (fileStorageState.fileHistory.length > 0) {
              devLog(`Skipping merged audio loading - ${fileStorageState.fileHistory.length} entries exist`);
              return;
            }

            let audioFiles = [];
            try {
              audioFiles = await listFromStorage('fileStorage');
            } catch (error) {
              devLog('Error fetching files from storage:', error, true);
              return;
            }

            if (!audioFiles) {
              devLog('No files returned from listFromStorage');
              return;
            }

            if (!Array.isArray(audioFiles)) {
              devLog('Invalid response from listFromStorage, expected array:', audioFiles, true);
              return;
            }

            if (audioFiles.length === 0) {
              devLog('No audio files found in storage');
              return;
            }

            const newFileHistoryEntries = [];
            const newAudioLibraryEntries = [];

            for (const file of audioFiles) {
              if (!file.id || !file.url) {
                devLog('Skipping file with missing fields:', file);
                continue;
              }

              const historyEntry = {
                id: file.id,
                name: file.name || 'Unknown',
                url: file.url,
                type: file.type || 'unknown',
                date: file.date || new Date().toISOString(),
                category: file.category || 'unknown',
              };

              newFileHistoryEntries.push(historyEntry);

              if (file.category === 'merged_audio' || file.type?.includes('audio')) {
                const audioEntry = {
                  ...historyEntry,
                  audioMetadata: {
                    duration: file.audioMetadata?.duration || 0,
                    format: file.audioMetadata?.format || file.type?.split('/')[1] || 'unknown',
                  },
                };
                newAudioLibraryEntries.push(audioEntry);
              }
            }

            if (newFileHistoryEntries.length > 0) {
              devLog(`Adding ${newFileHistoryEntries.length} new file history entries`);
              fileStorageDispatch({ type: 'SET_FILE_HISTORY', payload: newFileHistoryEntries });
            }

            if (newAudioLibraryEntries.length > 0) {
              devLog(`Adding ${newAudioLibraryEntries.length} new audio library entries`);
              fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: newAudioLibraryEntries });
            }
          } catch (error) {
            devLog('Error loading merged audio files:', error, true);
          }
        };

        await loadMergedAudio();
        await fetchGttsVoices();

        devLog('App initialization completed');
      } catch (error) {
        devLog('Error during initialization:', error, true);
      } finally {
        setIsLoading(false);
      }
    };

    devLog('Initialization effect triggered');
    initApp();

    return () => {
      devLog('Initialization cleanup');
    };
  }, []);  // Run only once on mount

  // Consolidated state saving with separate refs for TTSState and FileStorageState
  useEffect(() => {
    if (isLoading) return;

    if (
      previousStateRef.current &&
      JSON.stringify(previousStateRef.current) === JSON.stringify(state) &&
      previousFileStorageStateRef.current &&
      JSON.stringify(previousFileStorageStateRef.current.fileHistory) === JSON.stringify(fileStorageState.fileHistory) &&
      JSON.stringify(previousFileStorageStateRef.current.audioLibrary) === JSON.stringify(fileStorageState.audioLibrary)
    ) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Save main state
        await saveToStorage('tts_persistent_state', state, 'localStorage');
        devLog('Saved persistent state to localStorage');

        // Save individual settings
        await saveToStorage('theme', state.theme, 'localStorage');
        await saveToStorage('tts_storage_config', state.settings.storageConfig, 'localStorage');
        await saveToStorage('tts_active_voices', state.settings.activeVoices, 'localStorage');
        await saveToStorage('tts_default_voice', state.settings.defaultVoice, 'localStorage');
        await saveToStorage('tts_custom_voices', state.settings.customVoices, 'localStorage');
        await saveToStorage('tts_templates', state.templates, 'localStorage');
        await saveToStorage('file_server_file_history', fileStorageState.fileHistory, 'localStorage');
        await saveToStorage('file_server_audio_library', fileStorageState.audioLibrary, 'localStorage');

        // Save API keys
        const apiKeys = [
          'elevenLabsApiKeys',
          'awsPollyCredentials',
          'googleCloudCredentials',
          'azureTTSCredentials',
          'ibmWatsonCredentials',
          'anthropicApiKey',
          'openaiApiKey',
          'mode',
        ];
        for (const key of apiKeys) {
          const value = state.settings[key];
          if (value !== undefined) {
            await saveToStorage(`tts_${key}`, value, 'localStorage');
          }
        }

        // Update refs
        previousStateRef.current = { ...state };
        previousFileStorageStateRef.current = { ...fileStorageState };
      } catch (error) {
        devLog('Error saving state:', error, true);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, fileStorageState.fileHistory, fileStorageState.audioLibrary, isLoading]);

  if (isLoading) {
    return <div id="tts-loading-state">Loading persistent state...</div>;
  }

  const value: TTSContextValue = {
    state,
    dispatch,
    actions,
    processingMode,
    setProcessingMode,
    remoteEndpoint,
    setRemoteEndpoint,
    isLoading,
  };

  const fileStorageValue: FileStorageContextValue = {
    state: fileStorageState,
    dispatch: fileStorageDispatch,
    actions: fileStorageActions,
  };

  return (
    <TTSContext.Provider value={value}>
      <FileStorageContext.Provider value={fileStorageValue}>
        <TTSSessionProvider>{children}</TTSSessionProvider>
      </FileStorageContext.Provider>
    </TTSContext.Provider>
  );
};

export { TTSContext, FileStorageContext };