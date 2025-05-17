/**
 * @fileoverview Settings tab component for the TTS application.
 * Manages configuration for speech engines, voices, API keys, and other settings.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTTSContext } from '../context/TTSContext';
import { devLog } from '../utils/logUtils';
import { Voice } from '../utils/voiceUtils';
import { useNotification } from '../context/notificationContext';
import {
  getApiKeys,
  addApiKey,
  decryptKey,
  ApiKey,
  Service,
} from '../utils/apiKeyManagement';
import SettingsTabModeSettings from './settings/SettingsTabModeSettings';
import SettingsTabVoiceManagement from './settings/SettingsTabVoiceManagement';
import SettingsTabTTSServiceApiKeys from './settings/SettingsTabTTSServiceApiKeys';
import SettingsTabAIProviderSettings from './settings/SettingsTabAIProviderSettings';
import SettingsTabResetSettings from './settings/SettingsTabResetSettings';
import SettingsTabUploadJSON from './settings/SettingsTabUploadJSON';
import SettingsTabSpeechEngineSettings from './settings/SettingsTabSpeechEngineSettings';

// Define TTSEngine type to match sub-components
type TTSEngine = 'elevenlabs' | 'aws_polly' | 'googlecloud' | 'azuretts' | 'ibmwatson' | 'gtts';

// Notification type to match error's Omit requirements
interface Notification {
  id?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  isExiting?: boolean;
  createdAt?: string;
  expiresAt?: number;
}

interface SettingsTabProps {}

const SettingsTab: React.FC<SettingsTabProps> = () => {
  const {
    state: { settings },
    actions: ttsActions,
  } = useTTSContext();
  const { addNotification } = useNotification();

  const {
    mode,
    speechEngine,
    availableVoices = {},
    customVoices = {},
    activeVoices = [],
    defaultVoice = null,
  } = settings;

  // State for AI provider API keys (openai and anthropic) - temporarily unused
  const [aiProviderKeys, setAiProviderKeys] = useState<{
    openai: string;
    anthropic: string;
  }>({
    openai: '',
    anthropic: '',
  });

  // Force re-render after voice or API key actions
  const [updateKey, setUpdateKey] = useState(0);

  // Load AI provider API keys on mount or update - temporarily disabled
  useEffect(() => {
    const loadAiProviderKeys = async () => {
      try {
        const [openaiKeys, anthropicKeys] = await Promise.all([
          getApiKeys('openai'),
          getApiKeys('anthropic'),
        ]);
        setAiProviderKeys({
          openai: openaiKeys[0]?.key ? decryptKey(openaiKeys[0].key) : '',
          anthropic: anthropicKeys[0]?.key ? decryptKey(anthropicKeys[0].key) : '',
        });
      } catch (error) {
        devLog('Error loading AI provider API keys:', error);
        addNotification({ type: 'error', message: 'Failed to load AI provider API keys' });
      }
    };
    loadAiProviderKeys();
  }, [updateKey, addNotification]);

  // Debug logging for voice state
  useEffect(() => {
    devLog('SettingsTab Voice State:', {
      speechEngine,
      availableVoices: availableVoices[speechEngine],
      activeVoices,
      customVoices: customVoices[speechEngine],
      defaultVoice,
    });
  }, [speechEngine, availableVoices, activeVoices, customVoices, defaultVoice]);

  // Load-tts-config event listener
  useEffect(() => {
    const handleLoadTtsConfig = () => {
      devLog('load-tts-config event triggered');
    };
    window.addEventListener('load-tts-config', handleLoadTtsConfig);
    devLog('Attaching load-tts-config event listener');
    return () => {
      window.removeEventListener('load-tts-config', handleLoadTtsConfig);
      devLog('Removing load-tts-config event listener');
    };
  }, []);

  const handleSpeechEngineChange = (engine: string) => {
    if (mode === 'demo' && engine !== 'gtts') {
      addNotification({
        type: 'error',
        message: 'Cannot select this engine in demo mode. Switch to production mode first.',
      });
      return;
    }
    ttsActions.setSpeechEngine(engine);
    devLog('Speech engine changed to:', engine);
  };

  const handleRemoveActiveVoice = (engine: string, voiceId: string) => {
    if (activeVoices.length === 1) {
      addNotification({ type: 'error', message: 'Cannot remove the last active voice.' });
      return;
    }
    ttsActions.removeActiveVoice(engine, voiceId);
    addNotification({ type: 'success', message: 'Voice removed from active voices' });
    setUpdateKey((prev) => prev + 1);
  };

  const handleSetDefaultVoice = (voice: Voice) => {
    ttsActions.setDefaultVoice(voice);
    setUpdateKey((prev) => prev + 1);
  };

  // Compute all active voices based on mode
  const allActiveVoices = useMemo(() => {
    return mode === 'demo'
      ? activeVoices.filter((voice) => voice.engine === 'gtts')
      : activeVoices;
  }, [activeVoices, mode]);

  return (
    <div className="space-y-8">
      {/* Mode Settings */}
      <SettingsTabModeSettings mode={mode} addNotification={addNotification} />

      {/* Speech Engine Settings */}
      <SettingsTabSpeechEngineSettings
        speechEngine={speechEngine}
        mode={mode}
        allActiveVoices={allActiveVoices}
        defaultVoice={defaultVoice}
        handleSpeechEngineChange={handleSpeechEngineChange}
        setDefaultVoice={handleSetDefaultVoice}
        handleRemoveActiveVoice={handleRemoveActiveVoice}
        addNotification={addNotification}
      />

      {/* Voice Management and Related Settings */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <SettingsTabVoiceManagement
          speechEngine={speechEngine as TTSEngine}
          mode={mode}
          addNotification={addNotification}
          availableVoices={availableVoices[speechEngine] || []}
          activeVoices={allActiveVoices}
          customVoices={customVoices[speechEngine] || []}
          defaultVoice={defaultVoice}
        />
        {mode === 'production' && (
          <SettingsTabUploadJSON
            addNotification={addNotification}
            onUploadSuccess={() => setUpdateKey((prev) => prev + 1)}
          />
        )}
        {mode === 'production' && (
          <SettingsTabTTSServiceApiKeys
            service={speechEngine as TTSEngine}
            addNotification={addNotification}
          />
        )}
      </div>

      {/* AI Provider Settings - Temporarily minimal props until correct interface is provided */}
      <SettingsTabAIProviderSettings addNotification={addNotification} />

      {/* Reset Settings */}
      <SettingsTabResetSettings addNotification={addNotification} />
    </div>
  );
};

export default SettingsTab;