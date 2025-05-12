/**
 * @fileoverview Input component for the Text-to-Speech application.
 * This component handles text input, file upload, URL import, audio selection,
 * and voice selection for creating new TTS sections.
 *
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires next/link
 * @requires ../utils/logUtils
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTTSContext, useFileStorage } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import Link from 'next/link';
import { devLog, devDebug, devError } from '../utils/logUtils';

/**
 * Text and audio input component for TTS processing.
 * Provides interfaces for entering text, selecting voice, importing text from various sources,
 * selecting audio files, and creating new TTS or audio-only sections.
 *
 * @component
 * @returns {JSX.Element} The rendered TextInput component
 */
const TextInput = () => {
  const { state, actions: ttsActions, isProcessing } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { state: fileStorageState, actions: fileStorageActions } = useFileStorage();

  const selectedVoice = sessionState.selectedInputVoice;

  const inputText = sessionState?.inputText || '';
  const inputType = sessionState?.inputType || 'text';
  const sections = sessionState?.sections || [];

  /**
   * Computes the list of all active voices from the TTS state.
   */
  const allActiveVoices = useMemo(() => {
    const voices = Object.values(state?.settings?.activeVoices || {}).flat();
    devLog('All active voices computed:', voices);
    return voices;
  }, [state?.settings?.activeVoices]);

  /**
   * Filters the list of voices to display in the voice selection dropdown.
   */
  const voicesToShow = useMemo(() => {
    if (allActiveVoices.length > 0) {
      return allActiveVoices;
    }
    const defaultVoice = state?.settings?.defaultVoices?.gtts?.[0];
    devLog('No active voices, using default voice:', defaultVoice);
    if (defaultVoice) {
      return [defaultVoice];
    }
    return [];
  }, [allActiveVoices, state?.settings?.defaultVoices]);

  const defaultVoiceObj = useMemo(() => {
    const defaultVoiceSetting = state?.settings?.defaultVoice;
    if (defaultVoiceSetting) {
      const { engine, voiceId } = defaultVoiceSetting;
      return voicesToShow.find((v) => v.engine === engine && v.id === voiceId);
    }
    return null;
  }, [state?.settings?.defaultVoice, voicesToShow]);

  const filteredVoicesToShow = useMemo(() => {
    if (defaultVoiceObj) {
      return voicesToShow.filter(
        (v) => !(v.engine === defaultVoiceObj.engine && v.id === defaultVoiceObj.id)
      );
    }
    return voicesToShow;
  }, [voicesToShow, defaultVoiceObj]);

  const defaultVoiceInfo = useMemo(() => {
    return defaultVoiceObj
      ? `Default Voice - ${defaultVoiceObj.name} (${defaultVoiceObj.language}) - ${defaultVoiceObj.engine}`
      : 'Default Voice';
  }, [defaultVoiceObj]);

  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [audioSource, setAudioSource] = useState('library');
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [audioCategory, setAudioCategory] = useState('sound_effect');
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showPlayAudioItems, setShowPlayAudioItems] = useState(false);

  const speechEngine = state?.speechEngine || 'gtts';

  /**
   * Audio categories for filtering the library
   */
  const audioCategories = [
    'sound_effect',
    'uploaded_audio',
    'merged_audio',
    'generated_section_audio',
    'music',
    'binaural',
  ];

  /**
   * Transform audio library into an object for easy lookup
   */
  const audioLibrary = useMemo(() => {
    return (fileStorageState.audioLibrary || []).reduce((acc, audio) => {
      acc[audio.id] = audio;
      return acc;
    }, {});
  }, [fileStorageState.audioLibrary]);

  /**
   * Filter audio library by selected category
   */
  const filteredAudioLibrary = useMemo(() => {
    return (fileStorageState.audioLibrary || []).filter(
      (audio) => audio.category === audioCategory
    );
  }, [fileStorageState.audioLibrary, audioCategory]);

  /**
   * Server URL for audio playback
   */
  const serverUrl = state.settings.storageConfig.serverUrl || 'http://localhost:5000';

  /**
   * Normalizes a URL to a relative path
   */
  const normalizeUrl = (url, isLibraryAudio) => {
    if (!url) return '';
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
    normalizedUrl = normalizedUrl.startsWith(prefix) ? normalizedUrl : `${prefix}${normalizedUrl.replace(/^\//, '')}`;
    return normalizedUrl;
  };

  /**
   * Validates audio URL for playback
   */
  const validateAudioUrl = (url, source) => {
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
   * Update play button visibility
   */
  useEffect(() => {
    const hasValidAudio = () => {
      if (audioSource === 'library') {
        const selectedAudio = audioLibrary[selectedAudioId];
        const hasLibraryAudio = !!selectedAudioId && 
                              !!selectedAudio && 
                              !!selectedAudio.audio_url && 
                              typeof selectedAudio.audio_url === 'string';
        devLog('Library audio check:', {
          selectedAudioId,
          selectedAudio,
          hasLibraryAudio,
          audioUrl: selectedAudio?.audio_url,
          audioSource,
          showPlayAudioItems
        });
        return hasLibraryAudio;
      } else if (audioSource === 'upload') {
        const hasUploadedAudio = !!uploadedAudio && 
                               typeof uploadedAudio.url === 'string' && 
                               uploadedAudio.url.length > 0;
        devLog('Upload audio check:', {
          hasUploadedAudio,
          uploadedAudioUrl: uploadedAudio?.url
        });
        return hasUploadedAudio;
      }
      return false;
    };

    const shouldShowPlayButton = hasValidAudio();
    devLog('TextInput audio play button visibility check:', {
      audioSource,
      selectedAudioId,
      hasSelectedAudio: !!audioLibrary[selectedAudioId],
      selectedAudioUrl: audioLibrary[selectedAudioId]?.audio_url,
      hasUploadedAudio: !!uploadedAudio,
      uploadedAudioUrl: uploadedAudio?.url,
      shouldShowPlayButton,
      showPlayAudioItems
    });
    setShowPlayAudioItems(shouldShowPlayButton);
  }, [audioSource, uploadedAudio, audioLibrary, selectedAudioId]);

  /**
   * Restore audio state from session storage
   */
  useEffect(() => {
    const restoreAudioState = () => {
      if (inputType === 'audio') {
        const lastSelection = sessionState.lastAudioInputSelection;
        if (lastSelection) {
          devLog('Restoring last audio selection:', lastSelection);
          if (lastSelection.audioId) {
            const audio = fileStorageState.audioLibrary.find((a) => a.id === lastSelection.audioId);
            if (audio && audio.audio_url) {
              const normalizedAudioUrl = normalizeUrl(audio.audio_url, true);
              const validatedUrl = validateAudioUrl(normalizedAudioUrl, 'library');
              if (validatedUrl) {
                setAudioSource('library');
                setSelectedAudioId(lastSelection.audioId);
                setAudioCategory(lastSelection.audioCategory || audio.category || 'sound_effect');
                setShowPlayAudioItems(true);
                sessionActions.setGeneratedAudio('temp-section', {
                  url: normalizedAudioUrl,
                  source: 'library',
                  name: audio.name,
                  type: audio.type,
                  format: audio.audioMetadata?.format || audio.type?.split('/')[1] || 'wav',
                });
                devLog('Restored library audio:', {
                  audioId: lastSelection.audioId,
                  audioCategory: lastSelection.audioCategory || audio.category,
                  audioName: audio.name,
                  normalizedAudioUrl,
                });
              }
            }
          } else if (lastSelection.uploadedAudio) {
            setAudioSource('upload');
            setUploadedAudio(lastSelection.uploadedAudio);
            setShowPlayAudioItems(true);
          }
        }
      }
    };

    restoreAudioState();
  }, [inputType, sessionState.lastAudioInputSelection, fileStorageState.audioLibrary, sessionActions]);

  /**
   * Sync audioCategory with selected audio
   */
  useEffect(() => {
    if (audioSource === 'library' && selectedAudioId && fileStorageState.audioLibrary.length > 0) {
      const selectedAudio = fileStorageState.audioLibrary.find((a) => a.id === selectedAudioId);
      const isAudioInCurrentCategory = fileStorageState.audioLibrary
        .filter((a) => a.category === audioCategory)
        .some((a) => a.id === selectedAudioId);
      if (selectedAudio && selectedAudio.category && !isAudioInCurrentCategory) {
        setAudioCategory(selectedAudio.category);
        devLog('Updated audioCategory to match selected audio:', selectedAudio.category);
      }
    }
  }, [audioSource, selectedAudioId, fileStorageState.audioLibrary, audioCategory]);

  /**
   * Save audio selection to session storage
   */
  useEffect(() => {
    if (inputType === 'audio') {
      const selection = {
        audioId: selectedAudioId,
        audioCategory: audioCategory,
        uploadedAudio: uploadedAudio
      };
      sessionActions.setLastAudioInputSelection(selection);
      devLog('Saved audio selection:', selection);
    }
  }, [inputType, selectedAudioId, audioCategory, uploadedAudio, sessionActions]);

  /**
   * Handles input type change between text and audio.
   */
  const handleInputTypeChange = (type) => {
    sessionActions.setInputType(type);
    if (type === 'audio') {
      // Preserve existing audio state if available
      if (audioSource === 'library' && selectedAudioId && audioLibrary[selectedAudioId]) {
        setAudioSource('library');
      } else if (audioSource === 'upload' && uploadedAudio) {
        setAudioSource('upload');
      } else {
        setAudioSource('library');
        setSelectedAudioId('');
        setUploadedAudio(null);
      }
    } else {
      setAudioSource('library');
      setSelectedAudioId('');
      setUploadedAudio(null);
    }
    setAudioCategory('sound_effect');
    setPlayingAudio(false);
    setShowPlayAudioItems(false);
  };

  /**
   * Handles text change in the textarea.
   */
  const handleTextChange = (e) => {
    sessionActions.setInputText(e.target.value);
  };

  /**
   * Handles file upload for text input.
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'text/plain') {
      sessionActions.setError('Please upload a .txt file');
      return;
    }
    try {
      sessionActions.setProcessing(true);
      const text = await file.text();
      sessionActions.setInputText(text);
      sessionActions.setNotification({
        type: 'success',
        message: `File "${file.name}" loaded successfully`,
      });
    } catch (error) {
      sessionActions.setError(`Error reading file: ${error.message}`);
    } finally {
      sessionActions.setProcessing(false);
      fileInputRef.current.value = '';
    }
  };

  /**
   * Imports text content from a URL.
   */
  const handleUrlImport = async () => {
    if (!urlInput) {
      sessionActions.setError('Please enter a URL');
      return;
    }
    try {
      sessionActions.setProcessing(true);
      const response = await fetch('/api/extractTextFromUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).message || 'Failed to fetch URL content'
        );
      const { text } = await response.json();
      sessionActions.setInputText(text);
      sessionActions.setNotification({
        type: 'success',
        message: 'URL content imported successfully',
      });
      setUrlInput('');
    } catch (error) {
      sessionActions.setError(`Error importing URL: ${error.message}`);
    } finally {
      sessionActions.setProcessing(false);
    }
  };

  /**
   * Handles audio file upload for audio sections.
   */
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      sessionActions.setNotification({
        type: 'error',
        message: 'Please upload an audio file',
      });
      return;
    }

    try {
      const audioData = {
        name: file.name,
        category: audioCategory,
        config_url: null,
        audioMetadata: {
          duration: 0,
          format: file.name.split('.').pop().toLowerCase(),
          placeholder: file.name.toLowerCase().replace(/\s+/g, '_'),
          volume: 1,
        },
      };

      await fileStorageActions.addToAudioLibrary(file, audioData);
      await fileStorageActions.fetchAudioLibrary();

      setUploadedAudio({
        name: file.name,
        url: URL.createObjectURL(file),
        category: audioCategory,
      });

      setShowPlayAudioItems(true);
    } catch (error) {
      devError('Error uploading audio:', error);
      sessionActions.setNotification({
        type: 'error',
        message: `Error uploading audio: ${error.message}`,
      });
    }
  };

  /**
   * Creates a new text-to-speech section.
   */
  const createNewSection = () => {
    if (!inputText.trim()) {
      sessionActions.setError('Please enter some text first');
      return;
    }
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-speech',
      text: inputText,
      voice: selectedVoice,
    };
    sessionActions.addSection(newSection);
    sessionActions.setNotification({
      type: 'success',
      message: 'New section created',
    });
    sessionActions.setInputText('');
    devLog('New section created with voice:', selectedVoice);
  };

  /**
   * Creates a new audio-only section.
   */
  const createAudioSection = () => {
    if (audioSource === 'library' && !selectedAudioId) {
      sessionActions.setError('Please select an audio file from the library');
      return;
    }
    if (audioSource === 'upload' && !uploadedAudio) {
      sessionActions.setError('Please upload an audio file');
      return;
    }

    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'audio-only',
      audioId: audioSource === 'library' ? selectedAudioId : null,
      audioSource,
    };

    let audioData;
    if (audioSource === 'library') {
      const audio = audioLibrary[selectedAudioId];
      if (!audio) {
        sessionActions.setError('Selected audio not found');
        return;
      }
      const normalizedUrl = normalizeUrl(audio.audio_url, true);
      audioData = {
        url: normalizedUrl,
        source: 'library',
        name: audio.name,
        type: audio.type || 'audio/mpeg',
        format: audio.audioMetadata?.format || audio.type?.split('/')[1] || 'mp3',
      };
    } else {
      audioData = {
        url: uploadedAudio.url,
        source: 'upload',
        name: uploadedAudio.name,
        type: uploadedAudio.type,
        format: uploadedAudio.format,
      };
    }

    sessionActions.addSection(newSection);
    sessionActions.setGeneratedAudio(newSection.id, audioData);
    sessionActions.setNotification({
      type: 'success',
      message: `New section created from audio "${audioData.name}"`,
    });
    setSelectedAudioId('');
    setUploadedAudio(null);
    setPlayingAudio(false);
    setShowPlayAudioItems(false);
  };

  /**
   * Handles voice selection change.
   */
  const handleVoiceChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === '') {
      sessionActions.setSelectedInputVoice(null);
      devDebug('Selected default voice');
    } else {
      const selectedVoiceObj = voicesToShow.find(
        (v) => `${v.engine}-${v.id}` === selectedValue
      );
      if (selectedVoiceObj) {
        sessionActions.setSelectedInputVoice(selectedVoiceObj);
        devLog('Selected voice:', selectedVoiceObj);
      } else {
        devDebug('Voice not found for value:', selectedValue);
      }
    }
  };

  /**
   * Toggles audio playback
   */
  const togglePlayAudio = () => {
    if (audioSource === 'library') {
      if (!selectedAudioId || !audioLibrary[selectedAudioId]?.audio_url) {
        sessionActions.setNotification({
          type: 'error',
          message: 'No audio selected to play.',
        });
        return;
      }
    } else if (audioSource === 'upload') {
      if (!uploadedAudio || !uploadedAudio.url) {
        sessionActions.setNotification({
          type: 'error',
          message: 'No uploaded audio to play.',
        });
        return;
      }
    }
    setPlayingAudio((prev) => !prev);
  };

  /**
   * Handles library radio button change
   */
  const handleLibraryRadioChange = () => {
    setAudioSource('library');
    if (playingAudio) {
      setPlayingAudio(false);
    }
    sessionActions.setLastAudioInputSelection({
      audioId: selectedAudioId,
      audioCategory: audioCategory,
      uploadedAudio: null
    });
  };

  /**
   * Handles upload radio button change
   */
  const handleUploadRadioChange = () => {
    setAudioSource('upload');
    if (playingAudio) {
      setPlayingAudio(false);
    }
    sessionActions.setLastAudioInputSelection({
      audioId: null,
      audioCategory: audioCategory,
      uploadedAudio: uploadedAudio
    });
  };

  /**
   * Handles library audio selection
   */
  const handleLibrarySelection = (e) => {
    const audioId = e.target.value;
    const audio = fileStorageState.audioLibrary.find((a) => a.id === audioId);
    devLog('Library selection triggered:', {
      audioId,
      audio,
      audioLibrary: fileStorageState.audioLibrary
    });

    if (audio && audio.audio_url) {
      const normalizedAudioUrl = normalizeUrl(audio.audio_url, true);
      const validatedUrl = validateAudioUrl(normalizedAudioUrl, 'library');
      devLog('Selected audio details:', {
        id: audio.id,
        name: audio.name,
        audio_url: normalizedAudioUrl,
        validatedUrl,
        type: audio.type,
        format: audio.audioMetadata?.format,
      });

      if (!validatedUrl) {
        devLog('Invalid validated URL for audio:', { audioId, normalizedAudioUrl });
        setSelectedAudioId('');
        setShowPlayAudioItems(false);
        sessionActions.setNotification({
          type: 'error',
          message: 'Selected audio URL is invalid.',
        });
        return;
      }

      setSelectedAudioId(audioId);
      setAudioSource('library');
      setShowPlayAudioItems(true);
      setAudioCategory(audio.category || 'sound_effect');

      // Update the session state
      sessionActions.setLastAudioInputSelection({
        audioId: audioId,
        audioCategory: audio.category || 'sound_effect',
        uploadedAudio: null
      });

      // Set the generated audio data
      sessionActions.setGeneratedAudio('temp-section', {
        url: normalizedAudioUrl,
        source: 'library',
        name: audio.name,
        type: audio.type,
        format: audio.audioMetadata?.format || audio.type?.split('/')[1] || 'wav',
      });

      sessionActions.setNotification({
        type: 'success',
        message: `Selected audio: ${audio.name}`,
      });
    } else {
      devLog('Invalid audio selection:', { audioId, audio });
      setSelectedAudioId('');
      setShowPlayAudioItems(false);
      sessionActions.setGeneratedAudio('temp-section', null);
      if (audioId) {
        sessionActions.setNotification({
          type: 'error',
          message: 'Selected audio is invalid or missing a URL.',
        });
      }
      setPlayingAudio(false);
    }
  };

  return (
    <div className="mb-6">
      <style>
        {`
          #audio-input-play-items {
            display: none;
          }
          #audio-input-play-items.visible {
            display: flex !important;
            margin-top: 1rem;
            align-items: center;
            justify-content: flex-start;
          }
          .radio-input:checked::before {
            background-color: var(--accent-color);
            width: 0.65rem;
            height: 0.65rem;
            border-radius: 50%;
            content: '';
            display: block;
            margin: 2px;
          }
          .radio-input {
            appearance: none;
            width: 1rem;
            height: 1rem;
            border: 2px solid var(--text-color);
            border-radius: 50%;
            margin-right: 0.5rem;
            vertical-align: middle;
          }
          .select-field {
            width: 100%;
            padding: 0.5rem;
            border-radius: 0.375rem;
            border: 1px solid var(--border-color);
          }
          .theme-file-input {
            cursor: pointer;
          }
          .btn {
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s;
          }
          .btn-primary {
            background-color: var(--accent-color);
            color: white;
          }
          .btn-primary:hover {
            background-color: rgba(var(--accent-color-rgb, 79, 70, 229), 0.8);
          }
          .btn-secondary {
            background-color: var(--secondary-bg);
            color: var(--text-color);
          }
          .btn-secondary:hover {
            background-color: var(--secondary-hover);
          }
          .input-field {
            width: 100%;
            padding: 0.5rem;
            border-radius: 0.375rem;
            border: 1px solid var(--border-color);
            background-color: var(--input-bg);
            color: var(--text-color);
          }
        `}
      </style>
      <div className="mb-4 flex rounded-lg p-1" style={{ backgroundColor: 'var(--card-bg)' }}>
        <button
          id="text-input-tab"
          onClick={() => handleInputTypeChange('text')}
          className={`flex-1 py-2 px-4 rounded-md shadow-sm transition-colors duration-150 ${
            inputType === 'text' ? '' : 'hover:[color:var(--text-hover)]'
          }`}
          style={{
            backgroundColor: inputType === 'text' ? 'var(--active-bg)' : 'transparent',
            color: inputType === 'text' ? 'var(--active-text-color)' : 'var(--text-color)',
          }}
        >
          Text Input
        </button>
        <button
          id="audio-input-tab"
          onClick={() => handleInputTypeChange('audio')}
          className={`flex-1 py-2 px-4 rounded-md shadow-sm transition-colors duration-150 ${
            inputType === 'audio' ? '' : 'hover:[color:var(--text-hover)]'
          }`}
          style={{
            backgroundColor: inputType === 'audio' ? 'var(--active-bg)' : 'transparent',
            color: inputType === 'audio' ? 'var(--active-text-color)' : 'var(--text-color)',
          }}
        >
          Audio Input
        </button>
      </div>
      {inputType === 'text' ? (
        <>
          <div className="mb-4">
            <textarea
              id="text-input-area"
              className="input-field h-64 font-mono text-sm"
              value={inputText}
              onChange={handleTextChange}
              placeholder="Enter your text here or import from a file or URL..."
              disabled={isProcessing}
            />
          </div>
          <div className="mb-4">
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="voice-select"
            >
              Select Voice
            </label>
            <select
              id="voice-select"
              value={
                sessionState.selectedInputVoice
                  ? `${sessionState.selectedInputVoice.engine}-${sessionState.selectedInputVoice.id}`
                  : ''
              }
              onChange={handleVoiceChange}
              className="select-field"
              disabled={isProcessing || voicesToShow.length === 0}
            >
              <option value="">{defaultVoiceInfo}</option>
              {filteredVoicesToShow.map((voice) => (
                <option key={`${voice.engine}-${voice.id}`} value={`${voice.engine}-${voice.id}`}>
                  {voice.name} ({voice.language}) - {voice.engine}
                </option>
              ))}
            </select>
            {state?.defaultVoice && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Default voice: {defaultVoiceInfo}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-color)' }}
                htmlFor="file-upload-input"
              >
                Import from file
              </label>
              <input
                id="file-upload-input"
                type="file"
                ref={fileInputRef}
                accept=".txt"
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold theme-file-input"
                disabled={isProcessing}
                onChange={handleFileUpload}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="url-input"
              >
                Import from URL
              </label>
              <div className="flex">
                <input
                  id="url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/page"
                  className="input-field rounded-r-none"
                  disabled={isProcessing}
                />
                <button
                  id="url-import-button"
                  onClick={handleUrlImport}
                  className="btn btn-primary rounded-l-none"
                  disabled={isProcessing || !urlInput}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="create-section-button"
            >
              Create new section
            </label>
            <button
              id="create-section-button"
              onClick={createNewSection}
              className="btn btn-primary w-full"
              disabled={isProcessing || !inputText.trim()}
            >
              Create New Section
            </button>
          </div>
        </>
      ) : (
        <div
          className="rounded-lg p-4 mb-4"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <h3 className="text-lg font-medium mb-3">Select Audio</h3>
          <p style={{ color: 'var(--text-color)' }} className="mb-4">
            Choose how to provide the audio:
          </p>
          <div className="mb-4">
            <label className="mr-4">
              <input
                id="library-radio"
                type="radio"
                name="audioSource"
                value="library"
                checked={audioSource === 'library'}
                onChange={handleLibraryRadioChange}
                className="radio-input"
                disabled={isProcessing}
              />
              Select from Library
            </label>
            <label>
              <input
                id="upload-radio"
                type="radio"
                name="audioSource"
                value="upload"
                checked={audioSource === 'upload'}
                onChange={handleUploadRadioChange}
                className="radio-input"
                disabled={isProcessing}
              />
              Upload New Audio
            </label>
          </div>
          {audioSource === 'library' ? (
            fileStorageState.audioLibrary.length === 0 ? (
              <div className="text-center py-8">
                <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                  No audio files available in your library.
                </p>
                <Link href="/audio" className="btn btn-primary">
                  Go to Audio Library
                </Link>
              </div>
            ) : (
              <div className="mb-4">
                <div className="mb-2">
                  <label
                    htmlFor="audio-category-select"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Audio Category
                  </label>
                  <select
                    id="audio-category-select"
                    value={audioCategory}
                    onChange={(e) => setAudioCategory(e.target.value)}
                    className="text-sm rounded-md border-gray-300 shadow-sm p-1 select-field"
                    disabled={isProcessing}
                  >
                    {audioCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="audio-library-select"
                >
                  Select an audio file from your library
                </label>
                {filteredAudioLibrary.length === 0 ? (
                  <p className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                    No audio files available in the selected category.
                  </p>
                ) : (
                  <select
                    id="audio-library-select"
                    className="select-field w-full"
                    disabled={isProcessing}
                    value={selectedAudioId}
                    onChange={handleLibrarySelection}
                  >
                    <option value="">Select an audio file...</option>
                    {filteredAudioLibrary.map((audio) => (
                      <option key={audio.id} value={audio.id}>
                        {audio.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedAudioId && audioLibrary[selectedAudioId] && (
                  <p
                    className="text-sm flex items-center mt-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
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
                    Using audio from library: {audioLibrary[selectedAudioId].name}
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="audio-upload-input"
              >
                Upload an audio file
              </label>
              <input
                id="audio-upload-input"
                type="file"
                disabled={isProcessing}
                accept="audio/*"
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold theme-file-input"
                onChange={handleAudioUpload}
              />
              {uploadedAudio && (
                <p
                  className="text-sm flex items-center mt-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
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
                    Using uploaded audio: {uploadedAudio.name}
                  </p>
                )}
              </div>
            )}
            <div
              id="audio-input-play-items"
              className={`flex items-center ${showPlayAudioItems ? 'visible' : ''}`}
              style={{ marginTop: '1rem' }}
            >
              {showPlayAudioItems && (
                <>
                  {playingAudio ? (
                    <audio
                      id="audio-input-player"
                      data-testid="audio-input-player"
                      controls
                      autoPlay
                      className="w-full max-w-md"
                      onEnded={() => setPlayingAudio(false)}
                      onError={(e) => {
                        const playbackUrl = audioSource === 'upload' && uploadedAudio
                          ? uploadedAudio.url
                          : (selectedAudioId && audioLibrary[selectedAudioId]
                              ? validateAudioUrl(audioLibrary[selectedAudioId].audio_url, 'library')
                              : '');
                        devLog('Audio playback error:', e, {
                          playbackUrl,
                          audioSource,
                          selectedAudioId,
                          uploadedAudio,
                          serverUrl,
                        });
                        sessionActions.setNotification({
                          type: 'error',
                          message: 'Failed to play audio. Please check the file.',
                        });
                        setPlayingAudio(false);
                      }}
                    >
                      <source
                        src={audioSource === 'upload' && uploadedAudio
                          ? uploadedAudio.url
                          : (selectedAudioId && audioLibrary[selectedAudioId]
                              ? validateAudioUrl(audioLibrary[selectedAudioId].audio_url, 'library')
                              : '')}
                        type={
                          audioSource === 'upload' && uploadedAudio
                            ? uploadedAudio.type
                            : (selectedAudioId && audioLibrary[selectedAudioId]
                                ? (audioLibrary[selectedAudioId].format
                                    ? `audio/${audioLibrary[selectedAudioId].format}`
                                    : audioLibrary[selectedAudioId].type || 'audio/mpeg')
                                : 'audio/mpeg')
                        }
                      />
                      Your browser does not support the audio element.
                    </audio>
                  ) : (
                    <button
                      id="audio-input-play-button"
                      data-testid="audio-input-play-button"
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
            <div className="mt-4 flex justify-between">
              <Link href="/audio" className="btn btn-secondary">
                Manage Audio Library
              </Link>
              <button
                id="create-audio-section-button"
                onClick={createAudioSection}
                className="btn btn-primary"
                disabled={
                  isProcessing ||
                  (audioSource === 'library' && !selectedAudioId) ||
                  (audioSource === 'upload' && !uploadedAudio)
                }
              >
                Create Section from Audio
              </button>
            </div>
          </div>
        )}
      </div>
    );
};

export default TextInput;