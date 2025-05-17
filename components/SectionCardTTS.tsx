/**
 * @fileoverview Text-to-Speech section card component for the TTS application.
 * Handles the rendering and functionality of text-to-speech sections within
 * the SectionCard component, providing voice selection and text editing.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../utils/logUtils
 * @requires ../utils/voiceUtils
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { devLog, devError, devWarn } from '../utils/logUtils';
import { Voice, validateVoice, validateVoiceObject } from '../utils/voiceUtils';
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
 * Convert a blob URL to a data URL for better persistence
 * @param {string} blobUrl - The blob URL to convert
 * @returns {Promise<string>} A promise that resolves to a data URL
 */
const blobToDataURL = async (blobUrl: string): Promise<string> => {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    devError("Failed to convert blob URL to data URL:", error);
    throw error;
  }
};

/**
 * Props for SectionCardTTS component
 */
interface SectionCardTTSProps {
  section: {
    id: string;
    title: string;
    type: string;
    text: string;
    voice: Voice | null;
    voiceSettings: { volume: number; rate: number; pitch: number };
    audioUrl?: string;
  };
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  editedText: string;
  setEditedText: (text: string) => void;
  editedVoice: Voice | null;
  setEditedVoice: (voice: Voice | null) => void;
  voiceSettings: { volume: number; rate: number; pitch: number };
  setVoiceSettings: (settings: { volume: number; rate: number; pitch: number } | ((prev: { volume: number; rate: number; pitch: number }) => { volume: number; rate: number; pitch: number })) => void;
}

/**
 * SectionCardTTS component for handling text-to-speech section content.
 * Provides interfaces for editing text content, selecting voices, and
 * adjusting voice settings (volume, rate, pitch).
 * 
 * @component
 * @param {SectionCardTTSProps} props - Component props
 * @returns {JSX.Element} The rendered SectionCardTTS component
 */
