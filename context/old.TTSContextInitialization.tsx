/**
 * @fileoverview Initialization hook for the TTS application
 *
 * Handles initialization tasks such as loading voices, API keys, and other resources.
 */

import { useState, useEffect, useMemo } from 'react';
import throttle from 'lodash/throttle';
import { loadFromStorage, listFromStorage, setGlobalStorageConfig } from '../context/storage';
import { devLog } from '../utils/logUtils';
import { createFileStorageActions } from '../context/fileStorageActions';
import { initializeApiKeysFromJson, decryptKey } from '../utils/apiKeyManagement';
import { initialPersistentState } from './ttsDefaults';

interface TTSAction {
  type: string;
  payload: any;
}

interface FileStorageAction {
  type: string;
  payload: any;
}

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
    const fetchGttsVoices = async (updateProgress: (taskName: string, weight: number) => void) => {
      const startTime = Date.now();
      try {
        updateProgress('Fetching gTTS voices: Initiating request', 3);
        const response = await fetch('http://localhost:5000/gtts/voices');
        updateProgress('Fetching gTTS voices: Receiving response', 3);
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
        updateProgress('Fetching gTTS voices: Processing complete', 4);
        dispatch({
          type: 'UPDATE_DEFAULT_VOICES',
          payload: { gtts: transformedVoices },
        });
        devLog(`fetchGttsVoices took ${Date.now() - startTime}ms`);
      } catch (error) {
        devLog('Error fetching gTTS voices:', error, true);
        setCurrentTask('Error fetching gTTS voices, continuing...');
        throw error;
      }
    };

    const fetchElevenLabsVoices = async (updateProgress: (taskName: string, weight: number) => void) => {
      const startTime = Date.now();
      try {
        updateProgress('Fetching ElevenLabs voices: Initiating request', 3);
        const storedApiKeys = await loadFromStorage('tts_api_keys', false, 'localStorage');
        if (!storedApiKeys) {
          devLog('No ElevenLabs API keys available for fetching voices');
          return;
        }
        let jsonData;
        try {
          jsonData = JSON.parse(storedApiKeys);
        } catch (error) {
          devLog('Error parsing tts_api_keys:', error);
          return;
        }
        const elevenLabsKeys = jsonData.elevenlabs?.keys || [];
        if (!elevenLabsKeys.length) {
          devLog('No active ElevenLabs API keys');
          return;
        }
        const activeKey = elevenLabsKeys.find((key: any) => key.active && key.remaining_tokens > 0);
        if (!activeKey) {
          devLog('No active ElevenLabs API key with sufficient tokens');
          return;
        }
        const plainKey = decryptKey(activeKey.key);
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': plainKey },
        });
        updateProgress('Fetching ElevenLabs voices: Receiving response', 3);
        if (!response.ok) {
          throw new Error('Failed to fetch ElevenLabs voices');
        }
        const { voices } = await response.json();
        const transformedVoices = voices.map((voice: any) => ({
          id: voice.voice_id,
          name: voice.name,
          language: voice.labels?.language || 'en',
          engine: 'elevenlabs',
        }));
        devLog('Transformed ElevenLabs voices:', transformedVoices);
        updateProgress('Fetching ElevenLabs voices: Processing complete', 4);
        dispatch({
          type: 'UPDATE_DEFAULT_VOICES',
          payload: { elevenlabs: transformedVoices },
        });
        devLog(`fetchElevenLabsVoices took ${Date.now() - startTime}ms`);
      } catch (error) {
        devLog('Error fetching ElevenLabs voices:', error, true);
        setCurrentTask('Error fetching ElevenLabs voices, continuing...');
      }
    };

    const refreshApiKeyTokens = async (dispatch: React.Dispatch<TTSAction>) => {
      try {
        const storedApiKeys = await loadFromStorage('tts_api_keys', false, 'localStorage');
        if (!storedApiKeys) {
          devLog('No tts_api_keys in localStorage for token refresh');
          return;
        }

        let apiKeysData;
        try {
          apiKeysData = JSON.parse(storedApiKeys);
        } catch (error) {
          devLog('Error parsing tts_api_keys from localStorage:', error);
          return;
        }

        const elevenLabsKeys = apiKeysData.elevenlabs?.keys || [];
        if (!elevenLabsKeys.length) {
          devLog('No ElevenLabs API keys to refresh');
          return;
        }

        const updatedKeys = await Promise.all(
          elevenLabsKeys.map(async (key: any) => {
            try {
              const plainKey = decryptKey(key.key);
              const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
                headers: { 'xi-api-key': plainKey },
              });
              if (!response.ok) throw new Error('Failed to fetch token info');
              const data = await response.json();
              const remainingTokens = data.character_limit - data.character_count;
              return {
                ...key,
                remaining_tokens: remainingTokens,
                active: remainingTokens > 0 ? key.active : false,
              };
            } catch (error) {
              devLog(`Error refreshing token for key ${key.name || 'unnamed'}:`, error);
              return key;
            }
          })
        );

        dispatch({
          type: 'SET_API_KEY',
          payload: { keyName: 'elevenLabsApiKeys', value: updatedKeys },
        });
        devLog('ElevenLabs API key tokens refreshed');
      } catch (error) {
        devLog('Error during token refresh:', error);
      }
    };

    const initApp = async () => {
      if (typeof window === 'undefined') return;

      try {
        devLog('Starting app initialization');

        // Load theme first
        if (typeof window !== 'undefined') {
          const savedTheme = localStorage.getItem('theme');
          const themeToApply = savedTheme && typeof savedTheme === 'string' ? savedTheme : initialPersistentState.theme;
          document.documentElement.setAttribute('data-theme', themeToApply);
          // Optionally save the default theme to localStorage immediately
          if (!savedTheme) {
            localStorage.setItem('theme', themeToApply);
          }
        }

        // Define tasks and their progress weights (total sums to 100)
        const tasks = [
          { name: 'Setting storage config', weight: 10 },
          { name: 'Loading persistent state', weight: 10 },
          { name: 'Loading file history', weight: 10 },
          { name: 'Loading audio library', weight: 15 },
          { name: 'Loading templates', weight: 10 },
          { name: 'Loading local voices', weight: 10 },
          { name: 'Fetching gTTS voices', weight: 10 },
          { name: 'Fetching ElevenLabs voices', weight: 10 },
          { name: 'Loading API keys from storage', weight: 10 },
          { name: 'Loading merged audio', weight: 5 },
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
        const task1Start = Date.now();
        updateProgress(tasks[0].name, tasks[0].weight);
        setGlobalStorageConfig({
          type: 'local',
          serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
          serviceType: null,
        });
        dispatch({
          type: 'SET_STORAGE_CONFIG',
          payload: {
            type: 'local',
            serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
            serviceType: null,
          },
        });
        devLog(`Setting storage config took ${Date.now() - task1Start}ms`);

        // Task 2: Load persistent state
        const task2Start = Date.now();
        updateProgress(tasks[1].name, tasks[1].weight);
        const savedState = await loadFromStorage('tts_persistent_state', false, 'localStorage');
        devLog('Loaded persistent state:', savedState);
        if (savedState) dispatch({ type: 'LOAD_PERSISTENT_STATE', payload: savedState });
        devLog(`Loading persistent state took ${Date.now() - task2Start}ms`);

        // Task 3: Load file history
        const task3Start = Date.now();
        updateProgress(tasks[2].name, tasks[2].weight);
        const savedFileHistory = await loadFromStorage('file_server_file_history', false, 'localStorage');
        if (savedFileHistory && Array.isArray(savedFileHistory) && savedFileHistory.length > 0) {
          devLog(`Found existing file history with ${savedFileHistory.length} entries`);
          fileStorageDispatch({ type: 'SET_FILE_HISTORY', payload: savedFileHistory });
        }
        devLog(`Loading file history took ${Date.now() - task3Start}ms`);

        // Task 4: Load audio library
        const task4Start = Date.now();
        updateProgress(tasks[3].name, 7);
        const savedAudioLibrary = await loadFromStorage('file_server_audio_library', false, 'localStorage');
        if (savedAudioLibrary && Array.isArray(savedAudioLibrary) && savedAudioLibrary.length > 0) {
          devLog(`Found existing audio library with ${savedAudioLibrary.length} entries`);
          fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: savedAudioLibrary });
          updateProgress('Loading audio library: Local data loaded', 8);
        } else {
          updateProgress('Loading audio library: Checking server', 5);
          try {
            updateProgress('Loading audio library: Fetching from server', 2);
            await throttledFetchAudioLibrary();
            updateProgress('Loading audio library: Server fetch complete', 1);
            devLog('Audio library loaded');
          } catch (error) {
            devLog('Error loading audio library:', error, true);
            setCurrentTask('Error loading audio library, continuing...');
            fileStorageDispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
          }
        }
        devLog(`Loading audio library took ${Date.now() - task4Start}ms`);

        // Task 5: Load templates
        const task5Start = Date.now();
        updateProgress(tasks[4].name, tasks[4].weight);
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        devLog('Loaded templates:', templates);
        dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
        devLog(`Loading templates took ${Date.now() - task5Start}ms`);

        // Task 6: Load local voices
        const task6Start = Date.now();
        updateProgress(tasks[5].name, 3);
        const activeVoices = await loadFromStorage('tts_active_voices', false, 'localStorage');
        devLog('Loaded activeVoices:', activeVoices);
        if (activeVoices) dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: activeVoices });
        updateProgress('Loading local voices: Active voices loaded', 3);

        const defaultVoice = await loadFromStorage('tts_default_voice', false, 'localStorage');
        devLog('Loaded defaultVoice:', defaultVoice);
        if (defaultVoice) dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoice });
        updateProgress('Loading local voices: Default voice loaded', 2);

        const customVoices = await loadFromStorage('tts_custom_voices', false, 'localStorage');
        devLog('Loaded customVoices:', customVoices);
        if (customVoices) dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: customVoices });
        updateProgress('Loading local voices: Custom voices loaded', 2);
        devLog(`Loading local voices took ${Date.now() - task6Start}ms`);

        // Task 7: Fetch gTTS voices
        const task7Start = Date.now();
        updateProgress(tasks[6].name, 0);
        try {
          await fetchGttsVoices(updateProgress);
        } catch (error) {
          // Error handled in fetchGttsVoices
        }
        devLog(`Fetching gTTS voices took ${Date.now() - task7Start}ms`);

        // Task 8: Fetch ElevenLabs voices
        const task8Start = Date.now();
        updateProgress(tasks[7].name, 0);
        try {
          await fetchElevenLabsVoices(updateProgress);
        } catch (error) {
          // Error handled in fetchElevenLabsVoices
        }
        devLog(`Fetching ElevenLabs voices took ${Date.now() - task8Start}ms`);

        // Task 9: Load API keys from storage
        const task9Start = Date.now();
        updateProgress(tasks[8].name, tasks[8].weight);
        try {
          const success = await initializeApiKeysFromJson({ dispatch });
          devLog(success ? 'API keys loaded from localStorage' : 'No API keys found in localStorage');
        } catch (error) {
          devLog('Error loading API keys from storage:', error);
          setCurrentTask('Error loading API keys, continuing...');
        }
        devLog(`Loading API keys took ${Date.now() - task9Start}ms`);

        // Task 10: Load merged audio
        const task10Start = Date.now();
        updateProgress(tasks[9].name, tasks[9].weight);
        const loadMergedAudio = async () => {
          try {
            updateProgress('Loading merged audio: Fetching files', 2);
            let audioFiles = [];
            try {
              audioFiles = await listFromStorage('fileStorage');
            } catch (error) {
              devLog('Error fetching files from storage:', error, true);
              setCurrentTask('Error loading merged audio, continuing...');
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

            updateProgress('Loading merged audio: Processing files', 2);
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
            updateProgress('Loading merged audio: Completed', 1);
          } catch (error) {
            devLog('Error loading merged audio files:', error, true);
            setCurrentTask('Error loading merged audio, continuing...');
          }
        };

        await loadMergedAudio();
        devLog(`Loading merged audio took ${Date.now() - task10Start}ms`);

        // Trigger asynchronous token refresh
        setTimeout(() => refreshApiKeyTokens(dispatch), 1000);

        devLog('App initialization completed');
      } catch (error) {
        devLog('Error during initialization:', error, true);
        setCurrentTask('Initialization failed, recovering...');
      } finally {
        setProgress(100);
        setCurrentTask('Initialization complete');
        await new Promise(resolve => setTimeout(resolve, 500));
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