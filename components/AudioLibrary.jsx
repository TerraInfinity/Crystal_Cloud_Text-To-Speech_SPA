import React, { useState, useRef, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';

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

  // Fetch audio list from server on mount
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

  // Utility function to check for duplicate name or placeholder
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

  // Utility function to generate a unique name or placeholder
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

  // Audio Upload Handler
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

  // Play Audio
  const playAudio = (audio) => {
    setSelectedAudio(audio);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audio.url;
      audioPlayerRef.current.volume = audio.volume || 1;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  // Update Audio Volume
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

  // Delete Audio
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

  // Delete All Audios
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

  // Start Editing Audio
  const startEditing = (audio) => {
    setEditingAudioId(audio.id);
    setEditName(audio.name);
    setEditPlaceholder(audio.placeholder || '');
  };

   // Save Edited Audio
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

  
  // Cancel Editing
  const cancelEdit = () => {
    setEditingAudioId(null);
    setEditName('');
    setEditPlaceholder('');
  };

  // Audio Player Cleanup
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
          className={`p-4 rounded-lg mb-4 ${
            sessionState.notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {sessionState.notification.message}
          <button
            onClick={() => sessionActions.setNotification(null)}
            className="ml-4 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <h2 className="text-xl font-medium">Sound Effects Library</h2>

      {/* Upload Section */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Upload New Sound Effect</h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-color)' }}>
            Audio File
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept="audio/*"
            className="theme-file-input block w-full text-sm"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 italic mt-1">Supported: MP3, WAV, OGG</p>
        </div>

        {showSettings && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audio Name</label>
              <input
                type="text"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                className="input-field text-sm"
                placeholder="Enter a name (optional)"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Text</label>
              <input
                type="text"
                value={placeholderText}
                onChange={(e) => setPlaceholderText(e.target.value)}
                className="input-field text-sm"
                placeholder="e.g., beep, chime (optional)"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Volume</label>
              <input
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
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
          }}
        >
          <h3 className="text-lg font-medium mb-2">Now Playing: {selectedAudio.name}</h3>
          <audio
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
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <h3 className="text-lg font-medium mb-3">Your Sound Effects</h3>
        {Object.keys(audioLibrary).length === 0 ? (
          <p className="text-gray-500">No sound effects in your library yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.values(audioLibrary).map((audio) => (
              <div
                key={audio.id}
                className="p-2 rounded-md hover:bg-gray-100"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                {editingAudioId === audio.id ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Audio Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-field text-sm"
                        placeholder="Enter audio name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Placeholder Text</label>
                      <input
                        type="text"
                        value={editPlaceholder}
                        onChange={(e) => setEditPlaceholder(e.target.value)}
                        className="input-field text-sm"
                        placeholder="e.g., beep, chime"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => saveEdit(audio.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Save
                      </button>
                      <button
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
                      <h4 className="text-sm font-medium">{audio.name}</h4>
                      <p className="text-xs text-gray-500">[{audio.placeholder}]</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={audio.volume || 1}
                        onChange={(e) => updateAudioVolume(audio.id, parseFloat(e.target.value))}
                        className="w-20"
                      />
                      <button
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