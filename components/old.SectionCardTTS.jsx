/**
 * @fileoverview Text-to-Speech section card component for the TTS application.
 * Handles the rendering and functionality of text-to-speech sections within
 * the SectionCard component, providing voice selection and text editing.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../utils/logUtils
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {useTTSContext} from '../context/TTSContext';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { devLog, devError, devWarn } from '../utils/logUtils';

/**
 * SectionCardTTS component for handling text-to-speech section content.
 * Provides interfaces for editing text content, selecting voices, and
 * adjusting voice settings (volume, rate, pitch).
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.section - The section data
 * @param {boolean} props.isEditing - Whether the section is being edited
 * @param {Function} props.setIsEditing - Function to set editing state
 * @param {string} props.editedText - The current edited text
 * @param {Function} props.setEditedText - Function to update edited text
 * @param {Object|null} props.editedVoice - The current edited voice
 * @param {Function} props.setEditedVoice - Function to update edited voice
 * @param {Object} props.voiceSettings - The current voice settings
 * @param {Function} props.setVoiceSettings - Function to update voice settings
 * @returns {JSX.Element} The rendered SectionCardTTS component
 */
const SectionCardTTS = ({
  section,
  isEditing,
  setIsEditing,
  editedText,
  setEditedText,
  editedVoice,
  setEditedVoice,
  voiceSettings,
  setVoiceSettings,
}) => {
  const { state } = useTTSContext();
  const { state: sessionState, actions } = useTTSSessionContext ();
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  /**
   * Initialize and sync edited voice with session state.
   * Ensures the component's voice state is consistent with global state.
   */
  useEffect(() => {
    if (section.type !== 'text-to-speech') return;

    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    const defaultVoice = state.settings.defaultVoice || {
      engine: 'gtts',
      id: 'us',
      name: 'American English',
      language: 'en',
      tld: 'com',
    };
    if (sectionData?.voice && JSON.stringify(sectionData.voice) !== JSON.stringify(editedVoice)) {
      devLog('Syncing editedVoice with session state:', sectionData.voice);
      setEditedVoice(sectionData.voice);
    } else if (!sectionData?.voice && !editedVoice) {
      devLog('Setting default voice for editedVoice:', defaultVoice);
      setEditedVoice(defaultVoice);
      actions.setSectionVoice(section.id, defaultVoice);
    }
  }, [sessionState.sections, section.id, section.type, editedVoice, setEditedVoice, actions, state.settings.defaultVoice]);

  /**
   * Initialize voice settings in session state if missing.
   */
  useEffect(() => {
    if (section.type !== 'text-to-speech') return;

    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    if (!sectionData?.voiceSettings && actions.setVoiceSettings) {
      devLog('Initializing voiceSettings in session state:', voiceSettings);
      actions.setVoiceSettings(section.id, voiceSettings);
    }
  }, [section.id, section.type, actions, voiceSettings, sessionState.sections]);

  /**
   * Save voice settings to session state when they change.
   */
  useEffect(() => {
    if (section.type !== 'text-to-speech') return;

    if (actions.setVoiceSettings) {
      devLog('Saving voiceSettings:', voiceSettings);
      actions.setVoiceSettings(section.id, voiceSettings);
    } else {
      devWarn('actions.setVoiceSettings is not defined');
    }
  }, [voiceSettings, section.id, section.type, actions]);

  /**
   * Get active voices and filter for the section's engine.
   * @type {Array}
   */
  const allActiveVoices = useMemo(
    () => Object.values(state?.settings?.activeVoices || {}).flat(),
    [state?.settings?.activeVoices]
  );
  
  /**
   * Filter voices to show based on the current engine.
   * @type {Array}
   */
  const voicesToShow = useMemo(() => {
    if (allActiveVoices.length > 0) {
      return allActiveVoices;
    }
    const defaultVoice = state?.settings?.defaultVoices?.gtts?.[0] || {
      engine: 'gtts',
      id: 'us',
      name: 'American English',
      language: 'en',
      tld: 'com',
    };
    return [defaultVoice];
  }, [allActiveVoices, state?.settings?.defaultVoices]);


  /**
   * Get the default voice object from settings.
   * @type {Object|null}
   */
  const defaultVoiceObj = useMemo(() => {
    const defaultVoiceSetting = state?.settings?.defaultVoice;
    if (defaultVoiceSetting) {
      const { engine, voiceId } = defaultVoiceSetting;
      return voicesToShow.find((v) => v.engine === engine && v.id === voiceId);
    }
    return voicesToShow[0] || null;
  }, [state?.settings?.defaultVoice, voicesToShow]);

  /**
   * Filter out the default voice from the list of voices to show.
   * @type {Array}
   */
  const filteredVoicesToShow = useMemo(() => {
    if (defaultVoiceObj) {
      return voicesToShow.filter(
        (v) => !(v.engine === defaultVoiceObj.engine && v.id === defaultVoiceObj.id)
      );
    }
    return voicesToShow;
  }, [voicesToShow, defaultVoiceObj]);

  /**
   * Format the default voice info for display.
   * @type {string}
   */
  const defaultVoiceInfo = useMemo(() => {
    return defaultVoiceObj
      ? `Default Voice - ${defaultVoiceObj.name} (${defaultVoiceObj.language}) - ${defaultVoiceObj.engine}`
      : 'Default Voice';
  }, [defaultVoiceObj]);

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  /**
   * Set up audio element for playback and handle cleanup.
   */
  useEffect(() => {
    if (hasAudio && audioData.url) {
      audioRef.current = new Audio(audioData.url);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('error', () => {
        devError(`Audio load error for section ${section.id}`);
        setIsPlaying(false);
      });
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          // Use a more robust cleanup that doesn't depend on removeEventListener
          try {
            if (typeof audioRef.current.removeEventListener === 'function') {
              audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
              audioRef.current.removeEventListener('error', () => {});
            }
          } catch (e) {
            devWarn('Could not remove event listeners from audio element', e);
          }
          audioRef.current = null;
        }
      };
    }
  }, [audioData?.url, hasAudio, section.id]);

  /**
   * Toggle play/pause of the section's audio.
   */
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => devError(`Playback error for section ${section.id}:`, error));
      setIsPlaying(true);
    }
  };

  return (
    <div>
      {isEditing ? (
        <div id={`section-${section.id}-edit-container`}>
          <textarea
            id={`section-${section.id}-text-input`}
            data-testid={`section-${section.id}-text-input`}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="input-field h-32 mb-4 font-mono text-sm"
            placeholder="Enter text for this section..."
          ></textarea>
          <div className="mb-4">
            <label
              id={`section-${section.id}-voice-label`}
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-color)' }}
            >
              Voice (optional)
            </label>
            <select
              id={`section-${section.id}-voice-select`}
              data-testid={`section-${section.id}-voice-select`}
              value={editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : ''}
              onChange={(e) => {
                const selectedValue = e.target.value;
                if (selectedValue === '') {
                  setEditedVoice(null);
                  actions.setSectionVoice(section.id, null);
                  devLog('Voice set to default (null)');
                } else {
                  const [engine, id] = selectedValue.split('::', 2);
                  const selectedVoiceObj = voicesToShow.find(
                    (v) => v.engine === engine && v.id === id
                  );
                  if (selectedVoiceObj) {
                    setEditedVoice(selectedVoiceObj);
                    actions.setSectionVoice(section.id, selectedVoiceObj);
                    devLog('Selected voice:', selectedVoiceObj);
                  } else {
                    devWarn('Voice not found for engine:', engine, 'id:', id);
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
                  {voice.name} ({voice.language}) {voice.tld ? `(${voice.tld})` : ''} - {voice.engine}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div id={`section-${section.id}-view-container`}>
          <p
            id={`section-${section.id}-text-content`}
            className="whitespace-pre-wrap mb-4 text-sm"
            style={{ color: 'var(--text-color)' }}
          >
            {section.text || <span className="italic">No text content</span>}
          </p>
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <select
                id={`section-${section.id}-voice-select-view`}
                data-testid={`section-${section.id}-voice-select-view`}
                value={editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : ''}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  if (selectedValue === '') {
                    setEditedVoice(null);
                    actions.setSectionVoice(section.id, null);
                    devLog('Voice set to default (null)');
                  } else {
                    const [engine, id] = selectedValue.split('::', 2);
                    const selectedVoiceObj = voicesToShow.find(
                      (v) => v.engine === engine && v.id === id
                    );
                    if (selectedVoiceObj) {
                      setEditedVoice(selectedVoiceObj);
                      actions.setSectionVoice(section.id, selectedVoiceObj);
                      devLog('Selected voice:', selectedVoiceObj);
                    } else {
                      devWarn('Voice not found for engine:', engine, 'id:', id);
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
                    {voice.name} ({voice.language}) {voice.tld ? `(${voice.tld})` : ''} - {voice.engine}
                  </option>
                ))}
              </select>
              <button
                id={`section-${section.id}-voice-settings-toggle`}
                data-testid={`section-${section.id}-voice-settings-toggle`}
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
              <div id={`section-${section.id}-voice-settings`} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
                <div className="mb-3">
                  <label
                    id={`section-${section.id}-volume-label`}
                    htmlFor={`section-${section.id}-volume-slider`}
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-color)' }}
                  >
                    Volume
                  </label>
                  <input
                    id={`section-${section.id}-volume-slider`}
                    data-testid={`section-${section.id}-volume-slider`}
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
                    id={`section-${section.id}-rate-label`}
                    htmlFor={`section-${section.id}-rate-slider`}
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-color)' }}
                  >
                    Rate
                  </label>
                  <input
                    id={`section-${section.id}-rate-slider`}
                    data-testid={`section-${section.id}-rate-slider`}
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
                    id={`section-${section.id}-pitch-label`}
                    htmlFor={`section-${section.id}-pitch-slider`}
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-color)' }}
                  >
                    Pitch
                  </label>
                  <input
                    id={`section-${section.id}-pitch-slider`}
                    data-testid={`section-${section.id}-pitch-slider`}
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
            {hasAudio && (
              <div className="flex items-center space-x-2 mt-2">
                <button
                  id={`section-${section.id}-play-button`}
                  data-testid={`section-${section.id}-play-button`}
                  onClick={togglePlay}
                  className="p-2"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <rect x="5" y="4" width="4" height="12" />
                      <rect x="11" y="4" width="4" height="12" />
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
                <a
                  id={`section-${section.id}-download-link`}
                  data-testid={`section-${section.id}-download-link`}
                  href={audioData.url}
                  download={`section-${section.id}.wav`}
                  className="p-2"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Download audio"
                  title="Download"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionCardTTS;