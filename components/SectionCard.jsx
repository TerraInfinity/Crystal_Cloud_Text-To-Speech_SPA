/**
 * @fileoverview Section card component for the Text-to-Speech application.
 * This component renders and manages individual TTS or audio-only sections,
 * handling section editing, playback, and type toggling.
 * 
 * @requires React
 * @requires ../context/TTSSessionContext
 * @requires ./SectionCardAudio
 * @requires ./SectionCardTTS
 * @requires ../utils/logUtils
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import AudioSection from './SectionCardAudio';
import TTSSection from './SectionCardTTS';
import { devLog, devWarn } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

/**
 * Validates an audio URL to ensure it's in a proper format
 * @param {string} url - The URL to validate
 * @returns {boolean} Whether the URL is valid
 */
const isValidAudioUrl = (url) => {
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
 * SectionCard component for rendering and managing individual TTS or audio-only sections.
 * Handles section editing, reordering, deletion, and toggling between section types.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.section - The section data to render
 * @param {number} props.index - The index of this section in the sections array
 * @param {Function} props.moveUp - Function to move this section up in the order
 * @param {Function} props.moveDown - Function to move this section down in the order
 * @returns {JSX.Element} The rendered SectionCard component
 */
const SectionCard = ({ section, index, moveUp, moveDown }) => {
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext ();
  const { addNotification } = useNotification();

  // Component state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [editedText, setEditedText] = useState(section.text || '');
  const [editedVoice, setEditedVoice] = useState(
    section.type === 'text-to-speech' ? section.voice || null : null
  );
  const [voiceSettings, setVoiceSettings] = useState(
    section.type === 'text-to-speech'
      ? {
          volume: section.voiceSettings?.volume || 1,
          rate: section.voiceSettings?.rate || 1,
          pitch: section.voiceSettings?.pitch || 1,
        }
      : null
  );
  
  // Store previous voice when toggling to audio-only
  const previousVoiceRef = useRef(null);

  /**
   * Attempt to restore saved voice preference from localStorage on component mount
   */
  useEffect(() => {
    if (section.type === 'text-to-speech' && !previousVoiceRef.current) {
      try {
        // Check if we have a saved voice preference in localStorage
        const voiceStorage = JSON.parse(localStorage.getItem('voice_selections') || '{}');
        if (voiceStorage[section.id]) {
          previousVoiceRef.current = voiceStorage[section.id];
          devLog('Restored voice from localStorage for section:', section.id, previousVoiceRef.current);
          
          // If section doesn't already have a voice, apply the stored one
          if (!section.voice) {
            const updatedSection = {
              ...section,
              voice: previousVoiceRef.current
            };
            sessionActions.updateSection(updatedSection);
            setEditedVoice(previousVoiceRef.current);
            devLog('Applied restored voice to section:', section.id);
          }
        }
      } catch (e) {
        devLog('Error restoring voice from localStorage:', e);
      }
    }
  }, [section.id, section.type]);

  /**
   * Syncs voice and voice settings with sessionState.
   * Ensures local state reflects the current settings from the session.
   */
  useEffect(() => {
    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    if (!sectionData) return;

    // Check if we need to update voice or voice settings by comparing stringified values
    const sessionVoice = sectionData.voice ? JSON.stringify(sectionData.voice) : null;
    const localVoice = editedVoice ? JSON.stringify(editedVoice) : null;
    const sessionSettings = sectionData.voiceSettings ? JSON.stringify(sectionData.voiceSettings) : null;
    const localSettings = voiceSettings ? JSON.stringify(voiceSettings) : null;

    // Debug section data type
    devLog(`Section ${section.id} type from sessionState:`, sectionData.type);
    devLog(`Section ${section.id} local type:`, section.type);

    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

    // Make sure the local section type matches the session state
    if (sectionData.type !== section.type) {
      devLog(`Section type mismatch! Session: ${sectionData.type}, Local: ${section.type}`);
      // Update the local state if there's a mismatch
      // Note: This is just for debugging as the local section object should be updated
      // through props when the parent component re-renders
    }

    // Only perform updates if there's an actual change needed
    let voiceUpdated = false;
    let settingsUpdated = false;

    if (sectionData.type === 'text-to-speech') {
      // For text-to-speech, sync voice and voiceSettings only when different
      if (sectionData?.voice && sessionVoice !== localVoice) {
        devLog('Syncing editedVoice with session state:', sectionData.voice);
        setEditedVoice(sectionData.voice);
        previousVoiceRef.current = sectionData.voice;
        voiceUpdated = true;
      } else if (!editedVoice && !voiceUpdated) {
        devLog('Setting default voice for editedVoice:', defaultVoice);
        setEditedVoice(defaultVoice);
        previousVoiceRef.current = defaultVoice;
        // Only dispatch if this is a brand new section (no voice yet in session)
        if (!sectionData.voice) {
          sessionActions.setSectionVoice(section.id, defaultVoice);
        }
      }

      if (sectionData?.voiceSettings && sessionSettings !== localSettings) {
        devLog('Syncing voiceSettings with session state:', sectionData.voiceSettings);
        setVoiceSettings(sectionData.voiceSettings);
        settingsUpdated = true;
      } else if (!voiceSettings && !settingsUpdated) {
        devLog('Setting default voiceSettings:', defaultVoiceSettings);
        setVoiceSettings(defaultVoiceSettings);
        // Only dispatch if this is a brand new section (no settings yet in session)
        if (!sectionData.voiceSettings) {
          sessionActions.setVoiceSettings(section.id, defaultVoiceSettings);
        }
      }
    } else {
      // For audio-only, ensure voice and voiceSettings are null in component state
      // but preserve them for possible restoration
      if (editedVoice !== null && !previousVoiceRef.current) {
        previousVoiceRef.current = editedVoice;
        devLog('Storing voice for audio-only section:', previousVoiceRef.current);
        setEditedVoice(null);
      }
      if (voiceSettings !== null) {
        devLog('Clearing voiceSettings for audio-only section');
        setVoiceSettings(null);
      }
    }
  }, [sessionState.sections, section.id, section.type, editedVoice, voiceSettings, sessionActions]);

  /**
   * Toggles the section type between text-to-speech and audio-only.
   * Updates section properties based on the new type.
   */
  const toggleSectionType = () => {
    const newType = section.type === 'text-to-speech' ? 'audio-only' : 'text-to-speech';
    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
    
    // Validate audioUrl
    const isValid = section.audioUrl ? isValidAudioUrl(section.audioUrl) : true;
    
    devLog('Toggling section type:', {
      id: section.id,
      fromType: section.type,
      toType: newType,
      audioUrl: section.audioUrl,
      isValidAudioUrl: isValid
    });
    
    if (section.audioUrl && !isValid) {
      devWarn(`Invalid audioUrl detected in section ${section.id} during type toggle: ${section.audioUrl}`);
    }

    // Store current voice settings before changing type
    const currentVoice = section.voice || editedVoice;
    const currentVoiceSettings = section.voiceSettings || voiceSettings;

    if (section.type === 'text-to-speech') {
      // When switching to audio-only, save the current voice
      if (currentVoice) {
        previousVoiceRef.current = { ...currentVoice }; // Create a new object to avoid reference issues
        devLog('Switching to audio-only, storing voice:', previousVoiceRef.current);
      }
    }

    let updatedSection;
    if (newType === 'text-to-speech') {
      // Switching to text-to-speech: Add voice and voiceSettings
      // Restore previously saved voice if available
      const voiceToUse = previousVoiceRef.current || currentVoice || defaultVoice;
      updatedSection = {
        ...section,
        type: newType,
        voice: voiceToUse,
        voiceSettings: currentVoiceSettings || defaultVoiceSettings,
        audioUrl: isValid ? section.audioUrl : undefined // Clear invalid audioUrl when switching types
      };
      setEditedVoice(voiceToUse);
      setVoiceSettings(currentVoiceSettings || defaultVoiceSettings);
      devLog('Switching to text-to-speech, restoring voice:', voiceToUse);
    } else {
      // Switching to audio-only: Store voice and settings but remove from section
      updatedSection = {
        ...section,
        type: newType,
        voice: undefined, // Remove voice from section object
        voiceSettings: undefined, // Remove voiceSettings from section object
        audioUrl: isValid ? section.audioUrl : undefined // Clear invalid audioUrl when switching types
      };
      
      // Make sure to store the current voice for possible toggle back
      if (currentVoice && !previousVoiceRef.current) {
        previousVoiceRef.current = { ...currentVoice };
        devLog('Switching to audio-only, saving voice for later use:', currentVoice);
      }
    }

    // Update the section in session state
    sessionActions.updateSection(updatedSection);
    
    // Persist current voice selection in session storage
    if (currentVoice) {
      try {
        const voiceStorage = JSON.parse(localStorage.getItem('voice_selections') || '{}');
        voiceStorage[section.id] = currentVoice;
        localStorage.setItem('voice_selections', JSON.stringify(voiceStorage));
        devLog('Stored voice selection for section:', section.id);
      } catch (e) {
        devLog('Could not store voice selection in localStorage:', e);
      }
    }
    
    // Log the stored section after toggling
    setTimeout(() => {
      const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
      const storedSection = storedState.sections?.find(s => s.id === section.id);
      devLog('Stored tts_session_state after type toggle:', {
        sectionId: section.id,
        newType,
        audioUrl: storedSection?.audioUrl
      });
    }, 100);
  };

  /**
   * Saves section changes to the session state.
   * Updates the section with edited values for title, text, voice, and voiceSettings.
   */
  const saveSection = () => {
    const isValid = section.audioUrl ? isValidAudioUrl(section.audioUrl) : true;
    
    // Debug: Log the state before saving
    devLog('Current editedVoice before save:', editedVoice);
    devLog('Saving section:', {
      id: section.id,
      title: editedTitle,
      text: editedText,
      voice: section.type === 'text-to-speech' ? editedVoice : undefined,
      audioUrl: section.audioUrl,
      isValidAudioUrl: isValid
    });
    
    if (section.audioUrl && !isValid) {
      devWarn(`Invalid audioUrl detected in section ${section.id}: ${section.audioUrl}`);
    }

    const updatedSection = {
      ...section,
      title: editedTitle,
      text: editedText,
      audioUrl: isValid ? section.audioUrl : undefined // Clear invalid audioUrl
    };

    if (section.type === 'text-to-speech') {
      updatedSection.voice = editedVoice;
      updatedSection.voiceSettings = voiceSettings;
      // Also save to ref for possible type toggling
      if (editedVoice) {
        previousVoiceRef.current = { ...editedVoice };
        
        // Also persist to localStorage as a backup
        try {
          const voiceStorage = JSON.parse(localStorage.getItem('voice_selections') || '{}');
          voiceStorage[section.id] = editedVoice;
          localStorage.setItem('voice_selections', JSON.stringify(voiceStorage));
        } catch (e) {
          devLog('Could not store voice selection in localStorage:', e);
        }
      }
    } else {
      updatedSection.voice = undefined;
      updatedSection.voiceSettings = undefined;
    }

    sessionActions.updateSection(updatedSection);
    setIsEditing(false);
    addNotification({
      type: 'success',
      message: 'Section updated successfully',
    });

    // Debug: Log the stored sections after saving
    setTimeout(() => {
      const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
      const storedSection = storedState.sections?.find(s => s.id === section.id);
      devLog('Stored tts_session_state after save:', {
        sectionId: section.id,
        audioUrl: storedSection?.audioUrl
      });
    }, 100); // Delay to ensure storage is updated
  };

  /**
   * Deletes the section after confirmation.
   * Removes the section from the session state.
   */
  const deleteSection = () => {
    if (window.confirm(`Are you sure you want to delete "${section.title}"?`)) {
      sessionActions.removeSection(section.id);
      addNotification({
        type: 'success',
        message: 'Section deleted successfully',
      });
    }
  };

  return (
    <div
      id={`section-card-${section.id}`}
      data-testid={`section-card-${section.id}`}
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
              id={`move-up-${section.id}`}
              data-testid={`move-up-${section.id}`}
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
              id={`move-down-${section.id}`}
              data-testid={`move-down-${section.id}`}
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
                  id={`section-title-input-${section.id}`}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="input-field mr-2"
                />
                <button 
                  id={`save-section-${section.id}`}
                  onClick={saveSection} 
                  className="btn btn-primary mr-2"
                >
                  Save
                </button>
                <button 
                  id={`cancel-edit-${section.id}`}
                  onClick={() => setIsEditing(false)} 
                  className="btn btn-secondary"
                >
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
                  ({section.type === 'text-to-speech' ? 'Text to Speech' : 'Audio Only'})
                </span>
              </h3>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            id={`toggle-expand-${section.id}`}
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
            id={`toggle-section-type-${section.id}`}
            onClick={toggleSectionType}
            className="p-1"
            style={{ color: 'var(--accent-color)' }}
            title="Toggle Section Type"
          >
            {section.type === 'text-to-speech' ? (
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
            id={`toggle-edit-${section.id}`}
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
            id={`delete-section-${section.id}`}
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
          {section.type === 'text-to-speech' ? (
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