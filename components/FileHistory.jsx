/**
 * @fileoverview File History component for the Text-to-Speech application.
 * Displays a history of audio files, toggling between merged audio (category: merged_audio)
 * and generated audio (category: generated_audio) with options to play, download, and delete.
 *
 * @requires React
 * @requires ../context/TTSContext.tsx
 * @requires ./FileHistoryButtons
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useFileStorage } from '../context/TTSContext.tsx';
import { devLog } from '../utils/logUtils';
import FileHistoryButtons from './FileHistoryButtons';
import { useNotification } from '../context/notificationContext';

const FileHistory = () => {
  const { state, actions } = useFileStorage();
  const { addNotification } = useNotification();
  const [playingEntryId, setPlayingEntryId] = useState(null);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteOption, setDeleteOption] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyView, setHistoryView] = useState('merged_audio'); // Toggle state: 'merged_audio' or 'generated_audio'
  const dialogRef = useRef(null);
  const deleteAllDialogRef = useRef(null);

  // Fetch file history on mount
  useEffect(() => {
    actions.refreshFileHistory().catch((err) => {
      devLog(`[FileHistory] Error fetching file history: ${err.message}`, 'error');
      setError('Failed to load file history');
    });
  }, [actions]);

  // Handle Escape key to close dialog
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        if (deleteDialogOpen) {
          setDeleteDialogOpen(false);
          setSelectedEntry(null);
          setDeleteOption('');
          setIsDeleting(false);
        }
        if (deleteAllDialogOpen) {
          setDeleteAllDialogOpen(false);
          setIsDeleting(false);
        }
      }
    },
    [deleteDialogOpen, deleteAllDialogOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus dialog when it opens
  useEffect(() => {
    if (deleteDialogOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
    if (deleteAllDialogOpen && deleteAllDialogRef.current) {
      deleteAllDialogRef.current.focus();
    }
  }, [deleteDialogOpen, deleteAllDialogOpen]);

  // Determine entry type based on audio_url and config_url
  const getEntryType = (entry) => {
    const hasAudio = entry.audio_url && entry.audio_url !== 'null';
    const hasConfig = entry.config_url && entry.config_url !== 'null';
    if (hasAudio && hasConfig) return 'audio_and_config';
    if (hasAudio) return 'audio_only';
    if (hasConfig) return 'config_only';
    return 'unknown';
  };

  // Get display title for an entry
  const getEntryTitle = (entry) => {
    if (entry.audio_url && entry.audio_url !== 'null') {
      return entry.audio_url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
    }
    if (entry.config_url && entry.config_url !== 'null') {
      return entry.config_url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
    }
    return entry.title || 'Untitled';
  };

  // Handle audio playback
  const handlePlay = (entry) => {
    if (playingEntryId === entry.id) {
      setPlayingEntryId(null);
    } else {
      setPlayingEntryId(entry.id);
    }
  };

  // Handle audio/config download
  const handleDownload = async (url, filename) => {
    const fileType = filename.includes('.json') ? 'config' : 'audio';
    try {
      setError(null);
      const serverUrl = state.settings?.storageConfig?.serverUrl || 'http://localhost:5000';
      const downloadUrl = url.startsWith('http') ? url : `${serverUrl}${url}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || url.split('/').pop();
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);
    } catch (err) {
      devLog(`[FileHistory] Error downloading ${fileType} (${filename}): ${err.message}`, 'error');
      setError(`Failed to download file: ${err.message}`);
    }
  };

  // Open delete dialog
  const handleOpenDeleteDialog = (entry) => {
    const entryType = getEntryType(entry);
    const initialDeleteOption = historyView === 'generated_audio' ? 'audio_only' : (entryType === 'audio_and_config' ? 'audio_and_config' : entryType);
    setSelectedEntry(entry);
    setDeleteOption(initialDeleteOption);
    setDeleteDialogOpen(true);
  };

  // Close delete dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedEntry(null);
    setDeleteOption('');
    setIsDeleting(false);
  };

  // Handle delete option change
  const handleDeleteOptionChange = (e) => {
    setDeleteOption(e.target.value);
  };

  // Handle entry deletion
  const handleDelete = async () => {
    if (!selectedEntry || !deleteOption) return;
    const title = getEntryTitle(selectedEntry);
    setIsDeleting(true);
    setError(null);
    
    try {
      // Determine if the entry has only audio, only config, or both
      const hasAudio = selectedEntry.audio_url && selectedEntry.audio_url !== 'null';
      const hasConfig = selectedEntry.config_url && selectedEntry.config_url !== 'null';
      const entryType = hasAudio && hasConfig ? 'audio_and_config' : 
                        hasAudio ? 'audio_only' : 
                        hasConfig ? 'config_only' : 'unknown';
      
      // If deleting the only component of the entry, set proper expectations
      const shouldDeleteEntireEntry = 
        (entryType === 'audio_only' && deleteOption === 'audio_only') ||
        (entryType === 'config_only' && deleteOption === 'config_only') ||
        deleteOption === 'audio_and_config';
      
      devLog(`[FileHistory] Deleting ${title} (ID: ${selectedEntry.id}), Type: ${entryType}, Delete option: ${deleteOption}, Should delete entire entry: ${shouldDeleteEntireEntry}`, 'info');

      const result = await actions.deleteHistoryEntry(selectedEntry, { deleteOption });
      if (!result || !result.success) {
        throw new Error('Failed to delete the entry');
      }
      
      if (playingEntryId === selectedEntry.id) {
        setPlayingEntryId(null);
      }
      
      // Refresh file history to update the UI
      await actions.refreshFileHistory();
      
      // Close the dialog
      handleCloseDeleteDialog();
      
      // If entry was completely deleted, show a brief success message
      if (shouldDeleteEntireEntry && addNotification) {
        addNotification({
          type: 'success',
          message: `Entry "${title}" deleted successfully`,
        });
      }
    } catch (err) {
      devLog(`[FileHistory] Error deleting ${title} (ID: ${selectedEntry.id}): ${err.message}`, 'error');
      setError(`Failed to delete entry: ${err.message || 'Unknown error occurred'}`);
      setIsDeleting(false);
    }
  };

  // Open delete all dialog
  const handleOpenDeleteAllDialog = () => {
    setDeleteAllDialogOpen(true);
  };

  // Close delete all dialog
  const handleCloseDeleteAllDialog = () => {
    setDeleteAllDialogOpen(false);
    setIsDeleting(false);
  };

  // Handle delete all entries
  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      const entriesToDelete = uniqueAudioHistory;
      if (entriesToDelete.length === 0) {
        setDeleteAllDialogOpen(false);
        return;
      }
      
      // Stop any playing audio
      setPlayingEntryId(null);

      // Process files in batches to avoid overwhelming the system
      const batchSize = 3; // Smaller batch size for better reliability
      let deleteCount = 0;
      let errorCount = 0;
      let errorMessages = [];

      // For merged_audio we delete both audio and config, for generated_audio we delete audio only
      const defaultDeleteOption = historyView === 'merged_audio' ? 'audio_and_config' : 'audio_only';
      
      devLog(`[FileHistory] Starting deletion of ${entriesToDelete.length} entries`, 'info');
      
      for (let i = 0; i < entriesToDelete.length; i += batchSize) {
        const batch = entriesToDelete.slice(i, i + batchSize);
        
        // Process files sequentially within each batch for better stability
        for (const entry of batch) {
          try {
            // Update progress message
            const progressMessage = `Deleting ${i + batch.indexOf(entry) + 1} of ${entriesToDelete.length}...`;
            if (addNotification) {
              addNotification({ type: 'info', message: progressMessage });
            } else {
              setError(progressMessage);
            }
            
            // Use the appropriate delete option based on entry type and current view
            const entryType = getEntryType(entry);
            const deleteOption = historyView === 'generated_audio' ? 
              'audio_only' : (entryType === 'audio_only' || entryType === 'config_only' ? 
                entryType : defaultDeleteOption);
            
            const entryTitle = getEntryTitle(entry);
            devLog(`[FileHistory] Deleting entry "${entryTitle}" (${entry.id}) with option ${deleteOption}`, 'info');
            
            const result = await actions.deleteHistoryEntry(entry, { deleteOption });
            
            if (result && result.success) {
              deleteCount++;
              devLog(`[FileHistory] Successfully deleted entry ${entryTitle} (${entry.id})`, 'info');
            } else {
              errorCount++;
              const errorMsg = `Failed to delete entry ${entryTitle}`;
              devLog(`[FileHistory] ${errorMsg}`, 'error');
              errorMessages.push(errorMsg);
            }
            
            // Add a small delay between deletions to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (err) {
            const entryTitle = getEntryTitle(entry);
            const errorMsg = `Error deleting ${entryTitle}: ${err.message}`;
            console.error(errorMsg);
            devLog(`[FileHistory] ${errorMsg}`, 'error');
            errorMessages.push(errorMsg);
            errorCount++;
          }
        }
        
        // Periodically refresh to see progress
        if (i % (batchSize * 2) === 0 || i + batchSize >= entriesToDelete.length) {
          try {
            await actions.refreshFileHistory();
          } catch (refreshError) {
            console.warn("[FileHistory] Failed to refresh during deletion:", refreshError);
          }
        }
      }
      
      // Final refresh sequence
      try {
        // First refresh to update UI
        await actions.refreshFileHistory();
        
        // Add a delayed second refresh to ensure backend has processed everything
        await new Promise(resolve => setTimeout(resolve, 1000));
        await actions.refreshFileHistory();
        
        // And one last refresh after a longer delay for stubborn cases
        await new Promise(resolve => setTimeout(resolve, 2000));
        await actions.refreshFileHistory();
      } catch (refreshError) {
        console.warn("[FileHistory] Failed final refresh sequence:", refreshError);
      }
      
      setDeleteAllDialogOpen(false);
      setIsDeleting(false);
      
      // Show result message
      if (errorCount > 0) {
        if (deleteCount > 0) {
          // Some succeeded, some failed
          const message = `Deleted ${deleteCount} files. ${errorCount} files could not be deleted. ${errorMessages.length > 0 ? 'First error: ' + errorMessages[0] : ''}`;
          if (addNotification) {
            addNotification({
              type: 'warning',
              message: message
            });
          } else {
            setError(message);
          }
        } else {
          // All failed
          const message = `Failed to delete all ${errorCount} files. ${errorMessages.length > 0 ? 'First error: ' + errorMessages[0] : ''}`;
          if (addNotification) {
            addNotification({
              type: 'error',
              message: message
            });
          } else {
            setError(message);
          }
        }
      } else if (deleteCount > 0) {
        // All succeeded
        const message = `Successfully deleted all ${deleteCount} files.`;
        if (addNotification) {
          addNotification({
            type: 'success',
            message: message
          });
        } else {
          setError(message);
        }
      }
    } catch (err) {
      devLog(`[FileHistory] Error during batch deletion: ${err.message}`, 'error');
      
      // Close dialog and show error
      setDeleteAllDialogOpen(false);
      setIsDeleting(false);
      
      // Use notification if available, otherwise set error
      if (addNotification) {
        addNotification({
          type: 'error',
          message: `Failed to delete files: ${err.message || 'Unknown error occurred'}`
        });
      } else {
        setError(`Failed to delete files: ${err.message || 'Unknown error occurred'}`);
      }
    }
  };

  // Toggle history view
  const toggleHistoryView = () => {
    setHistoryView((prev) => (prev === 'merged_audio' ? 'generated_audio' : 'merged_audio'));
    setPlayingEntryId(null); // Stop any playing audio when switching views
  };

  // Memoize filtered and deduplicated history
  const uniqueAudioHistory = useMemo(() => {
    // Filter by category first
    const categoryFiltered = state.fileHistory.filter((entry) => entry.category === historyView);
    
    // Then ensure entries have valid URLs (not null/"null")
    const validEntries = categoryFiltered.filter(entry => {
      // If audio_url is valid
      const hasValidAudio = entry.audio_url && entry.audio_url !== 'null';
      
      // If config_url is valid
      const hasValidConfig = entry.config_url && entry.config_url !== 'null';
      
      // Keep only entries that have at least one valid URL
      return hasValidAudio || hasValidConfig;
    });
    
    // Finally deduplicate by ID
    return Array.from(
      new Map(validEntries.map((entry) => [entry.id, entry])).values()
    );
  }, [state.fileHistory, historyView]);

  return (
    <div className="space-y-4" id="file-history-container">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          {historyView === 'merged_audio' ? 'Merged Audio History' : 'Generated Audio History'}
        </h2>
        <div className="flex space-x-3">
          {uniqueAudioHistory.length > 0 && (
            <button
              onClick={handleOpenDeleteAllDialog}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              title="Delete All Files"
            >
              Delete All
            </button>
          )}
          <button
            onClick={toggleHistoryView}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Switch to {historyView === 'merged_audio' ? 'Generated Audio History' : 'Merged Audio History'}
          </button>
        </div>
      </div>
      {error && <div className="p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      {uniqueAudioHistory.length === 0 ? (
        <p className="text-sm italic text-gray-500">
          No {historyView === 'merged_audio' ? 'merged audio' : 'generated audio'} files generated yet
        </p>
      ) : (
        uniqueAudioHistory.map((entry) => {
          const entryType = getEntryType(entry);
          const hasAudio = entryType !== 'config_only';
          const hasConfig = entryType !== 'audio_only' && historyView === 'merged_audio'; // Config only for merged_audio
          const title = getEntryTitle(entry);
          const audioFilename = entry.audio_url && entry.audio_url !== 'null' ? entry.audio_url.split('/').pop() : '';
          const configFilename = entry.config_url && entry.config_url !== 'null' ? entry.config_url.split('/').pop() : '';

          return (
            <div
              key={entry.id}
              className="p-4 rounded-lg shadow-md bg-gray-800"
              id={`history-entry-${entry.id}`}
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="font-medium text-white">{title}</h3>
                  <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">
                    {historyView === 'generated_audio'
                      ? 'Audio Only'
                      : entryType === 'audio_only'
                      ? 'Audio Only'
                      : entryType === 'config_only'
                      ? 'Config Only'
                      : 'Audio and Config'}
                  </p>
                </div>
                <div className="flex space-x-3 items-center">
                  {hasAudio && (
                    <button
                      onClick={() => handlePlay(entry)}
                      className="p-2 rounded hover:bg-gray-700"
                      title={playingEntryId === entry.id ? 'Stop' : 'Play'}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {playingEntryId === entry.id ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18l15-9z" />
                        )}
                      </svg>
                    </button>
                  )}
                  {hasAudio && (
                    <button
                      onClick={() => handleDownload(entry.audio_url, audioFilename)}
                      className="p-2 rounded hover:bg-gray-700"
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
                    <>
                      <button
                        onClick={() => handleDownload(entry.config_url, configFilename)}
                        className="p-2 rounded hover:bg-gray-700"
                        title="Download Config"
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
                      
                      {/* Add FileHistoryButtons component for config files */}
                      <FileHistoryButtons 
                        entry={entry} 
                        configUrl={state.settings?.storageConfig?.serverUrl || 'http://localhost:5000'}
                      />
                    </>
                  )}
                  <button
                    onClick={() => handleOpenDeleteDialog(entry)}
                    className="p-2 rounded hover:bg-gray-700"
                    title="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>
              {hasAudio && playingEntryId === entry.id && (
                <audio
                  controls
                  autoPlay
                  className="w-full mt-2"
                  id={`audio-player-${entry.id}`}
                  onEnded={() => setPlayingEntryId(null)}
                >
                  <source
                    src={
                      entry.audio_url.startsWith('http')
                        ? entry.audio_url
                        : `${state.settings?.storageConfig?.serverUrl || 'http://localhost:5000'}${entry.audio_url}`
                    }
                    type="audio/wav"
                  />
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>
          );
        })
      )}
      {deleteDialogOpen && selectedEntry && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            ref={dialogRef}
            className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md"
            tabIndex={-1}
            aria-label={`Delete ${getEntryTitle(selectedEntry)}`}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Delete "{getEntryTitle(selectedEntry)}"</h3>
            <p className="text-gray-300 mb-4">Please select what you want to delete:</p>
            <div className="space-y-2">
              {getEntryType(selectedEntry) !== 'config_only' && (
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    name="deleteOption"
                    value="audio_only"
                    checked={deleteOption === 'audio_only'}
                    onChange={handleDeleteOptionChange}
                    disabled={isDeleting}
                    className="mr-2"
                  />
                  Delete Audio Only
                </label>
              )}
              {historyView === 'merged_audio' && getEntryType(selectedEntry) !== 'audio_only' && (
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    name="deleteOption"
                    value="config_only"
                    checked={deleteOption === 'config_only'}
                    onChange={handleDeleteOptionChange}
                    disabled={isDeleting}
                    className="mr-2"
                  />
                  Delete Config Only
                </label>
              )}
              {historyView === 'merged_audio' && getEntryType(selectedEntry) === 'audio_and_config' && (
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    name="deleteOption"
                    value="audio_and_config"
                    checked={deleteOption === 'audio_and_config'}
                    onChange={handleDeleteOptionChange}
                    disabled={isDeleting}
                    className="mr-2"
                  />
                  Delete Both
                </label>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseDeleteDialog}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteAllDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            ref={deleteAllDialogRef}
            className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md"
            tabIndex={-1}
            aria-label="Delete All Files"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Delete All Files</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete all{' '}
              {historyView === 'merged_audio' ? 'merged audio' : 'generated audio'} files?{' '}
              {historyView === 'merged_audio' && 'This will delete both audio and configuration files.'}
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseDeleteAllDialog}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileHistory;