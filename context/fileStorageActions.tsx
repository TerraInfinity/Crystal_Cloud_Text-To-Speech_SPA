// context/fileStorageActions.tsx
import { devLog } from '../utils/logUtils';
import { saveToStorage, removeFromStorage, listFromStorage } from './storage';
import { appendMetadataEntry, removeMetadataEntry, updateMetadataEntry, loadCurrentMetadata, syncMetadata } from './fileStorageMetadataActions';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FileHistoryItem, AudioLibraryItem, FileStorageState, AudioFileMetaDataEntry, FileStorageActions } from './types/types';

/**
 * Creates and returns all file storage-related actions that can be dispatched
 * @param dispatch - The dispatch function from the file storage reducer context
 * @returns Object containing all file storage action functions
 */
export function createFileStorageActions(dispatch: React.Dispatch<any>) {
  let currentState: Partial<FileStorageState> = {};
  let pendingAudioListRequest: Promise<any> | null = null;
  let pendingRefreshRequest: Promise<any> | null = null;
  let pendingMetadataOperations: Promise<any>[] = [];

  const setCurrentState = (state: Partial<FileStorageState>) => {
    currentState = state;
  };

  // Helper function to convert AudioLibraryItem to AudioFileMetaDataEntry
  function convertAudioLibraryItemToAudioFile(item: AudioLibraryItem): AudioFileMetaDataEntry {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      date: item.date,
      audio_url: item.audio_url,
      config_url: item.config_url,
      volume: item.audioMetadata?.volume ?? 1,
      placeholder: item.audioMetadata?.placeholder ?? item.name ?? 'Untitled',
      category: item.category,
      source: {
        type: item.category === 'merged_audio' ? 'merged' : 'local',
        metadata: {
          name: item.name,
          type: item.type,
          size: item.audioMetadata?.duration ? item.audioMetadata.duration * 1024 : 0,
        },
      },
    };
  }

  // Helper function to convert FileHistoryItem to AudioLibraryItem
  function convertFileHistoryItemToAudioLibraryItem(entry: FileHistoryItem): AudioLibraryItem {
    return {
      id: entry.id,
      name: entry.name || 'Untitled',
      audio_url: entry.audio_url || '',
      config_url: entry.config_url || null,
      type: entry.type || 'audio/wav',
      date: entry.date,
      category: entry.category,
      audioMetadata: {
        duration: 0,
        format: entry.audio_url ? 'wav' : 'json',
        placeholder: entry.name || 'Untitled',
        volume: 1,
      },
    };
  }

  return {
    updateCurrentState: setCurrentState,

    fetchAudioLibrary: async () => {
      try {
        if (pendingAudioListRequest) {
          return pendingAudioListRequest;
        }

        pendingAudioListRequest = (async () => {
          try {
            const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
            const metadata = await loadCurrentMetadata(serverUrl);

            const audioFiles = await validateFiles(metadata);
            dispatch({ type: 'SET_AUDIO_LIBRARY', payload: audioFiles });

            const fileHistory = metadata.map(file => ({
              id: file.id,
              name: file.name || 'Untitled',
              audio_url: file.audio_url || '',
              config_url: file.config_url || null,
              type: file.type || 'audio/wav',
              date: file.date,
              category: file.category || 'sound_effect',
              template: file.category === 'merged_audio' ? 'merged' : 'uploaded',
            }));

            dispatch({ type: 'SET_FILE_HISTORY', payload: fileHistory });

            const existingMetadataIds = new Set(metadata.map(m => m.id));
            for (const file of audioFiles) {
              if (!existingMetadataIds.has(file.id)) {
                const audioFile = convertAudioLibraryItemToAudioFile(file);
                const operation = syncMetadata(serverUrl, { type: 'append', payload: audioFile });
                pendingMetadataOperations.push(operation);
                await operation;
              }
            }
            return audioFiles;
          } catch (error) {
            devLog(`Error fetching audio library: ${error.message}`, 'error');
            dispatch({ type: 'SET_AUDIO_LIBRARY', payload: [] });
            dispatch({ type: 'SET_FILE_HISTORY', payload: [] });
            return [];
          } finally {
            pendingAudioListRequest = null;
          }
        })();

        return pendingAudioListRequest;
      } catch (error) {
        devLog(`Error in fetchAudioLibrary: ${error.message}`, 'error');
        return [];
      }
    },

    uploadAudio: async (file: File, audioData: Partial<AudioFileMetaDataEntry>) => {
      try {
        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
        const metadata = {
          category: audioData.category || 'other',
          name: audioData.name,
          placeholder: audioData.placeholder,
          volume: audioData.volume?.toString(),
        };
        
        // First, upload the actual audio file
        let url;
        try {
          url = await saveToStorage(file.name, file, 'fileStorage', metadata);
        } catch (uploadError) {
          devLog(`Error during file upload: ${uploadError.message}`, 'error');
          throw new Error(`Failed to upload audio file: ${uploadError.message}`);
        }
        
        const relativeUrl = url.startsWith(serverUrl) ? url.replace(serverUrl, '') : url;
        const id = uuidv4();
        const updatedAudioData: AudioLibraryItem = {
          id,
          name: audioData.name || file.name,
          audio_url: relativeUrl,
          config_url: audioData.category === 'sound_effect' ? null : null,
          type: file.type,
          date: new Date().toISOString(),
          category: audioData.category || 'sound_effect',
          audioMetadata: {
            duration: file.size ? Math.ceil(file.size / 1024) : 0,
            format: file.type.split('/')[1] || 'wav',
            placeholder: audioData.placeholder ?? file.name,
            volume: audioData.volume ?? 1,
          },
        };
        
        // Update local state immediately
        dispatch({ type: 'ADD_TO_AUDIO_LIBRARY', payload: updatedAudioData });
        const newEntry: FileHistoryItem = {
          id,
          name: updatedAudioData.name,
          audio_url: relativeUrl,
          config_url: updatedAudioData.config_url,
          type: file.type,
          date: new Date().toISOString(),
          category: updatedAudioData.category,
          template: 'uploaded',
        };
        dispatch({ type: 'ADD_HISTORY_ENTRIES', payload: [newEntry] });
        
        // Then try to update metadata, but continue even if it fails
        const audioFile = convertAudioLibraryItemToAudioFile(updatedAudioData);
        try {
          const operation = syncMetadata(serverUrl, { type: 'append', payload: audioFile });
          pendingMetadataOperations.push(operation);
          await operation;
          devLog('Metadata sync successful for uploaded audio');
        } catch (metadataError) {
          // Log the error but don't fail the whole upload process
          devLog(`Warning: Metadata sync failed, but file was uploaded successfully: ${metadataError.message}`, 'warn');
          
          // Add to session storage anyway as a fallback
          try {
            const existingMetadata = JSON.parse(sessionStorage.getItem('file_server_audio_metadata') || '[]');
            existingMetadata.push(audioFile);
            sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(existingMetadata));
            devLog('Added metadata to session storage as fallback');
          } catch (sessionError) {
            devLog(`Failed to update session storage: ${sessionError.message}`, 'error');
          }
        }
        
        return { audioUrl: url };
      } catch (error) {
        devLog(`Error uploading audio: ${error.message}`, 'error');
        throw error;
      }
    },

    mergeAndUploadAudio: async (
      audio_urls: string[],
      audioData: Partial<AudioFileMetaDataEntry> = {},
      config: any = null
    ) => {
      try {
        if (!audio_urls || !Array.isArray(audio_urls) || audio_urls.length === 0) {
          throw new Error('Audio URLs array is required');
        }

        const fileId = uuidv4();
        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';

        const response = await makeApiCall(() => axios.post('/api/mergeAudio', { audio_urls, config }));
        const { mergedAudioUrl, uploadedAudioUrl } = response.data;

        const baseName = audioData.name
          ? audioData.name.toLowerCase().replace(/\s+/g, '-')
          : `merged-${fileId}`;
        const audioKey = `${baseName}.wav`;
        let finalUrl = uploadedAudioUrl;

        if (!finalUrl) {
          const blobResponse = await makeApiCall(() => axios.get(mergedAudioUrl, { responseType: 'blob' }));
          const mergedBlob = blobResponse.data;
          const mergedFile = new File([mergedBlob], audioKey, { type: 'audio/wav' });
          finalUrl = await saveToStorage(audioKey, mergedFile, 'fileStorage', { category: 'merged_audio' });
        }

        const relativeFinalUrl = finalUrl.startsWith(serverUrl) ? finalUrl.replace(serverUrl, '') : finalUrl;

        let configUrl = null;
        let relativeConfigUrl = null;
        let configKey: string | null = null;

        if (config) {
          configKey = `${baseName}.json`;
          const configStr = JSON.stringify(config, null, 2);
          const configBlob = new Blob([configStr], { type: 'application/json' });
          const configFile = new File([configBlob], configKey, { type: 'application/json' });
          configUrl = await saveToStorage(configKey, configFile, 'fileStorage', {
            audioId: fileId,
            category: 'merged_audio_config',
            name: audioData.name || 'Merged Audio Config',
          });
          relativeConfigUrl = configUrl.startsWith(serverUrl) ? configUrl.replace(serverUrl, '') : configUrl;
        }

        const updatedAudioData: AudioLibraryItem = {
          id: fileId,
          name: audioData.name || 'Merged Audio',
          audio_url: relativeFinalUrl,
          config_url: relativeConfigUrl,
          type: 'audio/wav',
          date: new Date().toISOString(),
          category: 'merged_audio',
          audioMetadata: {
            duration: 0,
            format: 'wav',
            placeholder: audioData.placeholder ?? 'Merged Audio',
            volume: audioData.volume ?? 1,
          },
        };

        dispatch({ type: 'ADD_TO_AUDIO_LIBRARY', payload: updatedAudioData });
        const newEntry: FileHistoryItem = {
          id: fileId,
          name: updatedAudioData.name,
          audio_url: relativeFinalUrl,
          config_url: relativeConfigUrl,
          type: 'audio/wav',
          date: new Date().toISOString(),
          category: 'merged_audio',
          template: 'merged',
        };
        dispatch({ type: 'ADD_HISTORY_ENTRIES', payload: [newEntry] });
        const audioFile = convertAudioLibraryItemToAudioFile(updatedAudioData);
        const operation = syncMetadata(serverUrl, { type: 'append', payload: audioFile });
        pendingMetadataOperations.push(operation);
        await operation;
        return { mergedAudioUrl, uploadedAudioUrl: relativeFinalUrl };
      } catch (error) {
        devLog(`Error merging and uploading audio: ${error.message}`, 'error');
        throw error;
      }
    },

    deleteHistoryEntry: async (entry: FileHistoryItem, options: { deleteOption?: string } = {}) => {
      const { deleteOption = 'audio_and_config' } = options;
      try {
        if (!entry || !entry.id) {
          throw new Error('Invalid entry provided');
        }

        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
        devLog(`Deleting entry: ${entry.id} with option: ${deleteOption}`, 'info');

        // Get the entry type to make smart decisions
        const hasAudio = entry.audio_url && entry.audio_url !== 'null';
        const hasConfig = entry.config_url && entry.config_url !== 'null';
        const entryType = hasAudio && hasConfig ? 'audio_and_config' : 
                         hasAudio ? 'audio_only' : 
                         hasConfig ? 'config_only' : 'unknown';

        // If deleting the only component of the entry, we should delete the whole entry
        const shouldDeleteEntireEntry = 
          (entryType === 'audio_only' && deleteOption === 'audio_only') ||
          (entryType === 'config_only' && deleteOption === 'config_only') ||
          deleteOption === 'audio_and_config';

        devLog(`Entry type: ${entryType}, Delete option: ${deleteOption}, Should delete entire entry: ${shouldDeleteEntireEntry}`, 'info');
        
        // Step 1: Delete files from server
        if (deleteOption === 'audio_only' || deleteOption === 'audio_and_config') {
          if (entry.audio_url && entry.audio_url !== 'null') {
            // Extract the filename properly from the URL
            let audioFilename = entry.audio_url;
            
            // Remove serverUrl prefix if present
            if (audioFilename.startsWith(serverUrl)) {
              audioFilename = audioFilename.replace(serverUrl, '');
            }
            
            // Extract just the filename for API calls
            const parsedFilename = audioFilename.split('/').pop();
            
            if (parsedFilename) {
              devLog(`Attempting to delete audio file: ${parsedFilename}`, 'info');
              try {
                await removeFromStorage(parsedFilename, 'fileStorage', { deleteConfig: false });
                devLog(`Successfully deleted audio file: ${parsedFilename}`, 'info');
              } catch (error) {
                const errorMsg = (error as Error).message || 'Unknown error';
                if (!errorMsg.includes('not found')) {
                  devLog(`Error deleting audio file: ${errorMsg}`, 'error');
                  throw new Error(`Failed to delete audio file: ${errorMsg}`);
                } else {
                  devLog(`Audio file not found, continuing: ${parsedFilename}`, 'warn');
                }
              }
            }
          }
        }

        if (deleteOption === 'config_only' || deleteOption === 'audio_and_config') {
          if (entry.config_url && entry.config_url !== 'null') {
            // Extract the filename properly from the URL
            let configFilename = entry.config_url;
            
            // Remove serverUrl prefix if present
            if (configFilename.startsWith(serverUrl)) {
              configFilename = configFilename.replace(serverUrl, '');
            }
            
            // Extract just the filename for API calls
            const parsedFilename = configFilename.split('/').pop();
            
            if (parsedFilename) {
              devLog(`Attempting to delete config file: ${parsedFilename}`, 'info');
              try {
                await removeFromStorage(parsedFilename, 'fileStorage', { deleteConfig: true });
                devLog(`Successfully deleted config file: ${parsedFilename}`, 'info');
              } catch (error) {
                const errorMsg = (error as Error).message || 'Unknown error';
                if (!errorMsg.includes('not found')) {
                  devLog(`Error deleting config file: ${errorMsg}`, 'error');
                  throw new Error(`Failed to delete config file: ${errorMsg}`);
                } else {
                  devLog(`Config file not found, continuing: ${parsedFilename}`, 'warn');
                }
              }
            }
          }
        }

        // Step 2: Update metadata and state
        if (shouldDeleteEntireEntry) {
          // Delete the entire entry if we're deleting the only component that exists
          try {
            devLog(`Removing entire metadata entry: ${entry.id}`, 'info');
            await syncMetadata(serverUrl, { type: 'remove', payload: { id: entry.id } });
            dispatch({ type: 'REMOVE_HISTORY_ENTRY', payload: entry.id });
            dispatch({ type: 'REMOVE_FROM_AUDIO_LIBRARY', payload: entry.id });
            devLog(`Metadata entry completely removed: ${entry.id}`, 'info');
          } catch (error) {
            const errorMsg = (error as Error).message || 'Unknown error';
            devLog(`Failed to remove metadata entry: ${errorMsg}`, 'error');
            throw new Error(`Failed to remove metadata entry: ${errorMsg}`);
          }
        } else {
          // We're only partially updating the entry (e.g., removing audio but keeping config)
          const updatedFields: Partial<AudioFileMetaDataEntry> = {};
          if (deleteOption === 'audio_only') {
            updatedFields.audio_url = null;
          } else if (deleteOption === 'config_only') {
            updatedFields.config_url = null;
          }

          try {
            devLog(`Updating metadata entry: ${entry.id} with fields: ${JSON.stringify(updatedFields)}`, 'info');
            await syncMetadata(serverUrl, {
              type: 'update',
              payload: { id: entry.id, field_property: updatedFields },
            });
            devLog(`Metadata entry updated: ${entry.id}`, 'info');
          } catch (error) {
            const errorMsg = (error as Error).message || 'Unknown error';
            devLog(`Failed to update metadata entry: ${errorMsg}`, 'error');
            throw new Error(`Failed to update metadata entry: ${errorMsg}`);
          }

          const updatedEntry: FileHistoryItem = {
            ...entry,
            audio_url: deleteOption === 'audio_only' ? 'null' : entry.audio_url,
            config_url: deleteOption === 'config_only' ? 'null' : entry.config_url,
          };

          dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: updatedEntry });
          dispatch({
            type: 'ADD_TO_AUDIO_LIBRARY',
            payload: convertFileHistoryItemToAudioLibraryItem(updatedEntry),
          });
        }

        // Step 3: Update sessionStorage
        try {
          const metadata = await loadCurrentMetadata(serverUrl);
          sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(metadata));
          devLog(`Updated sessionStorage with latest metadata (${metadata.length} entries)`, 'info');
        } catch (error) {
          const errorMsg = (error as Error).message || 'Unknown error';
          devLog(`Error updating sessionStorage: ${errorMsg}`, 'error');
          // Don't throw here as this is not a critical error
        }

        return { success: true };
      } catch (error) {
        devLog(`Error in deleteHistoryEntry: ${(error as Error).message}`, 'error');
        throw new Error(`Deletion failed: ${(error as Error).message}`);
      }
    },

    updateAudio: async (audioId: string, updatedAudioData: Partial<AudioLibraryItem>) => {
      try {
        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
        const audioFile = currentState?.audioLibrary?.find((a) => a.id === audioId);
        if (!audioFile) throw new Error('Audio not found');

        const updatedMetadataFields: Partial<AudioFileMetaDataEntry> = {
          name: updatedAudioData.name ?? audioFile.name,
          placeholder: updatedAudioData.audioMetadata?.placeholder ?? audioFile.audioMetadata?.placeholder,
          volume: updatedAudioData.audioMetadata?.volume ?? audioFile.audioMetadata?.volume ?? 1,
          category: updatedAudioData.category ?? audioFile.category,
          audio_url: updatedAudioData.audio_url,
          config_url: updatedAudioData.config_url,
          type: updatedAudioData.type,
          date: updatedAudioData.date,
        };

        await syncMetadata(serverUrl, {
          type: 'update',
          payload: { id: audioId, field_property: updatedMetadataFields },
        });

        const normalizedAudioData: AudioLibraryItem = {
          ...audioFile,
          name: updatedAudioData.name ?? audioFile.name,
          audio_url: updatedAudioData.audio_url?.startsWith(serverUrl)
            ? updatedAudioData.audio_url.replace(serverUrl, '')
            : updatedAudioData.audio_url ?? audioFile.audio_url,
          config_url: updatedAudioData.config_url?.startsWith(serverUrl)
            ? updatedAudioData.config_url.replace(serverUrl, '')
            : updatedAudioData.config_url ?? audioFile.config_url,
          type: updatedAudioData.type ?? audioFile.type,
          date: updatedAudioData.date ?? audioFile.date,
          category: updatedAudioData.category ?? audioFile.category,
          audioMetadata: {
            duration: updatedAudioData.audioMetadata?.duration ?? audioFile.audioMetadata?.duration ?? 0,
            format: updatedAudioData.audioMetadata?.format ?? audioFile.audioMetadata?.format ?? 'wav',
            placeholder: updatedAudioData.audioMetadata?.placeholder ?? audioFile.audioMetadata?.placeholder,
            volume: updatedAudioData.audioMetadata?.volume ?? audioFile.audioMetadata?.volume ?? 1,
          },
        };

        dispatch({ type: 'ADD_TO_AUDIO_LIBRARY', payload: normalizedAudioData });
        const updatedEntry = currentState?.fileHistory?.find((entry) => entry.id === audioId);
        if (updatedEntry) {
          const newEntry: FileHistoryItem = {
            ...updatedEntry,
            name: normalizedAudioData.name,
            audio_url: normalizedAudioData.audio_url,
            config_url: normalizedAudioData.config_url,
            type: normalizedAudioData.type,
            category: normalizedAudioData.category,
            template: normalizedAudioData.category === 'merged_audio' ? 'merged' : 'uploaded',
          };
          dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: newEntry });
        }
      } catch (error) {
        devLog(`Error updating audio metadata: ${error.message}`, 'error');
        throw error;
      }
    },

    loadAudioLibrary: (audioLibrary: AudioLibraryItem[]) => {
      dispatch({ type: 'SET_AUDIO_LIBRARY', payload: audioLibrary });
    },

    addToAudioLibrary: async (file: File, audioData: Partial<AudioLibraryItem>) => {
      try {
        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
        const metadata = {
          category: audioData.category || 'sound_effect',
          name: audioData.name,
          placeholder: audioData.audioMetadata?.placeholder,
          volume: audioData.audioMetadata?.volume?.toString(),
        };
        const url = await saveToStorage(file.name, file, 'fileStorage', metadata);
        const relativeUrl = url.startsWith(serverUrl) ? url.replace(serverUrl, '') : url;
        const id = uuidv4();
        const updatedAudioData: AudioLibraryItem = {
          id,
          name: audioData.name || file.name,
          audio_url: relativeUrl,
          config_url: audioData.category === 'sound_effect' ? null : audioData.config_url ?? null,
          type: file.type,
          date: new Date().toISOString(),
          category: audioData.category || 'sound_effect',
          audioMetadata: {
            duration: audioData.audioMetadata?.duration ?? (file.size ? Math.ceil(file.size / 1024) : 0),
            format: audioData.audioMetadata?.format ?? (file.type.split('/')[1] || 'wav'),
            placeholder: audioData.audioMetadata?.placeholder ?? file.name,
            volume: audioData.audioMetadata?.volume ?? 1,
          },
        };
        dispatch({ type: 'ADD_TO_AUDIO_LIBRARY', payload: updatedAudioData });
        const newEntry: FileHistoryItem = {
          id,
          name: updatedAudioData.name,
          audio_url: relativeUrl,
          config_url: updatedAudioData.config_url,
          type: file.type,
          date: new Date().toISOString(),
          category: updatedAudioData.category,
          template: 'uploaded',
        };
        dispatch({ type: 'ADD_HISTORY_ENTRIES', payload: [newEntry] });
        const audioFile = convertAudioLibraryItemToAudioFile(updatedAudioData);
        const operation = syncMetadata(serverUrl, { type: 'append', payload: audioFile });
        pendingMetadataOperations.push(operation);
        await operation;
        return updatedAudioData;
      } catch (error) {
        devLog(`Error in addToAudioLibrary: ${error.message}`, 'error');
        throw error;
      }
    },

    removeFromAudioLibrary: async (audioId: string, options?: { category?: string }) => {
      try {
        const audio = currentState?.audioLibrary?.find((a) => a.id === audioId);
        
        // Don't throw if audio not found, just log a warning and continue
        if (!audio) {
          devLog(`Warning: Audio with ID ${audioId} not found in state, but proceeding with deletion anyway`, 'warn');
          // Remove it from state anyway (in case it exists in the UI but not in context)
          await dispatch({
            type: 'REMOVE_FROM_AUDIO_LIBRARY',
            payload: audioId,
          });
          
          // Try to remove from metadata without the full audio object
          try {
            const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
            await syncMetadata(serverUrl, { type: 'remove', payload: { id: audioId } });
            return { success: true };
          } catch (metadataError) {
            devLog(`Error removing metadata for missing audio: ${metadataError.message}`, 'error');
            return { success: false, error: metadataError.message };
          }
        }
        
        const deleteOption = options?.category === 'sound_effect' ? 'audio_only' : 'audio_and_config';
        
        // Remove from state first
        await dispatch({
          type: 'REMOVE_FROM_AUDIO_LIBRARY',
          payload: audioId,
        });
        
        // Then try to delete from storage
        return await createFileStorageActions(dispatch).deleteHistoryEntry(audio, { deleteOption });
      } catch (error) {
        devLog(`Error in removeFromAudioLibrary: ${error.message}`, 'error');
        throw error;
      }
    },

    addToFileHistory: async (entry: FileHistoryItem) => {
      if (!entry || !entry.id) {
        return;
      }
      if (currentState?.fileHistory?.some((e) => e.id === entry.id)) {
        return;
      }
      entry.name = entry.name || (entry.audio_url || entry.config_url || '').split('/').pop()?.replace(/\.[^/.]+$/, '') || `File-${entry.id}`;
      dispatch({ type: 'ADD_HISTORY_ENTRIES', payload: [entry] });

      try {
        const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
        const audioFile = convertFileHistoryItemToAudioLibraryItem(entry);
        const operation = syncMetadata(serverUrl, {
          type: 'append',
          payload: convertAudioLibraryItemToAudioFile(audioFile),
        });
        pendingMetadataOperations.push(operation);
        await operation;
        const metadata = await loadCurrentMetadata(serverUrl);
        sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(metadata));
      } catch (error) {
        devLog(`Error updating sessionStorage: ${error.message}`, 'error');
      }
    },

    updateHistoryEntry: (entry: FileHistoryItem) => {
      if (!entry || !entry.id) {
        return;
      }
      dispatch({ type: 'UPDATE_HISTORY_ENTRY', payload: entry });
    },

    setFileHistory: (history: FileHistoryItem[]) => {
      if (!Array.isArray(history)) {
        return;
      }
      dispatch({ type: 'SET_FILE_HISTORY', payload: history });
    },

    refreshFileHistory: async () => {
      try {
        if (pendingRefreshRequest) {
          return pendingRefreshRequest;
        }

        pendingRefreshRequest = (async () => {
          try {
            const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
            const files = await listFromStorage('fileStorage');
            const existingMetadata = await loadCurrentMetadata(serverUrl);

            const fileHistory = files.map(file => ({
              id: file.id,
              name: file.name || 'Untitled',
              audio_url: file.audio_url || file.url || '',
              config_url: file.config_url || null,
              type: file.type || 'audio/wav',
              date: file.date || new Date().toISOString(),
              category: file.category || 'sound_effect',
              template: file.category === 'merged_audio' ? 'merged' : 'uploaded',
            }));

            dispatch({ type: 'SET_FILE_HISTORY', payload: fileHistory });
            const existingMetadataIds = new Set(existingMetadata.map(m => m.id));
            let syncedCount = 0;
            for (const file of fileHistory) {
              if (!existingMetadataIds.has(file.id)) {
                const audioFile = convertAudioLibraryItemToAudioFile(convertFileHistoryItemToAudioLibraryItem(file));
                const operation = syncMetadata(serverUrl, { type: 'append', payload: audioFile });
                pendingMetadataOperations.push(operation);
                await operation;
                syncedCount++;
              }
            }
          } catch (error) {
            devLog(`Error refreshing file history: ${error.message}`, 'error');
            dispatch({ type: 'SET_FILE_HISTORY', payload: [] });
            throw error;
          } finally {
            pendingRefreshRequest = null;
          }
        })();

        return pendingRefreshRequest;
      } catch (error) {
        devLog(`Error in refreshFileHistory: ${error.message}`, 'error');
        throw error;
      }
    },

    resetFileHistory: () => {
      dispatch({ type: 'RESET_FILE_HISTORY' });
    },
  };

  async function validateFiles(files: any[]): Promise<AudioLibraryItem[]> {
    const audioFiles: AudioLibraryItem[] = [];
    const serverUrl = currentState?.settings?.storageConfig?.serverUrl ?? 'http://localhost:5000';
    let invalidFilesCount = 0;

    for (const file of files) {
      if (!file.id) {
        invalidFilesCount++;
        continue;
      }

      let audioExists = !!(file.audio_url || file.url);
      let configExists = !!file.config_url;

      const audioUrlRaw = file.audio_url || file.url || '';
      if (audioUrlRaw) {
        try {
          const audioUrl = audioUrlRaw.startsWith('http') ? audioUrlRaw : `${serverUrl}${audioUrlRaw}`;
          await makeApiCall(() => axios.head(audioUrl));
        } catch (e) {
          invalidFilesCount++;
          audioExists = false;
        }
      }

      if (file.config_url) {
        try {
          const configUrl = file.config_url.startsWith('http') ? file.config_url : `${serverUrl}${file.config_url}`;
          await makeApiCall(() => axios.head(configUrl));
        } catch (e) {
          invalidFilesCount++;
          configExists = false;
        }
      }

      if (audioExists || configExists) {
        audioFiles.push({
          id: file.id,
          name: file.name || `File-${file.id}`,
          audio_url: audioUrlRaw,
          config_url: file.config_url || null,
          type: file.type || 'audio/wav',
          date: file.date || new Date().toISOString(),
          category: file.category || 'sound_effect',
          audioMetadata: {
            duration: file.size ? Math.ceil(file.size / 1024) : 0,
            format: file.type?.split('/')[1] || 'wav',
            placeholder: file.placeholder ?? file.name ?? 'Untitled',
            volume: file.volume ?? 1,
          },
        });
      }
    }
    return audioFiles;
  }

  async function makeApiCall(apiCall: () => Promise<any>, retryCount = 0): Promise<any> {
    try {
      return await apiCall();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return makeApiCall(apiCall, retryCount + 1);
      }
      throw error;
    }
  }
}