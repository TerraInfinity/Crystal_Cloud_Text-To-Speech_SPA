/**
 * @fileoverview AI provider settings component for the TTS application settings tab.
 * Manages the input and saving of OpenAI and Anthropic API keys to localStorage.
 */

import React, { useState, useEffect } from 'react';
import { devLog } from '../../utils/logUtils';
import { saveApiKeys, loadApiKeys } from '../../utils/apiKeyManagement';

interface SettingsTabAIProviderSettingsProps {
  addNotification: (notification: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const SettingsTabAIProviderSettings: React.FC<SettingsTabAIProviderSettingsProps> = ({ addNotification }) => {
  const [openaiInput, setOpenaiInput] = useState('');
  const [anthropicInput, setAnthropicInput] = useState('');

  // Load initial keys from localStorage
  useEffect(() => {
    const loadInitialKeys = async () => {
      try {
        const keys = await loadApiKeys(['openai', 'anthropic']);
        setOpenaiInput(keys.openai?.keys[0]?.key || '');
        setAnthropicInput(keys.anthropic?.keys[0]?.key || '');
      } catch (error) {
        devLog('Error loading AI provider keys:', error);
        addNotification({ type: 'error', message: 'Failed to load AI provider keys' });
      }
    };
    loadInitialKeys();
  }, [addNotification]);

  const handleSaveOpenaiKey = async () => {
    try {
      await saveApiKeys('openai', [{ name: 'OpenAI Key', key: openaiInput, active: true }]);
      devLog('Saved OpenAI API key');
      addNotification({ type: 'success', message: 'OpenAI API key saved' });
    } catch (error) {
      devLog('Error saving OpenAI API key:', error);
      addNotification({ type: 'error', message: 'Failed to save OpenAI API key' });
    }
  };

  const handleSaveAnthropicKey = async () => {
    try {
      await saveApiKeys('anthropic', [{ name: 'Anthropic Key', key: anthropicInput, active: true }]);
      devLog('Saved Anthropic API key');
      addNotification({ type: 'success', message: 'Anthropic API key saved' });
    } catch (error) {
      devLog('Error saving Anthropic API key:', error);
      addNotification({ type: 'error', message: 'Failed to save Anthropic API key' });
    }
  };

  return (
    <div
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
      }}
    >
      <h3 className="text-lg font-medium mb-4">AI Provider Settings</h3>
      <div className="mb-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OpenAI API Key
        </label>
        <div className="flex">
          <input
            id="openai-key-input"
            type="password"
            value={openaiInput}
            onChange={(e) => setOpenaiInput(e.target.value)}
            className="input-field rounded-r-none"
            placeholder="Enter your OpenAI API key"
          />
          <button
            id="save-openai-key-button"
            data-testid="save-openai-key-button"
            onClick={handleSaveOpenaiKey}
            className="btn btn-primary rounded-l-none"
          >
            Save
          </button>
        </div>
      </div>
      <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Anthropic API Key
        </label>
        <div className="flex">
          <input
            id="anthropic-key-input"
            type="password"
            value={anthropicInput}
            onChange={(e) => setAnthropicInput(e.target.value)}
            className="input-field rounded-r-none"
            placeholder="Enter your Anthropic API key"
          />
          <button
            id="save-anthropic-key-button"
            data-testid="save-anthropic-key-button"
            onClick={handleSaveAnthropicKey}
            className="btn btn-primary rounded-l-none"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTabAIProviderSettings;