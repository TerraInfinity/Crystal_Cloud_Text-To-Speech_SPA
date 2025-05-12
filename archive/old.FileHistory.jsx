/**
 * @fileoverview File History component for the Text-to-Speech application.
 * Displays a history of previously generated TTS files and allows loading previous configurations
 * or downloading generated audio files.
 * 
 * @requires React
 * @requires ../context/TTSContext
 */

import React, { useState, useEffect, useRef } from 'react';
import {useTTSContext} from '../context/TTSContext';

/**
 * FileHistory component for displaying and managing TTS file history.
 * Shows previously generated TTS configurations and audio files, with options
 * to play audio, load configurations, download audio files, or delete history entries.
 * 
 * @component
 * @returns {JSX.Element} The rendered FileHistory component
 */
const FileHistory = () => {
  const { state, actions } = useTTSContext();
  const fileHistory = state?.fileHistory || [];

  // State to track which entries are being deleted (by ID)
  const [deletingEntries, setDeletingEntries] = useState(new Set());
  // State to track which entries are loading configs (by ID)
  const [loadingConfigs, setLoadingConfigs] = useState(new Set());
  // State to track the currently playing audio entry (by ID)
  const [playingEntryId, setPlayingEntryId] = useState(null);
  // State to hold loaded JSON config for download
  const [configData, setConfigData] = useState({});
  // State for custom confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({ 
    isOpen: false, 
    entryId: null, 
    title: '',
    message: '',
    configOnly: false
  });
  // State to track if verification has been run
  const [hasVerifiedFiles, setHasVerifiedFiles] = useState(false);
  // Add a new state to prevent multiple API requests
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  
  // Add a ref to cache file list and prevent multiple API calls
  const cachedFilesRef = useRef(null);
  // Add a ref to track active API requests
  const pendingRequestRef = useRef(null);

  /**
   * Check if a file exists using a HEAD request
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} True if file exists, false otherwise
   */
  const checkFileExists = async (url) => {
    if (!url) return false;
    
    try {
      // Extract filename from URL
      const filename = url.split('/').pop();
      if (!filename) return false;
      
      // Create a cache key using the filename
      const cacheKey = `file_exists_${filename}`;
      
      // Check if we have a cached result
      const cachedResult = sessionStorage.getItem(cacheKey);
      if (cachedResult) {
        return cachedResult === 'true';
      }
      
      // Make HEAD request to check existence
      const response = await fetch(`/api/storageService/file-exists/${encodeURIComponent(filename)}`, { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const exists = response.ok;
      
      // Cache the result for this session
      sessionStorage.setItem(cacheKey, exists.toString());
      
      return exists;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  };

  // Effect to verify files exist when component mounts
  useEffect(() => {
    if (hasVerifiedFiles || fileHistory.length === 0) {
        return;
    }

    const verifyFiles = async () => {
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            if (args.length > 0 && (typeof args[0] === 'string') && 
                (args[0].includes('[TTS]') || args[0].includes('API request'))) {
                return;
            }
            originalConsoleLog.apply(console, args);
        };
        
        try {
            const entriesToCheck = fileHistory.filter(entry => 
                (entry.audioUrl && entry.audioFileExists === undefined) ||
                ((entry.configUrl || entry.configFilename) && entry.configExists === undefined) ||
                (entry.category === 'merged_audio' && !entry.configVerified)
            );
            
            if (entriesToCheck.length === 0) {
                setHasVerifiedFiles(true);
                return;
            }

            console.log(`Verifying ${entriesToCheck.length} file history entries for existence`);
            
            const batchSize = 5;
            for (let i = 0; i < entriesToCheck.length; i += batchSize) {
                const batch = entriesToCheck.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (entry) => {
                    const updates = { ...entry };
                    let needsUpdate = false;
                    
                    // Verify audio file existence
                    if (entry.audioUrl && entry.audioFileExists === undefined) {
                        const audioExists = await checkFileExists(entry.audioUrl);
                        if (audioExists !== undefined) {
                            console.log(`Audio file ${audioExists ? 'exists' : 'does not exist'} for entry ${entry.id}`);
                            updates.audioFileExists = audioExists;
                            needsUpdate = true;
                        }
                    }
                    
                    // Verify config file existence based on configUrl or configFilename
                    if ((entry.configUrl || entry.configFilename) && entry.configExists === undefined) {
                        const configUrl = entry.configUrl || (entry.configFilename ? `/configs/${entry.configFilename}` : null);
                        if (configUrl) {
                            const configExists = await checkFileExists(configUrl);
                            console.log(`Config file ${configExists ? 'exists' : 'does not exist'} for entry ${entry.id}`);
                            updates.configExists = configExists;
                            updates.configUrl = configUrl;
                            needsUpdate = true;
                        }
                    }
                    
                    // Try to find a matching config file for audio-only entries
                    if (entry.category === 'merged_audio' && !entry.configUrl && entry.audioUrl) {
                        try {
                            const audioFilename = entry.audioUrl.split('/').pop();
                            const baseName = audioFilename.replace(/\.[^/.]+$/, '');
                            const configFilename = `${baseName}.json`;
                            const configUrl = `/configs/${configFilename}`;
                            const configExists = await checkFileExists(configUrl);
                            
                            if (configExists) {
                                console.log(`Found matching config ${configFilename} for entry ${entry.id}`);
                                updates.configUrl = configUrl;
                                updates.configFilename = configFilename;
                                updates.configExists = true;
                                needsUpdate = true;
                            }
                        } catch (error) {
                            console.error('Error searching for matching config:', error);
                        }
                    }
                    
                    if (needsUpdate) {
                        actions.updateHistoryEntry(updates);
                    }
                }));
                
                // Small delay between batches to avoid overwhelming the server
                if (i + batchSize < entriesToCheck.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            setHasVerifiedFiles(true);
        } finally {
            console.log = originalConsoleLog;
        }
    };

    verifyFiles();
  }, [fileHistory, actions, hasVerifiedFiles]);

  /**
   * Extracts the file name from an audio URL.
   * @param {string} audioUrl - The URL of the audio file
   * @returns {string} The extracted file name or a default value
   */
  const getFileNameFromUrl = (audioUrl) => {
    if (!audioUrl) return 'Configuration';
    try {
      const url = new URL(audioUrl);
      const fileName = url.pathname.split('/').pop(); // Get the last part of the path
      return fileName ? decodeURIComponent(fileName) : 'Untitled Audio';
    } catch (error) {
      console.error('Error parsing audio URL:', error);
      return 'Untitled Audio';
    }
  };

  /**
   * Gets the display title for an entry, prioritizing explicit title if available
   * @param {Object} entry - The history entry
   * @returns {string} The display title for the entry
   */
  const getEntryTitle = (entry) => {
    // First check if there's an explicit title property
    if (entry.title) {
      return entry.title;
    }
    
    // For audio entries, get the filename from URL
    if (entry.audioUrl && entry.audioFileExists !== false) {
      return getFileNameFromUrl(entry.audioUrl);
    }
    
    // For config-only entries, use the config filename without extension
    if (entry.configFilename) {
      return entry.configFilename.replace(/\.json$/, '');
    }
    
    // Fallback
    return 'Configuration';
  };

  /**
   * Handles the play/pause functionality for audio entries
   * @param {Object} entry - The history entry containing the audio file
   */
  const handlePlay = async (entry) => {
    if (playingEntryId === entry.id) {
      // If this entry is currently playing, stop it
      setPlayingEntryId(null);
    } else {
      // Check if audio file exists first
      if (entry.audioFileExists === undefined) {
        const exists = await checkFileExists(entry.audioUrl);
        if (!exists) {
          alert('Audio file not found on server.');
          actions.updateHistoryEntry({ ...entry, audioFileExists: false });
          return;
        }
      } else if (entry.audioFileExists === false) {
        alert('Audio file not found on server.');
        return;
      }
      
      // If another entry is playing, stop it first
      if (playingEntryId) {
        // Try to pause the current player if it exists
        const currentPlayer = document.getElementById(`audio-player-${playingEntryId}`);
        if (currentPlayer) {
          currentPlayer.pause();
        }
      }
      
      // Start playing this entry
      setPlayingEntryId(entry.id);
    }
  };

  /**
   * Loads a configuration from a history entry.
   * Sends a custom event to load the configuration in the TTS app.
   * @param {Object} historyEntry - The history entry to load the config from
   */
  const loadConfiguration = async (historyEntry) => {
    if (isLoadingConfig) {
      console.log('Already loading a configuration, skipping new request');
      return;
    }
    
    // First, check if the config exists if we have a URL
    if (historyEntry.configUrl && historyEntry.configExists === undefined) {
      const exists = await checkFileExists(historyEntry.configUrl);
      if (!exists) {
        alert('Configuration file not found on server.');
        actions.updateHistoryEntry({ ...historyEntry, configExists: false });
        return;
      }
    } else if (historyEntry.configExists === false) {
      alert('Configuration file not found on server.');
      return;
    }
    
    setIsLoadingConfig(true);
    setLoadingConfigs(prev => new Set(prev).add(historyEntry.id));
    
    try {
      let config = historyEntry.config;
      
      // If we already have the config data for this entry, use it
      if (configData[historyEntry.id]) {
        console.log('Using cached config data for', historyEntry.id);
        config = configData[historyEntry.id];
      } else if (historyEntry.configUrl) {
        // Try loading directly from configUrl if available
        try {
          console.log('Loading config from configUrl:', historyEntry.configUrl);
          const response = await fetch(historyEntry.configUrl);
          if (!response.ok) throw new Error(`Failed to fetch config: ${response.status}`);
          config = await response.json();
          
          // Cache the config for future use
          setConfigData(prev => ({ ...prev, [historyEntry.id]: config }));
        } catch (error) {
          console.error('Error loading config from URL:', error);
          // Mark the config as not existing if we get a 404
          if (error.message.includes('404')) {
            actions.updateHistoryEntry({ ...historyEntry, configExists: false });
          }
          throw error;
        }
      } else if (historyEntry.configFilename) {
        // Load from storage if we have a filename
        try {
          console.log('Loading config from configFilename:', historyEntry.configFilename);
          const configResponse = await actions.loadFromStorage(historyEntry.configFilename, false, 'fileStorage');
          config = JSON.parse(await configResponse.text());
          
          // Cache the config for future use
          setConfigData(prev => ({ ...prev, [historyEntry.id]: config }));
        } catch (error) {
          console.error('Error loading config:', error);
          // Mark the config as not existing if we get a file not found error
          if (error.message.includes('not found') || error.message.includes('404')) {
            actions.updateHistoryEntry({ ...historyEntry, configExists: false });
          }
          throw error;
        }
      }
        
      if (!config) {
        // Try to find the file in cached lists first
        let targetFile = null;
        
        // Only do a server list call if we haven't already found the config and we don't have a cached list
        if (!cachedFilesRef.current) {
          try {
            // If there's already a pending request, wait for it instead of creating a new one
            if (pendingRequestRef.current) {
              cachedFilesRef.current = await pendingRequestRef.current;
            } else {
              // Create a promise that we can track
              pendingRequestRef.current = actions.listFromStorage('fileStorage');
              cachedFilesRef.current = await pendingRequestRef.current;
            }
          } catch (err) {
            console.error('Error fetching files list:', err);
            cachedFilesRef.current = []; // Set to empty array to prevent further attempts
          } finally {
            // Clear the pending request ref regardless of success/failure
            pendingRequestRef.current = null;
          }
        }
        
        // Find the target file
        targetFile = cachedFilesRef.current.find(file => file.id === historyEntry.id);
        
        if (targetFile) {
          console.log('Found matching file in server list:', targetFile);
          
          // Try to get config from various sources
          if (targetFile.config) {
            // Config embedded in file metadata
            console.log('Found config embedded in file metadata');
            config = typeof targetFile.config === 'string' 
              ? JSON.parse(targetFile.config) 
              : targetFile.config;
              
            // Cache the config for future use
            setConfigData(prev => ({ ...prev, [historyEntry.id]: config }));
          } else if (targetFile.config_url) {
            // Try to load from config_url
            try {
              console.log('Loading config from server config_url:', targetFile.config_url);
              const configUrl = targetFile.config_url.startsWith('http') 
                ? targetFile.config_url 
                : `http://localhost:5000${targetFile.config_url}`;
              
              const configResponse = await fetch(configUrl);
              if (!configResponse.ok) throw new Error(`Failed to fetch config: ${configResponse.status}`);
              
              config = await configResponse.json();
              
              // Update the entry with the config URL
              actions.updateHistoryEntry({
                ...historyEntry,
                configUrl: configUrl,
                configExists: true
              });
              
              // Cache the config for future use
              setConfigData(prev => ({ ...prev, [historyEntry.id]: config }));
            } catch (configUrlError) {
              console.error('Error loading config from config_url:', configUrlError);
              // Mark the config as not existing if we get a 404
              if (configUrlError.message.includes('404')) {
                actions.updateHistoryEntry({ ...historyEntry, configExists: false });
              }
              throw configUrlError;
            }
          }
        }
      }
      
      if (!config) {
        console.warn('No configuration found for history entry', historyEntry);
        alert('No configuration found for this history entry');
        actions.updateHistoryEntry({
          ...historyEntry,
          configExists: false
        });
        return;
      }
      
      // Dispatch a custom event to load the config
      window.dispatchEvent(new CustomEvent('load-tts-config', { 
        detail: { config }
      }));
      
      console.log('Dispatched load-tts-config event with config:', config);
    } catch (error) {
      console.error('Error loading configuration:', error);
      alert(`Error loading configuration: ${error.message}`);
    } finally {
      setLoadingConfigs(prev => {
        const newSet = new Set(prev);
        newSet.delete(historyEntry.id);
        return newSet;
      });
      
      // Reset loading state after a short delay to prevent rapid clicking
      setTimeout(() => setIsLoadingConfig(false), 500);
    }
  };

  /**
   * Downloads the audio file by fetching it and triggering a "Save As" dialog.
   * @param {Object} entry - The history entry containing the audio file
   */
  const handleDownload = async (entry) => {
    // Verify the file exists first
    if (entry.audioFileExists === undefined) {
      const exists = await checkFileExists(entry.audioUrl);
      if (!exists) {
        alert('Audio file not found on server.');
        actions.updateHistoryEntry({ ...entry, audioFileExists: false });
        return;
      }
    } else if (entry.audioFileExists === false) {
      alert('Audio file not found on server.');
      return;
    }
    
    try {
      // Extract the original filename from the URL
      const urlFilename = entry.audioUrl.split('/').pop();
      const fileName = decodeURIComponent(urlFilename);
      
      const response = await fetch(entry.audioUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch audio file');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading audio:', error);
      alert('Failed to download audio: ' + error.message);
      
      // If we get a 404, update the entry to mark the file as not existing
      if (error.message.includes('not found') || error.message.includes('404')) {
        actions.updateHistoryEntry({ ...entry, audioFileExists: false });
      }
    }
  };

  /**
   * Downloads the JSON configuration file for an entry
   * @param {Object} entry - The history entry
   */
  const handleDownloadJSON = async (entry) => {
    // Verify the config exists first if we have a configUrl
    if (entry.configUrl && entry.configExists === undefined) {
      const exists = await checkFileExists(entry.configUrl);
      if (!exists) {
        alert('Configuration file not found on server.');
        actions.updateHistoryEntry({ ...entry, configExists: false });
        return;
      }
    } else if (entry.configExists === false) {
      alert('Configuration file not found on server.');
      return;
    }
    
    try {
      // First, make sure we have config data for this entry
      let configToDownload = configData[entry.id] || entry.config;
      
      if (!configToDownload) {
        // Try to load config from configUrl if available
        if (entry.configUrl && !isLoadingConfig) {
          console.log(`Using configUrl to load configuration for ${entry.id}`);
          
          // Show a loading indicator
          const loadingIndicator = document.getElementById(`download-json-btn-${entry.id}`);
          if (loadingIndicator) {
            const originalContent = loadingIndicator.innerHTML;
            loadingIndicator.innerHTML = `<svg class="animate-spin h-6 w-6 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>`;
            
            // Reset button after a timeout in case of errors
            setTimeout(() => {
              if (loadingIndicator && loadingIndicator.innerHTML.includes('animate-spin')) {
                loadingIndicator.innerHTML = originalContent;
              }
            }, 5000);
          }
          
          // Fetch the config directly from configUrl
          fetch(entry.configUrl)
            .then(response => {
              if (!response.ok) {
                // Mark the config as not existing if we get a 404
                if (response.status === 404) {
                  actions.updateHistoryEntry({ ...entry, configExists: false });
                }
                throw new Error(`Failed to fetch config: ${response.status}`);
              }
              return response.json();
            })
            .then(config => {
              // Cache the config for future use
              setConfigData(prev => ({ ...prev, [entry.id]: config }));
              
              // Reset the button appearance
              if (loadingIndicator) {
                loadingIndicator.innerHTML = originalContent;
              }
              
              // Download the config
              downloadConfigFile({...entry, config});
            })
            .catch(error => {
              console.error('Error fetching config:', error);
              // Reset the button appearance
              if (loadingIndicator) {
                loadingIndicator.innerHTML = originalContent;
              }
              alert(`Failed to load configuration: ${error.message}`);
            });
          return;
        } 
        // If it's a merged_audio entry without loaded config, first try to load it
        else if ((entry.category === 'merged_audio') && !isLoadingConfig) {
          console.log(`No config loaded yet for merged audio entry ${entry.id} - attempting to load it first`);
          
          // Show a loading indicator
          const loadingIndicator = document.getElementById(`download-json-btn-${entry.id}`);
          if (loadingIndicator) {
            const originalContent = loadingIndicator.innerHTML;
            loadingIndicator.innerHTML = `<svg class="animate-spin h-6 w-6 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>`;
            
            // Reset button after a timeout in case of errors
            setTimeout(() => {
              if (loadingIndicator && loadingIndicator.innerHTML.includes('animate-spin')) {
                loadingIndicator.innerHTML = originalContent;
              }
            }, 5000);
          }
          
          // Load the config first if it's not loaded yet, using our loadConfiguration function
          loadConfiguration(entry).then(() => {
            // After it's loaded, check again and try to download
            configToDownload = configData[entry.id] || entry.config;
            if (configToDownload) {
              downloadConfigFile(entry);
            } else {
              // Reset the button appearance
              if (loadingIndicator) {
                loadingIndicator.innerHTML = originalContent;
              }
              alert('No configuration data available for download after attempted loading. The config file may not exist or may not be accessible.');
            }
          });
          return;
        } else if (isLoadingConfig) {
          alert('Another config is currently loading. Please try again when that completes.');
          return;
        } else {
          // Not a merged_audio entry but still no config
          alert('No configuration data available for download. Please try loading the configuration first.');
          return;
        }
      }
      
      downloadConfigFile(entry);
    } catch (error) {
      console.error('Error downloading JSON configuration:', error);
      alert('Failed to download configuration: ' + error.message);
    }
  };
  
  /**
   * Helper function to download the config file
   * @param {Object} entry - The history entry
   */
  const downloadConfigFile = (entry) => {
    // Get the config data from our state
    const config = configData[entry.id] || entry.config;
    
    if (!config) {
      alert('No configuration data available to download.');
      return;
    }
    
    // Convert to string if it's an object
    const configStr = typeof config === 'string' 
      ? config 
      : JSON.stringify(config, null, 2);
      
    // Create and download the JSON file
    const blob = new Blob([configStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate a filename - use the exact filename from configUrl if available
    let filename;
    if (entry.configUrl) {
      const urlFilename = entry.configUrl.split('/').pop();
      filename = decodeURIComponent(urlFilename);
    } else if (entry.configFilename) {
      filename = entry.configFilename; 
    } else if (entry.title) {
      filename = `${entry.title}.json`;
    } else {
      filename = `config-${entry.id}.json`;
    }
    
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  /**
   * Custom confirm dialog for deletion
   */
  const CustomConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    
    const handleDeleteBoth = async () => {
      // Find the entry
      const entry = fileHistory.find(e => e.id === confirmDialog.entryId);
      if (!entry) return;
      
      setDeletingEntries(prev => new Set(prev).add(entry.id));
      try {
        // Use the new API endpoint to delete both audio and config
        const response = await fetch(`/api/storageService/file/${entry.id}/both`, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          alert(result.error || 'Failed to delete files');
        } else {
          // Remove from history
          actions.deleteHistoryEntry(entry, { deleteOption: 'remove_entry_only' });
        }
        
        if (playingEntryId === entry.id) {
          setPlayingEntryId(null);
        }
      } catch (error) {
        console.error('Error during deletion:', error);
        alert('Failed to delete: ' + error.message);
      } finally {
        setDeletingEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(entry.id);
          return newSet;
        });
        setConfirmDialog({ isOpen: false, entryId: null, title: '', message: '', configOnly: false });
      }
    };
    
    const handleDeleteAudioOnly = async () => {
      // Find the entry
      const entry = fileHistory.find(e => e.id === confirmDialog.entryId);
      if (!entry) return;
      
      setDeletingEntries(prev => new Set(prev).add(entry.id));
      try {
        // Use the new API endpoint to delete just the audio file
        const response = await fetch(`/api/storageService/file/${entry.id}/audio`, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok && response.status !== 404) {
          alert(result.error || 'Failed to delete audio file');
        } else {
          // Update the entry to mark audio as deleted
          const updatedEntry = { 
            ...entry, 
            audioUrl: null,
            audioFileExists: false 
          };
          actions.updateHistoryEntry(updatedEntry);
        }
        
        if (playingEntryId === entry.id) {
          setPlayingEntryId(null);
        }
      } catch (error) {
        console.error('Error during audio deletion:', error);
        alert('Failed to delete audio: ' + error.message);
        
        // If there was a network error, still update the UI to mark the audio as not existing
        const updatedEntry = { 
          ...entry, 
          audioFileExists: false 
        };
        actions.updateHistoryEntry(updatedEntry);
      } finally {
        setDeletingEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(entry.id);
          return newSet;
        });
        setConfirmDialog({ isOpen: false, entryId: null, title: '', message: '', configOnly: false });
      }
    };

    const handleDeleteConfig = async () => {
      // Find the entry
      const entry = fileHistory.find(e => e.id === confirmDialog.entryId);
      if (!entry) return;
      
      setDeletingEntries(prev => new Set(prev).add(entry.id));
      try {
        // Use the new API endpoint to delete just the config file
        const response = await fetch(`/api/storageService/file/${entry.id}/config`, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok && response.status !== 404) {
          alert(result.error || 'Failed to delete configuration');
        } else {
          // Update the entry to reflect config deletion
          const updatedEntry = { 
            ...entry, 
            configUrl: null,
            configExists: false,
            configFilename: null,
            config: null
          };
          actions.updateHistoryEntry(updatedEntry);
          
          // Remove from configData state
          setConfigData(prev => {
            const newData = {...prev};
            delete newData[entry.id];
            return newData;
          });
          
          // If there's no audio either, remove the entry entirely
          if (entry.audioFileExists === false || !entry.audioUrl) {
            actions.deleteHistoryEntry(entry, { deleteOption: 'remove_entry_only' });
          }
        }
      } catch (error) {
        console.error('Error deleting config:', error);
        alert('Failed to delete config: ' + error.message);
        
        // If there was a network error, still update the UI to mark the config as not existing
        const updatedEntry = { 
          ...entry, 
          configExists: false 
        };
        actions.updateHistoryEntry(updatedEntry);
      } finally {
        setDeletingEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(entry.id);
          return newSet;
        });
        setConfirmDialog({ isOpen: false, entryId: null, title: '', message: '', configOnly: false });
      }
    };

    const handleCancel = () => {
      setConfirmDialog({ isOpen: false, entryId: null, title: '', message: '', configOnly: false });
    };

    // For config-only dialog (two buttons)
    if (confirmDialog.configOnly) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-gray-300 mb-6">{confirmDialog.message}</p>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                onClick={handleDeleteConfig}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete Config
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // For audio+config dialog (three buttons)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-xl font-semibold text-white mb-2">{confirmDialog.title}</h3>
          <p className="text-gray-300 mb-6">{confirmDialog.message}</p>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={handleDeleteBoth}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Delete Both
            </button>
            <button
              onClick={handleDeleteAudioOnly}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
            >
              Delete Audio Only
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Shows a confirmation dialog for deleting config-only entries
   * @param {Object} entry - The config entry to delete
   */
  const showConfigDeleteConfirm = (entry) => {
    setConfirmDialog({
      isOpen: true,
      entryId: entry.id,
      title: `Delete Configuration`,
      message: `Are you sure you want to delete this configuration "${getEntryTitle(entry)}"?`,
      configOnly: true
    });
  };

  /**
   * Deletes a history entry and its associated file from storage.
   * Prompts the user with options for merged audio files to also delete JSON config.
   * @param {Object} entry - The history entry to delete
   */
  const handleDelete = (entry) => {
    const hasConfig = (entry.config || entry.configUrl || entry.configFilename) && entry.configExists !== false;
    const hasAudio = entry.audioUrl && entry.audioFileExists !== false;
    
    // If this is a merged audio file with configuration data and audio exists
    if (hasAudio && hasConfig) {
      // Show custom confirm dialog with three options
      setConfirmDialog({
        isOpen: true,
        entryId: entry.id,
        title: `Delete Options for "${getEntryTitle(entry)}"`,
        message: "Please select one of the following options:",
        configOnly: false
      });
    } 
    // If this is a config-only entry (no audio URL or audio file doesn't exist)
    else if (!hasAudio && hasConfig) {
      showConfigDeleteConfirm(entry);
    }
    // Audio-only file (no config or config doesn't exist)
    else if (hasAudio && !hasConfig) {
      if (window.confirm(`Are you sure you want to delete this audio file "${getEntryTitle(entry)}"?`)) {
        setDeletingEntries((prev) => new Set(prev).add(entry.id));
        
        // Use the new API endpoint to delete just the audio file
        fetch(`/api/storageService/file/${entry.id}/audio`, {
          method: 'DELETE'
        })
        .then(response => response.json())
        .then(result => {
          if (!result.success && !result.not_found) {
            alert('Failed to delete audio file: ' + (result.error || 'Unknown error'));
          } else {
            // Remove the entry since there's no config
            actions.deleteHistoryEntry(entry, { deleteOption: 'remove_entry_only' });
          }
          
          if (playingEntryId === entry.id) {
            setPlayingEntryId(null);
          }
        })
        .catch(error => {
          console.error('Error deleting audio:', error);
          alert('Failed to delete: ' + error.message);
          
          // If there was a network error, still update the UI
          const updatedEntry = {
            ...entry,
            audioFileExists: false
          };
          actions.updateHistoryEntry(updatedEntry);
        })
        .finally(() => {
          setDeletingEntries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(entry.id);
            return newSet;
          });
        });
      }
    }
    // Neither audio nor config exists
    else {
      if (window.confirm(`Are you sure you want to remove this entry "${getEntryTitle(entry)}" from history?`)) {
        actions.deleteHistoryEntry(entry, { deleteOption: 'remove_entry_only' });
      }
    }
  };

  /**
   * Consolidates file history entries to avoid duplicates
   * @returns {Array} Consolidated file history entries
   */
  const consolidateEntries = () => {
    if (!fileHistory || fileHistory.length === 0) {
      return [];
    }
    
    // Create a map to consolidate entries by ID
    const entryMap = new Map();
    
    // First pass: collect all entries by ID
    fileHistory.forEach(entry => {
      if (!entry.id) return;
      
      const existingEntry = entryMap.get(entry.id);
      if (!existingEntry) {
        // Set initial entry
        entryMap.set(entry.id, { ...entry });
      } else {
        // Merge with existing entry, prioritizing non-null values
        const mergedEntry = {
          ...existingEntry,
          audioUrl: entry.audioUrl || existingEntry.audioUrl,
          audioFileExists: entry.audioFileExists !== undefined ? entry.audioFileExists : existingEntry.audioFileExists,
          configUrl: entry.configUrl || existingEntry.configUrl,
          configFilename: entry.configFilename || existingEntry.configFilename,
          configPath: entry.configPath || existingEntry.configPath,
          configExists: entry.configExists !== undefined ? entry.configExists : existingEntry.configExists,
          config: entry.config || existingEntry.config,
          title: entry.title || existingEntry.title
        };
        
        // Reconstruct configUrl if we have configFilename but no configUrl
        if (mergedEntry.configFilename && !mergedEntry.configUrl) {
          mergedEntry.configUrl = `/configs/${mergedEntry.configFilename}`;
        }
        
        // Update entry in map
        entryMap.set(entry.id, mergedEntry);
      }
    });
    
    // Second pass: determine accurate category for each entry
    const consolidated = [];
    entryMap.forEach(entry => {
      const hasAudio = entry.audioUrl && entry.audioFileExists !== false;
      const hasConfig = (entry.config || entry.configUrl || entry.configFilename) && entry.configExists !== false;
      
      // Skip entries with no valid files
      if (!hasAudio && !hasConfig) {
        return;
      }
      
      // Set appropriate category
      if (hasAudio && hasConfig) {
        entry.category = 'merged_audio';
      } else if (hasAudio) {
        entry.category = 'merged_audio';
      } else if (hasConfig) {
        entry.category = 'merged_audio_config';
      }
      
      consolidated.push(entry);
    });
    
    // Sort by date, most recent first
    return consolidated.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
  };

  // Use consolidated history for rendering
  const consolidatedHistory = consolidateEntries();

  return (
    <div className="space-y-4" id="file-history-container">
      <h2 className="text-xl font-semibold mb-4" id="file-history-title">
        File History
      </h2>
      
      {/* Custom confirm dialog */}
      <CustomConfirmDialog />
      
      {consolidatedHistory.length === 0 ? (
        <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }} id="no-files-message">
          No files generated yet
        </p>
      ) : (
        consolidatedHistory.map((entry) => {
          // Determine which files actually exist and are accessible
          const hasAudio = entry.audioUrl && entry.audioFileExists !== false;
          const hasConfig = (entry.config || entry.configUrl || entry.configFilename) && entry.configExists !== false;
          
          // Skip entries where neither audio nor config exists
          if (!hasAudio && !hasConfig) {
            return null;
          }
          
          const isMergedAudio = entry.category === 'merged_audio';
          const title = getEntryTitle(entry);

          return (
            <div
              key={entry.id}
              className="section-card p-4 rounded-lg shadow-md bg-gray-800"
              id={`history-entry-${entry.id}`}
            >
              <div className="flex justify-between items-center mb-2" id={`history-entry-header-${entry.id}`}>
                <div>
                  <h3
                    className="font-medium text-white"
                    id={`history-entry-date-${entry.id}`}
                  >
                    {title}
                  </h3>
                  <p
                    className="text-xs text-gray-500"
                    id={`history-entry-date-text-${entry.id}`}
                  >
                    {new Date(entry.date).toLocaleString()}
                  </p>
                  {entry.audioFileExists === false && entry.audioUrl && (
                    <p className="text-xs text-red-400">Audio file not found on server</p>
                  )}
                  {entry.configExists === false && (entry.configUrl || entry.configFilename) && (
                    <p className="text-xs text-red-400">Config file not found on server</p>
                  )}
                  {hasConfig && !hasAudio && (
                    <p className="text-xs text-blue-400">Configuration Only</p>
                  )}
                  {hasAudio && !hasConfig && (
                    <p className="text-xs text-green-400">Audio Only</p>
                  )}
                </div>
                <div className="flex space-x-3 items-center" id={`history-entry-actions-${entry.id}`}>
                  {hasAudio && (
                    <button
                      onClick={() => handlePlay(entry)}
                      className="btn p-2 rounded hover:bg-gray-700"
                      id={`play-audio-btn-${entry.id}`}
                      title={playingEntryId === entry.id ? 'Stop Audio' : 'Play Audio'}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {playingEntryId === entry.id ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 9v6m4-6v6"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v18l15-9z"
                          />
                        )}
                      </svg>
                    </button>
                  )}
                  
                  {hasConfig && (
                    <button
                      onClick={() => loadConfiguration(entry)}
                      className="btn bg-yellow-600/70 hover:bg-yellow-700/70 text-white font-medium py-2 px-4 rounded"
                      id={`load-config-btn-${entry.id}`}
                      disabled={loadingConfigs.has(entry.id)}
                    >
                      {loadingConfigs.has(entry.id) ? (
                        <div className="flex items-center">
                          <svg
                            className="animate-spin h-4 w-4 mr-2 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Loading...
                        </div>
                      ) : (
                        'Load Configuration'
                      )}
                    </button>
                  )}
                  
                  {hasAudio && (
                    <button
                      onClick={() => handleDownload(entry)}
                      className="btn p-2 rounded hover:bg-gray-700"
                      id={`download-audio-btn-${entry.id}`}
                      title="Download Audio"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  )}
                  
                  {hasConfig && (
                    <button
                      onClick={() => handleDownloadJSON(entry)}
                      className="btn p-2 rounded hover:bg-gray-700"
                      id={`download-json-btn-${entry.id}`}
                      title="Download Configuration JSON"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-6 w-6 text-blue-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M15 11V7"
                        />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(entry)}
                    className="btn p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    id={`delete-btn-${entry.id}`}
                    title="Delete"
                    disabled={deletingEntries.has(entry.id)}
                  >
                    {deletingEntries.has(entry.id) ? (
                      <svg
                        className="animate-spin h-6 w-6 text-red-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {hasAudio && playingEntryId === entry.id && (
                <audio
                  controls
                  autoPlay
                  className="w-full mt-2 audio-player"
                  id={`audio-player-${entry.id}`}
                  data-testid={`audio-player-${entry.id}`}
                  onEnded={() => setPlayingEntryId(null)}
                  onError={(e) => {
                    console.error('Audio playback error:', e);
                    setPlayingEntryId(null);
                    alert('Error playing audio: File may be missing or corrupted');
                    // Mark the file as not existing
                    actions.updateHistoryEntry({
                      ...entry,
                      audioFileExists: false
                    });
                  }}
                >
                  <source src={entry.audioUrl} type="audio/wav" id={`audio-source-${entry.id}`} />
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>
          );
        }).filter(Boolean) // Filter out null entries (where both audio and config don't exist)
      )}
    </div>
  );
};

export default FileHistory;