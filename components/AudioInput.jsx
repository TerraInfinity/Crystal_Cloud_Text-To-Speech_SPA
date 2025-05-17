import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTTSContext, useFileStorage } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import Link from 'next/link';
import { devLog, devError } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

const AudioInput = () => {
  const { state } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { state: fileStorageState, actions: fileStorageActions } = useFileStorage();
  const { addNotification } = useNotification();

  const sections = sessionState?.sections || [];
  const [audioSource, setAudioSource] = useState('library');
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [audioCategory, setAudioCategory] = useState('sound_effect');
  const [playingAudio, setPlayingAudio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const serverUrl = state.settings.storageConfig.serverUrl || 'http://localhost:5000';
  
  // Audio categories for dropdown selection
  const audioCategories = [
    { value: 'sound_effect', label: 'Sound Effects' },
    { value: 'uploaded_audio', label: 'Uploaded Audio' },
    { value: 'merged_audio', label: 'Merged Audio' },
    { value: 'generated_section_audio', label: 'Generated Audio' },
    { value: 'music', label: 'Music' },
    { value: 'binaural', label: 'Binaural' },
  ];

  // Compute audio library
  const filteredAudioLibrary = useMemo(() => {
    return (fileStorageState.audioLibrary || []).filter(
      (audio) => audio.category === audioCategory
    );
  }, [fileStorageState.audioLibrary, audioCategory]);

  // Determine if we have valid audio to play
  const hasValidAudio = useMemo(() => {
    if (audioSource === 'library') {
      const selectedAudio = fileStorageState.audioLibrary.find(a => a.id === selectedAudioId);
      return !!selectedAudioId && !!selectedAudio?.audio_url;
    } else {
      return !!uploadedAudio && !!uploadedAudio.url;
    }
  }, [audioSource, selectedAudioId, fileStorageState.audioLibrary, uploadedAudio]);

  // Utility functions
  const normalizeUrl = (url, isLibraryAudio) => {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    
    let normalizedUrl = url;
    if (normalizedUrl.includes('://') || normalizedUrl.startsWith('http')) {
      try {
        const urlObj = new URL(normalizedUrl.includes('://') ? normalizedUrl : `http://${normalizedUrl}`);
        normalizedUrl = urlObj.pathname;
      } catch (e) {
        return normalizedUrl;
      }
    }
    const prefix = isLibraryAudio ? '/audio/' : '/Uploads/';
    normalizedUrl = normalizedUrl.startsWith(prefix) ? normalizedUrl : `${prefix}${normalizedUrl.replace(/^\//,'')}`;   
    return normalizedUrl;
  };

  const getFullAudioUrl = (url, source) => {
    if (!url) return '';
    if (source === 'upload' && url.startsWith('blob:')) return url;
    
    const normalizedUrl = normalizeUrl(url, source === 'library');
    if (!normalizedUrl) return '';
    
    if (source === 'library') {
      return `${serverUrl}${normalizedUrl}`;
    }
    return normalizedUrl;
  };

  // Event handlers
  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      addNotification({ type: 'error', message: 'Please upload an audio file' });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create blob URL for preview
      const audioUrl = URL.createObjectURL(file);
      
      setUploadedAudio({
        name: file.name,
        url: audioUrl,
        file: file,
        type: file.type,
        category: audioCategory,
      });
      
      setAudioSource('upload');
      setPlayingAudio(false);
      
      // Save temporary audio data for potential use in sections
      sessionActions.setGeneratedAudio('temp_upload', {
        url: audioUrl,
        source: 'upload',
        name: file.name,
        type: file.type,
        format: file.type.split('/')[1] || 'wav'
      });
      
      addNotification({ type: 'success', message: `Audio file "${file.name}" ready to use` });
    } catch (error) {
      devError('Error uploading audio:', error);
      addNotification({ type: 'error', message: `Error uploading audio: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const saveToLibrary = async () => {
    if (!uploadedAudio?.file) {
      addNotification({ type: 'error', message: 'No audio file to save' });
      return;
    }
    
    try {
      setIsUploading(true);
      
      const audioData = {
        name: uploadedAudio.name,
        category: audioCategory,
        config_url: null,
        audioMetadata: {
          duration: 0,
          format: uploadedAudio.file.name.split('.').pop().toLowerCase(),
          placeholder: uploadedAudio.name.toLowerCase().replace(/\s+/g, '_'),
          volume: 1,
        },
      };
      
      const addedAudio = await fileStorageActions.addToAudioLibrary(uploadedAudio.file, audioData);
      await fileStorageActions.fetchAudioLibrary();
      
      // Switch to library and select the newly added audio
      setAudioSource('library');
      setSelectedAudioId(addedAudio.id);
      setAudioCategory(audioCategory);
      
      // Clean up upload
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      addNotification({ type: 'success', message: `Audio saved to library as "${addedAudio.name}"` });
    } catch (error) {
      devError('Error saving to library:', error);
      addNotification({ type: 'error', message: `Error saving to library: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const createAudioSection = () => {
    if (audioSource === 'library' && !selectedAudioId) {
      addNotification({ type: 'error', message: 'Please select an audio file from the library' });
      return;
    }
    if (audioSource === 'upload' && !uploadedAudio) {
      addNotification({ type: 'error', message: 'Please upload an audio file' });
      return;
    }
    
    // Create new section with audio
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Audio Section ${sections.length + 1}`,
      type: 'audio-only',
      audioId: audioSource === 'library' ? selectedAudioId : null,
      audioSource,
      category: audioCategory,
    };
    
    let audioData;
    if (audioSource === 'library') {
      const audio = fileStorageState.audioLibrary.find(a => a.id === selectedAudioId);
      if (!audio) {
        addNotification({ type: 'error', message: 'Selected audio not found' });
        return;
      }
      
      const normalizedUrl = normalizeUrl(audio.audio_url, true);
      audioData = {
        url: normalizedUrl,
        source: 'library',
        name: audio.name,
        type: audio.type || 'audio/mpeg',
        format: audio.audioMetadata?.format || (audio.type ? audio.type.split('/')[1] : 'mp3'),
      };
    } else {
      audioData = {
        url: uploadedAudio.url,
        source: 'upload',
        name: uploadedAudio.name,
        type: uploadedAudio.type || 'audio/mpeg',
        format: uploadedAudio.type ? uploadedAudio.type.split('/')[1] : 'mp3',
      };
    }
    
    // Add the section and audio data
    sessionActions.addSection(newSection);
    sessionActions.setGeneratedAudio(newSection.id, audioData);
    
    // Save selection for reuse
    sessionActions.setLastAudioInputSelection({
      audioId: selectedAudioId,
      audioCategory: audioCategory,
      uploadedAudio: uploadedAudio,
    });
    
    addNotification({
      type: 'success',
      message: `New section created from audio "${audioData.name}"`,
    });
    
    // Reset state after creating section
    setPlayingAudio(false);
  };

  const togglePlayAudio = () => {
    if (!hasValidAudio) {
      addNotification({ 
        type: 'error', 
        message: `No ${audioSource === 'library' ? 'selected' : 'uploaded'} audio to play` 
      });
      return;
    }
    
    if (playingAudio) {
      setPlayingAudio(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setPlayingAudio(true);
    }
  };

  const handleLibrarySelection = (e) => {
    const audioId = e.target.value;
    if (!audioId) {
      setSelectedAudioId('');
      setPlayingAudio(false);
      return;
    }
    
    const audio = fileStorageState.audioLibrary.find(a => a.id === audioId);
    if (audio?.audio_url) {
      setSelectedAudioId(audioId);
      setPlayingAudio(false);
      
      // Save audio info for section
      const normalizedUrl = normalizeUrl(audio.audio_url, true);
      sessionActions.setGeneratedAudio('temp_library', {
        url: normalizedUrl,
        source: 'library',
        name: audio.name,
        type: audio.type || 'audio/mpeg',
        format: audio.audioMetadata?.format || (audio.type ? audio.type.split('/')[1] : 'mp3'),
      });
      
      // Save selection for next time
      sessionActions.setLastAudioInputSelection({
        audioId: audioId,
        audioCategory: audio.category || audioCategory,
        uploadedAudio: null,
      });
      
      // Update category if needed
      if (audio.category && audio.category !== audioCategory) {
        setAudioCategory(audio.category);
      }
      
      addNotification({ type: 'success', message: `Selected audio: ${audio.name}` });
    } else {
      setSelectedAudioId('');
      setPlayingAudio(false);
      addNotification({ type: 'error', message: 'Selected audio is invalid or missing a URL' });
    }
  };

  // Source radio button handlers
  const handleLibraryRadioChange = () => {
    setAudioSource('library');
    setPlayingAudio(false);
  };

  const handleUploadRadioChange = () => {
    setAudioSource('upload');
    setPlayingAudio(false);
  };

  // Restore previous selection if available
  useEffect(() => {
    const lastSelection = sessionState.lastAudioInputSelection;
    if (!lastSelection) return;
    
    if (lastSelection.audioId) {
      const audio = fileStorageState.audioLibrary.find(a => a.id === lastSelection.audioId);
      if (audio?.audio_url) {
        setAudioSource('library');
        setSelectedAudioId(lastSelection.audioId);
        setAudioCategory(lastSelection.audioCategory || audio.category || 'sound_effect');
      }
    } else if (lastSelection.uploadedAudio) {
      setAudioSource('upload');
      setUploadedAudio(lastSelection.uploadedAudio);
    }
  }, [sessionState.lastAudioInputSelection, fileStorageState.audioLibrary]);

  return (
    <div className="audio-input-container bg-[var(--card-bg)] rounded-lg p-4 mb-4 border border-[var(--card-border)]">
      <h3 className="text-lg font-medium mb-3">Add Audio Section</h3>
      
      {/* Audio Source Selection */}
      <div className="flex space-x-4 mb-4" role="radiogroup" aria-labelledby="audio-source-label">
        <span id="audio-source-label" className="sr-only">Select Audio Source</span>
        
        <label className="flex items-center cursor-pointer">
          <input
            id="library-radio"
            type="radio"
            name="audioSource"
            value="library"
            checked={audioSource === 'library'}
            onChange={handleLibraryRadioChange}
            className="mr-2 h-4 w-4"
          />
          <span>Select from Library</span>
        </label>
        
        <label className="flex items-center cursor-pointer">
          <input
            id="upload-radio"
            type="radio"
            name="audioSource"
            value="upload"
            checked={audioSource === 'upload'}
            onChange={handleUploadRadioChange}
            className="mr-2 h-4 w-4"
          />
          <span>Upload New Audio</span>
        </label>
      </div>
      
      {/* Library Selection */}
      {audioSource === 'library' && (
        <div className="mb-4">
          {fileStorageState.audioLibrary.length === 0 ? (
            <div className="text-center py-6 bg-[var(--bg-secondary)] rounded-lg">
              <p className="mb-4 text-[var(--text-secondary)]">
                No audio files available in your library.
              </p>
              <Link href="/audio" className="bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors">
                Go to Audio Library
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center mb-2 space-x-2">
                <label htmlFor="audio-category-select" className="text-sm whitespace-nowrap">
                  Audio type:
                </label>
                <select
                  id="audio-category-select"
                  value={audioCategory}
                  onChange={(e) => setAudioCategory(e.target.value)}
                  className="flex-grow select-field py-1 px-2 text-sm rounded-md"
                >
                  {audioCategories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <select
                id="audio-library-select"
                value={selectedAudioId}
                onChange={handleLibrarySelection}
                className="w-full select-field py-2 px-3 rounded-md mb-2"
              >
                <option value="">Select an audio file...</option>
                {filteredAudioLibrary.map(audio => (
                  <option key={audio.id} value={audio.id}>
                    {audio.name}
                  </option>
                ))}
              </select>
              
              {filteredAudioLibrary.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  No audio files in the selected category.
                </p>
              )}
              
              {selectedAudioId && (
                <div className="mt-2">
                  {playingAudio ? (
                    <audio
                      ref={audioRef}
                      controls
                      autoPlay
                      className="w-full"
                      onEnded={() => setPlayingAudio(false)}
                      onError={() => {
                        setPlayingAudio(false);
                        addNotification({
                          type: 'error',
                          message: 'Failed to play audio. The file might be corrupted or unavailable.',
                        });
                      }}
                    >
                      <source 
                        src={getFullAudioUrl(
                          fileStorageState.audioLibrary.find(a => a.id === selectedAudioId)?.audio_url || '',
                          'library'
                        )}
                        type={fileStorageState.audioLibrary.find(a => a.id === selectedAudioId)?.type || 'audio/wav'}
                      />
                      Your browser does not support the audio element.
                    </audio>
                  ) : (
                    <button
                      onClick={togglePlayAudio}
                      className="inline-flex items-center text-[var(--accent-color)] hover:text-opacity-80 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Preview Selected Audio
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Upload Interface */}
      {audioSource === 'upload' && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <label htmlFor="audio-category-upload" className="text-sm whitespace-nowrap">
              Audio category:
            </label>
            <select
              id="audio-category-upload"
              value={audioCategory}
              onChange={(e) => setAudioCategory(e.target.value)}
              className="flex-grow select-field py-1 px-2 text-sm rounded-md"
              disabled={isUploading}
            >
              {audioCategories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2 mb-2">
            <label htmlFor="audio-upload-input" className="cursor-pointer bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Choose File
              <input
                id="audio-upload-input"
                type="file"
                ref={fileInputRef}
                onChange={handleAudioUpload}
                accept="audio/*"
                className="hidden"
                disabled={isUploading}
              />
            </label>
            
            {uploadedAudio?.file && (
              <button
                onClick={saveToLibrary}
                disabled={isUploading}
                className="bg-[var(--secondary-bg)] text-[var(--text-color)] py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium inline-flex items-center"
                title="Save to library for reuse"
              >
                {isUploading ? (
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                )}
                Save to Library
              </button>
            )}
          </div>
          
          {uploadedAudio && (
            <div className="mt-2">
              <p className="text-sm mb-2 text-[var(--text-secondary)]">
                Selected file: {uploadedAudio.name}
              </p>
              
              {playingAudio ? (
                <audio
                  ref={audioRef}
                  controls
                  autoPlay
                  className="w-full"
                  onEnded={() => setPlayingAudio(false)}
                  onError={() => {
                    setPlayingAudio(false);
                    addNotification({
                      type: 'error',
                      message: 'Failed to play audio. The file might be corrupted.',
                    });
                  }}
                >
                  <source src={uploadedAudio.url} type={uploadedAudio.type || 'audio/wav'} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <button
                  onClick={togglePlayAudio}
                  className="inline-flex items-center text-[var(--accent-color)] hover:text-opacity-80 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Preview Uploaded Audio
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="mt-4 flex justify-between">
        <Link href="/audio" className="inline-flex items-center bg-[var(--secondary-bg)] text-[var(--text-color)] py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
          </svg>
          Manage Audio Library
        </Link>
        
        <button
          id="create-audio-section-button"
          onClick={createAudioSection}
          className="inline-flex items-center bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
          disabled={isUploading || (audioSource === 'library' && !selectedAudioId) || (audioSource === 'upload' && !uploadedAudio)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create Audio Section
        </button>
      </div>
    </div>
  );
};

export default AudioInput;