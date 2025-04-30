import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';

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
  const { state } = useTTS();
  const { state: sessionState, actions } = useTTSSession();
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Initialize and sync editedVoice with sessionState.sections
  useEffect(() => {
    if (section.type !== 'text-to-audio') return;

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

  // Initialize voiceSettings in session state if missing
  useEffect(() => {
    if (section.type !== 'text-to-audio') return;

    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    if (!sectionData?.voiceSettings && actions.setVoiceSettings) {
      devLog('Initializing voiceSettings in session state:', voiceSettings);
      actions.setVoiceSettings(section.id, voiceSettings);
    }
  }, [section.id, section.type, actions, voiceSettings, sessionState.sections]);

  // Save voiceSettings to session state on change
  useEffect(() => {
    if (section.type !== 'text-to-audio') return;

    if (actions.setVoiceSettings) {
      devLog('Saving voiceSettings:', voiceSettings);
      actions.setVoiceSettings(section.id, voiceSettings);
    } else {
      console.warn('actions.setVoiceSettings is not defined');
    }
  }, [voiceSettings, section.id, section.type, actions]);

  // Get active voices and filter for the section's engine
  const allActiveVoices = useMemo(
    () => Object.values(state?.settings?.activeVoices || {}).flat(),
    [state?.settings?.activeVoices]
  );
  const voicesToShow = useMemo(() => {
    const engine = editedVoice?.engine || 'gtts';
    const filteredVoices = allActiveVoices.filter(v => v.engine === engine);
    if (filteredVoices.length > 0) {
      return filteredVoices;
    }
    const defaultVoice = state?.settings?.defaultVoices?.[engine]?.[0] || {
      engine: 'gtts',
      id: 'us',
      name: 'American English',
      language: 'en',
      tld: 'com',
    };
    return [defaultVoice];
  }, [allActiveVoices, editedVoice, state?.settings?.defaultVoices]);

  const defaultVoiceObj = useMemo(() => {
    const defaultVoiceSetting = state?.settings?.defaultVoice;
    if (defaultVoiceSetting) {
      const { engine, voiceId } = defaultVoiceSetting;
      return voicesToShow.find((v) => v.engine === engine && v.id === voiceId);
    }
    return voicesToShow[0] || null;
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

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const hasAudio = !!audioData && !!audioData.url;

  useEffect(() => {
    if (hasAudio && audioData.url) {
      audioRef.current = new Audio(audioData.url);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('error', () => {
        console.error(`Audio load error for section ${section.id}`);
        setIsPlaying(false);
      });
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
          audioRef.current.removeEventListener('error', () => {});
          audioRef.current = null;
        }
      };
    }
  }, [audioData?.url, hasAudio, section.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => console.error(`Playback error for section ${section.id}:`, error));
      setIsPlaying(true);
    }
  };

  return (
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
                    console.warn('Voice not found for engine:', engine, 'id:', id);
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
                      console.warn('Voice not found for engine:', engine, 'id:', id);
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
            {hasAudio && (
              <div className="flex items-center space-x-2 mt-2">
                <button
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