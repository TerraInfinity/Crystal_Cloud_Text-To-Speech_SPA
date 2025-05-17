import React, { createContext, useContext, useReducer, useEffect, useMemo, useState, useRef } from 'react';
import { initialSessionState } from './ttsDefaults';
import { saveToStorage, loadFromStorage } from './storage';
import { ttsSessionReducer } from './ttsSessionReducer';
import { createSessionActions } from './ttsSessionActions';
import { devLog, devError, devWarn } from '../utils/logUtils';
import { loadDemoContent } from './demoContentLoader';
import { useNotification } from './notificationContext';
import { useTTSContext } from './TTSContext';
import { isValidAudioUrl } from '../utils/audioUtils';

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

interface TTSSessionState {
  title: string;
  description: string;
  sections: any[];
  generatedTTSAudios: Record<string, any>;
  mergedAudio: any;
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

const TTSSessionContext = createContext<TTSSessionContextValue | undefined>(undefined);

const estimateObjectSize = (obj: any): number => {
  const jsonStr = JSON.stringify(obj);
  return jsonStr ? jsonStr.length * 2 : 0;
};

const MAX_CHUNK_SIZE = 3.5 * 1024 * 1024;

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
    isProcessing: false, // Ensure isProcessing is false in chunks
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
  reassembledState.isProcessing = false; // Ensure isProcessing is false
  delete reassembledState.chunked;
  delete reassembledState.chunkIndex;
  delete reassembledState.totalChunks;

  return reassembledState;
};

