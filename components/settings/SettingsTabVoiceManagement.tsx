/**
 * @fileoverview Voice management component for the TTS application settings tab.
 * Allows users to add, remove, manage custom voices, and set the default voice for the selected speech engine.
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { devLog } from '../../utils/logUtils';
import throttle from 'lodash/throttle';
import debounce from 'lodash/debounce';
import { Voice, validateVoiceObject } from '../../utils/voiceUtils';
import { useTTSContext } from '../../context/TTSContext';
import { createTtsActions } from '../../context/ttsActions';

type TTSEngine = 'elevenlabs' | 'aws_polly' | 'googlecloud' | 'azuretts' | 'ibmwatson' | 'gtts';

interface Props {
  speechEngine: TTSEngine;
  mode: string;
  addNotification: (notification: { type: 'success' | 'warning' | 'error' | 'info'; message: string }) => void;
  availableVoices?: Voice[];
  activeVoices?: Voice[];
  customVoices?: Voice[];
  defaultVoice?: Voice | null;
}

const SettingsTabVoiceManagement: React.FC<Props> = ({
  speechEngine,
  mode,
  addNotification,
  availableVoices: propAvailableVoices,
  activeVoices: propActiveVoices,
  customVoices: propCustomVoices,
  defaultVoice: propDefaultVoice,
}) => {
  const { state, dispatch } = useTTSContext();
  const actions = createTtsActions(dispatch, addNotification);
  const [currentLanguage, setCurrentLanguage] = useState<string>('');
  const [newVoiceName, setNewVoiceName] = useState<string>('');
  const [newVoiceId, setNewVoiceId] = useState<string>('');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState<string>('');
  const [isCustomVoiceExpanded, setIsCustomVoiceExpanded] = useState<boolean>(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  const availableVoices = propAvailableVoices || state.settings.availableVoices[speechEngine] || [];
  const activeVoices = propActiveVoices || state.settings.activeVoices || [];
  const customVoices = propCustomVoices || state.settings.customVoices[speechEngine] || [];
  const defaultVoice = propDefaultVoice !== undefined ? propDefaultVoice : state.settings.defaultVoice;

  const hasSwitchedLanguage = useRef(false);

  const throttledDevLog = useMemo(() => throttle(devLog, 2000), []);

  // Filter out voices that are already active
  const filteredAvailableVoices = useMemo(() => {
    return availableVoices.filter(
      (voice) => !activeVoices.some((av) => av.id === voice.id && av.engine === voice.engine)
    );
  }, [availableVoices, activeVoices]);

  // Get available languages after filtering out active voices
  const languages = useMemo(() => {
    const uniqueLanguages = [...new Set(filteredAvailableVoices.map((v) => v.language))].sort();
    return uniqueLanguages;
  }, [filteredAvailableVoices]);

  // Get available voices for the current language (filtered to exclude active voices)
  const voicesForLanguage = useMemo(() => {
    const result = filteredAvailableVoices.filter((v) => v.language === currentLanguage);
    devLog(`Filtered voices for ${speechEngine} language ${currentLanguage}:`, result);
    return result;
  }, [filteredAvailableVoices, speechEngine, currentLanguage]);

  // Log state for debugging
  useEffect(() => {
    throttledDevLog('SettingsTabVoiceManagement State:', {
      speechEngine,
      availableVoices: availableVoices.length,
      filteredAvailableVoices: filteredAvailableVoices.length,
      activeVoices: activeVoices.length,
      languages: languages.length,
      currentLanguage,
      voicesForLanguage: voicesForLanguage.length,
    });
  }, [
    throttledDevLog, 
    speechEngine, 
    availableVoices, 
    filteredAvailableVoices, 
    activeVoices, 
    languages, 
    currentLanguage, 
    voicesForLanguage
  ]);

  // Handle language selection when voices change
  useEffect(() => {
    // Reset the flag when dependencies change
    hasSwitchedLanguage.current = false;
    
    // If current language has no voices but we have other languages available
    if (voicesForLanguage.length === 0 && filteredAvailableVoices.length > 0 && languages.length > 0) {
      const nextLanguage = languages[0];
      if (nextLanguage && nextLanguage !== currentLanguage) {
        hasSwitchedLanguage.current = true;
        setCurrentLanguage(nextLanguage);
        setSelectedVoiceId('');
        devLog(`Switched to language with available voices: ${nextLanguage}`);
      }
    } 
    // If we have languages but no current language is selected
    else if (languages.length > 0 && !currentLanguage) {
      setCurrentLanguage(languages[0]);
      devLog(`Initialized language: ${languages[0]}`);
    }
    // If there are no languages available anymore, reset the current language
    else if (languages.length === 0 && currentLanguage) {
      setCurrentLanguage('');
      setSelectedVoiceId('');
      devLog('No languages available, reset current language');
    }
  }, [voicesForLanguage, filteredAvailableVoices, languages, currentLanguage]);

  // Handle voice selection when available voices change
  useEffect(() => {
    if (voicesForLanguage.length > 0) {
      // If selected voice is not in available voices or no voice is selected
      if (!selectedVoiceId || !voicesForLanguage.some((v) => v.id === selectedVoiceId)) {
        const nextVoice = voicesForLanguage[0];
        setSelectedVoiceId(nextVoice.id);
        devLog('Selected new voice:', nextVoice);
      }
    } else {
      // No voices available for current language
      setSelectedVoiceId('');
    }
  }, [voicesForLanguage, selectedVoiceId]);

  const handleAddCustomVoice = () => {
    if (!newVoiceName || !newVoiceId || !newVoiceLanguage) {
      addNotification({ type: 'error', message: 'Please fill all fields' });
      return;
    }
    if (availableVoices.some((v) => v.id === newVoiceId)) {
      addNotification({ type: 'error', message: 'Voice ID already exists' });
      return;
    }
    const newVoice: Voice = validateVoiceObject({
      id: newVoiceId,
      name: newVoiceName,
      language: newVoiceLanguage,
      engine: speechEngine,
      ...(speechEngine === 'gtts' && { tld: newVoiceId }),
    });
    actions.addCustomVoice(speechEngine, newVoice);
    setNewVoiceName('');
    setNewVoiceId('');
    setNewVoiceLanguage('');
  };

  const handleRemoveCustomVoice = (voiceId: string) => {
    const activeVoiceIds = new Set(activeVoices.map((v) => v.id));
    if (activeVoiceIds.has(voiceId)) {
      addNotification({ type: 'error', message: 'Cannot remove active voice' });
      return;
    }
    actions.removeCustomVoice(speechEngine, voiceId);
  };

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    const voice = voicesForLanguage.find((v) => v.id === voiceId);
    if (voice) {
      devLog('Selected voice:', voice);
    }
  };

  const handleAddActiveVoice = useMemo(
    () =>
      debounce(() => {
        const selectedVoice = voicesForLanguage.find((v) => v.id === selectedVoiceId);
        if (!selectedVoice) {
          addNotification({ type: 'error', message: 'No voice selected' });
          return;
        }
        if (activeVoices.some((v) => v.id === selectedVoice.id && v.engine === selectedVoice.engine)) {
          addNotification({ type: 'warning', message: `${selectedVoice.name} is already active` });
          return;
        }
        if (mode === 'demo' && selectedVoice.engine !== 'gtts') {
          addNotification({ type: 'error', message: 'Only gTTS voices allowed in demo mode' });
          return;
        }
        actions.addActiveVoice(selectedVoice);
        
        // Find next available voice that's not active yet
        const nextVoice = voicesForLanguage.find(
          (v, i) => i !== voicesForLanguage.findIndex(voice => voice.id === selectedVoiceId) && 
          !activeVoices.some((av) => av.id === v.id && av.engine === v.engine)
        );
        
        if (nextVoice) {
          setSelectedVoiceId(nextVoice.id);
        } else {
          // If no more voices for this language, try to switch to another language
          const nextLanguage = languages.find(lang => 
            lang !== currentLanguage && 
            filteredAvailableVoices.some(v => v.language === lang)
          );
          
          if (nextLanguage) {
            setCurrentLanguage(nextLanguage);
            setSelectedVoiceId('');
          } else {
            setSelectedVoiceId('');
          }
        }
      }, 100),
    [selectedVoiceId, voicesForLanguage, activeVoices, speechEngine, mode, actions, addNotification, languages, currentLanguage, filteredAvailableVoices]
  );

  const handleSetDefaultVoice = (voice: Voice) => {
    actions.setDefaultVoice(voice);
  };

  return (
    <div
      className="mb-4 p-4 border-l-4 border-blue-500 rounded-r-md"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      <h4 className="text-md font-semibold text-blue-700 mb-2">{speechEngine.toUpperCase()} Voices</h4>
      <p className="text-sm text-gray-600 mb-2">Select and manage voices for {speechEngine}.</p>
      {filteredAvailableVoices.length === 0 ? (
        <p className="text-sm text-red-600">
          {availableVoices.length === 0 
            ? `No voices available for ${speechEngine}.` 
            : `All available voices for ${speechEngine} are already active.`}{' '}
          <button
            className="text-blue-600 underline hover:text-blue-800"
            onClick={() => setIsCustomVoiceExpanded(true)}
          >
            Add a custom voice
          </button>.
        </p>
      ) : languages.length === 0 ? (
        <p className="text-sm text-red-600">
          All voices are active for {speechEngine}. Remove voices from the active list or{' '}
          <button
            className="text-blue-600 underline hover:text-blue-800"
            onClick={() => setIsCustomVoiceExpanded(true)}
          >
            add a custom voice
          </button>.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="language-select">
              Language
            </label>
            <select
              id="language-select"
              value={currentLanguage}
              onChange={(e) => {
                setCurrentLanguage(e.target.value);
                setSelectedVoiceId('');
              }}
              className="select-field w-full p-2 border rounded"
              disabled={languages.length === 0}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'en' ? 'English (Multiple Accents)' : lang}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="voice-select">
              Voice
            </label>
            <div className="flex items-center space-x-2">
              <select
                id="voice-select"
                value={selectedVoiceId}
                onChange={(e) => handleSelectVoice(e.target.value)}
                className="select-field flex-1 p-2 border rounded"
                disabled={voicesForLanguage.length === 0}
              >
                {voicesForLanguage.length === 0 ? (
                  <option value="">No voices available</option>
                ) : (
                  voicesForLanguage.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.tld ? `(${voice.tld})` : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                id="add-voice-button"
                onClick={handleAddActiveVoice}
                className="bg-green-500 text-white rounded-full p-2 hover:bg-green-600 disabled:bg-gray-400"
                title="Add to active voices"
                disabled={voicesForLanguage.length === 0 || !selectedVoiceId}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {voicesForLanguage.length === 0 && languages.length > 0 && (
              <p className="text-sm text-yellow-600 mt-1">No voices available for {currentLanguage}. Select another language.</p>
            )}
          </div>
        </>
      )}

      <div className="mt-4">
        <button
          id="custom-voice-toggle"
          onClick={() => setIsCustomVoiceExpanded(!isCustomVoiceExpanded)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {isCustomVoiceExpanded ? 'Hide Custom Voice Section' : 'Show Custom Voice Section'}
        </button>
        {isCustomVoiceExpanded && (
          <div
            className="mt-2 p-4 border-l-4 border-yellow-500 rounded-r-md"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            <p className="text-sm text-yellow-700 mb-2">
              <strong>Note:</strong> Custom voice fields are sensitive. The details (e.g., voice ID) must match exactly for the voice to work properly.
            </p>
            <div className="flex space-x-2">
              <input
                id="voice-name-input"
                type="text"
                placeholder="Name"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="input-field flex-1"
              />
              <input
                id="voice-id-input"
                type="text"
                placeholder={speechEngine === 'gtts' ? 'TLD (e.g., com)' : 'ID'}
                value={newVoiceId}
                onChange={(e) => setNewVoiceId(e.target.value)}
                className="input-field flex-1"
              />
              <input
                id="voice-language-input"
                type="text"
                placeholder="Language (e.g., en)"
                value={newVoiceLanguage}
                onChange={(e) => setNewVoiceLanguage(e.target.value)}
                className="input-field flex-1"
              />
              <button id="add-custom-voice-button" onClick={handleAddCustomVoice} className="btn btn-primary">
                Add
              </button>
            </div>
            <div className="mt-2">
              <h5 className="text-sm font-medium mb-1">Custom Voices for {speechEngine}</h5>
              {customVoices.length === 0 ? (
                <p className="text-sm text-gray-600">No custom voices.</p>
              ) : (
                customVoices.map((voice) => (
                  <div key={voice.id} className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">
                      {voice.name} ({voice.language})
                      {voice.tld && ` - TLD: ${voice.tld}`}
                    </span>
                    <button
                      onClick={() => handleRemoveCustomVoice(voice.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTabVoiceManagement;