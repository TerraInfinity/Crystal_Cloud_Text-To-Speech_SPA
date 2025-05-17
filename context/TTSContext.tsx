import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useRef } from 'react';
import isEqual from 'lodash/isequal';
import { initialPersistentState } from './ttsDefaults';
import { saveToStorage } from './storage';
import { ttsReducer } from './ttsReducer';
import { fileStorageReducer, initialFileStorageState } from './fileStorageReducer';
import { createTtsActions } from './ttsActions';
import { createFileStorageActions } from './fileStorageActions';
import { TTSSessionProvider } from './TTSSessionContext';
import { devLog } from '../utils/logUtils';
import { TTSState, TTSAction, FileStorageState, FileStorageAction } from './types/types';
import { NotificationProvider, useNotification } from './notificationContext';
import { useTTSInitialization } from './TTSContextInitialization';

interface TTSContextValue {
  state: TTSState;
  dispatch: React.Dispatch<TTSAction>;
  actions: ReturnType<typeof createTtsActions> & { fileStorageActions: ReturnType<typeof createFileStorageActions> };
  processingMode: string;
  setProcessingMode: React.Dispatch<React.SetStateAction<string>>;
  remoteEndpoint: string;
  setRemoteEndpoint: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  initialPersistentState: TTSState;

}

interface FileStorageContextValue {
  state: FileStorageState;
  dispatch: React.Dispatch<FileStorageAction>;
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

let cachedState: TTSState | null = null;

function throttle<T extends (...args: any[]) => any>(func: T, delay: number) {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      return func(...args);
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      return new Promise(resolve => {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          timeoutId = null;
          resolve(func(...args));
        }, delay - timeSinceLastCall);
      });
    }
  };
}

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addNotification } = useNotification();
  const getInitialState = (): TTSState => {
    if (cachedState) {
      devLog('Using cached state for HMR');
      return cachedState;
    }
    return initialPersistentState;
  };

  const [state, dispatch] = useReducer(ttsReducer, getInitialState());
  const [fileStorageState, fileStorageDispatch] = useReducer(fileStorageReducer, initialFileStorageState);
  const [processingMode, setProcessingMode] = useState('local');
  const [remoteEndpoint, setRemoteEndpoint] = useState('https://tts.terrainfinity.ca');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStateRef = useRef<TTSState | null>(null);
  const previousFileStorageStateRef = useRef<FileStorageState | null>(null);
  const fileStorageStateRef = useRef<FileStorageState>(fileStorageState);
  const hasFetchedAudioLibrary = useRef(false);
  const actions = useMemo(() => createTtsActions(dispatch, addNotification), [addNotification]);
  const fileStorageActions = useMemo(() => createFileStorageActions(fileStorageDispatch), []);

  const { isLoading, progress, currentTask } = useTTSInitialization(dispatch, fileStorageDispatch);

  useEffect(() => {
    fileStorageStateRef.current = fileStorageState;
  }, [fileStorageState]);

  const throttledFetchAudioLibrary = useMemo(
    () => throttle(() => fileStorageActions.fetchAudioLibrary(), 2000),
    [fileStorageActions]
  );

  const resetAudioLibraryFetch = () => {
    hasFetchedAudioLibrary.current = false;
    fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
    throttledFetchAudioLibrary();
  };

  useEffect(() => {
    if (isLoading) return;

    if (
      previousStateRef.current &&
      isEqual(previousStateRef.current, state) &&
      previousFileStorageStateRef.current &&
      isEqual(previousFileStorageStateRef.current, fileStorageState)
    ) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveToStorage('tts_persistent_state', state, 'localStorage');
        devLog('Saved persistent state to localStorage', { state });
        await saveToStorage('theme', state.theme, 'localStorage');
        devLog('Saved theme to localStorage', { theme: state.theme });
        await saveToStorage('tts_available_voices', state.settings.availableVoices, 'localStorage');
        devLog('Saved available voices to localStorage', { availableVoices: state.settings.availableVoices });
        await saveToStorage('tts_active_voices', state.settings.activeVoices, 'localStorage');
        devLog('Saved active voices to localStorage', { activeVoices: state.settings.activeVoices });
        await saveToStorage('tts_custom_voices', state.settings.customVoices, 'localStorage');
        devLog('Saved custom voices to localStorage', { customVoices: state.settings.customVoices });
        await saveToStorage('tts_default_voice', state.settings.defaultVoice, 'localStorage');
        devLog('Saved default voice to localStorage', { defaultVoice: state.settings.defaultVoice });
        await saveToStorage('file_server_file_history', fileStorageState.fileHistory, 'localStorage');
        devLog('Saved file history to localStorage', { fileHistory: fileStorageState.fileHistory });
        await saveToStorage('file_server_audio_library', fileStorageState.audioLibrary, 'localStorage');
        devLog('Saved audio library to localStorage', { audioLibrary: fileStorageState.audioLibrary });

        const apiKeys = [
          'elevenLabsApiKeys',
          'awsPollyCredentials',
          'googleCloudCredentials',
          'azureTTSCredentials',
          'ibmWatsonCredentials',
        ];
        for (const key of apiKeys) {
          const value = state.settings[key];
          if (value !== undefined) {
            await saveToStorage(`tts_${key}`, value, 'localStorage');
            devLog(`Saved ${key} to localStorage`, { [key]: value });
          }
        }

        previousStateRef.current = { ...state };
        previousFileStorageStateRef.current = { ...fileStorageState };
      } catch (error) {
        devLog('Error saving state to localStorage:', error, true);
        addNotification({ type: 'error', message: 'Failed to save state' });
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, fileStorageState, isLoading, addNotification]);

  if (isLoading) {
    return (
      <div id="tts-loading-state" aria-live="polite" aria-busy="true">
        <div className="spinner"></div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>
        </div>
        <span>{currentTask}</span>
      </div>
    );
  }

  const value: TTSContextValue = {
    state,
    dispatch,
    actions: { ...actions, fileStorageActions },
    processingMode,
    setProcessingMode,
    remoteEndpoint,
    setRemoteEndpoint,
    isLoading,
    initialPersistentState,

  };

  const fileStorageValue: FileStorageContextValue = {
    state: fileStorageState,
    dispatch: fileStorageDispatch,
    actions: fileStorageActions,
  };

  return (
    <TTSContext.Provider value={value}>
      <FileStorageContext.Provider value={fileStorageValue}>
        <NotificationProvider>
          <TTSSessionProvider>{children}</TTSSessionProvider>
        </NotificationProvider>
      </FileStorageContext.Provider>
    </TTSContext.Provider>
  );
};

export { TTSContext, FileStorageContext };