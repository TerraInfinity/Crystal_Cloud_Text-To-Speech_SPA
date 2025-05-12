// context/TTSSessionContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useMemo, useState, useRef } from 'react';
import { initialSessionState } from './ttsDefaults';
import { saveToStorage, loadFromStorage } from './storage';
import { ttsSessionReducer } from './ttsSessionReducer';
import { createSessionActions } from './ttsSessionActions';
import { devLog, devError, devWarn } from '../utils/logUtils';
import { loadDemoContent } from './demoContentLoader';

// Extend Window interface to include custom properties
interface TTSConfig {
  sections: any[];
  title?: string;
  description?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    __queuedTTSConfigs?: TTSConfig[];
    ttsSessionDispatch?: React.Dispatch<any>;
  }
}

// Interfaces
interface TTSSessionState {
  title: string;
  description: string;
  sections: any[];
  generatedTTSAudios: Record<string, any>;
  mergedAudio: any;
  notification: { type: string; message: string } | null;
  activeTab: string;
  chunked?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  inputText: string;
  inputType: string;
  selectedInputVoice: any;
  isProcessing: boolean;
  isPlaying: boolean;
  selectedAudioLibraryId: string | null;
  lastAudioInputSelection: {
    audioId: string | null;
    audioCategory: string;
    uploadedAudio: any;
  } | null;
  templateCreation: {
    templateName: string;
    templateDescription: string;
    sections: any[];
    editingTemplate: any;
  };
}

interface TTSSessionContextValue {
  state: TTSSessionState;
  actions: ReturnType<typeof createSessionActions>;
}

// Context
const TTSSessionContext = createContext<TTSSessionContextValue | undefined>(undefined);

// Utility Functions
const estimateObjectSize = (obj: any): number => {
  const jsonStr = JSON.stringify(obj);
  return jsonStr ? jsonStr.length * 2 : 0; // UTF-16 characters are 2 bytes each
};

const MAX_CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB in bytes

const splitStateIntoChunks = (state: TTSSessionState): any[] => {
  const { generatedTTSAudios, mergedAudio, ...stateWithoutAudio } = state;
  const serializedState = JSON.stringify(stateWithoutAudio);
  const totalSize = serializedState.length * 2;

  if (totalSize <= MAX_CHUNK_SIZE) {
    return [stateWithoutAudio];
  }

  const chunks = [];
  const numChunks = Math.ceil(totalSize / MAX_CHUNK_SIZE);
  const baseState = {
    title: stateWithoutAudio.title,
    description: stateWithoutAudio.description,
    chunked: true,
    totalChunks: numChunks,
    inputText: stateWithoutAudio.inputText,
    inputType: stateWithoutAudio.inputType,
    selectedInputVoice: stateWithoutAudio.selectedInputVoice,
    isProcessing: stateWithoutAudio.isProcessing,
    isPlaying: stateWithoutAudio.isPlaying,
    selectedAudioLibraryId: stateWithoutAudio.selectedAudioLibraryId,
    templateCreation: stateWithoutAudio.templateCreation,
  };

  if (stateWithoutAudio.sections && Array.isArray(stateWithoutAudio.sections)) {
    const sectionsPerChunk = Math.ceil(stateWithoutAudio.sections.length / numChunks);
    for (let i = 0; i < numChunks; i++) {
      const start = i * sectionsPerChunk;
      const end = Math.min(start + sectionsPerChunk, stateWithoutAudio.sections.length);
      const chunkSections = stateWithoutAudio.sections.slice(start, end);
      chunks.push({
        ...baseState,
        chunkIndex: i,
        sections: chunkSections,
      });
    }
  } else {
    chunks.push({
      ...baseState,
      chunkIndex: 0,
      sections: [],
    });
  }

  return chunks;
};

const reassembleStateChunks = (stateChunks: any[]): any | null => {
  if (!stateChunks || stateChunks.length === 0) {
    return null;
  }

  if (stateChunks.length === 1 && !stateChunks[0].chunked) {
    return stateChunks[0];
  }

  stateChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  const reassembledState = { ...stateChunks[0] };
  const allSections = [...(reassembledState.sections || [])];

  for (let i = 1; i < stateChunks.length; i++) {
    if (stateChunks[i].sections) {
      allSections.push(...stateChunks[i].sections);
    }
  }

  reassembledState.sections = allSections;
  delete reassembledState.chunked;
  delete reassembledState.chunkIndex;
  delete reassembledState.totalChunks;

  return reassembledState;
};

