/**
 * @fileoverview Audio-only section card component for the TTS application.
 * Handles the rendering and functionality of audio-only sections within
 * the SectionCard component, providing audio selection and playback.
 * 
 * @requires React
 * @requires ../context/TTSContext.tsx
 * @requires ../context/TTSSessionContext.tsx
 * @requires ../context/storage.ts
 * @requires ../utils/logUtils.ts
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTTSContext, useFileStorage } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { saveToStorage } from '../context/storage';
import { devLog, devWarn, devError } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

/**
 * Validates an audio URL to ensure it's in a proper format
 * @param {string} url - The URL to validate
 * @returns {boolean} Whether the URL is valid
 */
const isValidAudioUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Allow blob and data URLs
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  
  // Validate URL format and ensure it's HTTP/HTTPS
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * SectionCardAudio component for handling audio-only section content.
 * Provides interfaces for selecting audio from library or uploading new audio,
 * as well as playing back selected audio files.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.section - The section data
 * @returns {React.ReactElement} The rendered SectionCardAudio component
 */
const SectionCardAudio = ({ section }: { section: any }): React.ReactElement => {
  const { state, actions } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { state: fileStorageState, actions: fileStorageActions } = useFileStorage();
  const { addNotification } = useNotification();

  // Get audio data from session state
  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  // Local state for UI
  const [audioSource, setAudioSource] = useState(section.audioSource || (hasAudio && audioData.source) || 'library');
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioCategory, setAudioCategory] = useState(section.category || 'sound_effect');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedAudioPreview, setUploadedAudioPreview] = useState<{ url: string, name: string, type: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Server URL for audio files
  const serverUrl = state.settings.storageConfig.serverUrl || 'http://localhost:5000';

  // Audio categories for selection
  const audioCategories = useMemo(() => [
    { value: 'sound_effect', label: 'Sound Effects' },
    { value: 'uploaded_audio', label: 'Uploaded Audio' },
    { value: 'merged_audio', label: 'Merged Audio' },
    { value: 'generated_section_audio', label: 'Generated Audio' },
    { value: 'music', label: 'Music' },
    { value: 'binaural', label: 'Binaural' },
  ], []);

  // Filtered audio library based on selected category
  const filteredAudioLibrary = useMemo(() => {
    return fileStorageState.audioLibrary.filter(audio => audio.category === audioCategory);
  }, [fileStorageState.audioLibrary, audioCategory]);

  /**
   * Normalizes a URL to a relative path
   */
  const normalizeUrl = (url: string, isLibraryAudio: boolean): string => {
    if (!url) return '';
    
    // For blob URLs and data URLs, return as is
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    
    let normalizedUrl = url;
    
    // Extract pathname if it's a full URL
    if (normalizedUrl.includes('://') || normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(normalizedUrl.includes('://') ? normalizedUrl : `http://${normalizedUrl}`);
        normalizedUrl = urlObj.pathname;
      } catch (e) {
        return normalizedUrl;
      }
    }
    
    // Add proper prefix based on audio source
    const prefix = isLibraryAudio ? '/audio/' : '/Uploads/';
    normalizedUrl = normalizedUrl.startsWith(prefix) ? normalizedUrl : `${prefix}${normalizedUrl.replace(/^\//,'')}`;
    
    return normalizedUrl;
  };

  /**
   * Validates and constructs the full audio URL
   */
  const getFullAudioUrl = (url: string, source: string): string => {
    if (!url) return '';
    
    // For blob URLs and data URLs, return as is
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    
    // For http URLs, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For all other URLs (relative paths), add server URL
    const normalizedUrl = normalizeUrl(url, source === 'library');
    return normalizedUrl ? `${serverUrl}${normalizedUrl}` : '';
  };

  /**
   * Syncs audio category with selected audio on component mount and when audioId changes
   */
  useEffect(() => {
    if (audioSource === 'library' && section.audioId) {
      const selectedAudio = fileStorageState.audioLibrary.find(a => a.id === section.audioId);
      if (selectedAudio?.category && selectedAudio.category !== audioCategory) {
        setAudioCategory(selectedAudio.category);
      }
    }
  }, [section.audioId, fileStorageState.audioLibrary, audioCategory, audioSource]);

  /**
   * Hydrates audioData if missing but section.audioId is set
   */
  useEffect(() => {
    if (audioSource === 'library' && section.audioId && (!audioData || !audioData.url)) {
      const audio = fileStorageState.audioLibrary.find(a => a.id === section.audioId);
      if (audio?.audio_url) {
        // First normalize the URL
        const normalizedUrl = normalizeUrl(audio.audio_url, true);
        
        // Then get the full URL
        const fullAudioUrl = getFullAudioUrl(normalizedUrl, 'library');
        
        // Log the URL transformation for debugging
        devLog('Audio URL transformation in hydration:', { 
          original: audio.audio_url,
          normalized: normalizedUrl,
          full: fullAudioUrl
        });
        
        // Update both the generatedTTSAudios and the section
        sessionActions.setGeneratedAudio(section.id, {
          url: normalizedUrl, // Keep using normalized URL for generatedTTSAudios
          source: 'library',
          name: audio.name,
          type: audio.type || 'audio/mpeg',
          format: audio.audioMetadata?.format || (audio.type ? audio.type.split('/')[1] : 'wav'),
        });
        
        // Also update the section directly with the full URL
        sessionActions.updateSection({
          ...section,
          audioUrl: fullAudioUrl // Store the FULL URL directly in the section
        });
      }
    }
  }, [audioSource, section.audioId, audioData, fileStorageState.audioLibrary, section.id, sessionActions]);

  /**
   * Verify audioUrl in session storage
   */
  useEffect(() => {
    const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
    const storedSection = storedState.sections?.find(s => s.id === section.id);
    devLog('Section in session storage:', { 
      id: section.id, 
      audioUrl: storedSection?.audioUrl,
      isValidUrl: storedSection?.audioUrl ? isValidAudioUrl(storedSection.audioUrl) : false
    });
  }, [section.id]);

  /**
   * Sets up audio element for playback
   */
  useEffect(() => {
    if (playingAudio) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      let audioUrl = '';
      let isValidUrl = false;
      
      if (audioSource === 'upload' && uploadedAudioPreview) {
        audioUrl = uploadedAudioPreview.url;
        isValidUrl = isValidAudioUrl(audioUrl);
        devLog('Playing uploaded audio preview:', audioUrl, { isValidUrl });
      } else if (section.audioUrl) {
        audioUrl = getFullAudioUrl(section.audioUrl, section.audioSource || audioSource);
        isValidUrl = isValidAudioUrl(audioUrl);
        devLog('Playing section.audioUrl:', audioUrl, { isValidUrl });
      } else if (audioData?.url) {
        audioUrl = getFullAudioUrl(audioData.url, audioData.source || audioSource);
        isValidUrl = isValidAudioUrl(audioUrl);
        devLog('Falling back to generatedTTSAudios:', audioUrl, { isValidUrl });
      }
      
      if (!isValidUrl && audioUrl) {
        devWarn(`Invalid audioUrl for section ${section.id}: ${audioUrl}`);
      }
      
      if (audioUrl && isValidUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setPlayingAudio(false);
          devLog('Playback ended for section:', section.id);
        };
        audioRef.current.onerror = (e) => {
          setPlayingAudio(false);
          devError(`Audio load error for section ${section.id}: ${audioUrl}`, e);
          addNotification({
            type: 'error',
            message: 'Failed to play audio. The file might be corrupted or unavailable.',
          });
        };
        
        audioRef.current.play().catch(error => {
          devWarn('Error playing audio:', error);
          setPlayingAudio(false);
          addNotification({
            type: 'error',
            message: 'Failed to play audio. Please try again.',
          });
        });
      } else {
        devWarn(`No valid audio URL for playback in section ${section.id}. URL: ${audioUrl}, Valid: ${isValidUrl}`);
        setPlayingAudio(false);
        addNotification({
          type: 'error',
          message: 'No valid audio available to play.',
        });
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [playingAudio, audioSource, uploadedAudioPreview, section.audioUrl, section.audioSource, audioData, section.id, addNotification]);

  /**
   * Handles library audio selection
   */
  const handleLibrarySelection = (e) => {
    const audioId = e.target.value;
    
    // If no audio selected, clear the section
    if (!audioId) {
      sessionActions.updateSection({ ...section, audioId: null, audioSource: 'library', audioUrl: null });
      sessionActions.setGeneratedAudio(section.id, null);
      setPlayingAudio(false);
      return;
    }
    
    // Find the selected audio in the library
    const audio = fileStorageState.audioLibrary.find(a => a.id === audioId);
    
    if (audio?.audio_url) {
      // First normalize the URL
      const normalizedUrl = normalizeUrl(audio.audio_url, true);
      
      // Then get the full URL (with server URL prepended if needed)
      const fullAudioUrl = getFullAudioUrl(normalizedUrl, 'library');
      
      // Log the URL transformation for debugging
      devLog('Audio URL transformation:', { 
        original: audio.audio_url,
        normalized: normalizedUrl,
        full: fullAudioUrl
      });
      
      // Update section with the selected audio - store FULL URL
      sessionActions.updateSection({ 
        ...section, 
        type: 'audio-only',  // Make sure type is explicitly set
        audioId, 
        audioSource: 'library',
        audioUrl: fullAudioUrl // Store the FULL URL directly in the section
      });
      sessionActions.setGeneratedAudio(section.id, {
        url: normalizedUrl, // Keep using normalized URL for generatedTTSAudios
        source: 'library',
        name: audio.name,
        type: audio.type || 'audio/mpeg',
        format: audio.audioMetadata?.format || (audio.type ? audio.type.split('/')[1] : 'wav'),
      });
      
      addNotification({
        type: 'success',
        message: `Selected audio: ${audio.name}`,
      });
    } else {
      addNotification({
        type: 'error',
        message: 'Selected audio is invalid or missing a URL',
      });
    }
    
    setPlayingAudio(false);
  };

  /**
   * Handles file selection for upload
   */
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      addNotification({
        type: 'error',
        message: 'Please upload an audio file',
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Create object URL for preview - blob URLs are already full URLs
      const audioUrl = URL.createObjectURL(file);
      
      // Log the URL for debugging
      devLog('Created blob URL for uploaded audio:', audioUrl);
      
      setCurrentFile(file);
      setUploadedAudioPreview({ url: audioUrl, name: file.name, type: file.type });
      
      // Update section with uploaded audio
      sessionActions.updateSection({ 
        ...section, 
        type: 'audio-only',  // Make sure type is explicitly set
        audioId: null, 
        audioSource: 'upload',
        audioUrl: audioUrl // Blob URLs are already full URLs, no need to modify
      });
      sessionActions.setGeneratedAudio(section.id, {
        url: audioUrl,
        source: 'upload',
        name: file.name,
        type: file.type,
        format: file.type.split('/')[1] || 'wav',
      });
      
      setAudioSource('upload');
      
      addNotification({
        type: 'success',
        message: `Audio file "${file.name}" ready to use`,
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: `Error uploading audio: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Saves uploaded audio to the library
   */
  const saveToLibrary = async () => {
    if (!currentFile || !audioData?.url) {
      addNotification({
        type: 'error',
        message: 'No audio file to save',
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Prepare data for library storage
      const fileName = currentFile.name.replace(/\.[^/.]+$/, '');
      const audioDataForLibrary = {
        name: fileName,
        category: 'uploaded_audio',
        audioMetadata: {
          placeholder: fileName.toLowerCase().replace(/\s+/g, '_'),
          volume: 1,
          duration: 0,
          format: currentFile.type.split('/')[1] || 'wav',
        },
      };
      
      // Add to audio library
      const addedAudio = await fileStorageActions.addToAudioLibrary(currentFile, audioDataForLibrary);
      
      // First normalize the URL
      const normalizedAudioUrl = normalizeUrl(addedAudio.audio_url, true);
      
      // Then get the full URL (with server URL prepended if needed)
      const fullAudioUrl = getFullAudioUrl(normalizedAudioUrl, 'library');
      
      // Log the URL transformation for debugging
      devLog('Audio URL transformation in saveToLibrary:', { 
        original: addedAudio.audio_url,
        normalized: normalizedAudioUrl,
        full: fullAudioUrl
      });
      
      // Update section to use the library audio
      setAudioSource('library');
      setAudioCategory('uploaded_audio');
      sessionActions.updateSection({
        ...section,
        type: 'audio-only',  // Make sure type is explicitly set
        audioId: addedAudio.id,
        audioSource: 'library',
        audioUrl: fullAudioUrl // Store the FULL URL directly in the section
      });
      sessionActions.setGeneratedAudio(section.id, {
        url: normalizedAudioUrl, // Keep using normalized URL for generatedTTSAudios
        source: 'library',
        name: addedAudio.name,
        type: addedAudio.type || 'audio/mpeg',
        format: addedAudio.audioMetadata?.format || 'wav',
      });
      
      // Clear upload state
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCurrentFile(null);
      setUploadedAudioPreview(null);
      
      addNotification({
        type: 'success',
        message: `Audio saved to library as "${fileName}"`,
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: `Error saving to library: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Updates audio source to 'library'
   */
  const handleLibraryRadioChange = () => {
    setAudioSource('library');
    if (playingAudio) setPlayingAudio(false);
  };

  /**
   * Updates audio source to 'upload'
   */
  const handleUploadRadioChange = () => {
    setAudioSource('upload');
    if (playingAudio) setPlayingAudio(false);
  };

  /**
   * Toggles audio playback
   */
  const togglePlayAudio = () => {
    let audioUrl = '';
    let isValidUrl = false;
    
    if (audioSource === 'upload' && uploadedAudioPreview) {
      audioUrl = uploadedAudioPreview.url;
      isValidUrl = isValidAudioUrl(audioUrl);
    } else if (section.audioUrl) {
      audioUrl = getFullAudioUrl(section.audioUrl, section.audioSource || audioSource);
      isValidUrl = isValidAudioUrl(audioUrl);
    } else if (audioData?.url) {
      audioUrl = getFullAudioUrl(audioData.url, audioData.source || audioSource);
      isValidUrl = isValidAudioUrl(audioUrl);
    }
    
    const canPlay = !!audioUrl && isValidUrl;
    
    if (!canPlay) {
      addNotification({
        type: 'error',
        message: `No valid audio ${audioSource === 'library' ? 'selected' : 'uploaded'} to play.`,
      });
      devWarn(`No valid audio to play for section ${section.id}. URL: ${audioUrl}, Valid: ${isValidUrl}`);
      return;
    }
    
    devLog('Toggling playback for section:', section.id, {
      audioUrl,
      source: audioSource === 'upload' && uploadedAudioPreview ? 'uploadedAudioPreview' :
              section.audioUrl ? 'section.audioUrl' : 'generatedTTSAudios',
      isValidUrl
    });
    
    setPlayingAudio(!playingAudio);
  };

  // Calculate if we have valid audio to show play button
  const hasValidAudio = useMemo(() => {
    if (audioSource === 'library') {
      return !!section.audioId && (
        (section.audioUrl && isValidAudioUrl(section.audioUrl)) || 
        (audioData?.url && isValidAudioUrl(getFullAudioUrl(audioData.url, audioData.source || audioSource)))
      );
    } else {
      return (
        (audioData?.url && audioData.source === 'upload' && isValidAudioUrl(getFullAudioUrl(audioData.url, audioData.source))) ||
        (uploadedAudioPreview?.url && isValidAudioUrl(uploadedAudioPreview.url)) ||
        (section.audioUrl && isValidAudioUrl(section.audioUrl))
      );
    }
  }, [audioSource, section.audioId, section.audioUrl, audioData, uploadedAudioPreview, section.audioSource]);

  /**
   * Verify audioUrl in session storage
   */
  useEffect(() => {
    const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
    devLog('Stored sections in session storage:', storedState.sections?.map(s => ({
      id: s.id,
      audioUrl: s.audioUrl
    })));
  }, [section.id]);

  return (
    <div className="audio-section-card p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
      <p className="text-[var(--text-color)] mb-4">
        This is an audio-only section. Choose how to provide the audio:
      </p>
      
      {/* Audio Source Selection */}
      <div className="flex space-x-4 mb-4" role="radiogroup" aria-labelledby="audio-source-label">
        <span id="audio-source-label" className="sr-only">Select Audio Source</span>
        
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name={`audioSource-${section.id}`}
            value="library"
            checked={audioSource === 'library'}
            onChange={handleLibraryRadioChange}
            className="mr-2 h-4 w-4"
          />
          <span>Select from Library</span>
        </label>
        
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name={`audioSource-${section.id}`}
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
          <div className="flex items-center mb-2 space-x-2">
            <label htmlFor={`audio-category-${section.id}`} className="text-sm whitespace-nowrap">
              Audio type:
            </label>
            <select
              id={`audio-category-${section.id}`}
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
            id={`audio-library-${section.id}`}
            value={section.audioId || ''}
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
          
          {section.audioId && audioData && (
            <p className="text-sm flex items-center text-[var(--text-secondary)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
              </svg>
              Using: {audioData.name}
            </p>
          )}
        </div>
      )}
      
      {/* Upload Interface */}
      {audioSource === 'upload' && (
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <label htmlFor={`audio-upload-${section.id}`} className="cursor-pointer bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Choose File
              <input
                id={`audio-upload-${section.id}`}
                type="file"
                ref={fileInputRef}
                onChange={handleAudioUpload}
                accept="audio/*"
                className="hidden"
                disabled={isUploading}
              />
            </label>
            
            {currentFile && (
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
          
          {currentFile && (
            <p className="text-sm mt-2 text-[var(--text-secondary)]">
              Selected file: {currentFile.name}
            </p>
          )}
          
          {audioData?.source === 'upload' && (
            <p className="text-sm mt-2 flex items-center text-[var(--text-secondary)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
              </svg>
              Using uploaded audio: {audioData.name}
            </p>
          )}
        </div>
      )}
      
      {/* Audio Playback */}
      {hasValidAudio && (
        <div className="mt-4">
          {playingAudio ? (
            <button
              onClick={togglePlayAudio}
              className="bg-[var(--accent-color)] text-white py-2 px-4 rounded-full hover:bg-opacity-90 transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="ml-2">Stop Audio</span>
            </button>
          ) : (
            <button
              onClick={togglePlayAudio}
              className="bg-[var(--accent-color)] text-white py-2 px-4 rounded-full hover:bg-opacity-90 transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span className="ml-2">Play Audio</span>
            </button>
          )}
        </div>
      )}
      
      {/* No Audio Selected/Uploaded Message */}
      {!hasValidAudio && (
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {audioSource === 'library'
            ? 'Please select an audio file from the library.'
            : 'Please upload an audio file to use in this section.'}
        </p>
      )}
    </div>
  );
};

export default SectionCardAudio;