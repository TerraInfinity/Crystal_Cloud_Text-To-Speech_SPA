/**
 * @fileoverview Input component for the Text-to-Speech application.
 * This component handles text input, file upload, URL import, audio selection,
 * and voice selection for creating new TTS sections.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires next/link
 * @requires ../context/TTSSessionContext
 * @requires ../utils/logUtils
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {useTTSContext} from '../context/TTSContext';
import Link from 'next/link';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';

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
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext ();
  const selectedVoice = sessionState.selectedInputVoice;

  const inputText = sessionState?.inputText || '';
  const inputType = sessionState?.inputType || 'text';
  const sections = sessionState?.sections || [];
  const audioLibrary = state?.AudioLibrary || {};

  /**
   * Computes the list of all active voices from the TTS state.
   * 
   * @type {Array}
   */
  const allActiveVoices = useMemo(() => {
    const voices = Object.values(state?.settings?.activeVoices || {}).flat();
    devLog('All active voices computed:', voices);
    return voices;
  }, [state?.settings?.activeVoices]);

  /**
   * Filters the list of voices to display in the voice selection dropdown.
   * Falls back to default voice if no active voices are available.
   * 
   * @type {Array}
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
      return voicesToShow.find(v => v.engine === engine && v.id === voiceId);
    }
    return null;
  }, [state?.settings?.defaultVoice, voicesToShow]);

  const filteredVoicesToShow = useMemo(() => {
    if (defaultVoiceObj) {
      return voicesToShow.filter(
        v => !(v.engine === defaultVoiceObj.engine && v.id === defaultVoiceObj.id)
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

  const speechEngine = state?.speechEngine || 'gtts';

  /**
   * Fetches audio library files from storage when the component mounts.
   */
  useEffect(() => {
    if (Object.keys(audioLibrary).length === 0 && !isProcessing) {
      ttsActions.fetchAudioLibrary();
    }
  }, [audioLibrary, ttsActions, isProcessing]);

  /**
   * Handles input type change between text and audio.
   * 
   * @param {string} type - The input type to switch to ('text' or 'audio')
   */
  const handleInputTypeChange = (type) => {
    sessionActions.setInputType(type);
    setAudioSource('library');
    setSelectedAudioId('');
    setUploadedAudio(null);
  };

  /**
   * Handles text change in the textarea.
   * 
   * @param {Object} e - The input change event
   */
  const handleTextChange = (e) => {
    sessionActions.setInputText(e.target.value);
  };

  /**
   * Handles file upload for text input.
   * Reads text from a file and sets it as the input text.
   * 
   * @param {Object} e - The file input change event
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
   * Calls the server API to fetch and process the URL content.
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
   * Creates an object URL for the uploaded audio file.
   * 
   * @param {Object} e - The file input change event
   */
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
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
      const audioUrl = URL.createObjectURL(file);
      if (!audioUrl) {
        throw new Error('Failed to generate audio URL');
      }
      setUploadedAudio({ url: audioUrl, name: file.name });
      setSelectedAudioId('');
      sessionActions.setNotification({
        type: 'success',
        message: `Audio file "${file.name}" uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      sessionActions.setError(`Error uploading audio: ${error.message}`);
    }
  };

  /**
   * Creates a new text-to-speech section from the current input text.
   * Adds the section to the session state.
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
   * Creates a new audio-only section using either a library audio or uploaded audio.
   * Adds the section to the session state.
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
      audioData = { url: audio.url, source: 'library', name: audio.name };
    } else {
      audioData = { url: uploadedAudio.url, source: 'upload', name: uploadedAudio.name };
    }

    sessionActions.addSection(newSection);
    sessionActions.setGeneratedAudio(newSection.id, audioData);
    sessionActions.setNotification({
      type: 'success',
      message: `New section created from audio "${audioData.name}"`,
    });
    setSelectedAudioId('');
    setUploadedAudio(null);
  };

  /**
   * Handles voice selection change.
   * Updates the selected voice in the session state.
   * 
   * @param {Object} e - The select change event
   */
  const handleVoiceChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === '') {
      sessionActions.setSelectedInputVoice(null);
      console.log('Selected default voice');
    } else {
      const selectedVoiceObj = voicesToShow.find(
        (v) => `${v.engine}-${v.id}` === selectedValue
      );
      if (selectedVoiceObj) {
        sessionActions.setSelectedInputVoice(selectedVoiceObj);
        console.log('Selected voice:', selectedVoiceObj);
      } else {
        console.log('Voice not found for value:', selectedValue);
      }
    }
  };

  return (
    <div className="mb-6">
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="voice-select">
              Select Voice
            </label>
            <select
              id="voice-select"
              value={sessionState.selectedInputVoice ? `${sessionState.selectedInputVoice.engine}-${sessionState.selectedInputVoice.id}` : ''}
              onChange={handleVoiceChange}
              className="select-field"
              disabled={isProcessing || voicesToShow.length === 0}
            >
              <option value="">{defaultVoiceInfo}</option>
              {filteredVoicesToShow.map((voice) => (
                <option
                  key={`${voice.engine}-${voice.id}`}
                  value={`${voice.engine}-${voice.id}`}
                >
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
        <div>
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
            {Object.keys(audioLibrary).length === 0 && !uploadedAudio ? (
              <div className="text-center py-8">
                <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                  No audio files available in your library.
                </p>
                <Link href="/audio" className="btn btn-primary">
                  Go to Audio Library
                </Link>
              </div>
            ) : (
              <>
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
                      onChange={() => {
                        setAudioSource('library');
                        setUploadedAudio(null);
                      }}
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
                      onChange={() => {
                        setAudioSource('upload');
                        setSelectedAudioId('');
                      }}
                      className="radio-input"
                      disabled={isProcessing}
                    />
                    Upload New Audio
                  </label>
                </div>
                {audioSource === 'library' && (
                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      htmlFor="audio-library-select"
                    >
                      Select an audio file from your library
                    </label>
                    <select
                      id="audio-library-select"
                      className="select-field w-full"
                      disabled={isProcessing}
                      value={selectedAudioId}
                      onChange={(e) => {
                        setSelectedAudioId(e.target.value);
                      }}
                    >
                      <option value="">Select an audio file...</option>
                      {Object.values(audioLibrary).map((audio) => (
                        <option key={audio.id} value={audio.id}>
                          {audio.name}
                        </option>
                      ))}
                    </select>
                    {selectedAudioId && (
                      <div className="mt-2">
                        <p className="text-sm flex items-center" style={{ color: 'var(--text-secondary)' }}>
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
                          Using audio from library: {audioLibrary[selectedAudioId]?.name}
                        </p>
                        <label className="block text-sm font-medium text-gray-700 mt-2 mb-1">
                          Preview
                        </label>
                        <audio
                          id="library-audio-preview"
                          controls
                          className="w-full"
                          src={audioLibrary[selectedAudioId]?.url}
                        />
                      </div>
                    )}
                  </div>
                )}
                {audioSource === 'upload' && (
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
                      <div className="mt-2">
                        <p className="text-sm flex items-center" style={{ color: 'var(--text-secondary)' }}>
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
                        <label className="block text-sm font-medium text-gray-700 mt-2 mb-1">
                          Preview
                        </label>
                        <audio
                          id="uploaded-audio-preview"
                          controls
                          className="w-full"
                          src={uploadedAudio.url}
                        />
                      </div>
                    )}
                  </div>
                )}
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextInput;