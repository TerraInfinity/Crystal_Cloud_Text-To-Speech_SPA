import React, { useState, useEffect, useMemo } from 'react';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { devLog, devWarn } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';
import { useApiKeyManagement } from '../utils/apiKeyManagement';
import { getDefaultVoices } from '../context/ttsDefaults';
import SettingsTabModeSettings from './settings/SettingsTabModeSettings';
import SettingsTabVoiceManagement from './settings/SettingsTabVoiceManagement';
import SettingsTabTTSServiceApiKeys from './settings/SettingsTabTTSServiceApiKeys';
import SettingsTabAIProviderSettings from './settings/SettingsTabAIProviderSettings';
import SettingsTabResetSettings from './settings/SettingsTabResetSettings';
import SettingsTabUploadJSON from './settings/SettingsTabUploadJSON';

const SettingsTab = () => {
  const {
    state: persistentState,
    actions: persistentActions,
  } = useTTSContext();
  const { actions: sessionActions } = useTTSSessionContext();
  const { addNotification } = useNotification();
  const {
    addApiKey,
    removeApiKey,
    toggleActiveStatus,
    updateApiKeyName,
    moveApiKeyUp,
    moveApiKeyDown,
    refreshApiKeyTokens,
  } = useApiKeyManagement();

  const {
    settings: {
      mode,
      speechEngine,
      defaultVoices = {},
      elevenLabsApiKeys = [],
      awsPollyCredentials = [],
      googleCloudCredentials = [],
      azureTTSCredentials = [],
      ibmWatsonCredentials = [],
      anthropicApiKey,
      openaiApiKey,
      customVoices = {},
      selectedVoices = {},
      activeVoices = {},
      defaultVoice,
    },
  } = persistentState;

  const [apiKeysUpdated, setApiKeysUpdated] = useState(0);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceId, setNewVoiceId] = useState('');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState(
    selectedVoices[speechEngine]?.language || defaultVoices[speechEngine]?.[0]?.language || 'en'
  );
  const [isCustomVoiceExpanded, setIsCustomVoiceExpanded] = useState(false);

  // Debounce handleAddApiKey to prevent rapid calls
  const handleAddApiKey = useMemo(() => {
    let timeout;
    return (service: string, keyObj: any) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        devLog('Adding API key:', { service, keyObj });
        addApiKey(service, keyObj);
        setApiKeysUpdated((prev) => prev + 1);
      }, 500); // Debounce for 500ms
    };
  }, [addApiKey]);

  // Sync API keys only if they differ from current state
  useEffect(() => {
    const storedKeys = JSON.parse(localStorage.getItem('tts_api_keys') || '{}');
    const updateIfDifferent = (keyName: string, newKeys: any[], currentKeys: any[]) => {
      if (JSON.stringify(newKeys) !== JSON.stringify(currentKeys)) {
        persistentActions.setApiKey(keyName, newKeys);
      }
    };

    updateIfDifferent('elevenLabsApiKeys', storedKeys.elevenlabs?.keys || [], elevenLabsApiKeys);
    updateIfDifferent('awsPollyCredentials', storedKeys.aws_polly?.keys || [], awsPollyCredentials);
    updateIfDifferent('googleCloudCredentials', storedKeys.google_cloud?.keys || [], googleCloudCredentials);
    updateIfDifferent('azureTTSCredentials', storedKeys.azure?.keys || [], azureTTSCredentials);
    updateIfDifferent('ibmWatsonCredentials', storedKeys.ibm_watson?.keys || [], ibmWatsonCredentials);
  }, [apiKeysUpdated, persistentActions, elevenLabsApiKeys, awsPollyCredentials, googleCloudCredentials, azureTTSCredentials, ibmWatsonCredentials]);

  // Move load-tts-config listener to SettingsTab
  useEffect(() => {
    const handleLoadTtsConfig = () => {
      // Handle load-tts-config logic (implement as needed)
      devLog('load-tts-config event triggered');
    };
    window.addEventListener('load-tts-config', handleLoadTtsConfig);
    devLog('Attaching load-tts-config event listener');
    return () => {
      window.removeEventListener('load-tts-config', handleLoadTtsConfig);
      devLog('Removing load-tts-config event listener');
    };
  }, []); // Run only on mount/unmount

  // Throttle API key state logging
  useEffect(() => {
    const timer = setTimeout(() => {
      devLog('API Keys State:', {
        elevenLabsApiKeys,
        awsPollyCredentials,
        googleCloudCredentials,
        azureTTSCredentials,
        ibmWatsonCredentials,
      });
    }, 1000); // Log at most once per second
    return () => clearTimeout(timer);
  }, [elevenLabsApiKeys, awsPollyCredentials, googleCloudCredentials, azureTTSCredentials, ibmWatsonCredentials]);

  const availableVoices = useMemo(() => {
    let engineDefaultVoices = defaultVoices[speechEngine] || [];
    if (!engineDefaultVoices.length) {
      engineDefaultVoices = getDefaultVoices()[speechEngine] || [];
    }
    return [...engineDefaultVoices, ...(customVoices[speechEngine] || [])];
  }, [speechEngine, defaultVoices[speechEngine], customVoices[speechEngine]]);

  const activeVoiceIds = useMemo(
    () => new Set((activeVoices[speechEngine] || []).map((v) => v.id)),
    [activeVoices[speechEngine]]
  );

  const languages = useMemo(() => {
    return [...new Set(
      availableVoices
        .filter(v => !activeVoiceIds.has(v.id))
        .map(v => v.language)
    )].sort();
  }, [availableVoices, activeVoiceIds]);

  const voicesForLanguage = useMemo(() => {
    const filteredVoices = availableVoices.filter((v) => v.language === currentLanguage);
    const result = filteredVoices.length > 0
      ? filteredVoices.filter((v) => !activeVoiceIds.has(v.id))
      : filteredVoices;
    if (result.length === 0 && filteredVoices.length > 0) {
      devWarn(`All voices for ${currentLanguage} in ${speechEngine} are active, showing all voices`);
    }
    return result;
  }, [availableVoices, currentLanguage, activeVoiceIds]);

  const selectedVoice = selectedVoices[speechEngine];
  const currentVoiceId = voicesForLanguage.some((v) => v.id === selectedVoice?.id)
    ? selectedVoice?.id
    : voicesForLanguage[0]?.id || '';

  const allActiveVoices = useMemo(() => {
    const voices = Object.values(activeVoices).flat();
    return mode === 'demo' ? voices.filter((voice) => voice.engine === 'gtts') : voices;
  }, [activeVoices, mode]);

  useEffect(() => {
    if (availableVoices.length > 0 && (!selectedVoices[speechEngine] || !selectedVoices[speechEngine].id)) {
      const defaultVoice = availableVoices[0];
      persistentActions.setSelectedVoice(speechEngine, defaultVoice);
      setCurrentLanguage(defaultVoice.language);
    } else if (availableVoices.length === 0) {
      devWarn(`No voices available for ${speechEngine}. User can add custom voices in Voice Management.`);
    }
  }, [speechEngine, availableVoices, selectedVoices, persistentActions]);

  useEffect(() => {
    if (voicesForLanguage.length > 0 && (!selectedVoice || !voicesForLanguage.some((v) => v.id === selectedVoice.id))) {
      persistentActions.setSelectedVoice(speechEngine, voicesForLanguage[0]);
    }
  }, [currentLanguage, voicesForLanguage, speechEngine, selectedVoice, persistentActions]);

  useEffect(() => {
    if (languages.length > 0 && !languages.includes(currentLanguage)) {
      setCurrentLanguage(languages[0]);
    } else if (languages.length === 0 && availableVoices.length > 0) {
      setCurrentLanguage(availableVoices[0].language || 'en');
    } else if (languages.length === 0 && availableVoices.length == 0) {
      setCurrentLanguage('en');
      devWarn(`No voices available for ${speechEngine}, defaulting currentLanguage to 'en'`);
    }
  }, [languages, currentLanguage, availableVoices, speechEngine]);

  const toggleMode = () => {
    const newMode = mode === 'demo' ? 'production' : 'demo';
    persistentActions.setMode(newMode);
    if (newMode === 'demo') {
      persistentActions.setSpeechEngine('gtts');
    }
    addNotification({
      type: 'success',
      message: `Switched to ${newMode === 'demo' ? 'Demo' : 'Production'} mode`,
    });
  };

  const handleSpeechEngineChange = (engine) => {
    if (mode === 'demo' && engine !== 'gtts') {
      addNotification({
        type: 'error',
        message: 'Cannot select this engine in demo mode. Switch to production mode first.',
      });
      return;
    }
    persistentActions.setSpeechEngine(engine);
    addNotification({
      type: 'success',
      message: `Switched to ${engine} speech engine`,
    });
  };

  const handleRemoveActiveVoice = (engine, voiceId) => {
    if (allActiveVoices.length === 1) {
      addNotification({ type: 'error', message: 'Cannot remove the last active voice.' });
      return;
    }
    persistentActions.removeActiveVoice(engine, voiceId);
    addNotification({ type: 'success', message: 'Voice removed from active voices' });
  };

  const saveApiKey = (keyName, value) => {
    persistentActions.setApiKey(keyName, value);
    addNotification({ type: 'success', message: 'API key saved successfully' });
  };

  const handleResetSettings = (selections) => {
    if (selections.activeVoices) {
      persistentActions.setActiveVoices({});
    }
    if (selections.mode) {
      persistentActions.setMode('demo');
      persistentActions.setSpeechEngine('gtts');
    }
    if (selections.ttsApiKeys) {
      persistentActions.setApiKey('elevenLabsApiKeys', []);
      persistentActions.setApiKey('awsPollyCredentials', []);
      persistentActions.setApiKey('googleCloudCredentials', []);
      persistentActions.setApiKey('azureTTSCredentials', []);
      persistentActions.setApiKey('ibmWatsonCredentials', []);
    }
    if (selections.aiProviderSettings) {
      persistentActions.setApiKey('openaiApiKey', '');
      persistentActions.setApiKey('anthropicApiKey', '');
    }
    addNotification({ type: 'success', message: 'Selected settings have been reset' });
  };

  return (
    <div className="space-y-8">
      <SettingsTabModeSettings mode={mode} toggleMode={toggleMode} addNotification={addNotification} />
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <h3 className="text-lg font-medium mb-4">Speech Engine Settings</h3>

        {/* Active Voices List */}
        <div className="mb-4">
          <h5 className="text-sm font-medium mb-2">Active Voices (all speech engines)</h5>
          {allActiveVoices.length === 0 ? (
            <p className="text-sm text-gray-600">No active voices added yet.</p>
          ) : (
            <ul className="space-y-2">
              {allActiveVoices.map(voice => {
                const isDefault =
                  defaultVoice &&
                  defaultVoice.engine === voice.engine &&
                  defaultVoice.voiceId === voice.id;
                return (
                  <li key={`${voice.engine}-${voice.id}`} className="flex justify-between items-center">
                    <span>{voice.name} ({voice.language}) - {voice.engine}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => persistentActions.setDefaultVoice(voice.engine, voice.id)}
                        className={`p-1 ${isDefault ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-600`}
                        title="Set as default voice"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3 .921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784 .57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81 .588-1.81h3.461a1 1 0 00 .951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveActiveVoice(voice.engine, voice.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Speech Engine Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="speech-engine-select">
            Speech Engine
          </label>
          <select
            id="speech-engine-select"
            value={speechEngine}
            onChange={(e) => handleSpeechEngineChange(e.target.value)}
            className="select-field w-full p-2 border rounded"
          >
            <option value="gtts">gtts</option>
            <option value="elevenLabs" disabled={mode === 'demo'}>ElevenLabs</option>
            <option value="awsPolly" disabled={mode === 'demo'}>AWS Polly</option>
            <option value="googleCloud" disabled={mode === 'demo'}>Google Cloud TTS</option>
            <option value="azureTTS" disabled={mode === 'demo'}>Azure TTS</option>
            <option value="ibmWatson" disabled={mode === 'demo'}>IBM Watson TTS</option>
          </select>
        </div>

        <SettingsTabVoiceManagement
          speechEngine={speechEngine}
          mode={mode}
          availableVoices={availableVoices}
          activeVoiceIds={activeVoiceIds}
          languages={languages}
          voicesForLanguage={voicesForLanguage}
          selectedVoice={selectedVoice}
          currentVoiceId={currentVoiceId}
          currentLanguage={currentLanguage}
          setCurrentLanguage={setCurrentLanguage}
          newVoiceName={newVoiceName}
          setNewVoiceName={setNewVoiceName}
          newVoiceId={newVoiceId}
          setNewVoiceId={setNewVoiceId}
          newVoiceLanguage={newVoiceLanguage}
          setNewVoiceLanguage={setNewVoiceLanguage}
          isCustomVoiceExpanded={isCustomVoiceExpanded}
          setIsCustomVoiceExpanded={setIsCustomVoiceExpanded}
          customVoices={customVoices}
          persistentActions={{
            addCustomVoice: persistentActions.addCustomVoice,
            removeCustomVoice: persistentActions.removeCustomVoice,
            setSelectedVoice: persistentActions.setSelectedVoice,
            addActiveVoice: persistentActions.addActiveVoice
          }}
          addNotification={addNotification}
        />
        
        {/* JSON Upload Section (only in production mode) */}
        {mode === 'production' && (
          <SettingsTabUploadJSON
            addApiKey={handleAddApiKey}
            addNotification={addNotification}
          />
        )}

        {/* Engine-Specific API Key Management */}
        {speechEngine === 'elevenLabs' && (
          <SettingsTabTTSServiceApiKeys
            service="elevenlabs"
            credentials={elevenLabsApiKeys}
            addApiKey={handleAddApiKey}
            removeApiKey={removeApiKey}
            toggleActiveStatus={toggleActiveStatus}
            updateApiKeyName={updateApiKeyName}
            moveApiKeyUp={moveApiKeyUp}
            moveApiKeyDown={moveApiKeyDown}
            refreshApiKeyTokens={refreshApiKeyTokens}
            addNotification={addNotification}
          />
        )}
        {speechEngine === 'awsPolly' && (
          <SettingsTabTTSServiceApiKeys
            service="aws_polly"
            credentials={awsPollyCredentials}
            addApiKey={handleAddApiKey}
            removeApiKey={removeApiKey}
            toggleActiveStatus={toggleActiveStatus}
            updateApiKeyName={updateApiKeyName}
            moveApiKeyUp={moveApiKeyUp}
            moveApiKeyDown={moveApiKeyDown}
            refreshApiKeyTokens={refreshApiKeyTokens}
            addNotification={addNotification}
          />
        )}
        {speechEngine === 'googleCloud' && (
          <SettingsTabTTSServiceApiKeys
            service="googleCloud"
            credentials={googleCloudCredentials}
            addApiKey={handleAddApiKey}
            removeApiKey={removeApiKey}
            toggleActiveStatus={toggleActiveStatus}
            updateApiKeyName={updateApiKeyName}
            moveApiKeyUp={moveApiKeyUp}
            moveApiKeyDown={moveApiKeyDown}
            refreshApiKeyTokens={refreshApiKeyTokens}
            addNotification={addNotification}
          />
        )}
        {speechEngine === 'azureTTS' && (
          <SettingsTabTTSServiceApiKeys
            service="azure"
            credentials={azureTTSCredentials}
            addApiKey={handleAddApiKey}
            removeApiKey={removeApiKey}
            toggleActiveStatus={toggleActiveStatus}
            updateApiKeyName={updateApiKeyName}
            moveApiKeyUp={moveApiKeyUp}
            moveApiKeyDown={moveApiKeyDown}
            refreshApiKeyTokens={refreshApiKeyTokens}
            addNotification={addNotification}
          />
        )}
        {speechEngine == 'ibmWatson' && (
          <SettingsTabTTSServiceApiKeys
            service="ibm_watson"
            credentials={ibmWatsonCredentials}
            addApiKey={handleAddApiKey}
            removeApiKey={removeApiKey}
            toggleActiveStatus={toggleActiveStatus}
            updateApiKeyName={updateApiKeyName}
            moveApiKeyUp={moveApiKeyUp}
            moveApiKeyDown={moveApiKeyDown}
            refreshApiKeyTokens={refreshApiKeyTokens}
            addNotification={addNotification}
          />
        )}
      </div>
      <SettingsTabAIProviderSettings
        openaiApiKey={openaiApiKey}
        anthropicApiKey={anthropicApiKey}
        setApiKey={persistentActions.setApiKey}
        saveApiKey={saveApiKey}
        addNotification={addNotification}
      />
      <SettingsTabResetSettings
        handleResetSettings={handleResetSettings}
        addNotification={addNotification}
      />
    </div>
  );
};

export default SettingsTab;