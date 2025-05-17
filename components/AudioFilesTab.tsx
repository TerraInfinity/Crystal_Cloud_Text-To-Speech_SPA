/**
 * @fileoverview Audio Files Tab component for the Text-to-Speech application.
 * Provides functionality for uploading, managing, and playing audio files, specifically sound effects.
 *
 * @requires React
 * @requires ../context/TTSContext.tsx
 * @requires ../context/types/types.ts
 */

import React, { useState, useRef, useEffect } from 'react';
import { useFileStorage } from '../context/TTSContext';
import { v4 as uuidv4 } from 'uuid';
import { AudioLibraryItem } from '../context/types/types';
import { devLog } from '../utils/logUtils';

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

/**
 * AudioFilesTab component for managing sound effect audio files.
 * Handles audio uploads, playback, and management of saved audio files with placeholders.
 *
 * @component
 * @returns {JSX.Element} The rendered AudioFilesTab component
 */
const AudioFilesTab: React.FC = () => {
  const { state, actions } = useFileStorage();
  const audioLibrary: AudioLibraryItem[] = state?.audioLibrary || [];
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  // Refs and state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioName, setAudioName] = useState<string>('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [placeholderText, setPlaceholderText] = useState<string>('');
  const [volume, setVolume] = useState<number>(1);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch audio library on mount
  useEffect(() => {
    actions.fetchAudioLibrary().catch((error: Error) => {
      devLog('Failed to fetch audio library:', error);
      setNotification({ type: 'error', message: 'Error loading audio library. Please try again.' });
    });
  }, [actions]);

  const soundEffects: AudioLibraryItem[] = audioLibrary.filter((audio) => audio.category === 'sound_effect');

  /**
   * Checks if a name or placeholder value already exists in the library.
   */
  const isDuplicate = (value: string, type: 'name' | 'placeholder', excludeId: string | null = null): boolean => {
    if (!value) return false;
    return soundEffects.some(
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
  const generateUniqueValue = (baseValue: string, type: 'name' | 'placeholder'): string => {
    if (!baseValue) return `${type}-${uuidv4().slice(0, 8)}`;
    let uniqueValue = baseValue;
    let counter = 1;
    while (isDuplicate(uniqueValue, type)) {
      uniqueValue = `${baseValue}_${counter}`;
      counter++;
    }
    return uniqueValue;
  };

  /**
   * Handles audio file upload.
   */
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setNotification({ type: 'error', message: 'No file selected.' });
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setNotification({ type: 'error', message: 'Please upload an audio file.' });
      return;
    }

    try {
      setIsProcessing(true);
      devLog('Uploading audio file:', file.name, file.type, file.size);

      let name = audioName.trim() || file.name.replace(/\.[^/.]+$/, '');
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

      const audioData: Partial<AudioLibraryItem> = {
        name: uniqueName,
        category: 'sound_effect',
        config_url: null,
        audioMetadata: {
          duration: 0, // Placeholder, updated by addToAudioLibrary
          format: file.type.split('/')[1] || 'wav',
          placeholder: uniquePlaceholder,
          volume: volume,
        },
      };

      setNotification({ type: 'info', message: 'Uploading audio file to server...' });

      await actions.addToAudioLibrary(file, audioData);
      await actions.fetchAudioLibrary();

      setAudioName('');
      setPlaceholderText('');
      setVolume(1);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setNotification({ type: 'success', message: 'Audio file uploaded successfully.' });
    } catch (error: any) {
      devLog('Error uploading audio:', error);
      setNotification({ type: 'error', message: `Error uploading audio: ${error.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Plays the selected audio file by toggling the playing audio ID.
   */
  const playAudio = (audio: AudioLibraryItem) => {
    if (playingAudioId === audio.id) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(audio.id);
    }
  };

  /**
   * Deletes an audio file after confirmation.
   */
  const deleteAudio = async (audioId: string) => {
    const audio = soundEffects.find((a) => a.id === audioId);
    if (!audio) return;

    if (window.confirm(`Are you sure you want to delete "${audio.name}"?`)) {
      try {
        await actions.removeFromAudioLibrary(audioId, { category: 'sound_effect' });
        if (playingAudioId === audioId) {
          setPlayingAudioId(null);
        }
        setNotification({ type: 'success', message: 'Audio file deleted successfully.' });
      } catch (error: any) {
        devLog('Error deleting audio:', error);
        setNotification({ type: 'error', message: `Error deleting audio: ${error.message}` });
      }
    }
  };

  /**
   * Deletes all sound effect audio files after confirmation.
   */
  const deleteAllAudio = async () => {
    if (soundEffects.length === 0) {
      setNotification({ type: 'info', message: 'No audio files to delete.' });
      return;
    }

    if (window.confirm(`Are you sure you want to delete ALL ${soundEffects.length} sound effect files? This cannot be undone.`)) {
      try {
        setIsDeletingAll(true);
        setNotification({ type: 'info', message: `Deleting ${soundEffects.length} sound effect files...` });
        
        // Stop any playing audio
        if (playingAudioId && soundEffects.some(audio => audio.id === playingAudioId)) {
          setPlayingAudioId(null);
        }
        
        // Create a complete array of audio info before we start deleting
        const audiosToDelete = soundEffects.map(audio => ({
          id: audio.id,
          category: audio.category
        }));
        
        // Process files sequentially to avoid overwhelming the system
        let deleteCount = 0;
        let errorCount = 0;
        
        // Process files one by one for more reliable operation
        for (let i = 0; i < audiosToDelete.length; i++) {
          const audio = audiosToDelete[i];
          
          try {
            // Update progress message
            setNotification({
              type: 'info',
              message: `Deleting file ${i + 1} of ${audiosToDelete.length}...`,
            });
            
            devLog(`Deleting audio ${audio.id}`, 'info');
            await actions.removeFromAudioLibrary(audio.id, { category: 'sound_effect' });
            deleteCount++;
            
            // Small delay between deletions
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error: any) {
            console.error(`Error deleting audio ${audio.id}:`, error);
            devLog(`Error deleting audio ${audio.id}: ${error.message}`, 'error');
            errorCount++;
          }
          
          // Refresh periodically
          if (i % 5 === 0 || i === audiosToDelete.length - 1) {
            try {
              await actions.fetchAudioLibrary();
            } catch (refreshError) {
              console.warn("Failed to refresh during deletion");
            }
          }
        }
        
        // Final refresh to update UI
        try {
          await actions.fetchAudioLibrary();
        } catch (refreshError) {
          console.warn("Failed final refresh:", refreshError);
        }
        
        // Add a delayed final refresh to ensure UI is updated after backend has fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Do a proper refresh sequence
        try {
          // First refresh
          await actions.fetchAudioLibrary();
          
          // Wait a bit longer and try again to ensure latest state
          await new Promise(resolve => setTimeout(resolve, 1000));
          await actions.fetchAudioLibrary();
        } catch (finalError) {
          console.warn("Failed additional refresh:", finalError);
        }
        
        if (errorCount > 0) {
          setNotification({
            type: 'info',
            message: `Deleted ${deleteCount} files. ${errorCount} files could not be deleted.`,
          });
        } else {
          setNotification({
            type: 'success',
            message: `Successfully deleted all ${deleteCount} sound effect files.`,
          });
        }
      } catch (error: any) {
        devLog('Error during bulk deletion:', error);
        setNotification({
          type: 'error',
          message: `Error deleting files: ${error.message}`,
        });
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  /**
   * Updates audio metadata (placeholder or volume).
   */
  const updateAudioMetadata = async (audioId: string, updatedData: Partial<AudioLibraryItem>) => {
    try {
      const audio = soundEffects.find((a) => a.id === audioId);
      if (!audio || !audio.audioMetadata) return;

      const newAudioMetadata = {
        duration: audio.audioMetadata.duration,
        format: audio.audioMetadata.format,
        placeholder: updatedData.audioMetadata?.placeholder ?? audio.audioMetadata.placeholder,
        volume: updatedData.audioMetadata?.volume ?? audio.audioMetadata.volume,
      };

      const newData: Partial<AudioLibraryItem> = {
        audioMetadata: newAudioMetadata,
      };

      await actions.updateAudio(audioId, newData);
      setNotification({ type: 'success', message: 'Audio metadata updated successfully.' });
    } catch (error: any) {
      devLog('Error updating audio:', error);
      setNotification({ type: 'error', message: `Error updating audio: ${error.message}` });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-medium mb-4">Audio Files</h2>
      {notification && (
        <div
          id="notification-container"
          className={`p-4 rounded-lg mb-4 ${
            notification.type === 'error'
              ? 'bg-red-100 text-red-700'
              : notification.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium mb-3">Upload New Audio</h3>
        <div className="mb-4">
          <label htmlFor="audio-name" className="block text-sm font-medium text-gray-700 mb-1">
            Audio Name
          </label>
          <input
            id="audio-name"
            type="text"
            value={audioName}
            onChange={(e) => setAudioName(e.target.value)}
            className="input-field"
            placeholder="Enter a name for this audio"
            disabled={isProcessing}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="placeholder-text" className="block text-sm font-medium text-gray-700 mb-1">
            Placeholder Text
          </label>
          <input
            id="placeholder-text"
            type="text"
            value={placeholderText}
            onChange={(e) => setPlaceholderText(e.target.value)}
            className="input-field"
            placeholder="e.g., beep, chime (used like [sound:placeholder])"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 mt-1">
            This placeholder will be used in text like [sound:placeholder]
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="default-volume" className="block text-sm font-medium text-gray-700 mb-1">
            Default Volume
          </label>
          <input
            id="default-volume"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 mt-1">
            Set the default playback volume for this audio file
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="audio-file" className="block text-sm font-medium text-gray-700 mb-1">
            Audio File
          </label>
          <input
            id="audio-file"
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept="audio/*"
            className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100"
            disabled={isProcessing}
          />
        </div>
        <p className="text-xs text-gray-500 italic">
          Supported file types: MP3, WAV, OGG, and other browser-supported audio formats
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">Your Audio Files</h3>
          {soundEffects.length > 0 && (
            <button
              onClick={deleteAllAudio}
              disabled={isDeletingAll}
              className={`px-3 py-1 rounded-md text-white ${
                isDeletingAll ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isDeletingAll ? 'Deleting...' : 'Delete All'}
            </button>
          )}
        </div>
        {soundEffects.length === 0 ? (
          <p className="text-gray-500">No audio files in your library yet.</p>
        ) : (
          <div className="space-y-3">
            {soundEffects.map((audio) => (
              <div
                key={audio.id}
                id={`audio-item-${audio.id}`}
                className="p-3 bg-gray-50 rounded-md hover:bg-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{audio.name}</h4>
                    <p className="text-xs text-gray-500">
                      Use as: [sound:{audio.audioMetadata?.placeholder || audio.name.toLowerCase().replace(/\s+/g, '_')}]
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => playAudio(audio)}
                      className="p-2 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                      id={`play-audio-btn-${audio.id}`}
                      title={playingAudioId === audio.id ? 'Stop' : 'Play'}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        {playingAudioId === audio.id ? (
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7h4v6H8V7z"
                            clipRule="evenodd"
                          />
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
                      onClick={() => deleteAudio(audio.id)}
                      className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100"
                      title="Delete"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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
                      src={`${state.settings?.storageConfig?.serverUrl}${audio.audio_url}`}
                      type={audio.type}
                      id={`audio-source-${audio.id}`}
                    />
                    Your browser does not support the audio element.
                  </audio>
                )}
                <div className="space-y-3 mt-2">
                  <div>
                    <label
                      htmlFor={`placeholder-${audio.id}`}
                      className="block text-sm text-gray-600 mb-1"
                    >
                      Placeholder Text
                    </label>
                    <input
                      id={`placeholder-${audio.id}`}
                      type="text"
                      value={audio.audioMetadata?.placeholder || ''}
                      onChange={(e) => {
                        const newPlaceholder = e.target.value.trim();
                        if (newPlaceholder && isDuplicate(newPlaceholder, 'placeholder', audio.id)) {
                          setNotification({
                            type: 'error',
                            message: `Placeholder '${newPlaceholder}' is already in use.`,
                          });
                          return;
                        }
                        updateAudioMetadata(audio.id, {
                          audioMetadata: {
                            duration: audio.audioMetadata?.duration ?? 0,
                            format: audio.audioMetadata?.format ?? 'wav',
                            placeholder: newPlaceholder,
                            volume: audio.audioMetadata?.volume ?? 1,
                          },
                        });
                      }}
                      className="input-field"
                      placeholder="e.g., beep, laugh"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Used in text as: [sound:
                      {audio.audioMetadata?.placeholder || audio.name.toLowerCase().replace(/\s+/g, '_')}]
                    </p>
                  </div>
                  <div>
                    <label htmlFor={`volume-${audio.id}`} className="block text-sm text-gray-600 mb-1">
                      Volume
                    </label>
                    <input
                      id={`volume-${audio.id}`}
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={audio.audioMetadata?.volume ?? 1}
                      onChange={(e) =>
                        updateAudioMetadata(audio.id, {
                          audioMetadata: {
                            duration: audio.audioMetadata?.duration ?? 0,
                            format: audio.audioMetadata?.format ?? 'wav',
                            placeholder: audio.audioMetadata?.placeholder,
                            volume: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioFilesTab;