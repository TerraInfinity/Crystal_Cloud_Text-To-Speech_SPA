/**
 * @fileoverview Reset settings component for the TTS application settings tab.
 * Provides a button to reset settings with a modal for selecting which settings to reset.
 */

import React, { useState } from 'react';
import { useTTSContext } from '../../context/TTSContext';
import { devLog } from '../../utils/logUtils';

interface SettingsTabResetSettingsProps {
  addNotification: (notification: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const SettingsTabResetSettings: React.FC<SettingsTabResetSettingsProps> = ({ addNotification }) => {
  const { dispatch, initialPersistentState } = useTTSContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetSelections, setResetSelections] = useState({
    activeVoices: true,
    mode: true,
    ttsApiKeys: true,
    aiProviderSettings: true,
  });

  const handleResetClick = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleSelectionChange = (category: keyof typeof resetSelections) => {
    setResetSelections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleConfirmReset = () => {
    devLog('Resetting settings:', resetSelections);

    if (resetSelections.activeVoices) {
      const defaultVoices = initialPersistentState.settings.activeVoices;
      dispatch({ type: 'LOAD_ACTIVE_VOICES', payload: defaultVoices });
      dispatch({ type: 'LOAD_CUSTOM_VOICES', payload: {} });
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: defaultVoices[0] });
    }
    
    if (resetSelections.mode) {
      dispatch({ type: 'SET_MODE', payload: 'demo' });
      dispatch({ type: 'SET_SPEECH_ENGINE', payload: 'gtts' });
    }
    
    if (resetSelections.ttsApiKeys) {
      const services = ['elevenlabs', 'aws_polly', 'googlecloud', 'azuretts', 'ibmwatson'];
      services.forEach(service => {
        localStorage.removeItem(`tts_api_key_${service}`);
      });
      localStorage.removeItem('tts_api_keys');
    }
    
    if (resetSelections.aiProviderSettings) {
      localStorage.removeItem('tts_api_key_anthropic');
      localStorage.removeItem('tts_api_key_openai');
    }

    addNotification({ type: 'success', message: 'Selected settings have been reset' });
    setIsModalOpen(false);
  };

  return (
    <div className="flex justify-end">
      <button
        id="reset-settings-button"
        onClick={handleResetClick}
        className="btn btn-danger"
      >
        Reset Settings
      </button>
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderWidth: '1px' }}
          >
            <h3 className="text-lg font-medium mb-4">Reset Settings</h3>
            <p className="text-sm text-gray-600 mb-4">Select which settings to reset:</p>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetSelections.activeVoices}
                  onChange={() => handleSelectionChange('activeVoices')}
                  className="mr-2"
                />
                Active Voices
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetSelections.mode}
                  onChange={() => handleSelectionChange('mode')}
                  className="mr-2"
                />
                Mode
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetSelections.ttsApiKeys}
                  onChange={() => handleSelectionChange('ttsApiKeys')}
                  className="mr-2"
                />
                TTS Service API Keys
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetSelections.aiProviderSettings}
                  onChange={() => handleSelectionChange('aiProviderSettings')}
                  className="mr-2"
                />
                AI Provider API Keys
              </label>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={handleConfirmReset}
                className="btn btn-primary"
              >
                Reset Selected
              </button>
              <button
                onClick={handleModalClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTabResetSettings;