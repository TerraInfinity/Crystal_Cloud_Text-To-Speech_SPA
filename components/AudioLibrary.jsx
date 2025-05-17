/**
 * @fileoverview Audio Library component for the Text-to-Speech application.
 * Provides a comprehensive interface for managing audio files including uploading,
 * editing, playing, and deleting sound effects and other audio types for use in TTS projects.
 *
 * @requires React
 * @requires ../context/useFileStorage
 */

import React, { useState, useRef, useEffect } from 'react';
import { useFileStorage } from '../context/TTSContext';
import { v4 as uuidv4 } from 'uuid';
import { devLog, devError, devDebug } from '../utils/logUtils';

/**
 * AudioLibrary component for managing sound effects and audio files.
 * Provides a full interface for uploading, editing, playing, and deleting
 * audio files that can be used in TTS projects.
 *
 * @component
 * @returns {JSX.Element} The rendered AudioLibrary component
 */
const AudioLibrary = () => {
  const { state, actions } = useFileStorage();
  const { audioLibrary } = state;
  const fileInputRef = useRef(null);
  const [audioName, setAudioName] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [placeholderText, setPlaceholderText] = useState('');
  const [volume, setVolume] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [editingAudioId, setEditingAudioId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const [uploadCategory, setUploadCategory] = useState('sound_effect');
  const [selectedFile, setSelectedFile] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Category display states
  const [expandedCategories, setExpandedCategories] = useState({
    sound_effect: true,
    uploaded_audio: true,
    generated_audio: false,
    music: false,
    Binaural: false,
    other: false,
  });

  // Fetch audio library on mount
  useEffect(() => {
    actions.fetchAudioLibrary().catch((error) => {
      devError('Failed to fetch audio library:', error);
      setNotification({ type: 'error', message: 'Error loading audio library. Please try again.' });
    });
  }, [actions]);

  /**
   * Checks if a name or placeholder value already exists in the library.
   */
  const isDuplicate = (value, type, excludeId = null) => {
    return audioLibrary.some(
      (audio) =>
        audio.id !== excludeId &&
        (type === 'name'
          ? audio.name.toLowerCase() === value.toLowerCase()
          : audio.audioMetadata?.placeholder?.toLowerCase() === value.toLowerCase())
    );
  };

  /**
   * Generates a unique name or placeholder based on a base value.
   */
  const generateUniqueValue = (baseValue, type) => {
    let uniqueValue = baseValue;
    let counter = 1;
    while (isDuplicate(uniqueValue, type)) {
      uniqueValue = `${baseValue}_${counter}`;
      counter++;
    }
    return uniqueValue;
  };

  /**
   * Handles file selection when settings are expanded.
   */
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setNotification({ type: 'error', message: 'Please upload an audio file' });
      setSelectedFile(null);
      fileInputRef.current.value = '';
      return;
    }

    devDebug('File selected:', file.name, file.type, 'category:', uploadCategory);
    setSelectedFile(file);

    if (!showSettings) {
      handleAudioUpload(file);
    }
  };

  /**
   * Handles audio file upload.
   */
  const handleAudioUpload = async (file) => {
    if (!file) {
      setNotification({ type: 'error', message: 'No file selected' });
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setNotification({ type: 'error', message: 'Please upload an audio file' });
      return;
    }

    try {
      setIsProcessing(true);
      devLog('Processing audio file upload:', file.name, file.type, file.size, `${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      devDebug('Using category:', uploadCategory);

      let name = audioName.trim() || file.name.replace(/\.[^/.]+$/, '');
      if (!name) {
        setNotification({ type: 'error', message: 'Audio name cannot be empty' });
        return;
      }
      let placeholder = placeholderText.trim() || name.toLowerCase().replace(/\s+/g, '_');

      const uniqueName = generateUniqueValue(name, 'name');
      if (uniqueName !== name) {
        setNotification({
          type: 'info',
          message: `Name '${name}' already exists. Using '${uniqueName}' instead.`,
        });
        name = uniqueName;
      }

      const uniquePlaceholder = generateUniqueValue(placeholder, 'placeholder');
      if (uniquePlaceholder !== placeholder) {
        setNotification({
          type: 'info',
          message: `Placeholder '${placeholder}' already exists. Using '${uniquePlaceholder}' instead.`,
        });
        placeholder = uniquePlaceholder;
      }

      setNotification({
        type: 'info',
        message: 'Uploading audio file to server...',
      });

      const audioData = {
        name: uniqueName,
        category: uploadCategory,
        config_url: uploadCategory === 'sound_effect' ? 'null' : null,
        audioMetadata: {
          duration: 0,
          format: file.name.split('.').pop().toLowerCase(),
          placeholder: uniquePlaceholder,
          volume: parseFloat(volume),
        },
      };

      await actions.addToAudioLibrary(file, audioData);
      await actions.fetchAudioLibrary();

      setNotification({
        type: 'success',
        message: `Audio file uploaded successfully as ${uploadCategory.replace(/_/g, ' ')}`,
      });

      setAudioName('');
      setPlaceholderText('');
      setVolume(1);
      setSelectedFile(null);
      fileInputRef.current.value = '';
    } catch (error) {
      devError('Error in handleAudioUpload:', error);
      setNotification({
        type: 'error',
        message: `Error uploading audio: ${error.message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle save button click when settings are expanded
   */
  const handleSaveClick = () => {
    if (selectedFile) {
      handleAudioUpload(selectedFile);
    } else {
      setNotification({ type: 'error', message: 'Please select an audio file first' });
    }
  };

  /**
   * Plays the selected audio file.
   */
  const playAudio = (audio) => {
    if (playingAudioId === audio.id) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(audio.id);
    }
  };

  /**
   * Updates the volume for an audio file.
   */
  const updateAudioVolume = async (audioId, newVolume) => {
    const audio = audioLibrary.find((a) => a.id === audioId);
    if (audio) {
      try {
        const updatedData = {
          audioMetadata: {
            ...audio.audioMetadata,
            volume: newVolume,
          },
        };
        await actions.updateAudio(audioId, updatedData);
        await actions.fetchAudioLibrary();
      } catch (error) {
        setNotification({
          type: 'error',
          message: `Error updating volume: ${error.message}`,
        });
      }
    }
  };

  /**
   * Deletes an audio file from storage.
   */
  const deleteAudio = async (audioId) => {
    const audio = audioLibrary.find((a) => a.id === audioId);
    if (!audio) return;

    if (window.confirm(`Are you sure you want to delete "${audio.name}"?`)) {
      try {
        // Make a copy of the essential information needed for deletion
        const audioInfo = {
          id: audio.id,
          name: audio.name,
          category: audio.category
        };

        // Stop playback if this audio was playing
        if (playingAudioId === audioId) {
          setPlayingAudioId(null);
        }

        // We'll let the actions handle state updates instead of updating local state directly
        try {
          // Try to delete from server/context
          await actions.removeFromAudioLibrary(audioInfo.id, { category: audioInfo.category });
        } catch (error) {
          console.error('Error during deletion:', error);
          
          // If error contains "not found", consider it already deleted
          if (error.message?.includes('not found')) {
            console.log(`Audio ${audioInfo.id} not found in context, but deleting from UI anyway`);
            // No need to throw, we'll just update the UI
          } else {
            throw error; // Re-throw other errors
          }
        }

        // Refresh audio library to sync state
        await actions.fetchAudioLibrary();

        setNotification({
          type: 'info',
          message: 'Audio file deleted successfully.',
        });
      } catch (error) {
        console.error('Error during deletion:', error);
        setNotification({
          type: 'error',
          message: `Error deleting audio: ${error.message}`,
        });
      }
    }
  };

  /**
   * Deletes all audio files from storage in a specific category.
   */
  const deleteAllAudiosInCategory = async (category) => {
    const audiosByCategory = audioLibrary.filter((audio) => audio.category === category);

    if (audiosByCategory.length === 0) {
      setNotification({
        type: 'info',
        message: `No ${category.replace('_', ' ')} files to delete.`,
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete all ${audiosByCategory.length} ${category.replace('_', ' ')} files? This cannot be undone.`)) {
      try {
        setIsProcessing(true);
        
        // Stop any playing audio in this category
        if (playingAudioId && audiosByCategory.some(audio => audio.id === playingAudioId)) {
          setPlayingAudioId(null);
        }
        
        setNotification({
          type: 'info',
          message: `Deleting ${audiosByCategory.length} ${category.replace('_', ' ')} files...`,
        });
        
        // Create a complete array of audio info before we start deleting
        const audiosToDelete = audiosByCategory.map(audio => ({
          id: audio.id,
          name: audio.name,
          category: audio.category
        }));
        
        // Process files in batches to avoid overwhelming the system
        const batchSize = 3; // Reduce batch size to 3 for more reliable processing
        let deleteCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        
        devLog(`Starting batch deletion of ${audiosToDelete.length} files in category ${category}`, 'info');
        
        // Process files in batches
        for (let i = 0; i < audiosToDelete.length; i += batchSize) {
          const batch = audiosToDelete.slice(i, i + batchSize);
          
          // Update notification for progress
          setNotification({
            type: 'info',
            message: `Deleting files ${i+1}-${Math.min(i+batchSize, audiosToDelete.length)} of ${audiosToDelete.length}...`,
          });
          
          // Process each file sequentially within the batch
          for (const audio of batch) {
            try {
              devLog(`Deleting audio ${audio.id} (${audio.name}) in category ${audio.category}`, 'info');
              
              // Use the deletion option based on category
              const deleteOption = audio.category === 'sound_effect' ? 'audio_only' : 'audio_and_config';
              
              await actions.removeFromAudioLibrary(audio.id, { category: audio.category });
              deleteCount++;
              
              // Small delay between files to avoid overwhelming server
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`Error deleting audio ${audio.id} (${audio.name}):`, error);
              devLog(`Error deleting audio ${audio.id}: ${error.message}`, 'error');
              errorCount++;
              
              // Store error details for debugging
              errorMessages.push(`${audio.name}: ${error.message || 'Unknown error'}`);
              
              // Continue with other files even if one fails
              continue;
            }
          }
          
          // Periodically refresh to see progress
          if (i % (batchSize * 2) === 0 || i + batchSize >= audiosToDelete.length) {
            try {
              await actions.refreshFileHistory();
            } catch (refreshError) {
              console.warn("Failed to refresh file history during batch deletion:", refreshError);
            }
          }
        }
        
        devLog(`Batch deletion completed: ${deleteCount} deleted, ${errorCount} errors`, 'info');
        
        // Final refresh to update UI with accurate state
        try {
          // Do both refreshes to ensure consistency
          await actions.fetchAudioLibrary();
          await actions.refreshFileHistory();
        } catch (refreshError) {
          console.warn("Failed to refresh after batch deletion:", refreshError);
        }
        
        if (errorCount > 0) {
          setNotification({
            type: 'warning',
            message: `Deleted ${deleteCount} files. ${errorCount} files could not be deleted. ${errorMessages.length > 0 ? 'First error: ' + errorMessages[0] : ''}`,
          });
        } else if (deleteCount > 0) {
          setNotification({
            type: 'success',
            message: `Successfully deleted all ${deleteCount} ${category.replace('_', ' ')} files.`,
          });
        } else {
          setNotification({
            type: 'error',
            message: `No files were deleted. Try again or delete files individually.`,
          });
        }
        
        // Add a delayed final refresh to ensure UI is updated after backend has fully processed all deletions
        // Use a properly awaited timeout rather than setTimeout with an async callback
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          // Refresh both data sources again to ensure UI is in sync
          await actions.fetchAudioLibrary();
          await actions.refreshFileHistory();
          
          // One more check if there are still files in this category
          const currentState = await actions.getState();
          const remainingFiles = currentState.audioLibrary.filter(a => a.category === category);
          
          if (remainingFiles.length > 0 && deleteCount > 0) {
            devLog(`Still found ${remainingFiles.length} remaining files after deletion, performing final refresh`, 'warn');
            // Wait a bit longer and try one last time
            await new Promise(resolve => setTimeout(resolve, 2000));
            await actions.fetchAudioLibrary();
            await actions.refreshFileHistory();
          }
        } catch (finalError) {
          console.warn("Failed final refresh:", finalError);
        }
      } catch (error) {
        console.error('Error during bulk deletion:', error);
        devLog(`Error during bulk deletion: ${error.message}`, 'error');
        setNotification({
          type: 'error',
          message: `Error deleting files: ${error.message}`,
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  /**
   * Begins editing an audio file's metadata.
   */
  const startEditing = (audio) => {
    setEditingAudioId(audio.id);
    setEditName(audio.name);
    setEditPlaceholder(audio.audioMetadata?.placeholder || '');
  };

  /**
   * Saves edited audio metadata.
   */
  const saveEdit = async (audioId) => {
    try {
      const audio = audioLibrary.find((a) => a.id === audioId);
      if (!audio) return;

      let name = editName.trim() || audio.name;
      let placeholder = editPlaceholder.trim() || audio.audioMetadata?.placeholder || audio.name.toLowerCase().replace(/\s+/g, '_');

      if (isDuplicate(name, 'name', audioId)) {
        setNotification({
          type: 'error',
          message: `Name '${name}' is already in use. Please choose a different name.`,
        });
        return;
      }
      if (isDuplicate(placeholder, 'placeholder', audioId)) {
        setNotification({
          type: 'error',
          message: `Placeholder '${placeholder}' is already in use. Please choose a different placeholder.`,
        });
        return;
      }

      const updatedData = {
        name,
        audioMetadata: {
          ...audio.audioMetadata,
          placeholder,
        },
      };

      await actions.updateAudio(audioId, updatedData);
      await actions.fetchAudioLibrary();

      setEditingAudioId(null);
      setEditName('');
      setEditPlaceholder('');
      setNotification({
        type: 'success',
        message: 'Audio file updated successfully.',
      });
    } catch (error) {
      console.error('Error in saveEdit:', error);
      setNotification({
        type: 'error',
        message: `Error updating audio: ${error.message}`,
      });
    }
  };

  /**
   * Cancels the current audio editing operation.
   */
  const cancelEdit = () => {
    setEditingAudioId(null);
    setEditName('');
    setEditPlaceholder('');
  };

  /**
   * Toggles a category's expanded state
   */
  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  /**
   * Gets audio items filtered by category
   */
  const getAudioByCategory = (category) => {
    return audioLibrary.filter((audio) => audio.category === category);
  };

  /**
   * Renders an audio item
   */
  const renderAudioItem = (audio) => (
    <div
      key={audio.id}
      id={`audio-item-${audio.id}`}
      className="p-2 rounded-md hover:bg-gray-100 border-b border-gray-100 last:border-0"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      {editingAudioId === audio.id ? (
        <div id={`edit-audio-form-${audio.id}`} className="space-y-2">
          <div>
            <label id={`edit-name-label-${audio.id}`} className="block text-xs font-medium text-gray-700">
              Audio Name
            </label>
            <input
              id={`edit-name-input-${audio.id}`}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-field text-sm"
              placeholder="Enter audio name"
            />
          </div>
          <div>
            <label id={`edit-placeholder-label-${audio.id}`} className="block text-xs font-medium text-gray-700">
              Placeholder Text
            </label>
            <input
              id={`edit-placeholder-input-${audio.id}`}
              type="text"
              value={editPlaceholder}
              onChange={(e) => setEditPlaceholder(e.target.value)}
              className="input-field text-sm"
              placeholder="e親g., beep, chime"
            />
          </div>
          <div className="flex space-x-2">
            <button
              id={`save-edit-btn-${audio.id}`}
              onClick={() => saveEdit(audio.id)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Save
            </button>
            <button
              id={`cancel-edit-btn-${audio.id}`}
              onClick={cancelEdit}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 id={`audio-name-${audio.id}`} className="text-sm font-medium">
              {audio.name}
            </h4>
            <p id={`audio-placeholder-${audio.id}`} className="text-xs text-gray-500">
              [{audio.audioMetadata?.placeholder || 'No placeholder'}]
            </p>
          </div>
          <div className="flex items-center space-x-1">
            <input
              id={`audio-volume-range-${audio.id}`}
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={audio.audioMetadata?.volume || 1}
              onChange={(e) => updateAudioVolume(audio.id, parseFloat(e.target.value))}
              className="w-16"
            />
            <button
              id={`play-audio-btn-${audio.id}`}
              onClick={() => playAudio(audio)}
              className="p-1 text-indigo-600 hover:text-indigo-800"
              title="Play"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                {playingAudioId === audio.id ? (
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7h4v6H8V7z" clipRule="evenodd" />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
            </button>
            <button
              id={`edit-audio-btn-${audio.id}`}
              onClick={() => startEditing(audio)}
              className="p-1 text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              id={`delete-audio-btn-${audio.id}`}
              onClick={() => deleteAudio(audio.id)}
              className="p-1 text-red-600 hover:text-red-800"
              title="Delete"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {playingAudioId === audio.id && (
        <audio
          controls
          autoPlay
          className="w-full mt-2 audio-player"
          id={`audio-player-${audio.id}`}
          data-testid={`audio-player-${audio.id}`}
          key={`audio-player-${audio.id}`}
        >
          <source
            src={`${state.settings.storageConfig.serverUrl}${audio.audio_url}`}
            type={audio.audioMetadata?.format ? `audio/${audio.audioMetadata.format}` : 'audio/wav'}
            id={`audio-source-${audio.id}`}
          />
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );

  /**
   * Renders a category section
   */
  const renderCategorySection = (category, displayName) => {
    if (category === 'merged_audio') return null;
    const items = getAudioByCategory(category);
    const isGeneratedAudio = category === 'generated_audio';

    return (
      <div
        className="mb-2 border border-gray-200 rounded-md overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div
          className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-50 hover:bg-gray-100"
          onClick={() => toggleCategory(category)}
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <h3 className="text-sm font-medium flex items-center">
            {displayName}
            {isGeneratedAudio && (
              <span className="ml-1 text-xs text-gray-500 italic">
                (generated audios are temporary and expire, unless manually saved)
              </span>
            )}
            <span className="ml-2 text-xs text-gray-500">({items.length})</span>
          </h3>
          <div className="flex space-x-2 items-center">
            {items.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAllAudiosInCategory(category);
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Delete All
              </button>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transform ${expandedCategories[category] ? 'rotate-180' : ''} transition-transform`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {expandedCategories[category] && (
          <div className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-2">No {displayName.toLowerCase()} in your library.</p>
            ) : (
              items.map((audio) => renderAudioItem(audio))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Notification Display */}
      {notification && (
        <div
          id="notification-container"
          className={`p-4 rounded-lg mb-4 ${
            notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {notification.message}
          <button
            id="notification-dismiss-btn"
            onClick={() => setNotification(null)}
            className="ml-4 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with title only */}
      <div className="flex justify-between items-center">
        <h2 id="audio-library-title" className="text-xl font-medium">
          Audio Library
        </h2>
      </div>

      {/* Upload Section */}
      <div
        id="audio-upload-section"
        className="rounded-lg p-4 mb-2"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="upload-section-title" className="text-lg font-medium">
            Upload New Audio
          </h3>
          <button
            id="toggle-settings-btn"
            onClick={() => {
              setShowSettings(!showSettings);
              if (showSettings) {
                setSelectedFile(null);
                fileInputRef.current.value = '';
              }
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        <div className="mb-2">
          <div className="flex items-center space-x-2 mb-2">
            <label htmlFor="audio-category-select" className="text-sm whitespace-nowrap font-medium">
              Audio Category:
            </label>
            <select
              id="audio-category-select"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="text-sm rounded-md border-gray-300 shadow-sm p-1 select-field"
              style={{ width: 'auto', minWidth: '150px' }}
              disabled={isProcessing}
            >
              <option value="sound_effect">Sound Effect</option>
              <option value="uploaded_audio">Uploaded Audio</option>
              <option value="music">Music</option>
              <option value="binaural">Binaural</option>
              <option value="other">Other</option>
            </select>
          </div>

          <label id="audio-file-label" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-color)' }}>
            Audio File
          </label>
          <input
            id="audio-upload-input"
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="audio/*"
            className="hidden"
            disabled={isProcessing}
          />
          <div className="flex items-center">
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
            >
              Choose File
            </button>
            <span className="ml-3 text-so text-gray-500">
              {selectedFile ? selectedFile.name : 'No file selected'}
            </span>
          </div>
          <p id="audio-file-hint" className="text-xs text-gray-500 italic mt-1">
            Supported: MP3, WAV, OGG
          </p>
        </div>

        {showSettings ? (
          <div id="audio-settings" className="space-y-3">
            <div>
              <label id="audio-name-label" className="block text-sm font-medium text-gray-700 mb-1">
                Audio Name
              </label>
              <input
                id="audio-name-input"
                type="text"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                className="input-field text-sm"
                placeholder="Enter a name (optional)"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label id="audio-placeholder-label" className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text
              </label>
              <input
                id="audio-placeholder-input"
                type="text"
                value={placeholderText}
                onChange={(e) => setPlaceholderText(e.target.value)}
                className="input-field text-sm"
                placeholder="e.g., beep, chime (optional)"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label id="audio-volume-label" className="block text-sm font-medium text-gray-700 mb-1">
                Default Volume
              </label>
              <input
                id="audio-volume-input"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-4">
              <button
                id="save-audio-btn"
                onClick={handleSaveClick}
                disabled={!selectedFile || isProcessing}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  !selectedFile || isProcessing ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? 'Saving...' : 'Save Audio'}
              </button>
              {selectedFile && (
                <span className="ml-2 text-xs text-gray-500">Selected: {selectedFile.name}</span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Audio Library Categories */}
      <div id="audio-library-categories" className="space-y-1">
        {renderCategorySection('sound_effect', 'Sound Effects')}
        {renderCategorySection('uploaded_audio', 'Uploaded Audio')}
        {renderCategorySection('generated_audio', 'Generated Audio')}
        {renderCategorySection('music', 'Music')}
        {renderCategorySection('binaural', 'Binaural')}
        {renderCategorySection('other', 'Other')}
      </div>
    </div>
  );
};

export default AudioLibrary;