const SectionCardTTS: React.FC<SectionCardTTSProps> = ({
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
  const { state: sessionState, actions } = useTTSSessionContext();
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUserInitiatedChange = useRef(false);
  const voiceSelectPending = useRef(false);
  const lastSelectedVoice = useRef<Voice | null>(null);
  const { addNotification } = useNotification();
  
  // Store initial voice when component mounts to preserve user selection
  useEffect(() => {
    if (section.voice && section.type === 'text-to-speech') {
      lastSelectedVoice.current = section.voice;
      devLog('Initially storing voice for section:', section.id, 'Voice:', section.voice);
    }
  }, [section.id]);

  // Get activeVoices and defaultVoice from TTSContext
  const activeVoices = (state?.settings?.activeVoices as unknown as Voice[]) || [];
  const defaultVoice = state?.settings?.defaultVoice as Voice | null;

  /**
   * Initialize and sync edited voice with session state.
   */
  useEffect(() => {
    if (section.type !== 'text-to-speech') return;

    // Skip synchronization if this component just processed a user-initiated change
    if (isUserInitiatedChange.current || voiceSelectPending.current) {
      devLog('Skipping voice sync due to user-initiated change or pending selection');
      return;
    }

    const sectionData = sessionState.sections.find((s) => s.id === section.id);
    if (!sectionData) return;

    let voiceToUse = sectionData?.voice || null;

    // Don't force validation against activeVoices if the section already has a voice
    // This preserves template-specified voices even if they aren't in activeVoices
    if (voiceToUse) {
      // Make sure the voice has all required properties, but don't replace with defaultVoice
      const formattedVoice = validateVoiceObject(voiceToUse);
      
      // Only update local state if different
      if (JSON.stringify(formattedVoice) !== JSON.stringify(editedVoice)) {
        devLog('Syncing editedVoice with section voice:', formattedVoice);
        setEditedVoice(formattedVoice);
        lastSelectedVoice.current = formattedVoice;
      }
    } else if (lastSelectedVoice.current) {
      // Try to use the last manually selected voice if available
      devLog('Using lastSelectedVoice for section:', section.id, 'Voice:', lastSelectedVoice.current);
      setEditedVoice(lastSelectedVoice.current);
      
      // Also update the session state to keep it in sync
      if (actions.setSectionVoice) {
        actions.setSectionVoice(section.id, lastSelectedVoice.current);
      }
    } else {
      // If no voice, use default as a last resort
      const validatedVoice = defaultVoice;
      if (JSON.stringify(validatedVoice) !== JSON.stringify(editedVoice)) {
        devLog('No voice, setting default voice:', validatedVoice);
        setEditedVoice(validatedVoice);
        lastSelectedVoice.current = validatedVoice;
      }

      if (!sectionData?.voice && actions.setSectionVoice) {
        // Only update session if the section truly has no voice
        devLog('Updating session state with default voice for section:', section.id);
        actions.setSectionVoice(section.id, validatedVoice);
      }
    }
  }, [sessionState.sections, section.id, section.type, defaultVoice, actions, editedVoice]);

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
   * Get voices to show in the dropdown.
   */
  const voicesToShow = useMemo(() => {
    return activeVoices.filter((voice: Voice) => voice.engine === 'gtts' || voice.engine === 'elevenlabs');
  }, [activeVoices]);

  /**
   * Format the default voice info for display.
   */
  const defaultVoiceInfo = useMemo(() => {
    if (!defaultVoice) {
      return 'Default Voice - None';
    }
    const validDefaultVoice = validateVoice(defaultVoice, activeVoices, defaultVoice);
    return `Default Voice - ${validDefaultVoice.name} (${validDefaultVoice.language}${validDefaultVoice.tld ? `, ${validDefaultVoice.tld}` : ''}) - ${validDefaultVoice.engine}`;
  }, [defaultVoice, activeVoices]);

  const audioData = sessionState?.generatedTTSAudios[section.id];
  const audioUrl = section.audioUrl || (audioData?.url || null);
  const isValidUrl = audioUrl ? isValidAudioUrl(audioUrl) : false;
  const hasAudio = !!audioUrl && isValidUrl;

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
   * Set up audio element for playback and handle cleanup.
   */
  useEffect(() => {
    const audioUrl = section.audioUrl || (audioData?.url || null);
    const isValidUrl = audioUrl ? isValidAudioUrl(audioUrl) : false;
    const hasAudio = !!audioUrl && isValidUrl;
    
    devLog('SectionCardTTS playback setup:', {
      sectionId: section.id,
      audioUrl,
      source: section.audioUrl ? 'section.audioUrl' : 'generatedTTSAudios',
      hasAudio,
      isValidUrl
    });
    
    if (!isValidUrl && audioUrl) {
      devWarn(`Invalid audioUrl for section ${section.id}: ${audioUrl}`);
    }
    
    // If we have a blob URL, convert it to data URL for better persistence
    const handleBlobUrl = async () => {
      if (hasAudio && audioUrl && audioUrl.startsWith('blob:')) {
        try {
          devLog(`Converting blob URL to data URL for section ${section.id}`);
          const dataUrl = await blobToDataURL(audioUrl);
          
          // Store the data URL in the section for persistence
          actions.updateSection({
            ...section,
            audioUrl: dataUrl
          });
          
          // Also update the generatedTTSAudios if that was the source
          if (audioData?.url === audioUrl) {
            actions.setGeneratedAudio(section.id, {
              ...audioData,
              url: dataUrl
            });
          }
          
          devLog(`Successfully converted blob URL to data URL for section ${section.id}`);
          return dataUrl;
        } catch (error) {
          devError(`Failed to convert blob URL for section ${section.id}:`, error);
          return audioUrl; // Fall back to original URL
        }
      }
      return audioUrl;
    };
    
    if (hasAudio && audioUrl) {
      // For blob URLs, convert first (but don't block UI)
      if (audioUrl.startsWith('blob:')) {
        handleBlobUrl().catch(error => {
          devError(`Error handling blob URL conversion: ${error.message}`);
        });
      }
      
      // Create audio element for playback
      try {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          devLog('Playback ended for section:', section.id);
        });
        audioRef.current.addEventListener('error', (e) => {
          devError(`Audio load error for section ${section.id}: ${audioUrl}`, e);
          setIsPlaying(false);
          
          // If it fails and it's a blob URL, try to reload with data URL conversion
          if (audioUrl.startsWith('blob:')) {
            devLog(`Attempting to recover blob URL failure for section ${section.id}`);
            handleBlobUrl().then(resolvedUrl => {
              if (resolvedUrl !== audioUrl) {
                // Try again with data URL
                audioRef.current = new Audio(resolvedUrl);
                audioRef.current.addEventListener('ended', () => setIsPlaying(false));
                audioRef.current.addEventListener('error', () => {
                  devError(`Still failed to load audio after conversion for section ${section.id}`);
                  addNotification({ type: 'error', message: 'Failed to load audio even after conversion.' });
                });
              } else {
                addNotification({ type: 'error', message: 'Failed to load audio.' });
              }
            }).catch(() => {
              addNotification({ type: 'error', message: 'Failed to load audio and conversion failed.' });
            });
          } else {
            addNotification({ type: 'error', message: 'Failed to load audio.' });
          }
        });
        
        return () => {
          if (audioRef.current) {
            audioRef.current.pause();
            try {
              audioRef.current.removeEventListener('ended', () => {});
              audioRef.current.removeEventListener('error', () => {});
            } catch (e) {
              devWarn('Could not remove event listeners from audio element', e);
            }
            audioRef.current = null;
          }
        };
      } catch (error) {
        devError(`Error setting up audio element for section ${section.id}:`, error);
      }
    }
  }, [section.audioUrl, audioData?.url, section.id, addNotification, actions]);

  /**
   * Toggle play/pause of the section's audio.
   */
  const togglePlay = () => {
    const audioUrl = section.audioUrl || (audioData?.url || null);
    const isValidUrl = audioUrl ? isValidAudioUrl(audioUrl) : false;
    
    if (!audioUrl || !isValidUrl) {
      devWarn(`No valid audio URL for section ${section.id}. URL: ${audioUrl}, Valid: ${isValidUrl}`);
      addNotification({ type: 'error', message: 'No valid audio available to play.' });
      return;
    }
    
    // Handle blob URL if needed
    const handleAndPlay = async () => {
      let urlToUse = audioUrl;
      
      // Convert blob URL to data URL if needed
      if (audioUrl.startsWith('blob:')) {
        try {
          devLog(`Converting blob URL before playback for section ${section.id}`);
          urlToUse = await blobToDataURL(audioUrl);
          
          // Update section with data URL for future use
          actions.updateSection({
            ...section,
            audioUrl: urlToUse
          });
          
          // Also update generatedTTSAudios if that was the source
          if (audioData?.url === audioUrl) {
            actions.setGeneratedAudio(section.id, {
              ...audioData,
              url: urlToUse
            });
          }
        } catch (error) {
          devWarn(`Failed to convert blob URL before playback for section ${section.id}:`, error);
          // Continue with original URL and hope it works
        }
      }
      
      // Create or update audio element
      if (!audioRef.current || audioRef.current.src !== urlToUse) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        audioRef.current = new Audio(urlToUse);
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
        });
        audioRef.current.addEventListener('error', (e) => {
          devError(`Audio load error for section ${section.id}: ${urlToUse}`, e);
          setIsPlaying(false);
          addNotification({ type: 'error', message: 'Failed to load audio.' });
        });
      }
      
      // Play or pause
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        devLog('Paused playback for section:', section.id);
      } else {
        devLog('Starting playback for section:', section.id, { audioUrl: audioRef.current.src });
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          devError(`Playback error for section ${section.id}:`, error);
          setIsPlaying(false);
          addNotification({ type: 'error', message: 'Failed to play audio.' });
        }
      }
    };
    
    // Call the async function
    handleAndPlay().catch(error => {
      devError(`Unexpected error in togglePlay for section ${section.id}:`, error);
      setIsPlaying(false);
      addNotification({ type: 'error', message: 'An unexpected error occurred while trying to play audio.' });
    });
  };

  /**
   * Handle voice selection change.
   */
  const handleVoiceChange = (selectedValue: string) => {
    let selectedVoice: Voice | null = null;

    if (selectedValue === 'default') {
      // For the default option, use the defaultVoice directly
      selectedVoice = defaultVoice;
      devLog('Voice set to default:', selectedVoice);
    } else {
      const [engine, id] = selectedValue.split('::', 2);
      const voiceObj = activeVoices.find((v: Voice) => v.engine === engine && v.id === id);
      if (!voiceObj) {
        devWarn('Selected voice not found in activeVoices:', selectedValue);
        return; // Don't update if the voice isn't found
      }
      selectedVoice = voiceObj;
      devLog('Selected voice:', selectedVoice);
    }

    // Mark this as a user-initiated change and set the pending flag
    isUserInitiatedChange.current = true;
    voiceSelectPending.current = true;
    
    // Store the selected voice as the last selected one
    lastSelectedVoice.current = selectedVoice;

    // Set local state immediately to prevent UI lag
    setEditedVoice(selectedVoice);
    
    // Update store in next tick to ensure component updates first
    setTimeout(() => {
      // Make sure we commit this to the reducer
      if (actions.setSectionVoice) {
        actions.setSectionVoice(section.id, selectedVoice);
        
        // Force update the section to ensure changes are applied
        const currentSection = sessionState.sections.find(s => s.id === section.id);
        if (currentSection) {
          actions.updateSection({
            ...currentSection,
            voice: selectedVoice,
            audioUrl: currentSection.audioUrl // Preserve audioUrl when updating voice
          });
        }
      }
      
      // Reset the flags after a delay to allow for normal syncing in the future
      setTimeout(() => {
        isUserInitiatedChange.current = false;
        voiceSelectPending.current = false;
      }, 500);
    }, 0);
  };

  // Add an effect to restore the last selected voice if it gets lost
  useEffect(() => {
    // Only run this for text-to-speech sections
    if (section.type !== 'text-to-speech') return;
    
    // If we have a stored voice but current state doesn't match it
    if (
      lastSelectedVoice.current && 
      (!editedVoice || 
        lastSelectedVoice.current.id !== editedVoice.id || 
        lastSelectedVoice.current.engine !== editedVoice.engine) && 
      !isUserInitiatedChange.current
    ) {
      devWarn('Voice selection was lost, restoring last selected voice', {
        last: lastSelectedVoice.current,
        current: editedVoice
      });
      
      // Restore the last selected voice to local state
      setEditedVoice(lastSelectedVoice.current);
      
      // Update session state to match
      if (actions.setSectionVoice) {
        actions.setSectionVoice(section.id, lastSelectedVoice.current);
        
        // Also update the whole section to ensure voice sticks
        const currentSection = sessionState.sections.find(s => s.id === section.id);
        if (currentSection) {
          // Set a small timeout to avoid synchronization issues
          setTimeout(() => {
            actions.updateSection({
              ...currentSection,
              voice: lastSelectedVoice.current,
              audioUrl: currentSection.audioUrl // Preserve audioUrl when restoring voice
            });
          }, 0);
        }
      }
    }
  }, [editedVoice, section.id, section.type, actions, sessionState.sections]);

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
              value={editedVoice && editedVoice.id === defaultVoice?.id && editedVoice.engine === defaultVoice?.engine ? 'default' : (editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : 'default')}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="select-field"
            >
              <option value="default">{defaultVoiceInfo}</option>
              {voicesToShow
                .filter(voice => !(voice.id === defaultVoice?.id && voice.engine === defaultVoice?.engine)) // Filter out the default voice
                .map((voice: Voice) => (
                <option
                  key={`${voice.engine}::${voice.id}`}
                  value={`${voice.engine}::${voice.id}`}
                >
                  {voice.name} ({voice.language}{voice.tld ? `, ${voice.tld}` : ''}) - {voice.engine}
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
                value={editedVoice && editedVoice.id === defaultVoice?.id && editedVoice.engine === defaultVoice?.engine ? 'default' : (editedVoice ? `${editedVoice.engine}::${editedVoice.id}` : 'default')}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="select-field flex-1 mr-2"
              >
                <option value="default">{defaultVoiceInfo}</option>
                {voicesToShow
                  .filter(voice => !(voice.id === defaultVoice?.id && voice.engine === defaultVoice?.engine)) // Filter out the default voice
                  .map((voice: Voice) => (
                  <option
                    key={`${voice.engine}::${voice.id}`}
                    value={`${voice.engine}::${voice.id}`}
                  >
                    {voice.name} ({voice.language}{voice.tld ? `, ${voice.tld}` : ''}) - {voice.engine}
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
                  href={audioUrl && isValidUrl ? audioUrl : '#'}
                  download={`section-${section.id}.wav`}
                  className={`p-2 ${!audioUrl || !isValidUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Download audio"
                  title="Download"
                  onClick={(e) => {
                    if (!audioUrl || !isValidUrl) {
                      e.preventDefault();
                      addNotification({ type: 'error', message: 'Invalid audio URL for download.' });
                    }
                  }}
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