// context/ttsActions.jsx
import { saveToStorage, removeFromStorage, listFromStorage, updateFileMetadata, loadFromStorage } from './storage';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { devLog } from '../utils/logUtils';

/**
 * Creates and returns all TTS-related actions that can be dispatched
 * @param {Function} dispatch - The dispatch function from the TTS reducer context
 * @returns {Object} Object containing all TTS action functions
 */
export function createTtsActions(dispatch) {
  // Function to get the current state from the Redux store
  let currentState = null;
  
  // Function to be called when the state updates
  const setCurrentState = (state) => {
    currentState = state;
    // For debugging potential race conditions
    devLog('Updated current state reference in ttsActions');
  };
  
  // Track in-flight requests to prevent duplicates
  let pendingAudioListRequest = null;
  
  return {
    /**
     * Fetches the audio library from storage
     * Uses a centralized request deduplication to prevent multiple API calls
     * @returns {Promise<Object>} Object containing the loaded audio files
     */
    fetchAudioLibrary: async () => {
      devLog('Fetching audio library!!!');
      try {
        // Check sessionStorage first
        const cachedFiles = sessionStorage.getItem('file_server_audio_metadata');
        if (cachedFiles) {
          try {
            const files = JSON.parse(cachedFiles);
            const audioFiles = files.reduce((acc, file) => {
              if (!file.category) return acc;
              acc[file.id] = {
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                source: file.source,
                date: file.date,
                placeholder: file.placeholder,
                volume: file.volume,
                url: file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`,
                configUrl: file.config_url ? (file.config_url.startsWith('http') ? file.config_url : `http://localhost:5000${file.config_url}`) : null,
                category: file.category,
              };
              return acc;
            }, {});
            dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audioFiles });
            console.log(`Loaded ${Object.keys(audioFiles).length} audio files from sessionStorage`);
            return audioFiles;
          } catch (e) {
            console.error('Error parsing session storage cache:', e);
            // Continue with server request if parsing fails
          }
        }

        if (pendingAudioListRequest) {
          console.log('Using existing audio list request');
          return pendingAudioListRequest;
        }
        
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          if (args.length > 0 && (typeof args[0] === 'string') && 
              (args[0].includes('[TTS]') || args[0].includes('API request'))) {
            return;
          }
          originalConsoleLog.apply(console, args);
        };
        
        pendingAudioListRequest = listFromStorage('fileStorage')
          .then(files => {
            const audioFiles = files.reduce((acc, file) => {
              if (!file.category) return acc;
              acc[file.id] = {
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                source: file.source,
                date: file.date,
                placeholder: file.placeholder,
                volume: file.volume,
                url: file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`,
                configUrl: file.config_url ? (file.config_url.startsWith('http') ? file.config_url : `http://localhost:5000${file.config_url}`) : null,
                category: file.category,
              };
              return acc;
            }, {});
            
            dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audioFiles });
            
            saveToStorage('file_server_audio_metadata', files, 'localStorage')
              .then(() => console.log(`Saved ${files.length} metadata entries to localStorage`))
              .catch(error => console.error('Error saving metadata to localStorage:', error));
            
            // Also save to sessionStorage
            sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(files));
            
            console.log = originalConsoleLog;
            console.log(`Loaded ${Object.keys(audioFiles).length} audio files from server`);
            
            return audioFiles;
          })
          .catch(error => {
            console.log = originalConsoleLog;
            console.error('Error fetching audio library:', error);
            return {};
          })
          .finally(() => {
            setTimeout(() => {
              pendingAudioListRequest = null;
            }, 1000);
          });
        
        return pendingAudioListRequest;
      } catch (error) {
        console.error('Error in fetchAudioLibrary:', error);
        return {};
      }
    },

    /**
     * Sets the storage configuration for the TTS application
     * @param {Object} config - The storage configuration object
     */
    setStorageConfig: (config) => dispatch({ type: 'SET_STORAGE_CONFIG', payload: config }),
    
    /**
     * Sets the active speech engine
     * @param {string} engine - The speech engine to use (e.g., 'gtts', 'elevenLabs')
     */
    setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
    
    /**
     * Sets the selected voice for a specific engine
     * @param {string} engine - The speech engine 
     * @param {Object} voice - The voice object to set as selected
     */
    setSelectedVoice: (engine, voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: { engine, voice } }),
    
    /**
     * Adds a custom voice to the specified engine
     * @param {string} engine - The speech engine
     * @param {Object} voice - The custom voice object to add
     */
    addCustomVoice: (engine, voice) => dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice } }),
    
    /**
     * Removes a custom voice from the specified engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to remove
     */
    removeCustomVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } }),
    
    /**
     * Adds a voice to the active voices list for the specified engine
     * @param {string} engine - The speech engine
     * @param {Object} voice - The voice object to add to active voices
     */
    addActiveVoice: (engine, voice) => dispatch({ type: 'ADD_ACTIVE_VOICE', payload: { engine, voice } }),
    
    /**
     * Removes a voice from the active voices list for the specified engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to remove
     */
    removeActiveVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } }),
    
    /**
     * Sets an API key for a specific service
     * @param {string} keyName - The name of the API key to set
     * @param {string} value - The API key value
     */
    setApiKey: (keyName, value) => dispatch({ type: 'SET_API_KEY', payload: { keyName, value } }),
    
    /**
     * Adds an API key to an array of keys
     * @param {string} keyArray - The name of the array to add the key to
     * @param {Object} keyValue - The key value object to add
     */
    addApiKey: (keyArray, keyValue) => dispatch({ type: 'ADD_API_KEY', payload: { keyArray, keyValue } }),
    
    /**
     * Removes an API key from an array of keys
     * @param {string} keyArray - The name of the array to remove from
     * @param {number} index - The index of the key to remove
     */
    removeApiKey: (keyArray, index) => dispatch({ type: 'REMOVE_API_KEY', payload: { keyArray, index } }),
    
    /**
     * Sets the application mode
     * @param {string} mode - The mode to set ('demo' or 'production')
     */
    setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
    
    /**
     * Sets the application theme
     * @param {string} theme - The theme to apply
     */
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),

    /**
     * Uploads an audio file to storage and adds it to state
     * @param {File} file - The audio file to upload
     * @param {Object} audioData - Metadata for the audio file
     * @returns {Promise<void>}
     */
    uploadAudio: async (file, audioData) => {
      try {
        // Extract metadata to send to the server
        const metadata = {
          category: audioData.category || 'sound_effect',
          name: audioData.name,
          placeholder: audioData.placeholder,
          volume: audioData.volume.toString(),
        };
        const url = await saveToStorage(file.name, file, 'fileStorage', metadata);
        const updatedAudioData = { ...audioData, url };
        dispatch({ type: 'SAVE_AUDIO', payload: updatedAudioData });
      } catch (error) {
        devLog('Error uploading audio:', error);
        throw error;
      }
    },

    /**
     * Merges multiple audio files and uploads the result to storage
     * @param {string[]} audioUrls - Array of URLs or data URLs of audio files to merge
     * @param {Object} [audioData={}] - Metadata for the merged audio file
     * @param {Object} [config=null] - Configuration object containing sections and metadata
     * @returns {Promise<Object>} Object containing the local URL for playback and the uploaded URL
     */
    mergeAndUploadAudio: async (audioUrls, audioData = {}, config = null) => {
      try {
        if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
          throw new Error('Audio URLs array is required');
        }

        const fileId = uuidv4();
        devLog(`Creating new merged audio with ID: ${fileId}`);

        const response = await axios.post('/api/mergeAudio', { 
          audioUrls,
          config
        });
        const { mergedAudioUrl, uploadedAudioUrl } = response.data;

        const baseName = audioData.name 
          ? audioData.name.toLowerCase().replace(/\s+/g, '-') 
          : `merged-audio-${fileId}`;
          
        const audioKey = `${baseName}.wav`;
        const metadata = {
          id: fileId,
          category: 'merged_audio',
          name: audioData.name || 'Merged Audio',
          date: new Date().toISOString(),
          volume: audioData.volume ? audioData.volume.toString() : '1',
          placeholder: audioData.placeholder || audioData.name?.toLowerCase().replace(/\s+/g, '_') || 'merged_audio',
        };

        let finalUrl = uploadedAudioUrl;
        if (!finalUrl) {
          devLog('No uploadedAudioUrl, fetching from mergedAudioUrl:', mergedAudioUrl);
          const blobResponse = await axios.get(mergedAudioUrl, { responseType: 'blob' });
          const mergedBlob = blobResponse.data;
          const mergedFile = new File([mergedBlob], audioKey, { type: 'audio/wav' });
          finalUrl = await saveToStorage(audioKey, mergedFile, 'fileStorage', metadata);
          devLog('Fallback upload successful:', finalUrl);
        }

        let configFilename = null;
        let configUrl = null;
        
        if (config) {
          try {
            const configKey = `${baseName}.json`;
            configFilename = configKey;
            
            const configStr = JSON.stringify(config, null, 2);
            const configBlob = new Blob([configStr], { type: 'application/json' });
            const configFile = new File([configBlob], configKey, { type: 'application/json' });
            
            const configMetadata = {
              audioId: fileId,
              category: 'merged_audio_config',
              name: audioData.name || 'Merged Audio Config',
            };
            
            const configResponse = await saveToStorage(configKey, configFile, 'fileStorage', configMetadata);
            
            if (configResponse) {
              configUrl = configResponse.startsWith('http') 
                ? configResponse 
                : `http://localhost:5000/configs/${configKey}`;
                
              devLog('Config file saved successfully:', configUrl);
              
              // Retry metadata update up to 3 times
              let attempts = 0;
              const maxAttempts = 3;
              while (attempts < maxAttempts) {
                try {
                  await axios.patch(`http://localhost:5000/audio/${fileId}`, {
                    config_filename: configFilename,
                    config_url: `/configs/${configFilename}`,
                    config_exists: true
                  });
                  devLog('Updated audio metadata with config information');
                  break;
                } catch (metadataError) {
                  attempts++;
                  devLog(`Metadata update attempt ${attempts} failed:`, metadataError);
                  if (attempts === maxAttempts) {
                    console.error('Failed to update audio metadata after retries:', metadataError);
                    // Log but continue
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                }
              }
            }
          } catch (configError) {
            console.error('Error saving config file:', configError);
          }
        }

        const updatedAudioData = {
          id: fileId,
          url: finalUrl,
          category: 'merged_audio',
          name: metadata.name,
          date: metadata.date,
          volume: parseFloat(metadata.volume),
          placeholder: metadata.placeholder,
          type: 'audio/wav',
          config,
          configFilename,
          configUrl,
          audioFileExists: true,
          configExists: !!configUrl
        };

        dispatch({ type: 'SAVE_AUDIO', payload: updatedAudioData });

        dispatch({
          type: 'ADD_TO_FILE_HISTORY',
          payload: {
            id: updatedAudioData.id,
            date: updatedAudioData.date,
            template: audioData.template || 'merged',
            audioUrl: finalUrl,
            title: audioData.name,
            config,
            configFilename,
            configUrl,
            audioFileExists: true,
            configExists: !!configUrl,
            category: 'merged_audio'
          },
        });

        devLog('Merged and uploaded audio:', { 
          fileId,
          mergedAudioUrl, 
          uploadedAudioUrl: finalUrl,
          configFilename,
          configUrl
        });
        
        return { mergedAudioUrl, uploadedAudioUrl: finalUrl };
      } catch (error) {
        devLog('Error merging and uploading audio:', error);
        throw error;
      }
    },

    /**
     * Deletes an audio file from storage.
     * @param {string} audioId - The ID of the audio to delete
     * @param {string} filename - The filename of the audio file
     * @param {Object} options - Additional options for deletion
     * @param {string} [options.deleteOption='audio_only'] - Deletion option: 'audio_only', 'audio_and_config', or 'cancel'
     * @returns {Promise<void>}
     */
    deleteAudioFromStorage: async (audioId, filename, options = {}) => {
      try {
        devLog('Deleting audio from storage:', audioId, filename);
        
        // Extract deleteOption from options
        const deleteOption = options.deleteOption || 'audio_only';
        
        // If user chose to cancel, just return
        if (deleteOption === 'cancel') {
          return;
        }
        
        // Check if we need to delete config too
        const deleteConfig = deleteOption === 'audio_and_config';
        
        try {
          // Determine the appropriate API endpoint based on storage config
          let url = '';
          
          // Check if we have access to the current state
          if (!currentState) {
            // Fallback to a default URL if state is not available
            url = `http://localhost:5000/audio/${filename}?delete_config=${deleteConfig}`;
            devLog('Warning: currentState not available, using default server URL');
          } else {
            // Use the storage config from the current state
            switch (currentState.settings?.storageConfig?.type || 'local') {
              case 'local':
              case 'remote':
                const serverUrl = currentState.settings?.storageConfig?.serverUrl || 'http://localhost:5000';
                url = `${serverUrl}/audio/${filename}?delete_config=${deleteConfig}`;
                break;
              default:
                throw new Error(`Unsupported storage config type: ${currentState.settings?.storageConfig?.type || 'unknown'}`);
            }
          }
          
          devLog(`Deleting audio file ${filename} from ${url}`);
          await axios.delete(url);
          
          // If we're deleting a merged_audio, check if we need to update file history
          if (currentState && currentState.AudioLibrary && currentState.fileHistory) {
            const audioEntry = currentState.AudioLibrary[audioId];
            if (audioEntry && audioEntry.category === 'merged_audio' && !deleteConfig) {
              // Find the file history entry that corresponds to this audio
              const historyEntry = currentState.fileHistory.find(entry => {
                if (!entry.audioUrl) return false;
                return entry.audioUrl.includes(filename);
              });
              
              if (historyEntry && (historyEntry.config || historyEntry.configFilename)) {
                // Update the entry to be config-only
                const configOnlyEntry = {
                  ...historyEntry,
                  audioUrl: null,
                  audioFileExists: false,
                  title: historyEntry.title || (historyEntry.configFilename ? 
                    historyEntry.configFilename.replace(/\.json$/, '') : 
                    `Config-${historyEntry.id}`)
                };
                
                dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: configOnlyEntry });
              }
            }
          }
        } catch (error) {
          // Special case for 404 errors (file already deleted)
          if (error.response && error.response.status === 404) {
            devLog('File not found on server, but proceeding with state update:', error);
            
            // Even though the delete request failed, update the state
            dispatch({ type: 'DELETE_AUDIO', payload: audioId });
            
            // If we're deleting a merged_audio, check if we need to update file history
            if (currentState && currentState.AudioLibrary && currentState.fileHistory) {
              const audioEntry = currentState.AudioLibrary[audioId];
              if (audioEntry && audioEntry.category === 'merged_audio' && !deleteConfig) {
                // Find the file history entry
                const historyEntry = currentState.fileHistory.find(entry => {
                  if (!entry.audioUrl) return false;
                  return entry.audioUrl.includes(filename);
                });
                
                if (historyEntry && (historyEntry.config || historyEntry.configFilename)) {
                  // Update the entry to be config-only
                  const configOnlyEntry = {
                    ...historyEntry,
                    audioUrl: null,
                    audioFileExists: false,
                    title: historyEntry.title || (historyEntry.configFilename ? 
                      historyEntry.configFilename.replace(/\.json$/, '') : 
                      `Config-${historyEntry.id}`)
                  };
                  
                  dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: configOnlyEntry });
                }
              }
            }
            return;
          }
          
          // For other errors, throw the error
          devLog('Error in deleteAudioFromStorage:', error);
          throw error;
        }
        
        // Delete the audio from the AudioLibrary
        dispatch({ type: 'DELETE_AUDIO', payload: audioId });
      } catch (error) {
        devLog('Error in deleteAudioFromStorage:', error);
        throw error;
      }
    },

    /**
     * Lists all items from the specified storage type
     * @param {string} storageType - The storage type to list from
     * @returns {Promise<Array>} A list of items from storage
     */
    listFromStorage: async (storageType) => {
      try {
        // Temporarily disable console.log to prevent API spam
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          if (args.length > 0 && (typeof args[0] === 'string') && 
              (args[0].includes('[TTS]') || args[0].includes('API request'))) {
            return; // Skip TTS and API logs
          }
          originalConsoleLog.apply(console, args);
        };
        
        try {
          // Make the API call with logging suppressed
          const result = await listFromStorage(storageType);
          return result;
        } finally {
          // Restore console.log in any case (success or error)
          console.log = originalConsoleLog;
        }
      } catch (error) {
        devLog('Error listing from storage:', error);
        // Return empty array on error instead of throwing to prevent cascading failures
        return [];
      }
    },

    /**
     * Updates audio metadata on the server and in state
     * @param {string} audioId - The ID of the audio to update
     * @param {Object} updatedAudioData - The updated audio data
     * @returns {Promise<void>}
     */
    updateAudio: async (audioId, updatedAudioData) => {
      try {
        devLog('Updating audio with ID:', audioId, 'Data:', updatedAudioData);
        const updatedMetadata = await updateFileMetadata(audioId, {
          name: updatedAudioData.name || '',
          placeholder: updatedAudioData.placeholder || '',
          volume: typeof updatedAudioData.volume === 'number' ? updatedAudioData.volume : 1,
        });
        dispatch({ type: 'SAVE_AUDIO', payload: { ...updatedAudioData, ...updatedMetadata } });
      } catch (error) {
        devLog('Error updating audio metadata:', error);
        throw error;
      }
    },

    /**
     * Loads the audio library into state
     * @param {Object} audioLibrary - The audio library to load
     */
    loadAudioLibrary: (audioLibrary) => {
      dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audioLibrary });
    },

    /**
     * Saves audio data to state
     * @param {Object} audioData - The audio data to save
     */
    saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
    
    /**
     * Deletes audio from state by ID
     * @param {string} audioId - The ID of the audio to delete
     */
    deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),

    /**
     * Resets the application state to initial values
     */
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
      saveToStorage('tts_persistent_state', initialPersistentState, 'localStorage');
    },

    /**
     * Saves a template to state and localStorage
     * @param {Object} template - The template to save
     * @returns {Promise<void>}
     */
    saveTemplate: async (template) => {
      dispatch({ type: 'SAVE_TEMPLATE', payload: template });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        templates[template.id] = template;
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        devLog('Error saving template:', error);
        throw error;
      }
    },

    /**
     * Deletes a template from state and localStorage
     * @param {string} templateId - The ID of the template to delete
     * @returns {Promise<void>}
     */
    deleteTemplate: async (templateId) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        delete templates[templateId];
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        devLog('Error deleting template:', error);
        throw error;
      }
    },

    /**
     * Loads templates from localStorage
     * @returns {Promise<void>}
     */
    loadTemplates: async () => {
      try {
        const templates = await loadFromStorage('tts_templates', false, 'localStorage');
        if (templates) {
          dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
        }
      } catch (error) {
        devLog('Error loading templates:', error);
        throw error;
      }
    },

    /**
     * Sets the default voice for a specific engine
     * @param {string} engine - The speech engine
     * @param {string} voiceId - The ID of the voice to set as default
     */
    setDefaultVoice: (engine, voiceId) =>
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: { engine, voiceId } }),

    /**
     * Loads a history entry
     * @param {Object} historyEntry - The history entry to load
     * @returns {void}
     */
    loadHistoryEntry: (historyEntry) => {
      try {
        // Check if the history entry has an audioUrl
        if (historyEntry && historyEntry.audioUrl) {
          devLog('Loading history entry with audioUrl:', historyEntry);
          
          // If it's a merged audio file, check for config
          if (historyEntry.template === 'merged' || !historyEntry.template) {
            if (historyEntry.config) {
              devLog('Found configuration in history entry:', historyEntry.config);
              
              // Make sure we have a proper config object
              const config = typeof historyEntry.config === 'string' 
                ? JSON.parse(historyEntry.config) 
                : historyEntry.config;
              
              // Make sure the window.ttsSessionDispatch is available
              // If not, we'll use a custom event that will be picked up once the context is loaded
              if (window.ttsSessionDispatch) {
                devLog('Using window.ttsSessionDispatch to load config');
                
                // Reset the current session
                window.ttsSessionDispatch({ type: 'RESET_SESSION' });
                
                // Load the sections from the config
                if (Array.isArray(config.sections)) {
                  window.ttsSessionDispatch({ type: 'SET_SECTIONS', payload: config.sections });
                }
                
                // Set description if available
                if (config.description) {
                  window.ttsSessionDispatch({ type: 'SET_DESCRIPTION', payload: config.description });
                }
                
                // Set title if available
                if (config.title) {
                  window.ttsSessionDispatch({ type: 'SET_TITLE', payload: config.title });
                }
                
                // Set notification
                window.ttsSessionDispatch({ 
                  type: 'SET_NOTIFICATION', 
                  payload: { 
                    type: 'success', 
                    message: 'Configuration loaded successfully'
                  } 
                });
                
                // Navigate to main tab
                window.ttsSessionDispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' });
              } else {
                // Dispatch an event to load the configuration into the session state
                // This is a more reliable method after page refresh
                devLog('window.ttsSessionDispatch not available, using custom event');
                
                const event = new CustomEvent('load-tts-config', { 
                  detail: { config }
                });
                window.dispatchEvent(event);
                devLog('Dispatched load-tts-config event with config');
                
                // After a short delay to ensure the event is processed, redirect if needed
                setTimeout(() => {
                  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                  }
                }, 100);
              }
              
              return;
            }
            
            // Configuration not found but we have the audio URL
            devLog('This is a merged audio file but no configuration found. It can be played directly from the file history.');
            alert('This file can be played, but its configuration is not available for editing.');
            return;
          }
          
          // For other templates, future implementation will restore the session
          console.log('Loading non-merged history entry:', historyEntry);
          alert('This template loading feature is currently being implemented.');
        } else {
          devLog('History entry has no audioUrl');
          alert('This history entry has no associated audio file.');
        }
      } catch (error) {
        devLog('Error loading history entry:', error);
        console.error('Failed to load history entry:', error);
        alert(`Error loading configuration: ${error.message}`);
      }
    },

    /**
     * Deletes a history entry from the storage API.
     * @param {Object} entry - The history entry to delete
     * @param {Object} options - Options for deletion
     * @param {string} options.deleteOption - Delete option ('audio_only', 'config_only', 'audio_and_config', 'remove_entry_only')
     * @returns {Promise<Object>} Result of the deletion operation
     */
    deleteHistoryEntry: async (entry, options = {}) => {
      const {
        deleteOption = 'audio_and_config', // Default to deleting both
      } = options;
      
      devLog('deleteHistoryEntry called with entry:', entry, 'options:', options);
      
      // Safety check
      if (!entry || !entry.id) {
        devLog('Invalid entry passed to deleteHistoryEntry');
        return { success: false, error: 'Invalid entry' };
      }
      
      try {
        let result = { success: true };
        
        // If we're only removing from history (not deleting any actual files)
        if (deleteOption === 'remove_entry_only') {
          // Just dispatch the action to remove from history
          dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
          return { success: true, removedFromHistory: true };
        }
        
        // If we need to delete audio file
        if (entry.audioUrl && (deleteOption === 'audio_only' || deleteOption === 'audio_and_config')) {
          try {
            // Extract the filename from the URL
            const url = new URL(entry.audioUrl);
            const filename = url.pathname.split('/').pop();
            
            // Delete from storage
            result = await removeFromStorage(filename, 'fileStorage', {
              delete_config: deleteOption === 'audio_and_config'
            });
            
            // If successful or file not found, remove from history if appropriate
            if (result.success || (result.error && result.error.includes('not found'))) {
              if (deleteOption === 'audio_and_config') {
                dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
              } else if (deleteOption === 'audio_only') {
                // If we're only deleting audio but no config exists, remove the whole entry
                if (!entry.configUrl && !entry.configFilename && !entry.config) {
                  dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
                } else {
                  // Otherwise update to mark audio as deleted
                  dispatch({ 
                    type: 'UPDATE_HISTORY_ENTRY', 
                    payload: { 
                      ...entry, 
                      audioUrl: null,
                      audioFileExists: false
                    } 
                  });
                }
              }
            }
          } catch (error) {
            devLog('Error deleting audio file:', error);
            result.success = false;
            result.error = error.message;
          }
        }
        // If no audio URL but we need to delete config only
        else if (deleteOption === 'audio_only') {
          // Just remove entry if this is audio-only deletion and there's no audio
          dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
          result.success = true;
        }
        
        // If we need to delete config file explicitly (and not via audio deletion with delete_config)
        if (deleteOption === 'config_only' && (entry.configUrl || entry.configFilename)) {
          try {
            result = await dispatch({
              type: 'DELETE_CONFIG_FILE',
              payload: entry
            });
            
            // If successful or file not found, update history
            if (result.success || (result.error && result.error.includes('not found'))) {
              // If no audio exists either, remove the whole entry
              if (!entry.audioUrl || entry.audioFileExists === false) {
                dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
              } else {
                // Otherwise update to mark config as deleted
                dispatch({ 
                  type: 'UPDATE_HISTORY_ENTRY', 
                  payload: { 
                    ...entry, 
                    configUrl: null,
                    configExists: false,
                    configFilename: null,
                    config: null
                  } 
                });
              }
            }
          } catch (error) {
            devLog('Error deleting config file:', error);
            result.success = false;
            result.error = error.message;
          }
        }
        
        return result;
      } catch (error) {
        devLog('Error in deleteHistoryEntry:', error);
        return { success: false, error: error.message };
      }
    },
    
    /**
     * Deletes just the config file associated with a history entry
     * @param {Object} entry - The history entry containing the config to delete
     * @returns {Promise<Object>} Result object with deletion status
     */
    deleteConfigFile: async (entry) => {
      try {
        if (!entry || !entry.id) {
          throw new Error('Invalid entry');
        }
        
        const result = { 
          success: false, 
          deletedConfig: false,
          error: null
        };
        
        // First try to get the config filename from the entry
        let configFilename = entry.configFilename;
        
        // If we don't have it, try to find it from the file ID
        if (!configFilename && entry.id) {
          try {
            const response = await axios.get(`http://localhost:5000/debug/file/${entry.id}`);
            if (response.data && response.data.file) {
              configFilename = response.data.file.config_filename;
            }
          } catch (lookupError) {
            devLog('Error looking up config filename:', lookupError);
            // Continue with the next method
          }
        }
        
        // If we still don't have the filename, try to get it from the list method
        if (!configFilename) {
          try {
            const listResponse = await axios.get(`http://localhost:5000/audio/list`);
            if (listResponse.data && Array.isArray(listResponse.data)) {
              const fileEntry = listResponse.data.find(item => item.id === entry.id);
              if (fileEntry && fileEntry.config_filename) {
                configFilename = fileEntry.config_filename;
              }
            }
          } catch (listError) {
            devLog('Error getting file list:', listError);
            result.error = 'Could not retrieve config filename';
          }
        }
        
        // If we have a config filename, try to delete it
        if (configFilename) {
          try {
            const response = await axios.delete(`http://localhost:5000/configs/${configFilename}`);
            if (response.status === 200) {
              result.deletedConfig = true;
              
              // If there's no audio or the audio doesn't exist, we should completely remove the entry
              if (!entry.audioUrl || entry.audioFileExists === false) {
                dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
              } else {
                // Otherwise, just update it to remove the config references
                const updatedEntry = {
                  ...entry,
                  config: null,
                  configFilename: null
                };
                dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: updatedEntry });
              }
              
              result.success = true;
              devLog(`Successfully deleted config file: ${configFilename}`);
            }
          } catch (deleteError) {
            // If 404, config already deleted
            if (deleteError.response && deleteError.response.status === 404) {
              devLog('Config file not found on server (already deleted)');
              result.deletedConfig = true;
              result.success = true;
              
              // Still update the state
              if (!entry.audioUrl || entry.audioFileExists === false) {
                dispatch({ type: 'DELETE_HISTORY_ENTRY', payload: entry.id });
              } else {
                const updatedEntry = {
                  ...entry,
                  config: null,
                  configFilename: null
                };
                dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: updatedEntry });
              }
            } else {
              devLog('Error deleting config file:', deleteError);
              result.error = `Failed to delete config file: ${deleteError.message}`;
            }
          }
        } else {
          result.error = 'No config filename found to delete';
        }
        
        return result;
      } catch (error) {
        devLog('Error in deleteConfigFile:', error);
        return {
          success: false,
          deletedConfig: false,
          error: error.message
        };
      }
    },

    /**
     * Adds an entry to the file history
     * @param {Object} entry - The history entry to add
     * @param {string} entry.id - The unique ID of the entry
     * @param {string} entry.date - The date of the entry in ISO format
     * @param {string} entry.template - The template name
     * @param {string} entry.audioUrl - The URL of the audio file
     * @param {string} [entry.title] - Optional title for the entry
     */
    addToFileHistory: (entry) => {
      if (!entry || !entry.id) {
        devLog('Invalid history entry:', entry);
        return;
      }
      
      devLog('Adding to file history:', entry);
      
      // Make sure we have a title for the entry
      if (entry.audioUrl && !entry.title) {
        try {
          // Try to extract a title from the URL if not provided
          const url = new URL(entry.audioUrl);
          const filename = url.pathname.split('/').pop();
          if (filename) {
            // Remove extension and use as title
            entry.title = filename.replace(/\.[^/.]+$/, '');
          }
        } catch (e) {
          devLog('Error extracting title from URL:', e);
        }
      }
      
      dispatch({ type: 'ADD_TO_FILE_HISTORY', payload: entry });
    },
    
    /**
     * Updates an existing entry in the file history
     * @param {Object} entry - The history entry to update
     * @param {string} entry.id - The unique ID of the entry to update
     * @returns {void}
     */
    updateHistoryEntry: (entry) => {
      if (!entry || !entry.id) {
        devLog('Invalid history entry for update:', entry);
        return;
      }
      
      devLog('Updating file history entry:', entry);
      dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: entry });
    },

    /**
     * Cleanup the file history, keeping only the provided entries
     * @param {Array} entriesToKeep - Array of entries to keep in the history
     * @returns {void}
     */
    cleanupFileHistory: (entriesToKeep) => {
      if (!Array.isArray(entriesToKeep)) {
        devLog('Invalid entries array for cleanup:', entriesToKeep);
        return;
      }
      
      devLog(`Cleaning up file history, keeping ${entriesToKeep.length} entries`);
      dispatch({ type: 'CLEANUP_FILE_HISTORY', payload: entriesToKeep });
    },

    /**
     * Refreshes the file history by fetching the latest data from file storage
     * @returns {Promise<void>}
     */
    refreshFileHistory: async () => {
      try {
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          if (args.length > 0 && (typeof args[0] === 'string') && 
              (args[0].includes('[TTS]') || args[0].includes('API request'))) {
            return;
          }
          originalConsoleLog.apply(console, args);
        };
        
        try {
          const files = await listFromStorage('fileStorage');
          
          if (Array.isArray(files)) {
            devLog(`Processing ${files.length} files from storage`);
            
            const fileMap = new Map();
            
            for (const file of files) {
              if (!file.id) continue;
              
              let entry = fileMap.get(file.id) || {
                id: file.id,
                date: file.date || new Date().toISOString(),
                category: file.category || 'other',
                template: 'merged',
                audioFileExists: false,
                configExists: false
              };
              
              if (file.name) {
                entry.title = file.name;
              }
              
              if (file.url) {
                entry.audioUrl = file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`;
                entry.audioFileExists = file.audio_exists !== false;
              }
              
              if (file.config_filename || file.config_path || file.config_url) {
                entry.configFilename = file.config_filename || entry.configFilename;
                entry.configPath = file.config_path || entry.configPath;
                entry.configUrl = file.config_url ? 
                  (file.config_url.startsWith('http') ? file.config_url : `http://localhost:5000${file.config_url}`) : 
                  (file.config_filename ? `http://localhost:5000/configs/${file.config_filename}` : entry.configUrl);
                entry.configExists = file.config_exists !== false;
              }
              
              if (entry.audioUrl && entry.audioFileExists !== false) {
                if (entry.configUrl && entry.configExists !== false) {
                  entry.category = 'merged_audio';
                } else {
                  entry.category = 'merged_audio';
                }
              } else if (entry.configUrl && entry.configExists !== false) {
                entry.category = 'merged_audio_config';
              }
              
              fileMap.set(file.id, entry);
            }
            
            const existingHistory = currentState?.fileHistory || [];
            const existingEntryMap = new Map();
            existingHistory.forEach(entry => {
              existingEntryMap.set(entry.id, entry);
            });
            
            const newEntries = [];
            const updatedEntries = [];
            
            for (const [id, fileEntry] of fileMap.entries()) {
              const existingEntry = existingEntryMap.get(id);
              
              if (!existingEntry) {
                newEntries.push(fileEntry);
              } else {
                const updatedEntry = { 
                  ...existingEntry,
                  audioUrl: fileEntry.audioUrl || existingEntry.audioUrl,
                  audioFileExists: fileEntry.audioFileExists !== undefined ? fileEntry.audioFileExists : existingEntry.audioFileExists,
                  configUrl: fileEntry.configUrl || existingEntry.configUrl,
                  configFilename: fileEntry.configFilename || existingEntry.configFilename,
                  configPath: fileEntry.configPath || existingEntry.configPath,
                  configExists: fileEntry.configExists !== undefined ? fileEntry.configExists : existingEntry.configExists,
                  category: fileEntry.category || existingEntry.category
                };
                
                if (fileEntry.title && (!existingEntry.title || existingEntry.title.startsWith('Config-') || existingEntry.title.startsWith('File-'))) {
                  updatedEntry.title = fileEntry.title;
                }
                
                if (JSON.stringify(existingEntry) !== JSON.stringify(updatedEntry)) {
                  updatedEntries.push(updatedEntry);
                }
              }
            }
            
            const removedEntries = existingHistory.filter(entry => {
              if (!fileMap.has(entry.id)) {
                return !(entry.audioFileExists || entry.configExists);
              }
              return false;
            });
            
            if (newEntries.length > 0) {
              devLog(`Adding ${newEntries.length} new entries to history`);
              dispatch({ type: 'ADD_HISTORY_ENTRIES', payload: newEntries });
            }
            
            updatedEntries.forEach(entry => {
              devLog(`Updating entry ${entry.id} in history`);
              dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: entry });
            });
            
            if (removedEntries.length > 0) {
              devLog(`Cleaning up ${removedEntries.length} entries without valid files`);
              const remainingEntries = existingHistory.filter(entry => !removedEntries.includes(entry));
              dispatch({ type: 'CLEANUP_FILE_HISTORY', payload: remainingEntries });
            }
            
            devLog(`Refresh complete: ${newEntries.length} new, ${updatedEntries.length} updated, ${removedEntries.length} removed`);
          }
        } finally {
          console.log = originalConsoleLog;
        }
      } catch (error) {
        devLog('Error refreshing file history:', error);
      }
    },

    // Add the setCurrentState function to the actions
    updateCurrentState: setCurrentState,
  };
}