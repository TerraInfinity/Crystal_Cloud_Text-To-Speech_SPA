/**
 * @fileoverview Mode settings component for the TTS application settings tab.
 * Handles the display and toggling of demo/production modes.
 */

import React, { useEffect } from 'react';
import { useTTSContext } from '../../context/TTSContext';
import { devLog } from '../../utils/logUtils';

interface SettingsTabModeSettingsProps {
  mode: string;
  addNotification: (notification: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const SettingsTabModeSettings: React.FC<SettingsTabModeSettingsProps> = ({ mode, addNotification }) => {
  const { actions } = useTTSContext();

  // Debug the current mode when component mounts
  useEffect(() => {
    devLog('Current mode:', mode);
  }, [mode]);

  const handleToggleMode = () => {
    const newMode = mode === 'demo' ? 'production' : 'demo';
    devLog('Switching mode to:', newMode);
    
    // Use the action from ttsActions.tsx
    actions.setMode(newMode);
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
      <h3 className="text-lg font-medium mb-4">Mode Settings</h3>
      <div
        className="flex items-center justify-between p-4 rounded-md"
        style={{ backgroundColor: 'var(--card-bg)' }}
      >
        <div>
          <h4 className="font-medium">Current Mode: {mode === 'demo' ? 'Demo' : 'Production'}</h4>
          <p className="text-sm text-gray-600 mt-1">
            {mode === 'demo'
              ? 'Using gTTS for demo mode (Python server).'
              : 'Using cloud-based speech engines (requires API keys).'}
          </p>
        </div>
        <button
          id="mode-toggle-button"
          onClick={handleToggleMode}
          className={`btn ${mode === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
          data-testid="mode-toggle-button"
        >
          Switch to {mode === 'demo' ? 'Production' : 'Demo'} Mode
        </button>
      </div>
    </div>
  );
};

export default SettingsTabModeSettings;