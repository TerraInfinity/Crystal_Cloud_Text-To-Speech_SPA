import React, { useState, useRef, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';

const SectionCardAudio = ({ section }) => {
  const { state, isProcessing } = useTTS();
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  const [audioSource, setAudioSource] = useState(
    section.audioSource || (hasAudio && audioData.source) || 'library'
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [showPlayAudioItems, setShowPlayAudioItems] = useState(false);

  const audioRef = useRef(null);

  useEffect(() => {
    console.log('SectionCardAudio mounted with:', {
      sectionAudioSource: section.audioSource,
      audioDataSource: audioData?.source,
      audioSource,
      audioData,
      hasAudio,
      showPlayAudioItems,
    });
  }, []);

  useEffect(() => {
    if (audioSource === 'library') {
      setShowPlayAudioItems(!!section.audioId && hasAudio);
    } else if (audioSource === 'upload') {
      setShowPlayAudioItems(hasAudio && audioData?.source === 'upload');
    }
  }, [audioSource, section.audioId, hasAudio, audioData]);

  useEffect(() => {
    if (hasAudio && audioData.url) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      audioRef.current = new Audio(audioData.url);
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      setIsPlaying(false);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioData?.url, hasAudio]);

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
      sessionActions.updateSection({ ...section, audioId: null, audioSource: 'upload' });
      sessionActions.setGeneratedAudio(section.id, { url: audioUrl, source: 'upload', name: file.name });
      sessionActions.setNotification({
        type: 'success',
        message: `Audio file "${file.name}" uploaded successfully`,
      });
      setAudioSource('upload');
    } catch (error) {
      console.error('Error uploading audio:', error);
      sessionActions.setError(`Error uploading audio: ${error.message}`);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioData.url);
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => {
        console.error('Error playing audio:', error);
        sessionActions.setError('Error playing audio');
      });
      setIsPlaying(true);
    }
  };

  const toggleAudioPlayer = () => {
    setShowAudioPlayer((prev) => !prev);
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
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
            onChange={() => {
              setAudioSource('library');
              if (audioData?.source === 'upload') {
                sessionActions.setGeneratedAudio(section.id, null);
              }
              if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
              }
              sessionActions.updateSection({ ...section, audioSource: 'library' });
            }}
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
            onChange={() => {
              setAudioSource('upload');
              if (section.audioId) {
                sessionActions.updateSection({ ...section, audioId: null, audioSource: 'upload' });
              }
              if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
              }
            }}
            className="radio-input"
          />
          Upload New Audio
        </label>
      </div>
      {audioSource === 'library' && (
        <div className="mb-4" id="section-card-library-selector">
          <select
            id="section-card-audio-library-select"
            value={section.audioId || ''}
            onChange={(e) => {
              const audioId = e.target.value;
              const audio = state?.AudioLibrary[audioId];
              if (audio && audio.url && typeof audio.url === 'string') {
                sessionActions.updateSection({ ...section, audioId, audioSource: 'library' });
                sessionActions.setGeneratedAudio(section.id, { url: audio.url, source: 'library', name: audio.name });
                sessionActions.setNotification({
                  type: 'success',
                  message: `Selected audio: ${audio.name}`,
                });
              } else {
                sessionActions.updateSection({ ...section, audioId: null, audioSource: 'library' });
                sessionActions.setGeneratedAudio(section.id, null);
                if (audioId) {
                  sessionActions.setNotification({
                    type: 'error',
                    message: 'Selected audio is invalid or missing a URL.',
                  });
                }
              }
              if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
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
          <input
            id="section-card-audio-upload-input"
            data-testid="section-card-audio-upload-input"
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
      <div
        id="section-card-play-audio-items"
        className={`flex items-center ${showPlayAudioItems ? 'visible' : ''}`}
      >
        {showAudioPlayer ? (
          <audio
            id="section-card-audio-player"
            data-testid="section-card-audio-player"
            controls
            src={audioData.url}
            className="w-full max-w-md"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <button
            id="section-card-play-audio-button-mini"
            data-testid="section-card-play-audio-button-mini"
            onClick={togglePlayAudio}
            className="btn btn-secondary flex items-center mr-2"
            style={{ padding: '0.5rem' }}
          >
            {isPlaying ? (
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
                <rect x="11" y="11" width="2" height="2" fill="currentColor" />
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
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        )}
        <button
          id="section-card-toggle-player-button"
          data-testid="section-card-toggle-player-button"
          onClick={toggleAudioPlayer}
          className="p-1"
          style={{ color: 'var(--text-secondary)' }}
          title={showAudioPlayer ? 'Hide Audio Player' : 'Show Audio Player'}
        >
          {showAudioPlayer ? (
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
          ) : (
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
          )}
        </button>
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