const createStorageOptimizedState = (state: TTSSessionState): any => {
  try {
    const { generatedTTSAudios, mergedAudio, ...baseState } = state;
    const minimalState = { ...baseState };

    if (estimateObjectSize(minimalState) > 4000000) {
      devLog('State too large, trimming section text content');
      if (minimalState.sections && Array.isArray(minimalState.sections)) {
        minimalState.sections = minimalState.sections.map(section => {
          const { text, ...sectionWithoutText } = section;
          if (text && typeof text === 'string' && text.length > 100) {
            sectionWithoutText.textPreview = text.substring(0, 100) + '...';
          } else {
            sectionWithoutText.text = text;
          }
          return sectionWithoutText;
        });
      }
    }

    return minimalState;
  } catch (error) {
    devError('Error creating storage-optimized state:', error);
    return {
      sections: state.sections?.map(s => ({ id: s.id, title: s.title, type: s.type })) || [],
      title: state.title,
      description: state.description,
      inputText: state.inputText,
      inputType: state.inputType,
      selectedInputVoice: state.selectedInputVoice,
      isProcessing: state.isProcessing,
      isPlaying: state.isPlaying,
      selectedAudioLibraryId: state.selectedAudioLibraryId,
      templateCreation: state.templateCreation,
    };
  }
};

const cleanupOldSessionStorage = (): void => {
  try {
    const chunkKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('tts_session_chunk_')) {
        chunkKeys.push(key);
      }
    }

    if (chunkKeys.length > 0) {
      devLog(`Cleaning up ${chunkKeys.length} old session chunks`);
      chunkKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
    }

    const oldKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key !== 'tts_session_state' && key.includes('tts_session')) {
        oldKeys.push(key);
      }
    }

    if (oldKeys.length > 0) {
      devLog(`Cleaning up ${oldKeys.length} old session states`);
      oldKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
    }
  } catch (error) {
    devError('Error cleaning up old session storage:', error);
  }
};

