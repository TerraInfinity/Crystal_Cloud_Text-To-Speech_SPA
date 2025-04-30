import React, { useState, useEffect } from 'react';
import { useTTSSession } from '../context/TTSSessionContext';
import AudioSection from './SectionCardAudio';
import TTSSection from './SectionCardTTS';
import { devLog } from '../utils/logUtils';

const SectionCard = ({ section, index, moveUp, moveDown }) => {
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [editedText, setEditedText] = useState(section.text || '');
  const [editedVoice, setEditedVoice] = useState(
    section.type === 'text-to-audio' ? section.voice || null : null
  );
  const [voiceSettings, setVoiceSettings] = useState(
    section.type === 'text-to-audio'
      ? {
          volume: section.voiceSettings?.volume || 1,
          rate: section.voiceSettings?.rate || 1,
          pitch: section.voiceSettings?.pitch || 1,
        }
      : null
  );

  // Sync editedVoice and voiceSettings with sessionState.sections
  useEffect(() => {
    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    if (!sectionData) return;

    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

    if (sectionData.type === 'text-to-audio') {
      // For text-to-audio, sync voice and voiceSettings
      if (sectionData?.voice && sectionData.voice !== editedVoice) {
        devLog('Syncing editedVoice with session state:', sectionData.voice);
        setEditedVoice(sectionData.voice);
      } else if (!editedVoice) {
        devLog('Setting default voice for editedVoice:', defaultVoice);
        setEditedVoice(defaultVoice);
        sessionActions.setSectionVoice(section.id, defaultVoice);
      }

      if (sectionData?.voiceSettings && sectionData.voiceSettings !== voiceSettings) {
        devLog('Syncing voiceSettings with session state:', sectionData.voiceSettings);
        setVoiceSettings(sectionData.voiceSettings);
      } else if (!voiceSettings) {
        devLog('Setting default voiceSettings:', defaultVoiceSettings);
        setVoiceSettings(defaultVoiceSettings);
        sessionActions.setVoiceSettings(section.id, defaultVoiceSettings);
      }
    } else {
      // For audio-only, ensure voice and voiceSettings are null
      if (editedVoice !== null) {
        devLog('Clearing editedVoice for audio-only section');
        setEditedVoice(null);
      }
      if (voiceSettings !== null) {
        devLog('Clearing voiceSettings for audio-only section');
        setVoiceSettings(null);
      }
    }
  }, [sessionState.sections, section.id, editedVoice, voiceSettings, sessionActions]);

  const toggleSectionType = () => {
    const newType = section.type === 'text-to-audio' ? 'audio-only' : 'text-to-audio';
    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

    let updatedSection;
    if (newType === 'text-to-audio') {
      // Switching to text-to-audio: Add voice and voiceSettings
      updatedSection = {
        ...section,
        type: newType,
        voice: editedVoice || defaultVoice,
        voiceSettings: voiceSettings || defaultVoiceSettings,
      };
      setEditedVoice(editedVoice || defaultVoice);
      setVoiceSettings(voiceSettings || defaultVoiceSettings);
      devLog('Switching to text-to-audio, setting voice and voiceSettings:', updatedSection);
    } else {
      // Switching to audio-only: Remove voice and voiceSettings
      updatedSection = {
        ...section,
        type: newType,
        voice: undefined, // Remove voice
        voiceSettings: undefined, // Remove voiceSettings
      };
      setEditedVoice(null);
      setVoiceSettings(null);
      devLog('Switching to audio-only, removing voice and voiceSettings:', updatedSection);
    }

    sessionActions.updateSection(updatedSection);
  };

  const saveSection = () => {
    // Debug: Log the state before saving
    console.log('Current editedVoice before save:', editedVoice);
    console.log('Saving section:', {
      id: section.id,
      title: editedTitle,
      text: editedText,
      voice: section.type === 'text-to-audio' ? editedVoice : undefined,
      voiceSettings: section.type === 'text-to-audio' ? voiceSettings : undefined,
    });

    const updatedSection = {
      ...section,
      title: editedTitle,
      text: editedText,
    };

    if (section.type === 'text-to-audio') {
      updatedSection.voice = editedVoice;
      updatedSection.voiceSettings = voiceSettings;
    } else {
      updatedSection.voice = undefined;
      updatedSection.voiceSettings = undefined;
    }

    sessionActions.updateSection(updatedSection);
    setIsEditing(false);
    sessionActions.setNotification({
      type: 'success',
      message: 'Section updated successfully',
    });

    // Debug: Log the stored sections after saving
    setTimeout(() => {
      const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
      console.log('Stored tts_session_state:', storedState);
    }, 100); // Delay to ensure storage is updated
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
              <div className="flex items-center">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="input-field mr-2"
                />
                <button onClick={saveSection} className="btn btn-primary mr-2">
                  Save
                </button>
                <button onClick={() => setIsEditing(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
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
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-5"
              >
                <path d="M10.5 3.75a.75.75 0 0 0-1.264-.546L5.203 7H2.667a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 1.5 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h2.535l4.033 3.796a.75.75 0 0 0 1.264-.546V3.75ZM16.45 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z" />
                <path d="M14.329 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
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
            <TTSSection
              section={section}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              editedText={editedText}
              setEditedText={setEditedText}
              editedVoice={editedVoice}
              setEditedVoice={setEditedVoice}
              voiceSettings={voiceSettings}
              setVoiceSettings={setVoiceSettings}
            />
          ) : (
            <AudioSection section={section} />
          )}
        </div>
      )}
    </div>
  );
};

export default SectionCard;