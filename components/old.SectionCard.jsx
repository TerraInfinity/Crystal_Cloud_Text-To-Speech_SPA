import React, { useState, useMemo } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';

const SectionCard = ({ section, index, moveUp, moveDown }) => {
  const { state, actions, isProcessing } = useTTS();
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  console.log('AudioLibrary:', state?.AudioLibrary);

  const allActiveVoices = useMemo(
    () => Object.values(state?.settings?.activeVoices || {}).flat(),
    [state?.settings?.activeVoices]
  );
  const voicesToShow = useMemo(() => {
    if (allActiveVoices.length > 0) {
      return allActiveVoices;
    }
    const defaultVoice = state?.settings?.defaultVoices?.gtts?.[0];
    return defaultVoice ? [defaultVoice] : [];
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

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [editedText, setEditedText] = useState(section.text || '');
  const [editedVoice, setEditedVoice] = useState(section.voice || null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    volume: section.voiceSettings?.volume || 1,
    rate: section.voiceSettings?.rate || 1,
    pitch: section.voiceSettings?.pitch || 1,
  });
  const [audioSource, setAudioSource] = useState('library'); // New state for audio source

  const toggleSectionType = () => {
    const newType = section.type === 'text-to-audio' ? 'audio-only' : 'text-to-audio';
    sessionActions.updateSection({
      ...section,
      type: newType,
    });
  };

  const saveSection = () => {
    sessionActions.updateSection({
      ...section,
      title: editedTitle,
      text: editedText,
      voice: editedVoice,
      voiceSettings,
    });
    setIsEditing(false);
    sessionActions.setNotification({
      type: 'success',
      message: 'Section updated successfully',
    });
  };

  const deleteSection = () => {
    if (window.confirm(`Are you sure you want to delete "${section.title}"?`)) {
      sessionActions.removeSection(section.id);
      sessionActions.setNotification({
        type: 'success',
        message: 'Section deleted successfully',
      });
    }
  };

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
      // Clear library selection when uploading a new file
      sessionActions.updateSection({ ...section, audioId: null });
      sessionActions.setGeneratedAudio(section.id, { url: audioUrl, source: 'upload', name: file.name });
      sessionActions.setNotification({
        type: 'success',
        message: `Audio file "${file.name}" uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      sessionActions.setError(`Error uploading audio: ${error.message}`);
    }
  };

  const generateSpeech = async () => {
    if (!section.text || section.text.trim() === '') {
      sessionActions.setError('Section text is empty');
      return;
    }
    try {
      sessionActions.setProcessing(true);
      const voiceToUse = editedVoice || null;
      const engineToUse = voiceToUse?.engine || state?.speechEngine || 'gtts';
      const response = await fetch('/api/textToSpeech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: section.text,
          engine: engineToUse,
          voice: voiceToUse?.id || null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert text to speech');
      }
      const { audioUrl } = await response.json();
      sessionActions.setGeneratedAudio(section.id, { url: audioUrl });
      sessionActions.setNotification({
        type: 'success',
        message: 'Speech generated successfully',
      });
    } catch (error) {
      sessionActions.setError(`Error generating speech: ${error.message}`);
    } finally {
      sessionActions.setProcessing(false);
    }
  };

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  const playAudio = () => {
    if (hasAudio) {
      const audioUrl = audioData.url;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play();
      }
    }
  };

  return (
    <div
      className="rounded-lg p-4 mb-4"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex flex-col mr-2">
            <button
              onClick={moveUp}
              className="p-1"
              style={{ color: 'var(--text-secondary)' }}
              title="Move Up"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              onClick={moveDown}
              className="p-1"
              style={{ color: 'var(--text-secondary)' }}
              title="Move Down"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="input-field"
              />
            ) : (
              <h3 className="text-lg font-medium">
                {index + 1}. {section.title}
                <span
                  className="ml-2 text-sm font-normal"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  ({section.type === 'text-to-audio' ? 'Text to Speech' : 'Audio Only'})
                </span>
              </h3>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1"
            style={{ color: 'var(--text-secondary)' }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <button
            onClick={toggleSectionType}
            className="p-1"
            style={{ color: 'var(--accent-color)' }}
            title="Toggle Section Type"
          >
            {section.type === 'text-to-audio' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1"
            style={{ color: 'var(--accent-color)' }}
            title={isEditing ? 'Cancel Editing' : 'Edit Section'}
          >
            {isEditing ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            )}
          </button>
          <button
            onClick={deleteSection}
            className="p-1"
            style={{ color: 'var(--danger-color)' }}
            title="Delete Section"
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
      {isExpanded && (
        <div className="mt-4">
          {section.type === 'text-to-audio' ? (
            <div>
              {isEditing ? (
                <div>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="input-field h-32 mb-4 font-mono text-sm"
                    placeholder="Enter text for this section..."
                  ></textarea>
                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--text-color)' }}
                    >
                      Voice (optional)
                    </label>
                    <select
                      value={editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : ''}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        if (selectedValue === '') {
                          setEditedVoice(null);
                          console.log('Voice set to default (null)');
                        } else {
                          const [engine, id] = selectedValue.split('::', 2);
                          const selectedVoiceObj = voicesToShow.find(
                            (v) => v.engine === engine && v.id === id
                          );
                          if (selectedVoiceObj) {
                            setEditedVoice(selectedVoiceObj);
                            console.log('Selected voice:', selectedVoiceObj);
                          } else {
                            console.log('Voice not found for engine:', engine, 'id:', id);
                          }
                        }
                      }}
                      className="select-field"
                    >
                      <option value="">{defaultVoiceInfo}</option>
                      {filteredVoicesToShow.map((voice) => (
                        <option
                          key={`${voice.engine}::${voice.id}`}
                          value={`${voice.engine}::${voice.id}`}
                        >
                          {voice.name} ({voice.language}) - {voice.engine}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={saveSection} className="btn btn-primary mr-2">
                    Save Changes
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <p
                    className="whitespace-pre-wrap mb-4 text-sm"
                    style={{ color: 'var(--text-color)' }}
                  >
                    {section.text || <span className="italic">No text content</span>}
                  </p>
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <select
                        value={editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : ''}
                        onChange={(e) => {
                          const selectedValue = e.target.value;
                          if (selectedValue === '') {
                            setEditedVoice(null);
                            console.log('Voice set to default (null)');
                          } else {
                            const [engine, id] = selectedValue.split('::', 2);
                            const selectedVoiceObj = voicesToShow.find(
                              (v) => v.engine === engine && v.id === id
                            );
                            if (selectedVoiceObj) {
                              setEditedVoice(selectedVoiceObj);
                              console.log('Selected voice:', selectedVoiceObj);
                            } else {
                              console.log('Voice not found for engine:', engine, 'id:', id);
                            }
                          }
                        }}
                        className="select-field flex-1 mr-2"
                      >
                        <option value="">{defaultVoiceInfo}</option>
                        {filteredVoicesToShow.map((voice) => (
                          <option
                            key={`${voice.engine}::${voice.id}`}
                            value={`${voice.engine}::${voice.id}`}
                          >
                            {voice.name} ({voice.language}) - {voice.engine}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                        className="p-2"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Voice Settings"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {showVoiceSettings && (
                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <div className="mb-3">
                          <label
                            className="block text-sm font-medium mb-1"
                            style={{ color: 'var(--text-color)' }}
                          >
                            Volume
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={voiceSettings.volume}
                            onChange={(e) =>
                              setVoiceSettings((prev) => ({
                                ...prev,
                                volume: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full"
                          />
                        </div>
                        <div className="mb-3">
                          <label
                            className="block text-sm font-medium mb-1"
                            style={{ color: 'var(--text-color)' }}
                          >
                            Rate
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="2"
                            step="0.1"
                            value={voiceSettings.rate}
                            onChange={(e) =>
                              setVoiceSettings((prev) => ({
                                ...prev,
                                rate: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label
                            className="block text-sm font-medium mb-1"
                            style={{ color: 'var(--text-color)' }}
                          >
                            Pitch
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={voiceSettings.pitch}
                            onChange={(e) =>
                              setVoiceSettings((prev) => ({
                                ...prev,
                                pitch: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-color)' }} className="mb-4">
                This is an audio-only section. Choose how to provide the audio:
              </p>
              <div className="mb-4">
                <label className="mr-4">
                  <input
                    type="radio"
                    name="audioSource"
                    value="library"
                    checked={audioSource === 'library'}
                    onChange={() => {
                      setAudioSource('library');
                      // Clear uploaded audio when switching to library
                      if (audioData?.source === 'upload') {
                        sessionActions.setGeneratedAudio(section.id, null);
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Select from Library
                </label>
                <label>
                  <input
                    type="radio"
                    name="audioSource"
                    value="upload"
                    checked={audioSource === 'upload'}
                    onChange={() => {
                      setAudioSource('upload');
                      // Clear library selection when switching to upload
                      if (section.audioId) {
                        sessionActions.updateSection({ ...section, audioId: null });
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Upload New Audio
                </label>
              </div>
              {audioSource === 'library' && (
                <div className="mb-4">
                  <select
                    value={section.audioId || ''}
                    onChange={(e) => {
                      const audioId = e.target.value;
                      const audio = state?.AudioLibrary[audioId];
                      if (audio && audio.url && typeof audio.url === 'string') {
                        sessionActions.updateSection({ ...section, audioId });
                        sessionActions.setGeneratedAudio(section.id, { url: audio.url, source: 'library', name: audio.name });
                        sessionActions.setNotification({
                          type: 'success',
                          message: `Selected audio: ${audio.name}`,
                        });
                      } else {
                        sessionActions.updateSection({ ...section, audioId: null });
                        sessionActions.setGeneratedAudio(section.id, null);
                        if (audioId) {
                          sessionActions.setNotification({
                            type: 'error',
                            message: 'Selected audio is invalid or missing a URL.',
                          });
                        }
                      }
                    }}
                    className="select-field w-full"
                    disabled={isProcessing}
                  >
                    <option value="">Select an audio file...</option>
                    {Object.values(state?.AudioLibrary || {}).map((audio) => (
                      <option key={audio.id} value={audio.id}>
                        {audio.name}
                      </option>
                    ))}
                  </select>
                  {hasAudio && audioData?.source === 'library' && (
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
                <div className="mb-4">
                  <input
                    type="file"
                    onChange={handleAudioUpload}
                    accept="audio/*"
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold theme-file-input"
                    disabled={isProcessing}
                  />
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
              {hasAudio ? (
                <button onClick={playAudio} className="btn btn-secondary flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 tableaux 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Play Audio
                </button>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Please select or upload an audio file to play.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionCard;