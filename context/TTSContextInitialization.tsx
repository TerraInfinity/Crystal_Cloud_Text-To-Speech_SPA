/**
 * @fileoverview Initialization hook for the TTS application
 *
 * Handles initialization tasks such as loading voices and other resources from localStorage.
 */
import { useState, useEffect, useMemo } from 'react';
import throttle from 'lodash/throttle';
import { loadFromStorage, listFromStorage, setGlobalStorageConfig } from '../context/storage';
import { devLog } from '../utils/logUtils';
import { createFileStorageActions } from '../context/fileStorageActions';
import { initializeApiKeysFromJson } from '../utils/apiKeyManagement';
import { initialPersistentState, getDefaultVoices } from '../context/ttsDefaults';
import { Voice, validateVoice, validateVoiceObject } from '../utils/voiceUtils';
import { TTSAction, FileStorageAction, TTSState, FileStorageState, FileHistoryItem, AudioLibraryItem } from '../context/types/types';

export const useTTSInitialization = (
  dispatch: React.Dispatch<TTSAction>,
  fileStorageDispatch: React.Dispatch<FileStorageAction>
) => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Initializing...');

  const fileStorageActions = useMemo(() => createFileStorageActions(fileStorageDispatch), [fileStorageDispatch]);
  const throttledFetchAudioLibrary = useMemo(
    () => throttle(() => fileStorageActions.fetchAudioLibrary(), 2000),
    [fileStorageActions]
  );

  useEffect(() => {
    const initApp = async () => {
      if (typeof window === 'undefined') return;

      try {
        devLog('Starting app initialization');

        // Load theme
        const savedTheme = localStorage.getItem('theme');
        const themeToApply = savedTheme || initialPersistentState.theme;
        document.documentElement.setAttribute('data-theme', themeToApply);
        localStorage.setItem('theme', themeToApply);

        // Define tasks and weights (total: 100)
        const tasks = [
          { name: 'Setting storage config', weight: 12 },
          { name: 'Loading persistent state', weight: 13 },
          { name: 'Loading file history', weight: 13 },
          { name: 'Loading audio library', weight: 18 },
          { name: 'Loading templates', weight: 13 },
          { name: 'Loading voices', weight: 20 }, // Consolidated voice task
          { name: 'Loading API keys', weight: 13 },
          { name: 'Loading merged audio', weight: 10 },
        ];

        let currentProgress = 0;

        const updateProgress = (() => {
          let timeoutId: NodeJS.Timeout | null = null;
          return (taskName: string, weight: number) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              setCurrentTask(taskName);
              currentProgress += weight;
              setProgress(Math.min(currentProgress, 100));
            }, 20);
          };
        })();

        // Task 1: Set global storage config
        updateProgress(tasks[0].name, tasks[0].weight);
        const storageConfig = {
          type: 'local',
          serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
          serviceType: null,
        };
        setGlobalStorageConfig(storageConfig);
        dispatch({ type: 'SET_STORAGE_CONFIG', payload: storageConfig });

        // Task 2: Load persistent state (including templates)
        updateProgress(tasks[1].name, tasks[1].weight);
        const savedState: Partial<TTSState> = (await loadFromStorage('tts_persistent_state', false, 'localStorage')) || {};
        const mergedState: TTSState = {
          ...initialPersistentState,
          ...savedState,
          // Explicitly preserve user templates or use defaults if none exist
          templates: savedState.templates || initialPersistentState.templates,
          settings: {
            ...initialPersistentState.settings,
            ...savedState.settings,
            // Voices handled separately in later tasks
          },
        };
        dispatch({ type: 'LOAD_PERSISTENT_STATE', payload: mergedState });

        // Task 3: Load file history
        updateProgress(tasks[2].name, tasks[2].weight);
        const savedFileHistory = await loadFromStorage('file_server_file_history', false, 'localStorage');
        if (Array.isArray(savedFileHistory) && savedFileHistory.length > 0) {
          fileStorageDispatch({ type: 'SET_FILE_HISTORY', payload: savedFileHistory });
        }

        // Task 4: Load audio library
        updateProgress(tasks[3].name, tasks[3].weight);
        const savedAudioLibrary = await loadFromStorage('file_server_audio_library', false, 'localStorage');
        if (Array.isArray(savedAudioLibrary) && savedAudioLibrary.length > 0) {
          fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: savedAudioLibrary });
          updateProgress('Loading audio library: Local data loaded', 8);
        } else {
          updateProgress('Loading audio library: Checking server', 5);
          try {
            updateProgress('Loading audio library: Fetching from server', 2);
            await throttledFetchAudioLibrary();
            updateProgress('Loading audio library: Server fetch complete', 1);
          } catch (error) {
            devLog('Error loading audio library:', error, true);
            fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
          }
        }

        // Task 6: Load voices
        updateProgress(tasks[5].name, 5);
        
        // Load availableVoices
        let availableVoices: Record<string, Voice[]>;
        try {
          const savedAvailable = await loadFromStorage('tts_available_voices', false, 'localStorage');
          availableVoices = savedAvailable ? { ...getDefaultVoices(), ...savedAvailable } : getDefaultVoices();
        } catch (error) {
          devLog('Error loading availableVoices, using defaults:', error);
          availableVoices = getDefaultVoices();
        }
        // Use specific action instead of LOAD_PERSISTENT_STATE to avoid overriding templates
        dispatch({ type: 'LOAD_AVAILABLE_VOICES', payload: availableVoices });
        updateProgress('Loading voices: Available voices loaded', 5);

        // Load customVoices
        let customVoices: Record<string, Voice[]>;
        try {
          const savedCustom = await loadFromStorage('tts_custom_voices', false, 'localStorage');
          customVoices = savedCustom
            ? Object.entries(savedCustom).reduce((acc, [engine, voices]) => {
                acc[engine] = (voices as Voice[]).map(validateVoiceObject).filter(Boolean);
                return acc;
              }, {} as Record<string, Voice[]>)
            : {};
        } catch (error) {
          devLog('Error loading customVoices, using empty object:', error);
          customVoices = {};
        }
        dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: customVoices });
        updateProgress('Loading voices: Custom voices loaded', 5);

        // Load activeVoices
        let activeVoices: Voice[];
        try {
          const savedActive = await loadFromStorage('tts_active_voices', false, 'localStorage');
          activeVoices = Array.isArray(savedActive)
            ? savedActive.map(validateVoiceObject).filter(Boolean)
            : initialPersistentState.settings.activeVoices;
        } catch (error) {
          devLog('Error loading activeVoices, using defaults:', error);
          activeVoices = initialPersistentState.settings.activeVoices;
        }
        dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: activeVoices });
        updateProgress('Loading voices: Active voices loaded', 3);

        // Load and validate defaultVoice
        let defaultVoice: Voice;
        try {
          const savedDefault = await loadFromStorage('tts_default_voice', false, 'localStorage');
          defaultVoice = savedDefault ? validateVoiceObject(savedDefault) : initialPersistentState.settings.defaultVoice || getDefaultVoices()['gtts'][0];
        } catch (error) {
          devLog('Error loading defaultVoice, using fallback:', error);
          defaultVoice = initialPersistentState.settings.defaultVoice || getDefaultVoices()['gtts'][0];
        }
        // Validate defaultVoice against activeVoices
        defaultVoice = validateVoice(defaultVoice, activeVoices, activeVoices[0] || getDefaultVoices()['gtts'][0], true) || activeVoices[0] || getDefaultVoices()['gtts'][0];
        dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoice });
        updateProgress('Loading voices: Default voice loaded', 2);

        // Task 7: Load API keys
        updateProgress(tasks[6].name, tasks[6].weight);
        try {
          const success = await initializeApiKeysFromJson();
          devLog(success ? 'API keys loaded from localStorage' : 'No API keys found in localStorage');
        } catch (error) {
          devLog('Error loading API keys:', error);
          setCurrentTask('Error loading API keys, continuing...');
        }

        // Task 8: Load merged audio
        updateProgress(tasks[7].name, tasks[7].weight);
        const loadMergedAudio = async () => {
          try {
            updateProgress('Loading merged audio: Fetching files', 3);
            const audioFiles = await listFromStorage('fileStorage');
            if (!Array.isArray(audioFiles)) {
              devLog('Invalid response from listFromStorage', audioFiles, true);
              return;
            }
            updateProgress('Loading merged audio: Processing files', 4);
            const newFileHistoryEntries: FileHistoryItem[] = [];
            const newAudioLibraryEntries: AudioLibraryItem[] = [];
            for (const file of audioFiles) {
              if (!file.id || !file.url) continue;
              const historyEntry: FileHistoryItem = {
                id: file.id,
                name: file.name || 'Unknown',
                audio_url: file.url,
                type: file.type || 'unknown',
                date: file.date || new Date().toISOString(),
                category: file.category || 'unknown',
              };
              newFileHistoryEntries.push(historyEntry);
              if (file.category === 'merged_audio' || file.type?.includes('audio')) {
                newAudioLibraryEntries.push({
                  ...historyEntry,
                  audioMetadata: {
                    duration: file.audioMetadata?.duration || 0,
                    format: file.audioMetadata?.format || file.type?.split('/')[1] || 'unknown',
                  },
                });
              }
            }
            if (newFileHistoryEntries.length > 0) {
              fileStorageDispatch({ type: 'SET_FILE_HISTORY', payload: newFileHistoryEntries });
            }
            if (newAudioLibraryEntries.length > 0) {
              fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: newAudioLibraryEntries });
            }
            updateProgress('Loading merged audio: Completed', 3);
          } catch (error) {
            devLog('Error loading merged audio files:', error, true);
          }
        };
        await loadMergedAudio();

        devLog('App initialization completed');
      } catch (error) {
        devLog('Error during initialization:', error, true);
        setCurrentTask('Initialization failed, recovering...');
      } finally {
        setProgress(100);
        setCurrentTask('Initialization complete');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setIsLoading(false);
      }
    };

    devLog('Initialization effect triggered');
    initApp();

    return () => {
      devLog('Initialization cleanup');
    };
  }, [dispatch, fileStorageDispatch, throttledFetchAudioLibrary]);

  return { isLoading, progress, currentTask };
};