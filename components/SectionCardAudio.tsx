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

import React, { useState, useRef, useEffect } from 'react';
import { useTTSContext, useFileStorage } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { saveToStorage } from '../context/storage';
import { devLog } from '../utils/logUtils';

/**
 * SectionCardAudio component for handling audio-only section content.
 * Provides interfaces for selecting audio from library or uploading new audio,
 * as well as playing back selected audio files.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.section - The section data
 * @returns {JSX.Element} The rendered SectionCardAudio component
 */
const SectionCardAudio: React.FC<{ section: any }> = ({ section }) => {
  const { state, actions, isLoading } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { state: fileStorageState, actions: fileStorageActions } = useFileStorage();

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  const [audioSource, setAudioSource] = useState(section.audioSource || (hasAudio && audioData.source) || 'library');
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showPlayAudioItems, setShowPlayAudioItems] = useState(false);
  const [audioCategory, setAudioCategory] = useState('sound_effect');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedAudioPreview, setUploadedAudioPreview] = useState<{ url: string, name: string, type: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Use state.settings.storageConfig.serverUrl, with fallback to http://localhost:5000
  const serverUrl = state.settings.storageConfig.serverUrl && state.settings.storageConfig.serverUrl !== ''
    ? state.settings.storageConfig.serverUrl
    : 'http://localhost:5000';

  /**
   * Logs component initialization, server URL, audio library, and audio data for debugging.
   */
  useEffect(() => {
    devLog('SectionCardAudio mounted with:', {
      sectionId: section.id,
      sectionAudioSource: section.audioSource,
      audioDataSource: audioData?.source,
      audioSource,
      audioData,
      hasAudio,
      showPlayAudioItems,
      serverUrl,
      audioId: section.audioId,
    });
    devLog('Server URL from tts_persistant_state:', serverUrl);
    devLog('Audio library URLs:', fileStorageState.audioLibrary.map((a) => a.audio_url));
    devLog('Audio data:', {
      url: audioData?.url,
      source: audioData?.source,
      name: audioData?.name,
      type: audioData?.type,
      format: audioData?.format,
    });
  }, [audioData, audioSource, hasAudio, section.audioSource, showPlayAudioItems, serverUrl, fileStorageState.audioLibrary, section.id, section.audioId]);

  /**
   * Updates the visibility of audio playback controls based on audio source and availability.
   */
  useEffect(() => {
    const hasValidAudio = () => {
      if (audioSource === 'library') {
        const hasLibraryAudio = !!section.audioId && 
                              !!audioData && 
                              typeof audioData.url === 'string' && 
                              audioData.url.length > 0;
        devLog('Library audio check:', {
          sectionAudioId: section.audioId,
          hasLibraryAudio,
          audioDataUrl: audioData?.url
        });
        return hasLibraryAudio;
      } else if (audioSource === 'upload') {
        const hasSessionAudio = !!audioData && 
                              audioData.source === 'upload' && 
                              typeof audioData.url === 'string' && 
                              audioData.url.length > 0;
        const hasLocalPreview = !!uploadedAudioPreview && 
                              typeof uploadedAudioPreview.url === 'string' && 
                              uploadedAudioPreview.url.length > 0;
        devLog('Upload audio check:', {
          hasSessionAudio,
          hasLocalPreview,
          sessionAudioUrl: audioData?.url,
          previewUrl: uploadedAudioPreview?.url
        });
        return hasSessionAudio || hasLocalPreview;
      }
      return false;
    };

    const shouldShowPlayButton = hasValidAudio();
    devLog('Audio play button visibility check:', {
      audioSource,
      sectionAudioId: section.audioId,
      hasAudioData: !!audioData,
      audioDataUrl: audioData?.url,
      hasUploadedPreview: !!uploadedAudioPreview,
      uploadedPreviewUrl: uploadedAudioPreview?.url,
      shouldShowPlayButton
    });

    setShowPlayAudioItems(shouldShowPlayButton);
  }, [audioSource, section.audioId, audioData, uploadedAudioPreview]);

  /**
   * Normalizes a URL to a relative path, using /audio/ for library audio and /Uploads/ for uploaded audio.
   */
  const normalizeUrl = (url: string, isLibraryAudio: boolean): string => {
    if (!url) return '';
    let normalizedUrl = url;
    if (normalizedUrl.includes('://') || normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(normalizedUrl.includes('://') ? normalizedUrl : `http://${normalizedUrl}`);
        normalizedUrl = urlObj.pathname;
        devLog('Normalized URL to pathname:', { original: url, normalized: normalizedUrl });
      } catch (e) {
        devLog('Invalid URL format:', url);
        return normalizedUrl;
      }
    }
    const prefix = isLibraryAudio ? '/audio/' : '/Uploads/';
    normalizedUrl = normalizedUrl.startsWith(prefix) ? normalizedUrl : `${prefix}${normalizedUrl.replace(/^\//, '')}`;
    return normalizedUrl;
  };

  /**
   * Validates and constructs audio URL, forcing serverUrl for library audio.
   */
  const validateAudioUrl = (url: string, source: string | undefined): string => {
    if (!url) {
      devLog('Invalid audio URL: empty or undefined');
      sessionActions.setNotification({
        type: 'error',
        message: 'Audio URL is missing.',
      });
      return '';
    }
    if (source === 'upload' || url.startsWith('blob:')) {
      devLog('Using blob URL directly for uploaded audio:', url);
      return url;
    }
    const normalizedUrl = normalizeUrl(url, true);
    if (!normalizedUrl) {
      devLog('Failed to normalize URL:', url);
      sessionActions.setNotification({
        type: 'error',
        message: 'Invalid audio URL format.',
      });
      return '';
    }
    const fullUrl = `${serverUrl}${normalizedUrl}`;
    devLog('Validated audio URL:', { original: url, source, normalized: normalizedUrl, full: fullUrl, serverUrl });
    return fullUrl;
  };

  /**
   * Handles audio file upload for the section.
   * Creates an object URL for the uploaded audio file.
   */
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      sessionActions.setNotification({
        type: 'error',
        message: 'No file selected.',
      });
      return;
    }
    if (!file.type.startsWith('audio/')) {
      sessionActions.setError('Please upload an audio file');
      return;
    }
    try {
      setCurrentFile(file);
      const audioUrl = URL.createObjectURL(file);
      if (!audioUrl) {
        throw new Error('Failed to generate audio URL');
      }
      setUploadedAudioPreview({ url: audioUrl, name: file.name, type: file.type });
      sessionActions.updateSection({ ...section, audioId: null, audioSource: 'upload' });
      const audioData = {
        url: audioUrl,
        source: 'upload',
        name: file.name,
        type: file.type,
        format: file.type.split('/')[1] || 'wav',
      };
      sessionActions.setGeneratedAudio(section.id, audioData);
      setAudioSource('upload');
      setShowPlayAudioItems(true);
      sessionActions.setNotification({
        type: 'success',
        message: `Audio file "${file.name}" uploaded successfully`,
      });
      devLog('Uploaded audio data set:', audioData);
    } catch (error: any) {
      devLog('Error uploading audio:', error);
      sessionActions.setError(`Error uploading audio: ${error.message}`);
    }
  };

  /**
   * Saves the currently uploaded audio file to the library.
   * Uses /Uploads/ for uploaded audio.
   */
  const saveToLibrary = async () => {
    if (!currentFile || !audioData?.url) {
      sessionActions.setNotification({
        type: 'error',
        message: 'No audio file to save',
      });
      return;
    }
    try {
      setIsSaving(true);
      const fileName = currentFile.name.replace(/\.[^/.]+$/, '');
      sessionActions.setNotification({
        type: 'info',
        message: `Uploading "${fileName}" to library...`,
      });
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
      const addedAudio = await fileStorageActions.addToAudioLibrary(currentFile, audioDataForLibrary);
      const normalizedAudioUrl = normalizeUrl(addedAudio.audio_url, true);
      sessionActions.setNotification({
        type: 'success',
        message: `Audio saved to library as "${fileName}"`,
      });
      setAudioSource('library');
      setAudioCategory('uploaded_audio');
      sessionActions.updateSection({
        ...section,
        audioId: addedAudio.id,
        audioSource: 'library',
      });
      sessionActions.setGeneratedAudio(section.id, {
        url: normalizedAudioUrl,
        source: 'library',
        name: addedAudio.name,
        type: addedAudio.type,
        format: addedAudio.audioMetadata?.format,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCurrentFile(null);
    } catch (error: any) {
      devLog('Error saving to library:', error);
      sessionActions.setNotification({
        type: 'error',
        message: `Error saving to library: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Toggles audio playback (play/pause).
   */
  const togglePlayAudio = () => {
    if (audioSource === 'upload') {
      const hasSessionAudio = !!audioData && audioData.source === 'upload' && !!audioData.url;
      const hasLocalPreview = !!uploadedAudioPreview && !!uploadedAudioPreview.url;
      if (!hasSessionAudio && !hasLocalPreview) {
        sessionActions.setNotification({
          type: 'error',
          message: 'No uploaded audio to play.',
        });
        return;
      }
      setPlayingAudio((prev) => !prev);
      return;
    }
    if (!hasAudio || !audioData || !audioData.url) {
      sessionActions.setNotification({
        type: 'error',
        message: 'No audio selected to play.',
      });
      return;
    }
    setPlayingAudio((prev) => !prev);
  };

  /**
   * Filters audio library items by selected category
   */
  const getFilteredAudioLibrary = () => {
    if (!fileStorageState?.audioLibrary) return [];
    return fileStorageState.audioLibrary.filter((audio) => audio.category === audioCategory);
  };

  /**
   * Hydrates audioData if missing but section.audioId is set
   */
  useEffect(() => {
    if (
      audioSource === 'library' &&
      section.audioId &&
      (!audioData || !audioData.url)
    ) {
      const audio = fileStorageState.audioLibrary.find((a) => a.id === section.audioId);
      if (audio && audio.audio_url) {
        const normalizedAudioUrl = normalizeUrl(audio.audio_url, true);
        sessionActions.setGeneratedAudio(section.id, {
          url: normalizedAudioUrl,
          source: 'library',
          name: audio.name,
          type: audio.type,
          format: audio.audioMetadata?.format || audio.type.split('/')[1] || 'wav',
        });
        devLog('Restored library audio:', {
          audioId: section.audioId,
          audioCategory,
          audioName: audio.name,
        });
      }
    }
  }, [
    audioSource,
    section.audioId,
    audioData,
    fileStorageState.audioLibrary,
    section.id,
    sessionActions,
  ]);

  /**
   * Syncs audioCategory with selected audio
   */
  useEffect(() => {
    if (
      audioSource === 'library' &&
      section.audioId &&
      fileStorageState.audioLibrary.length > 0
    ) {
      const selectedAudio = fileStorageState.audioLibrary.find(a => a.id === section.audioId);
      const isAudioInCurrentCategory = fileStorageState.audioLibrary
        .filter(a => a.category === audioCategory)
        .some(a => a.id === section.audioId);
      if (selectedAudio && selectedAudio.category && !isAudioInCurrentCategory) {
        setAudioCategory(selectedAudio.category);
        devLog('Updated audioCategory to match selected audio:', selectedAudio.category);
      }
    }
  }, [audioSource, section.audioId, fileStorageState.audioLibrary, audioCategory]);

  // Update the radio button handlers
  const handleLibraryRadioChange = () => {
    setAudioSource('library');
    // Preserve existing library audio if available
    if (section.audioId) {
      sessionActions.updateSection({
        ...section,
        audioId: section.audioId,
        audioSource: 'library',
      });
    }
    if (playingAudio) {
      setPlayingAudio(false);
    }
  };

  const handleUploadRadioChange = () => {
    setAudioSource('upload');
    // Preserve existing upload audio if available
    if (audioData?.source === 'upload') {
      sessionActions.updateSection({
        ...section,
        audioId: null,
        audioSource: 'upload',
      });
    }
    if (playingAudio) {
      setPlayingAudio(false);
    }
  };

  // Update the library selection handler
  const handleLibrarySelection = (e) => {
    const audioId = e.target.value;
    const audio = fileStorageState.audioLibrary.find((a) => a.id === audioId);
    if (audio && audio.audio_url) {
      const normalizedAudioUrl = normalizeUrl(audio.audio_url, true);
      devLog('Selected audio details:', {
        id: audio.id,
        name: audio.name,
        audio_url: normalizedAudioUrl,
        type: audio.type,
        format: audio.audioMetadata?.format,
      });
      sessionActions.updateSection({ ...section, audioId, audioSource: 'library' });
      sessionActions.setGeneratedAudio(section.id, {
        url: normalizedAudioUrl,
        source: 'library',
        name: audio.name,
        type: audio.type,
        format: audio.audioMetadata?.format || audio.type.split('/')[1] || 'wav',
      });
      sessionActions.setNotification({
        type: 'success',
        message: `Selected audio: ${audio.name}`,
      });
    } else {
      devLog('Invalid audio selection:', { audioId, audio });
      sessionActions.updateSection({ ...section, audioId: null, audioSource: 'library' });
      sessionActions.setGeneratedAudio(section.id, null);
      if (audioId) {
        sessionActions.setNotification({
          type: 'error',
          message: 'Selected audio is invalid or missing a URL.',
        });
      }
    }
    setPlayingAudio(false);
  };

  return (
    <div>
      <style>
        {`
          #section-card-play-audio-items {
            display: none;
          }
          #section-card-play-audio-items.visible {
            display: flex;
          }
          .tooltip {
            position: relative;
          }
          .tooltip .tooltiptext {
            visibility: hidden;
            width: 200px;
            background-color: var(--tooltip-bg, #555);
            color: var(--tooltip-text, white);
            text-align: center;
            border-radius: 6px;
            padding: 5px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.75rem;
          }
          .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
          }
          .info-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            background-color: var(--accent-color);
            border-radius: 50%;
            font-style: italic;
            font-size: 10px;
            color: white;
            vertical-align: super;
            margin-left: 2px;
          }
          .compact-select {
            padding: 4px 8px;
            font-size: 0.85rem;
          }
          .file-upload-container {
            display: flex;
            align-items: center;
          }
          .file-upload-container input[type="file"] {
            display: none;
          }
          .file-upload-label {
            display: inline-flex;
            align-items: center;
            cursor: pointer;
            color: var(--accent-color);
            padding: 2px;
            border-radius: 4px;
            transition: all 0.2s;
          }
          .file-upload-label:hover {
            background-color: rgba(var(--accent-color-rgb, 79, 70, 229), 0.1);
          }
          .save-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            background-color: var(--accent-color);
            border: none;
            border-radius: 4px;
            padding: 6px 8px;
            margin-left: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.2s;
          }
          .save-btn:hover {
            background-color: rgba(var(--accent-color-rgb, 79, 70, 229), 0.8);
          }
          .save-btn:disabled {
            background-color: rgba(var(--accent-color-rgb, 79, 70, 229), 0.5);
            cursor: not-allowed;
          }
          .save-icon {
            position: relative;
            color: var(--accent-color);
            cursor: pointer;
            margin-left: 10px;
            transition: color 0.2s;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .save-icon:hover {
            color: rgba(var(---accent-color-rgb, 79, 70, 229), 0.8);
          }
          .save-icon:disabled {
            color: rgba(var(--- accent-color-rgb, 79, 70, 229), 0.5);
            cursor: not-allowed;
          }
          .save-icon svg {
            width: 20px;
            height: 20px;
          }
          .info-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
            background-color: var(--accent-color);
            border-radius: 50%;
            font-style: italic;
            font-size: 8px;
            color: white;
            border: 1px solid white;
            z-index: 1;
          }
        `}
      </style>
      <p style={{ color: 'var(--text-color)' }} className="mb-4" id="section-card-audio-description">
        This is an audio-only section. Choose how to provide the audio:
      </p>
      <div className="mb-4" id="section-card-audio-source-options">
        <label className="mr-4" id="section-card-library-option">
          <input
            type="radio"
            name="audioSource"
            value="library"
            checked={audioSource === 'library'}
            onChange={handleLibraryRadioChange}
            className="radio-input"
          />
          Select from Library
        </label>
        <label id="section-card-upload-option">
          <input
            type="radio"
            name="audioSource"
            value="upload"
            checked={audioSource === 'upload'}
            onChange={handleUploadRadioChange}
            className="radio-input"
          />
          Upload New Audio
        </label>
      </div>
      {audioSource === 'library' && (
        <div className="mb-4" id="section-card-library-selector">
          <div className="flex items-center mb-2 space-x-2">
            <label htmlFor="section-card-audio-category-select" className="text-sm whitespace-nowrap">
              Audio type:
            </label>
            <select
              id="section-card-audio-category-select"
              value={audioCategory}
              onChange={(e) => setAudioCategory(e.target.value)}
              className="compact-select flex-grow select-field"
              disabled={isLoading}
            >
              <option value="sound_effect">Sound Effects</option>
              <option value="uploaded_audio">Uploaded Audio</option>
              <option value="merged_audio">Merged Audio</option>
              <option value="generated_section_audio">Generated Audio</option>
              <option value="music">Music</option>
              <option value="binaural">Binaural</option>
            </select>
          </div>
          <select
            id="section-card-audio-library-select"
            value={section.audioId || ''}
            onChange={handleLibrarySelection}
            className="select-field w-full"
            disabled={isLoading}
          >
            <option value="">Select an audio file...</option>
            {getFilteredAudioLibrary().map((audio) => (
              <option key={audio.id} value={audio.id}>
                {audio.name}
              </option>
            ))}
          </select>
          {section.audioId && hasAudio && audioData?.source === 'library' && (
            <p className="text-sm mt-2 flex items-center" style={{ color: 'var(--text-secondary)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
                  clipRule="evenodd"
                />
              </svg>
              Using audio from library: {audioData.name}
            </p>
          )}
        </div>
      )}
      {audioSource === 'upload' && (
        <div className="mb-4" id="section-card-upload-container">
          <div className="file-upload-container">
            <label htmlFor="section-card-audio-upload-input" className="file-upload-label">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 512 512"
                fill="currentColor"
              >
                <path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64zm432 64c0-8.8-7.2-16-16-16H384c0 8.8 7.2 16 16 16s16-7.2 16-16z" />
              </svg>
              Choose File
            </label>
            <input
              id="section-card-audio-upload-input"
              data-testid="section-card-audio-upload-input"
              type="file"
              ref={fileInputRef}
              onChange={handleAudioUpload}
              accept="audio/*"
              disabled={isLoading || isSaving}
            />
            {currentFile && (
              <div className="tooltip">
                <div
                  id="save-to-library-btn"
                  onClick={saveToLibrary}
                  className="save-icon"
                  title="Save to Library"
                >
                  {isSaving ? (
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 640 512"
                        fill="currentColor"
                      >
                        <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z" />
                      </svg>
                      <span className="info-badge">i</span>
                    </>
                  )}
                  <span className="tooltiptext">Save this audio to your library for reuse in other sections</span>
                </div>
              </div>
            )}
          </div>
          {currentFile && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Selected file: {currentFile.name}
            </p>
          )}
          {hasAudio && audioData?.source === 'upload' && (
            <p className="text-sm mt-2 flex items-center" style={{ color: 'var(--text-secondary)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
                  clipRule="evenodd"
                />
              </svg>
              Using uploaded audio: {audioData.name}
            </p>
          )}
        </div>
      )}
      <div
        id="section-card-play-audio-items"
        className={`flex items-center ${showPlayAudioItems ? 'visible' : ''}`}
      >
        {showPlayAudioItems && (
          <>
            {playingAudio ? (
              <audio
                id="section-card-audio-player"
                data-testid="section-card-audio-player"
                controls
                autoPlay
                className="w-full max-w-md"
                onEnded={() => setPlayingAudio(false)}
                onError={(e) => {
                  const uploadedUrl = audioSource === 'upload' && uploadedAudioPreview ? uploadedAudioPreview.url : null;
                  const sessionUrl = audioData && audioData.url ? audioData.url : null;
                  const playbackUrl = uploadedUrl || (sessionUrl ? validateAudioUrl(sessionUrl, audioData?.source) : '');
                  devLog('Audio playback error:', e, {
                    playbackUrl,
                    audioSource,
                    audioData,
                    uploadedAudioPreview,
                    serverUrl,
                  });
                  sessionActions.setNotification({
                    type: 'error',
                    message: 'Failed to play audio. Please check the file.',
                  });
                  setPlayingAudio(false);
                }}
                onLoadStart={() => {
                  const uploadedUrl = audioSource === 'upload' && uploadedAudioPreview ? uploadedAudioPreview.url : null;
                  const sessionUrl = audioData && audioData.url ? audioData.url : null;
                  const playbackUrl = uploadedUrl || (sessionUrl ? validateAudioUrl(sessionUrl, audioData?.source) : '');
                  devLog('Audio loading:', {
                    playbackUrl,
                    audioSource,
                    uploadedAudioPreview,
                    audioData,
                    serverUrl,
                  });
                }}
              >
                <source
                  src={audioSource === 'upload' && uploadedAudioPreview
                    ? uploadedAudioPreview.url
                    : (audioData && audioData.url
                        ? validateAudioUrl(audioData.url, audioData.source)
                        : '')}
                  type={
                    audioSource === 'upload' && uploadedAudioPreview
                      ? uploadedAudioPreview.type
                      : (audioData && (audioData.format
                          ? `audio/${audioData.format}`
                          : audioData.type || 'audio/wav'))
                  }
                />
                Your browser does not support the audio element.
              </audio>
            ) : (
              <button
                id="section-card-play-audio-button-mini"
                data-testid="section-card-play-audio-button-mini"
                onClick={togglePlayAudio}
                className="btn btn-secondary flex items-center mr-2"
                style={{ padding: '0.5rem' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
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
            )}
          </>
        )}
      </div>
      {!showPlayAudioItems && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }} id="section-card-audio-instruction">
          {audioSource === 'library'
            ? 'Please select an audio file from the library to play.'
            : 'Please upload an audio file to play.'}
        </p>
      )}
    </div>
  );
};

export default SectionCardAudio;