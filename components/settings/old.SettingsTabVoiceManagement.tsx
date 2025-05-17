/**
 * @fileoverview Voice management component for the TTS application settings tab
 *
 * Allows users to add, remove, and manage custom voices for the selected speech engine.
 */

import React from 'react';
import { devLog } from '../../utils/logUtils';

interface Voice {
  id: string;
  name: string;
  language: string;
  engine: string;
  tld?: string;
}

interface Props {
  speechEngine: string;
  mode: string;
  availableVoices: Voice[];
  activeVoiceIds: Set<string>;
  languages: string[];
  voicesForLanguage: Voice[];
  selectedVoice: Voice | undefined;
  currentVoiceId: string;
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  newVoiceName: string;
  setNewVoiceName: (name: string) => void;
  newVoiceId: string;
  setNewVoiceId: (id: string) => void;
  newVoiceLanguage: string;
  setNewVoiceLanguage: (language: string) => void;
  isCustomVoiceExpanded: boolean;
  setIsCustomVoiceExpanded: (expanded: boolean) => void;
  customVoices: { [key: string]: Voice[] };
  persistentActions: {
    addCustomVoice: (engine: string, voice: Voice) => void;
    removeCustomVoice: (engine: string, voiceId: string) => void;
    setSelectedVoice: (engine: string, voice: Voice) => void;
    addActiveVoice: (engine: string, voice: Voice) => void;
  };
  addNotification: (notification: { type: string; message: string }) => void;
}

const SettingsTabVoiceManagement: React.FC<Props> = ({
  speechEngine,
  mode,
  availableVoices,
  activeVoiceIds,
  languages,
  voicesForLanguage,
  selectedVoice,
  currentVoiceId,
  currentLanguage,
  setCurrentLanguage,
  newVoiceName,
  setNewVoiceName,
  newVoiceId,
  setNewVoiceId,
  newVoiceLanguage,
  setNewVoiceLanguage,
  isCustomVoiceExpanded,
  setIsCustomVoiceExpanded,
  customVoices,
  persistentActions,
  addNotification,
}) => {
  devLog('SettingsTabVoiceManagement Props:', {
    speechEngine,
    availableVoices,
    activeVoiceIds: Array.from(activeVoiceIds),
    languages,
    voicesForLanguage,
    selectedVoice,
    currentVoiceId,
    currentLanguage,
    customVoices: customVoices[speechEngine] || [],
  });

  const handleAddCustomVoice = () => {
    if (!newVoiceName || !newVoiceId || !newVoiceLanguage) {
      addNotification({ type: 'error', message: 'Please fill all fields' });
      return;
    }
    const existingVoice = availableVoices.find(v => v.id === newVoiceId);
    if (existingVoice) {
      addNotification({ type: 'error', message: 'Voice ID already exists.' });
      return;
    }
    const newVoice: Voice = {
      id: newVoiceId,
      name: newVoiceName,
      language: newVoiceLanguage,
      engine: speechEngine,
      ...(speechEngine === 'gtts' && { tld: newVoiceId }),
    };
    persistentActions.addCustomVoice(speechEngine, newVoice);
    setNewVoiceName('');
    setNewVoiceId('');
    setNewVoiceLanguage('');
    addNotification({ type: 'success', message: 'Custom voice added' });
  };

  const handleRemoveCustomVoice = (voiceId: string) => {
    if (activeVoiceIds.has(voiceId)) {
      addNotification({ type: 'error', message: 'Cannot remove active voice' });
      return;
    }
    persistentActions.removeCustomVoice(speechEngine, voiceId);
    addNotification({ type: 'success', message: 'Custom voice removed' });
  };

  const handleSelectVoice = (voiceId: string) => {
    const voice = voicesForLanguage.find((v) => v.id === voiceId);
    if (voice) {
      persistentActions.setSelectedVoice(speechEngine, voice);
    }
  };

  const handleAddActiveVoice = () => {
    if (selectedVoice) {
      if (mode === 'demo' && selectedVoice.engine !== 'gtts') {
        addNotification({
          type: 'error',
          message: 'Only gtts voices can be added in demo mode.',
        });
        return;
      }
      
      const voiceWithEngine = {
        id: selectedVoice.id,
        name: selectedVoice.name,
        language: selectedVoice.language,
        tld: selectedVoice.tld,
        engine: speechEngine
      };
      
      devLog('Adding active voice:', voiceWithEngine);
      persistentActions.addActiveVoice(speechEngine, voiceWithEngine);
      addNotification({
        type: 'success',
        message: `${selectedVoice.name} added to active voices`,
      });
      
      if (voicesForLanguage.length > 1) {
        const nextVoice = voicesForLanguage.find(v => v.id !== selectedVoice.id);
        if (nextVoice) persistentActions.setSelectedVoice(speechEngine, nextVoice);
      }
    } else {
      addNotification({
        type: 'error',
        message: 'No voice selected to add.',
      });
    }
  };

  return (
    <div
      className="mb-4 p-4 border-l-4 border-blue-500 rounded-r-md"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      <h4 className="text-md font-semibold text-blue-700 mb-2">{speechEngine.toUpperCase()} Voices</h4>
      <p className="text-sm text-gray-600 mb-2">
        Select from available voices for {speechEngine}.
      </p>
      {availableVoices.length === 0 ? (
        <p className="text-sm text-red-600">
          No voices available for {speechEngine}.{' '}
          {speechEngine === 'elevenLabs' ? (
            <>
              Add an ElevenLabs API key in the API Keys section below or{' '}
              <button
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => setIsCustomVoiceExpanded(true)}
              >
                add a custom voice
              </button>.
            </>
          ) : (
            <>
              <button
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => setIsCustomVoiceExpanded(true)}
              >
                Add a custom voice
              </button>.
            </>
          )}
        </p>
      ) : languages.length === 0 ? (
        <p className="text-sm text-red-600">
          All voices are currently active for {speechEngine}. Remove voices from the active list above or{' '}
          <button
            className="text-blue-600 underline hover:text-blue-800"
            onClick={() => setIsCustomVoiceExpanded(true)}
          >
            add a new custom voice
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
              onChange={(e) => setCurrentLanguage(e.target.value)}
              className="select-field w-full p-2 border rounded"
            >
              {languages.map(lang => (
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
                value={currentVoiceId}
                onChange={(e) => handleSelectVoice(e.target.value)}
                className="select-field flex-1 p-2 border rounded"
              >
                {voicesForLanguage.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} {voice.tld ? `(${voice.tld})` : ''}
                  </option>
                ))}
              </select>
              <button
                id="add-voice-button"
                onClick={handleAddActiveVoice}
                className="bg-green-500 text-white rounded-full p-2 hover:bg-green-600"
                title="Add to active voices"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Custom Voice Management (Expandable) */}
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
              <button 
                id="add-custom-voice-button"
                onClick={handleAddCustomVoice} 
                className="btn btn-primary"
              >
                Add
              </button>
            </div>
            <div className="mt-2">
              <h5 className="text-sm font-medium mb-1">Custom Voices for {speechEngine}</h5>
              {(customVoices[speechEngine] || []).map((voice) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTabVoiceManagement;