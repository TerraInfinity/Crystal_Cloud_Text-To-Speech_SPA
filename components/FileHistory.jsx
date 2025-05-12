/**
 * @fileoverview File History component for the Text-to-Speech application.
 * Displays a history of merged audio files (category: merged_audio) with options to play, download, and delete.
 *
 * @requires React
 * @requires ../context/TTSContext.tsx
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFileStorage } from '../context/TTSContext.tsx';
import { devLog } from '../utils/logUtils';

const FileHistory = () => {
  const { state, actions } = useFileStorage();
  const [playingEntryId, setPlayingEntryId] = useState(null);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteOption, setDeleteOption] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogRef = useRef(null);

  // Fetch file history on mount
  useEffect(() => {
    actions.refreshFileHistory().catch((err) => {
      devLog('Error fetching file history:', err);
      setError('Failed to load file history');
    });
  }, [actions]);

  // Handle Escape key to close dialog
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && deleteDialogOpen) {
        handleCloseDeleteDialog();
      }
    },
    [deleteDialogOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus dialog when it opens
  useEffect(() => {
    if (deleteDialogOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [deleteDialogOpen]);

  // Determine entry type based on audio_url and config_url
  const getEntryType = (entry) => {
    const hasAudio = entry.audio_url && entry.audio_url !== 'null';
    const hasConfig = entry.config_url && entry.config_url !== 'null';
    if (hasAudio && hasConfig) return 'audio_and_config';
    if (hasAudio) return 'audio_only';
    if (hasConfig) return 'config_only';
    devLog('Unknown entry type:', JSON.stringify(entry, null, 2));
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
      devLog('Error downloading file:', err);
      setError(`Failed to download file: ${err.message}`);
    }
  };

  // Open delete dialog
  const handleOpenDeleteDialog = (entry) => {
    devLog('[FileHistory] Opening delete dialog for entry:', JSON.stringify(entry, null, 2));
    const entryType = getEntryType(entry);
    const initialDeleteOption = entryType === 'audio_and_config' ? 'audio_and_config' : entryType;
    devLog('[FileHistory] Initial deleteOption:', initialDeleteOption);
    setSelectedEntry(entry);
    setDeleteOption(initialDeleteOption);
    setDeleteDialogOpen(true);
  };

  // Close delete dialog
  const handleCloseDeleteDialog = () => {
    devLog('[FileHistory] Closing delete dialog');
    setDeleteDialogOpen(false);
    setSelectedEntry(null);
    setDeleteOption('');
    setIsDeleting(false);
  };

  // Handle delete option change
  const handleDeleteOptionChange = (e) => {
    const newOption = e.target.value;
    devLog('[FileHistory] Delete option changed to:', newOption);
    setDeleteOption(newOption);
  };

  // Handle entry deletion
  const handleDelete = async () => {
    if (!selectedEntry || !deleteOption) {
      devLog('[FileHistory] handleDelete skipped: missing selectedEntry or deleteOption');
      return;
    }

    devLog('[FileHistory] Initiating deletion for entry:', JSON.stringify(selectedEntry, null, 2));
    devLog('[FileHistory] Delete option:', deleteOption);

    setIsDeleting(true);
    setError(null);
    try {
      const result = await actions.deleteHistoryEntry(selectedEntry, { deleteOption });
      devLog('[FileHistory] deleteHistoryEntry result:', result);
      if (!result || !result.success) {
        throw new Error('Failed to delete the entry');
      }
      if (playingEntryId === selectedEntry.id) {
        devLog('[FileHistory] Stopping playback for deleted entry:', selectedEntry.id);
        setPlayingEntryId(null);
      }
      // Refresh file history to ensure UI reflects latest metadata
      await actions.refreshFileHistory();
      handleCloseDeleteDialog();
    } catch (err) {
      devLog('[FileHistory] Error deleting entry:', err);
      setError(`Failed to delete entry: ${err.message || 'Unknown error occurred'}`);
      setIsDeleting(false);
    }
  };

  // Filter fileHistory to only show merged_audio entries
  const mergedAudioHistory = state.fileHistory.filter((entry) => entry.category === 'merged_audio');

  return (
    <div className="space-y-4" id="file-history-container">
      <h2 className="text-xl font-semibold mb-4">File History</h2>

      {error && (
        <div className="p-2 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {mergedAudioHistory.length === 0 ? (
        <p className="text-sm italic text-gray-500">No merged audio files generated yet</p>
      ) : (
        mergedAudioHistory.map((entry) => {
          devLog('FileHistory entry:', JSON.stringify(entry, null, 2));
          const entryType = getEntryType(entry);
          devLog('Entry type:', entryType);
          const hasAudio = entryType !== 'config_only';
          const hasConfig = entryType !== 'audio_only';
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
                  <p className="text-xs text-gray-500">
                    {new Date(entry.date).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entryType === 'audio_only'
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
                    src={entry.audio_url.startsWith('http') ? entry.audio_url : `${state.settings?.storageConfig?.serverUrl || 'http://localhost:5000'}${entry.audio_url}`}
                    type="audio/wav"
                  />
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>
          );
        })
      )}

      {/* Custom Delete Modal */}
      {deleteDialogOpen && selectedEntry && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            ref={dialogRef}
            className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md"
            tabIndex={-1}
            aria-label={`Delete ${getEntryTitle(selectedEntry)}`}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Delete "{getEntryTitle(selectedEntry)}"
            </h3>
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
              {getEntryType(selectedEntry) !== 'audio_only' && (
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
              {getEntryType(selectedEntry) === 'audio_and_config' && (
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
                      className="animate-spin h-5 w-5 mr-2 text-white"
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
                        d="M4 12a8 8 0 018-8v8z"
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
    </div>
  );
};

export default FileHistory;