const createStorageOptimizedState = (state: TTSSessionState): any => {
  try {
    const { generatedTTSAudios, mergedAudio, ...baseState } = state;
    const minimalState = { ...baseState, isProcessing: false }; // Ensure isProcessing is false

    if (estimateObjectSize(minimalState) > 4000000) {
      devLog('State too large, trimming section text content');
      if (minimalState.sections && Array.isArray(minimalState.sections)) {
        minimalState.sections = minimalState.sections.map(section => {
          const { text, audioUrl, ...sectionWithoutText } = section;
          
          // Preserve audioUrl explicitly
          sectionWithoutText.audioUrl = audioUrl;
          
          if (text && typeof text === 'string' && text.length > 100) {
            sectionWithoutText.textPreview = text.substring(0, 100) + '...';
          } else {
            sectionWithoutText.text = text;
          }
          return sectionWithoutText;
        });
      }
    }
    
    // Debug log to verify audioUrl is preserved
    if (minimalState.sections && Array.isArray(minimalState.sections)) {
      const audioUrlCount = minimalState.sections.filter(s => s.audioUrl).length;
      devLog(`Optimized state has ${audioUrlCount} sections with audioUrl`);
      
      // Log the first few sections with audioUrl for verification
      const sectionsWithAudio = minimalState.sections.filter(s => s.audioUrl).slice(0, 3);
      if (sectionsWithAudio.length > 0) {
        devLog('Sample sections with audioUrl:', 
          sectionsWithAudio.map(s => ({ id: s.id, type: s.type, audioUrl: s.audioUrl }))
        );
      }
    }

    return minimalState;
  } catch (error) {
    devError('Error creating storage-optimized state:', error);
    return {
      sections: state.sections?.map(s => ({ 
        id: s.id, 
        title: s.type,
        audioUrl: s.audioUrl // Preserve audioUrl in error case too
      })) || [],
      title: state.title,
      description: state.description,
      inputText: state.inputText,
      inputType: state.inputType,
      selectedInputVoice: state.selectedInputVoice,
      isProcessing: false, // Ensure isProcessing is false
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

    // Explicitly clear any processing-related storage
    sessionStorage.removeItem('tts_processing');
  } catch (error) {
    devError('Error cleaning up old session storage:', error);
  }
};

export const TTSSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: ttsState } = useTTSContext();
  const [state, dispatch] = useReducer(ttsSessionReducer, initialSessionState);
  const [isLoading, setIsLoading] = useState(true);
  const { addNotification } = useNotification();
  const lastProcessedSectionsRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Reset isProcessing on mount to prevent persistent processing-container
  useEffect(() => {
    dispatch({ type: 'SET_PROCESSING', payload: false });
    sessionStorage.removeItem('tts_processing');
    cleanupOldSessionStorage();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      sessionStorage.removeItem('tts_processing');
      cleanupOldSessionStorage();
    };
  }, []);

  // Enhanced dispatch to include context
  const enhancedDispatch = (action) => {
    dispatch({
      ...action,
      context: {
        activeVoices: ttsState.settings.activeVoices || [],
        defaultVoice: ttsState.settings.defaultVoice,
      },
    });
  };

  // Create actions with enhanced dispatch
  const actions = useMemo(() => {
    const baseActions = createSessionActions(enhancedDispatch, loadDemoContent);
    return {
      ...baseActions,
      setSections: (sections) => enhancedDispatch({ type: 'SET_SECTIONS', payload: sections }),
      addSection: (section) => enhancedDispatch({ type: 'ADD_SECTION', payload: section }),
      updateSection: (section) => enhancedDispatch({ type: 'UPDATE_SECTION', payload: section }),
      reorderSections: (sections) => enhancedDispatch({ type: 'REORDER_SECTIONS', payload: sections }),
      setSectionVoice: (sectionId, voice) => enhancedDispatch({ type: 'SET_SECTION_VOICE', payload: { sectionId, voice } }),
    };
  }, []);

  // Log TTSContext defaultVoice for debugging
  useEffect(() => {
    devLog('TTSContext defaultVoice:', ttsState.settings.defaultVoice);
    if (!ttsState.settings.defaultVoice) {
      devWarn('No default voice found in ttsState.settings.defaultVoice');
    }
  }, [ttsState.settings.defaultVoice]);

  // Load session state
  useEffect(() => {
    const loadState = async () => {
      try {
        cleanupOldSessionStorage();
        const savedState = await loadFromStorage('tts_session_state', false, 'sessionStorage');
        if (savedState) {
          devLog('Loaded session state:', {
            sectionCount: savedState.sections?.length,
            sectionsWithAudioUrl: savedState.sections?.filter(s => s.audioUrl).length,
            hasMergedAudio: !!savedState.mergedAudio,
            isValidMergedAudio: savedState.mergedAudio && isValidAudioUrl(savedState.mergedAudio)
          });
          
          // Validate mergedAudio if present
          let mergedAudio = savedState.mergedAudio;
          if (mergedAudio && !isValidAudioUrl(mergedAudio)) {
            devWarn(`Invalid mergedAudio URL: ${mergedAudio}. Removing it.`);
            mergedAudio = null;
          }
          
          const defaultVoice = ttsState.settings.defaultVoice;
          if (!defaultVoice) {
            devWarn('No default voice available during session state load');
          }
          
          const updatedSections = savedState.sections.map((section) => {
            // ONLY apply default voice if the section is missing a voice completely
            if (section.type === 'text-to-speech' && !section.voice && defaultVoice) {
              devLog('Section missing voice, applying default voice for section:', section.id);
              return { ...section, voice: { ...defaultVoice } };
            }
            
            // Validate audioUrl if present
            if (section.audioUrl && !isValidAudioUrl(section.audioUrl)) {
              devWarn(`Invalid audioUrl in section ${section.id}: ${section.audioUrl}. Removing it.`);
              return { ...section, audioUrl: undefined };
            }
            
            // Otherwise preserve the user's selected voice and valid audioUrl
            return section;
          });
          
          if (savedState.chunked === true) {
            devLog('Loading chunked state');
            const stateChunks = [savedState];
            for (let i = 1; i < savedState.totalChunks; i++) {
              try {
                const chunkKey = `tts_session_chunk_${i}`;
                const chunk = await loadFromStorage(chunkKey, false, 'sessionStorage');
                if (chunk) stateChunks.push(chunk);
              } catch (chunkError) {
                devError(`Error loading state chunk ${i}:`, chunkError);
              }
            }
            
            const fullState = reassembleStateChunks(stateChunks);
            if (fullState) {
              const chunkedSections = fullState.sections.map((section) => {
                // ONLY apply default voice if the section is missing a voice completely
                if (section.type === 'text-to-speech' && !section.voice && defaultVoice) {
                  devLog('Section missing voice, applying default voice for section:', section.id);
                  return { ...section, voice: { ...defaultVoice } };
                }
                
                // Validate audioUrl if present
                if (section.audioUrl && !isValidAudioUrl(section.audioUrl)) {
                  devWarn(`Invalid audioUrl in chunked section ${section.id}: ${section.audioUrl}. Removing it.`);
                  return { ...section, audioUrl: undefined };
                }
                
                // Otherwise preserve the user's selected voice
                return section;
              });
              
              // Debug: Check for audioUrl in loaded sections
              const sectionsWithAudioUrl = chunkedSections.filter(s => s.audioUrl).length;
              devLog(`After loading from chunked storage: ${sectionsWithAudioUrl} of ${chunkedSections.length} sections have audioUrl`);
              
              if (sectionsWithAudioUrl > 0) {
                const sampleSections = chunkedSections.filter(s => s.audioUrl).slice(0, 2);
                devLog('Sample sections with audioUrl after loading:', 
                  sampleSections.map(s => ({ 
                    id: s.id, 
                    type: s.type, 
                    audioUrl: s.audioUrl,
                    isValidUrl: isValidAudioUrl(s.audioUrl)
                  }))
                );
              }
              
              const mergedState = {
                ...fullState,
                sections: chunkedSections,
                mergedAudio: mergedAudio,
                generatedTTSAudios: state.generatedTTSAudios || {},
                isProcessing: false, // Ensure isProcessing is false
              };
              
              enhancedDispatch({ type: 'LOAD_SESSION_STATE', payload: mergedState });
              sessionStorage.setItem('tts_session_state', JSON.stringify(mergedState));
              devLog('Loaded state from chunks, preserved audio data');
            } else {
              devLog('Failed to reassemble chunks, using initial state');
            }
          } else {
            const mergedState = {
              ...savedState,
              sections: updatedSections,
              mergedAudio: mergedAudio,
              generatedTTSAudios: state.generatedTTSAudios || {},
              isProcessing: false, // Ensure isProcessing is false
            };
            
            // Debug: Check for audioUrl in loaded sections
            const sectionsWithAudioUrl = updatedSections.filter(s => s.audioUrl).length;
            devLog(`After loading from storage: ${sectionsWithAudioUrl} of ${updatedSections.length} sections have audioUrl`);
            
            if (sectionsWithAudioUrl > 0) {
              const sampleSections = updatedSections.filter(s => s.audioUrl).slice(0, 2);
              devLog('Sample sections with audioUrl after loading:', 
                sampleSections.map(s => ({ 
                  id: s.id, 
                  type: s.type, 
                  audioUrl: s.audioUrl,
                  isValidUrl: isValidAudioUrl(s.audioUrl)
                }))
              );
            }
            
            enhancedDispatch({ type: 'LOAD_SESSION_STATE', payload: mergedState });
            sessionStorage.setItem('tts_session_state', JSON.stringify(mergedState));
            devLog('Loaded state, preserved audio data');
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

  // Migrate voices
  useEffect(() => {
    if (!state.sections.length || !ttsState.settings.defaultVoice) {
      devLog('Skipping voice migration: no sections or no default voice', {
        sectionsLength: state.sections.length,
        defaultVoice: ttsState.settings.defaultVoice,
      });
      return;
    }
    if (state.isProcessing) {
      devLog('Skipping voice migration: isProcessing is true');
      return;
    }
    const sectionsSignature = JSON.stringify(state.sections);
    if (lastProcessedSectionsRef.current === sectionsSignature) {
      devLog('Skipping voice migration: sections unchanged');
      return;
    }

    const defaultVoice = ttsState.settings.defaultVoice;
    devLog('Checking for voice migration:', {
      defaultVoice,
      activeVoices: ttsState.settings.activeVoices,
      sections: state.sections.map(s => ({
        id: s.id,
        type: s.type,
        voice: s.voice,
      })),
    });

    // Only migrate sections that have NO voice at all, not just different voices
    const needsMigration = state.sections.some(
      (section) => section.type === 'text-to-speech' && !section.voice
    );

    if (needsMigration) {
      const updatedSections = state.sections.map((section) => {
        if (section.type === 'text-to-speech' && !section.voice) {
          devLog('Migrating voice for section:', section.id, 'to:', defaultVoice, {
            sectionVoice: section.voice,
            conditions: {
              noVoice: !section.voice
            },
          });
          return { ...section, voice: { ...defaultVoice } };
        }
        return section;
      });
      lastProcessedSectionsRef.current = JSON.stringify(updatedSections);
      enhancedDispatch({ type: 'SET_SECTIONS', payload: updatedSections });
      sessionStorage.setItem('tts_session_state', JSON.stringify({ ...state, sections: updatedSections, isProcessing: false }));
      devLog('Updated sections with migrated voices:', updatedSections.map(s => ({
        id: s.id,
        type: s.type,
        voice: s.voice,
      })));
    } else {
      lastProcessedSectionsRef.current = sectionsSignature;
      devLog('No voice migration needed');
    }
  }, [ttsState.settings.defaultVoice, state.sections, state.isProcessing]);

  useEffect(() => {
    window.ttsSessionDispatch = enhancedDispatch;
    return () => {
      delete window.ttsSessionDispatch;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
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
          
          // Debug: Check for mergedAudio before saving to storage
          devLog(`Before saving: mergedAudio: ${state.mergedAudio || 'none'}`, {
            isValid: state.mergedAudio ? isValidAudioUrl(state.mergedAudio) : false
          });
          
          // Debug: Check for audioUrl in sections before saving to storage
          const sectionsWithAudioUrl = state.sections.filter(s => s.audioUrl).length;
          devLog(`Before saving: ${sectionsWithAudioUrl} of ${state.sections.length} sections have audioUrl`);
          
          // Validate audioUrls before saving
          const validAudioUrls = state.sections
            .filter(s => s.audioUrl && isValidAudioUrl(s.audioUrl))
            .map(s => ({ id: s.id, audioUrl: s.audioUrl }));
          
          const invalidAudioUrls = state.sections
            .filter(s => s.audioUrl && !isValidAudioUrl(s.audioUrl))
            .map(s => ({ id: s.id, audioUrl: s.audioUrl }));
          
          if (validAudioUrls.length > 0) {
            devLog(`Found ${validAudioUrls.length} sections with valid audioUrls`, 
              validAudioUrls.slice(0, 2)); // Show only first 2 for brevity
          }
          
          if (invalidAudioUrls.length > 0) {
            devWarn(`Found ${invalidAudioUrls.length} sections with INVALID audioUrls`, 
              invalidAudioUrls);
          }
          
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
            if (storageError) setStorageError(null);
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
                  audioUrl: s.audioUrl && isValidAudioUrl(s.audioUrl) ? s.audioUrl : undefined,
                })) || [],
                inputText: state.inputText,
                inputType: state.inputType,
                selectedInputVoice: state.selectedInputVoice,
                isProcessing: false, // Ensure isProcessing is false
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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, isLoading, storageError]);

  useEffect(() => {
    if (storageError) {
      addNotification({
        type: 'warning',
        message: storageError,
      });
    }
  }, [storageError, addNotification]);

  useEffect(() => {
    const handleNotification = (event: CustomEvent<{ type: string; message: string }>) => {
      addNotification({
        type: event.detail.type as 'success' | 'warning' | 'error' | 'info',
        message: event.detail.message,
      });
    };
    window.addEventListener('trigger-notification', handleNotification as EventListener);
    return () => {
      window.removeEventListener('trigger-notification', handleNotification as EventListener);
    };
  }, [addNotification]);

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
        enhancedDispatch({ type: 'RESET_SESSION' });
        enhancedDispatch({ type: 'SET_SECTIONS', payload: configObj.sections });
        if (configObj.description) {
          enhancedDispatch({ type: 'SET_DESCRIPTION', payload: configObj.description });
        }
        if (configObj.title) {
          enhancedDispatch({ type: 'SET_TITLE', payload: configObj.title });
        }
        enhancedDispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' });
        enhancedDispatch({ type: 'SET_PROCESSING', payload: false }); // Ensure processing is reset
        addNotification({
          type: 'success',
          message: 'Configuration loaded successfully',
        });
        devLog('Successfully loaded configuration from history');
      } catch (error) {
        devError('Error handling load-tts-config event:', error);
        addNotification({
          type: 'error',
          message: `Failed to load configuration: ${error.message}`,
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
  }, []);

  if (isLoading) {
    return <div id="tts-loading-session-state">Loading session state...</div>;
  }

  const value: TTSSessionContextValue = { state, actions };
  return <TTSSessionContext.Provider value={value}>{children}</TTSSessionContext.Provider>;
};

export const useTTSSessionContext = (): TTSSessionContextValue => {
  const context = useContext(TTSSessionContext);
  if (!context) {
    throw new Error('useTTSSessionContext must be used within a TTSSessionProvider');
  }
  return context;
};

export { TTSSessionContext };