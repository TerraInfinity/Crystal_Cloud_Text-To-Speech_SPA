/**
 * @fileoverview Audio Library component for the Text-to-Speech application.
 * Provides a comprehensive interface for managing audio files including uploading,
 * editing, playing, and deleting sound effects for use in TTS projects.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';

/**
 * AudioLibrary component for managing sound effects and audio files.
 * Provides a full interface for uploading, editing, playing, and deleting
 * audio files that can be used in TTS projects.
 * 
 * @component
 * @returns {JSX.Element} The rendered AudioLibrary component
 */
const AudioLibrary = () => {
  const { state, actions } = useTTS();
  const { state: sessionState, actions: sessionActions, isProcessing } = useTTSSession();
  const audioLibrary = state?.AudioLibrary || {};
  const fileInputRef = useRef(null);
  const [audioName, setAudioName] = useState('');
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const [volume, setVolume] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [editingAudioId, setEditingAudioId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const audioPlayerRef = useRef(null);

  /**
   * Fetches audio list from server on component mount.
   * Loads sound effects from storage into the audio library.
   */
  useEffect(() => {
    const fetchAudioList = async () => {
      try {
        const files = await actions.listFromStorage('fileStorage');
        const soundEffects = files.reduce((acc, file) => {
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
            category: 'sound_effect',
          };
          return acc;
        }, {});
        actions.loadAudioLibrary(soundEffects);
      } catch (error) {
        console.error('Error fetching tts_audio_library:', error);
        sessionActions.setNotification({
          type: 'error',
          message: 'Failed to load sound effects',
        });
      }
    };
    fetchAudioList();
  }, [actions, sessionActions]);

  /**
   * Checks if a name or placeholder value already exists in the library.
   * 
   * @param {string} value - The value to check for duplicates
   * @param {string} type - The type of value to check ('name' or 'placeholder')
   * @param {string} [excludeId=null] - ID to exclude from the check (for editing)
   * @returns {boolean} True if the value is a duplicate, false otherwise
   */
  const isDuplicate = (value, type, excludeId = null) => {
    const libraryValues = Object.values(audioLibrary);
    return libraryValues.some(
      (audio) =>
        audio.id !== excludeId &&
        (type === 'name'
          ? audio.name.toLowerCase() === value.toLowerCase()
          : audio.placeholder.toLowerCase() === value.toLowerCase())
    );
  };

  /**
   * Generates a unique name or placeholder based on a base value.
   * Appends a counter until a unique value is found.
   * 
   * @param {string} baseValue - The base value to start with
   * @param {string} type - The type of value ('name' or 'placeholder')
   * @returns {string} A unique value for the library
   */
  const generateUniqueValue = (baseValue, type) => {
    let uniqueValue = baseValue;
    let counter = 1;
    const libraryValues = Object.values(audioLibrary);
    while (
      libraryValues.some((audio) =>
        type === 'name'
          ? audio.name.toLowerCase() === uniqueValue.toLowerCase()
          : audio.placeholder.toLowerCase() === uniqueValue.toLowerCase()
      )
    ) {
      uniqueValue = `${baseValue}_${counter}`;
      counter++;
    }
    return uniqueValue;
  };

  /**
   * Handles audio file upload.
   * Processes the file, generates unique name and placeholder if needed,
   * and uploads to storage.
   * 
   * @param {Object} e - The file input change event
   */
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('audio/')) {
      sessionActions.setNotification({ type: 'error', message: 'Please upload an audio file' });
      return;
    }

    try {
      sessionActions.setProcessing(true);
      let name = audioName.trim() || file.name.replace(/\.[^/.]+$/, '');
      if (!name) {
        sessionActions.setNotification({ type: 'error', message: 'Audio name cannot be empty' });
        return;
      }
      let placeholder = placeholderText.trim() || name.toLowerCase().replace(/\.s+/g, '_');

      // Check and adjust name if duplicate
      const uniqueName = generateUniqueValue(name, 'name');
      if (uniqueName !== name) {
        sessionActions.setNotification({
          type: 'info',
          message: `Name '${name}' already exists. Using '${uniqueName}' instead.`,
        });
        name = uniqueName;
      }

      // Check and adjust placeholder if duplicate
      const uniquePlaceholder = generateUniqueValue(placeholder, 'placeholder');
      if (uniquePlaceholder !== placeholder) {
        sessionActions.setNotification({
          type: 'info',
          message: `Placeholder '${placeholder}' already exists. Using '${uniquePlaceholder}' instead.`,
        });
        placeholder = uniquePlaceholder;
      }

      const audioId = `audio-${Date.now()}`;
      const audioData = {
        id: audioId,
        name,
        type: file.type,
        size: file.size,
        source: {
          type: 'remote',
          metadata: { name: file.name, type: file.type, size: file.size },
        },
        date: new Date().toISOString(),
        placeholder,
        volume: parseFloat(volume),
        category: 'sound_effect',
      };

      await actions.uploadAudio(file, audioData);

      setAudioName('');
      setPlaceholderText('');
      setVolume(1);
      setShowSettings(false);
      fileInputRef.current.value = '';
    } catch (error) {
      sessionActions.setNotification({
        type: 'error',
        message: `Error uploading audio: ${error.message}`,
      });
    } finally {
      sessionActions.setProcessing(false);
    }
  };

  /**
   * Plays the selected audio file.
   * 
   * @param {Object} audio - The audio file object to play
   */
  const playAudio = (audio) => {
    setSelectedAudio(audio);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audio.url;
      audioPlayerRef.current.volume = audio.volume || 1;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  /**
   * Updates the volume for an audio file.
   * 
   * @param {string} audioId - The ID of the audio to update
   * @param {number} newVolume - The new volume value
   */
  const updateAudioVolume = async (audioId, newVolume) => {
    const audio = audioLibrary[audioId];
    if (audio) {
      try {
        const updatedData = { ...audio, volume: newVolume };
        await actions.updateAudio(audioId, updatedData);
      } catch (error) {
        sessionActions.setNotification({
          type: 'error',
          message: `Error updating volume: ${error.message}`,
        });
      }
    }
  };

  /**
   * Deletes an audio file from storage.
   * 
   * @param {string} audioId - The ID of the audio to delete
   */
  const deleteAudio = async (audioId) => {
    if (window.confirm('Are you sure you want to delete this sound effect?')) {
      try {
        const audio = audioLibrary[audioId];
        if (audio) {
          const filename = audio.url.split('/').pop();
          await actions.deleteAudioFromStorage(audioId, filename);
          // Stop playback if the deleted audio is playing
          if (selectedAudio?.id === audioId) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
            setSelectedAudio(null);
          }
          sessionActions.setNotification({
            type: 'info',
            message: 'Sound effect deleted successfully.',
          });
        }
      } catch (error) {
        console.error('Error during deletion:', error);
        if (error.message.includes('Unsupported storage config type')) {
          // Assume server deletion succeeded and dispatch DELETE_AUDIO
          actions.deleteAudio(audioId);
          if (selectedAudio?.id === audioId) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
            setSelectedAudio(null);
          }
          sessionActions.setNotification({
            type: 'info',
            message: 'Sound effect deleted successfully.',
          });
        } else {
          sessionActions.setNotification({
            type: 'error',
            message: `Error deleting audio: ${error.message}`,
          });
        }
      }
    }
  };

  /**
   * Deletes all audio files from storage.
   */
  const deleteAllAudios = async () => {
    if (Object.keys(audioLibrary).length === 0) {
      sessionActions.setNotification({
        type: 'info',
        message: 'No sound effects to delete.',
      });
      return;
    }
    if (window.confirm('Are you sure you want to delete all sound effects?')) {
      try {
        for (const audio of Object.values(audioLibrary)) {
          const filename = audio.url.split('/').pop();
          await actions.deleteAudioFromStorage(audio.id, filename);
        }
        // Stop any playback
        if (selectedAudio) {
          audioPlayerRef.current.pause();
          setIsPlaying(false);
          setSelectedAudio(null);
        }
        sessionActions.setNotification({
          type: 'info',
          message: 'All sound effects deleted successfully.',
        });
      } catch (error) {
        console.error('Error during bulk deletion:', error);
        if (error.message.includes('Unsupported storage config type')) {
          // Assume server deletions succeeded and clear state
          actions.loadAudioLibrary({});
          if (selectedAudio) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
            setSelectedAudio(null);
          }
          sessionActions.setNotification({
            type: 'info',
            message: 'All sound effects deleted successfully.',
          });
        } else {
          sessionActions.setNotification({
            type: 'error',
            message: `Error deleting all sound effects: ${error.message}`,
          });
        }
      }
    }
  };

  /**
   * Begins editing an audio file's metadata.
   * 
   * @param {Object} audio - The audio file to edit
   */
  const startEditing = (audio) => {
    setEditingAudioId(audio.id);
    setEditName(audio.name);
    setEditPlaceholder(audio.placeholder || '');
  };

  /**
   * Saves edited audio metadata.
   * 
   * @param {string} audioId - The ID of the audio being edited
   */
   const saveEdit = async (audioId) => {
    try {
      const audio = audioLibrary[audioId];
      if (!audio) return;

      let name = editName.trim() || audio.name;
      let placeholder = editPlaceholder.trim() || audio.placeholder || audio.name.toLowerCase().replace(/\s+/g, '_');

      // Check for duplicates, excluding the current audio
      if (isDuplicate(name, 'name', audioId)) {
        sessionActions.setNotification({
          type: 'error',
          message: `Name '${name}' is already in use. Please choose a different name.`,
        });
        return;
      }
      if (isDuplicate(placeholder, 'placeholder', audioId)) {
        sessionActions.setNotification({
          type: 'error',
          message: `Placeholder '${placeholder}' is already in use. Please choose a different placeholder.`,
        });
        return;
      }

      const updatedData = {
        ...audio,
        name,
        placeholder,
      };

      await actions.updateAudio(audioId, updatedData);

      // Clear editing state
      setEditingAudioId(null);
      setEditName('');
      setEditPlaceholder('');
      sessionActions.setNotification({
        type: 'success',
        message: 'Sound effect updated successfully.',
      });
    } catch (error) {
      console.error('Error in saveEdit:', error);
      if (error.message.includes('Audio not found')) {
        // Refresh the audio list to sync with server
        try {
          const files = await actions.listFromStorage('fileStorage');
          const soundEffects = files.reduce((acc, file) => {
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
              category: 'sound_effect',
            };
            return acc;
          }, {});
          actions.loadAudioLibrary(soundEffects);
          sessionActions.setNotification({
            type: 'error',
            message: 'Audio file not found on server. Library refreshed. Please try again.',
          });
        } catch (fetchError) {
          console.error('Error refreshing audio list:', fetchError);
          sessionActions.setNotification({
            type: 'error',
            message: 'Failed to refresh audio library. Please try again later.',
          });
        }
      } else {
        sessionActions.setNotification({
          type: 'error',
          message: `Error updating audio: ${error.message}`,
        });
      }
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
   * Clean up audio player when component unmounts.
   */
  useEffect(() => {
    const player = audioPlayerRef.current;
    const handleEnded = () => setIsPlaying(false);
    if (player) {
      player.addEventListener('ended', handleEnded);
    }
    return () => {
      if (player) {
        player.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Notification Display - Only on /audio to avoid duplicates on root */}
      {sessionState.notification && window.location.pathname === '/audio' && (
        <div
          id="notification-container"
          className={`p-4 rounded-lg mb-4 ${
            sessionState.notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {sessionState.notification.message}
          <button
            id="notification-dismiss-btn"
            onClick={() => sessionActions.setNotification(null)}
            className="ml-4 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <h2 id="audio-library-title" className="text-xl font-medium">Sound Effects Library</h2>

      {/* Upload Section */}
      <div
        id="audio-upload-section"
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="upload-section-title" className="text-lg font-medium">Upload New Sound Effect</h3>
          <button
            id="toggle-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        <div className="mb-2">
          <label id="audio-file-label" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-color)' }}>
            Audio File
          </label>
          <input
            id="audio-upload-input"
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept="audio/*"
            className="theme-file-input block w-full text-sm"
            disabled={isProcessing}
          />
          <p id="audio-file-hint" className="text-xs text-gray-500 italic mt-1">Supported: MP3, WAV, OGG</p>
        </div>

        {showSettings && (
          <div id="audio-settings" className="space-y-3">
            <div>
              <label id="audio-name-label" className="block text-sm font-medium text-gray-700 mb-1">Audio Name</label>
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
              <label id="audio-placeholder-label" className="block text-sm font-medium text-gray-700 mb-1">Placeholder Text</label>
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
              <label id="audio-volume-label" className="block text-sm font-medium text-gray-700 mb-1">Default Volume</label>
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
          </div>
        )}
      </div>

      {/* Now Playing Section */}
      {selectedAudio && (
        <div
          id="now-playing-section"
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
          }}
        >
          <h3 id="now-playing-title" className="text-lg font-medium mb-2">Now Playing: {selectedAudio.name}</h3>
          <audio
            id="now-playing-audio"
            ref={audioPlayerRef}
            controls
            className="w-full"
            src={selectedAudio.url}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>
      )}

      {/* Audio Library List */}
      <div
        id="audio-library-list"
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <h3 id="library-list-title" className="text-lg font-medium mb-3">Your Sound Effects</h3>
        {Object.keys(audioLibrary).length === 0 ? (
          <p id="empty-library-message" className="text-gray-500">No sound effects in your library yet.</p>
        ) : (
          <div id="audio-items-container" className="space-y-2">
            {Object.values(audioLibrary).map((audio) => (
              <div
                key={audio.id}
                id={`audio-item-${audio.id}`}
                className="p-2 rounded-md hover:bg-gray-100"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                {editingAudioId === audio.id ? (
                  <div id={`edit-audio-form-${audio.id}`} className="space-y-2">
                    <div>
                      <label id={`edit-name-label-${audio.id}`} className="block text-xs font-medium text-gray-700">Audio Name</label>
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
                      <label id={`edit-placeholder-label-${audio.id}`} className="block text-xs font-medium text-gray-700">Placeholder Text</label>
                      <input
                        id={`edit-placeholder-input-${audio.id}`}
                        type="text"
                        value={editPlaceholder}
                        onChange={(e) => setEditPlaceholder(e.target.value)}
                        className="input-field text-sm"
                        placeholder="e.g., beep, chime"
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
                      <h4 id={`audio-name-${audio.id}`} className="text-sm font-medium">{audio.name}</h4>
                      <p id={`audio-placeholder-${audio.id}`} className="text-xs text-gray-500">[{audio.placeholder}]</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        id={`audio-volume-range-${audio.id}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={audio.volume || 1}
                        onChange={(e) => updateAudioVolume(audio.id, parseFloat(e.target.value))}
                        className="w-20"
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
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
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
                          <path
                            d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                          />
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
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Delete All Button */}
      <div className="flex justify-end">
        <button
          id="delete-all-sound-effects-btn"
          onClick={deleteAllAudios}
          className="btn btn-danger text-sm"
        >
          Delete All Sound Effects
        </button>
      </div>
    </div>
  );
};

export default AudioLibrary;