// Provider Component
export const TTSSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(ttsSessionReducer, initialSessionState);
  const [isLoading, setIsLoading] = useState(true);
  const actions = useMemo(() => createSessionActions(dispatch, loadDemoContent), [dispatch]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    window.ttsSessionDispatch = dispatch;
    return () => {
      delete window.ttsSessionDispatch;
    };
  }, [dispatch]);

  useEffect(() => {
    const loadState = async () => {
      try {
        cleanupOldSessionStorage();
        const savedState = await loadFromStorage('tts_session_state', false, 'sessionStorage');
        if (savedState) {
          devLog('Loaded session state:', savedState);
          if (savedState.chunked === true) {
            devLog('Loading chunked state');
            const stateChunks = [savedState];
            for (let i = 1; i < savedState.totalChunks; i++) {
              try {
                const chunkKey = `tts_session_chunk_${i}`;
                const chunk = await loadFromStorage(chunkKey, false, 'sessionStorage');
                if (chunk) {
                  stateChunks.push(chunk);
                }
              } catch (chunkError) {
                devError(`Error loading state chunk ${i}:`, chunkError);
              }
            }
            const fullState = reassembleStateChunks(stateChunks);
            if (fullState) {
              const mergedState = {
                ...fullState,
                generatedTTSAudios: state.generatedTTSAudios || {},
                mergedAudio: state.mergedAudio,
              };
              dispatch({ type: 'LOAD_SESSION_STATE', payload: mergedState });
              devLog('Loaded state from chunks, preserved audio data from current state');
            } else {
              devLog('Failed to reassemble chunks, using initial state');
            }
          } else {
            const mergedState = {
              ...savedState,
              generatedTTSAudios: state.generatedTTSAudios || {},
              mergedAudio: state.mergedAudio,
            };
            dispatch({ type: 'LOAD_SESSION_STATE', payload: mergedState });
            devLog('Loaded state, preserved audio data from current state');
          }
        } else {
          devLog('No saved session state found, using initialSessionState');
        }
      } catch (error) {
        devError('Error loading session state:', error);
        setStorageError('Failed to load session state: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          cleanupOldSessionStorage();
          const optimizedState = createStorageOptimizedState(state);
          const stateSize = estimateObjectSize(optimizedState);
          const originalSize = estimateObjectSize(state);
          const audioSize = estimateObjectSize({
            generatedTTSAudios: state.generatedTTSAudios,
            mergedAudio: state.mergedAudio,
          });
          devLog(`Original state size: ${Math.round(originalSize / 1024)} KB`);
          devLog(`Audio data size: ${Math.round(audioSize / 1024)} KB`);
          devLog(`Optimized state size (no audio): ${Math.round(stateSize / 1024)} KB`);
          if (stateSize > 5000000) {
            devWarn(`Session state is still very large (${Math.round(stateSize / 1024)} KB). This may cause storage issues.`);
          }
          try {
            if (stateSize > MAX_CHUNK_SIZE) {
              devLog(`State too large for single chunk (${Math.round(stateSize / 1024)} KB), splitting into chunks`);
              const stateChunks = splitStateIntoChunks(optimizedState);
              for (let i = 0; i < stateChunks.length; i++) {
                const chunkKey = i === 0 ? 'tts_session_state' : `tts_session_chunk_${i}`;
                await saveToStorage(chunkKey, stateChunks[i], 'sessionStorage');
              }
              devLog(`Saved state in ${stateChunks.length} chunks`);
            } else {
              await saveToStorage('tts_session_state', optimizedState, 'sessionStorage');
              devLog('Saved session state to sessionStorage (no audio data)');
            }
            if (storageError) {
              setStorageError(null);
            }
          } catch (saveError: any) {
            devError('Error saving session state:', saveError);
            setStorageError('Failed to save session state: ' + saveError.message);
            if (saveError.name === 'QuotaExceededError' || saveError.message.includes('quota')) {
              devLog('QuotaExceededError encountered, attempting to save minimal state');
              const minimalState = {
                title: state.title,
                description: state.description,
                sections: state.sections?.map(s => ({
                  id: s.id,
                  title: s.title,
                  type: s.type,
                  voice: s.voice,
                  language: s.language,
                })) || [],
                inputText: state.inputText,
                inputType: state.inputType,
                selectedInputVoice: state.selectedInputVoice,
                isProcessing: state.isProcessing,
                isPlaying: state.isPlaying,
                selectedAudioLibraryId: state.selectedAudioLibraryId,
                templateCreation: state.templateCreation,
              };
              try {
                await saveToStorage('tts_session_state', minimalState, 'sessionStorage');
                devLog('Saved minimal session state to sessionStorage');
                setStorageError('Storage quota exceeded. Saved with reduced data.');
              } catch (error) {
                devError('Failed to save minimal state:', error);
                setStorageError('Cannot save state: storage quota exceeded');
              }
            }
          }
        } catch (error) {
          devError('Error preparing session state for storage:', error);
          setStorageError('Failed to prepare state for storage: ' + error.message);
        }
      }, 1000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, isLoading, storageError]);

  useEffect(() => {
    if (state.notification) {
      devLog('Setting notification timeout');
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: null });
        devLog('Notification cleared');
      }, 5000);
      return () => {
        devLog('Cleaning up notification timeout');
        clearTimeout(timer);
      };
    }
  }, [state.notification]);

  useEffect(() => {
    if (storageError) {
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: {
          type: 'warning',
          message: storageError,
        },
      });
    }
  }, [storageError, dispatch]);

  useEffect(() => {
    const handleLoadConfig = (event: CustomEvent<{ config: TTSConfig | string }>) => {
      try {
        devLog('Received load-tts-config event:', event.detail);
        const { config } = event.detail;
        if (!config) {
          devLog('Invalid event data, no config provided');
          return;
        }
        const configObj = typeof config === 'string' ? JSON.parse(config) : config;
        if (!configObj.sections || !Array.isArray(configObj.sections)) {
          devLog('Invalid config received, missing sections array:', configObj);
          return;
        }
        dispatch({ type: 'RESET_SESSION' });
        dispatch({ type: 'SET_SECTIONS', payload: configObj.sections });
        if (configObj.description) {
          dispatch({ type: 'SET_DESCRIPTION', payload: configObj.description });
        }
        if (configObj.title) {
          dispatch({ type: 'SET_TITLE', payload: configObj.title });
        }
        dispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' });
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: {
            type: 'success',
            message: 'Configuration loaded successfully',
          },
        });
        devLog('Successfully loaded configuration from history');
      } catch (error) {
        devError('Error handling load-tts-config event:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: `Failed to load configuration: ${error.message}`,
        });
      }
    };

    devLog('Attaching load-tts-config event listener');
    window.addEventListener('load-tts-config', handleLoadConfig as EventListener);

    if (
      window.__queuedTTSConfigs &&
      Array.isArray(window.__queuedTTSConfigs) &&
      window.__queuedTTSConfigs.length > 0
    ) {
      devLog('Found queued configs, processing:', window.__queuedTTSConfigs);
      window.__queuedTTSConfigs.forEach(queuedConfig => {
        handleLoadConfig({ detail: { config: queuedConfig } } as CustomEvent);
      });
      window.__queuedTTSConfigs = [];
    }

    return () => {
      devLog('Removing load-tts-config event listener');
      window.removeEventListener('load-tts-config', handleLoadConfig as EventListener);
    };
  }, [dispatch]);

  if (isLoading) {
    return <div id="tts-loading-session-state">Loading session state...</div>;
  }

  const value: TTSSessionContextValue = { state, actions };

  return <TTSSessionContext.Provider value={value}>{children}</TTSSessionContext.Provider>;
};

// Custom Hook
export const useTTSSessionContext = (): TTSSessionContextValue => {
  const context = useContext(TTSSessionContext);
  if (!context) {
    throw new Error('useTTSSessionContext must be used within a TTSSessionProvider');
  }
  return context;
};

export { TTSSessionContext };