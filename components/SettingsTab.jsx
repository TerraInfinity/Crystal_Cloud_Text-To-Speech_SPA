import React, { useState, useEffect, useMemo } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';

const SettingsTab = () => {
  const {
    state: persistentState,
    actions: persistentActions,
    processingMode,
    setProcessingMode,
    remoteEndpoint,
    setRemoteEndpoint,
  } = useTTS();
  const { actions: sessionActions } = useTTSSession();

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

  // Local state for input fields
  const [newElevenLabsKey, setNewElevenLabsKey] = useState('');
  const [newAwsAccessKey, setNewAwsAccessKey] = useState('');
  const [newAwsSecretKey, setNewAwsSecretKey] = useState('');
  const [newGoogleCloudKey, setNewGoogleCloudKey] = useState('');
  const [newAzureKey, setNewAzureKey] = useState('');
  const [newIbmWatsonKey, setNewIbmWatsonKey] = useState('');
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceId, setNewVoiceId] = useState('');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState(
    selectedVoices[speechEngine]?.language ||
    defaultVoices[speechEngine]?.[0]?.language ||
    'en'
  );
  const [isCustomVoiceExpanded, setIsCustomVoiceExpanded] = useState(false);

  // Compute available voices, using defaultVoices and customVoices
  const availableVoices = useMemo(() => {
    const engineDefaultVoices = defaultVoices[speechEngine] || [];
    if (!defaultVoices[speechEngine]) {
      console.warn(`No default voices defined for ${speechEngine}`);
    }
    return [
      ...engineDefaultVoices,
      ...(customVoices[speechEngine] || []),
    ];
  }, [speechEngine, defaultVoices, customVoices]);

  // Get active voice IDs for the current engine
  const activeVoiceIds = useMemo(() => new Set((activeVoices[speechEngine] || []).map(v => v.id)), [activeVoices, speechEngine]);

  // Compute languages with at least one available (non-active) voice
  const languages = useMemo(() => {
    return [...new Set(
      availableVoices
        .filter(v => !activeVoiceIds.has(v.id))
        .map(v => v.language)
    )].sort();
  }, [availableVoices, activeVoiceIds]);

  // Filter voices for the current language, excluding active voices
  const voicesForLanguage = useMemo(() => 
    availableVoices
      .filter(v => v.language === currentLanguage)
      .filter(v => !activeVoiceIds.has(v.id)),
    [availableVoices, currentLanguage, activeVoiceIds]
  );

  // Determine the current selected voice
  const selectedVoice = selectedVoices[speechEngine];
  const currentVoiceId = voicesForLanguage.some(v => v.id === selectedVoice?.id)
    ? selectedVoice?.id
    : voicesForLanguage[0]?.id || '';

  // Get all active voices across all engines
  const allActiveVoices = useMemo(() => {
    const voices = Object.values(activeVoices).flat();
    return mode === 'demo' ? voices.filter(voice => voice.engine === 'gtts') : voices;
  }, [activeVoices, mode]);

  // useEffect Hooks
  useEffect(() => {
    if (availableVoices.length > 0 && (!selectedVoices[speechEngine] || !selectedVoices[speechEngine].id)) {
      const defaultVoice = availableVoices[0];
      persistentActions.setSelectedVoice(speechEngine, defaultVoice);
      setCurrentLanguage(defaultVoice.language);
    }
  }, [speechEngine, availableVoices, selectedVoices, persistentActions]);

  useEffect(() => {
    if (voicesForLanguage.length > 0 && (!selectedVoice || !voicesForLanguage.some(v => v.id === selectedVoice.id))) {
      persistentActions.setSelectedVoice(speechEngine, voicesForLanguage[0]);
    }
  }, [currentLanguage, voicesForLanguage, speechEngine, selectedVoice, persistentActions]);

  useEffect(() => {
    if (languages.length > 0 && !languages.includes(currentLanguage)) {
      setCurrentLanguage(languages[0]);
    }
  }, [languages, currentLanguage]);

  // Functions
  const toggleMode = () => {
    const newMode = mode === 'demo' ? 'production' : 'demo';
    persistentActions.setMode(newMode);
    if (newMode === 'demo') {
      persistentActions.setSpeechEngine('gtts');
    } else {
      if (elevenLabsApiKeys.length > 0) persistentActions.setSpeechEngine('elevenLabs');
      else if (awsPollyCredentials.length > 0) persistentActions.setSpeechEngine('awsPolly');
      else if (googleCloudCredentials.length > 0) persistentActions.setSpeechEngine('googleCloud');
      else if (azureTTSCredentials.length > 0) persistentActions.setSpeechEngine('azureTTS');
      else if (ibmWatsonCredentials.length > 0) persistentActions.setSpeechEngine('ibmWatson');
      else persistentActions.setSpeechEngine('gtts');
    }
    sessionActions.setNotification({
      type: 'success',
      message: `Switched to ${newMode === 'demo' ? 'Demo' : 'Production'} mode`,
    });
  };

  const handleSpeechEngineChange = (engine) => {
    persistentActions.setSpeechEngine(engine);
    if (engine === 'gtts') {
      persistentActions.setMode('demo');
    } else {
      persistentActions.setMode('production');
    }
  };

  const addElevenLabsApiKey = () => {
    if (newElevenLabsKey) {
      persistentActions.addApiKey('elevenLabsApiKeys', newElevenLabsKey);
      setNewElevenLabsKey('');
      sessionActions.setNotification({ type: 'success', message: 'ElevenLabs API key added' });
    }
  };

  const removeElevenLabsApiKey = (index) => {
    persistentActions.removeApiKey('elevenLabsApiKeys', index);
    sessionActions.setNotification({ type: 'success', message: 'ElevenLabs API key removed' });
  };

  const addAwsPollyCredential = () => {
    if (newAwsAccessKey && newAwsSecretKey) {
      persistentActions.addApiKey('awsPollyCredentials', {
        accessKey: newAwsAccessKey,
        secretKey: newAwsSecretKey,
      });
      setNewAwsAccessKey('');
      setNewAwsSecretKey('');
      sessionActions.setNotification({ type: 'success', message: 'AWS Polly credentials added' });
    }
  };

  const removeAwsPollyCredential = (index) => {
    persistentActions.removeApiKey('awsPollyCredentials', index);
    sessionActions.setNotification({ type: 'success', message: 'AWS Polly credentials removed' });
  };

  const addGoogleCloudKey = () => {
    if (newGoogleCloudKey) {
      persistentActions.addApiKey('googleCloudCredentials', newGoogleCloudKey);
      setNewGoogleCloudKey('');
      sessionActions.setNotification({ type: 'success', message: 'Google Cloud TTS API key added' });
    }
  };

  const removeGoogleCloudKey = (index) => {
    persistentActions.removeApiKey('googleCloudCredentials', index);
    sessionActions.setNotification({ type: 'success', message: 'Google Cloud TTS API key removed' });
  };

  const addAzureTTSKey = () => {
    if (newAzureKey) {
      persistentActions.addApiKey('azureTTSCredentials', newAzureKey);
      setNewAzureKey('');
      sessionActions.setNotification({ type: 'success', message: 'Azure TTS API key added' });
    }
  };

  const removeAzureTTSKey = (index) => {
    persistentActions.removeApiKey('azureTTSCredentials', index);
    sessionActions.setNotification({ type: 'success', message: 'Azure TTS API key removed' });
  };

  const addIbmWatsonKey = () => {
    if (newIbmWatsonKey) {
      persistentActions.addApiKey('ibmWatsonCredentials', newIbmWatsonKey);
      setNewIbmWatsonKey('');
      sessionActions.setNotification({ type: 'success', message: 'IBM Watson TTS API key added' });
    }
  };

  const removeIbmWatsonKey = (index) => {
    persistentActions.removeApiKey('ibmWatsonCredentials', index);
    sessionActions.setNotification({ type: 'success', message: 'IBM Watson TTS API key removed' });
  };

  const saveApiKey = (keyName, value) => {
    persistentActions.setApiKey(keyName, value);
    sessionActions.setNotification({ type: 'success', message: 'API key saved successfully' });
  };

  const addCustomVoice = () => {
    if (newVoiceName && newVoiceId && newVoiceLanguage) {
      const existingVoice = availableVoices.find(v => v.id === newVoiceId);
      if (existingVoice) {
        sessionActions.setNotification({ type: 'error', message: 'Voice ID already exists.' });
        return;
      }
      const newVoice = {
        name: newVoiceName,
        id: newVoiceId,
        language: newVoiceLanguage,
        engine: speechEngine,
        ...(speechEngine === 'gtts' && { tld: newVoiceId }),
      };
      persistentActions.addCustomVoice(speechEngine, newVoice);
      setNewVoiceName('');
      setNewVoiceId('');
      setNewVoiceLanguage('');
      sessionActions.setNotification({ type: 'success', message: 'Custom voice added' });
    } else {
      sessionActions.setNotification({ type: 'error', message: 'Please fill all fields' });
    }
  };

  const removeCustomVoice = (voiceId) => {
    persistentActions.removeCustomVoice(speechEngine, voiceId);
    sessionActions.setNotification({ type: 'success', message: 'Custom voice removed' });
  };

  const handleAddActiveVoice = () => {
    if (selectedVoice) {
      if (mode === 'demo' && selectedVoice.engine !== 'gtts') {
        sessionActions.setNotification({
          type: 'error',
          message: 'Only gtts voices can be added in demo mode.',
        });
        return;
      }
      // Create voice object with engine information
      // Note: tld may be undefined for non-gtts engines or when not explicitly set in the voice configuration
      // This is expected behavior and doesn't affect functionality
      const voiceWithEngine = {
        id: selectedVoice.id,
        name: selectedVoice.name,
        language: selectedVoice.language,
        tld: selectedVoice.tld,
        engine: speechEngine
      };
      devLog('Adding active voice:', voiceWithEngine);
      persistentActions.addActiveVoice(speechEngine, voiceWithEngine);
      sessionActions.setNotification({
        type: 'success',
        message: `${selectedVoice.name} added to active voices`,
      });
      if (voicesForLanguage.length > 1) {
        const nextVoice = voicesForLanguage.find(v => v.id !== selectedVoice.id);
        if (nextVoice) persistentActions.setSelectedVoice(speechEngine, nextVoice);
      }
    } else {
      sessionActions.setNotification({
        type: 'error',
        message: 'No voice selected to add.',
      });
    }
  };

  const handleRemoveActiveVoice = (engine, voiceId) => {
    if (allActiveVoices.length === 1) {
      sessionActions.setNotification({
        type: 'error',
        message: 'Cannot remove the last active voice.',
      });
      return;
    }
    persistentActions.removeActiveVoice(engine, voiceId);
    sessionActions.setNotification({
      type: 'success',
      message: `Voice removed from active voices`,
    });
  };

  // JSX
  return (
    <div className="space-y-8">
      {/* Mode Settings */}
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
                ? 'Using gtts for demo mode (Python server).'
                : 'Using cloud-based speech engines (requires API keys).'}
            </p>
          </div>
          <button
            id="mode-toggle-button"
            onClick={toggleMode}
            className={`btn ${mode === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Switch to {mode === 'demo' ? 'Production' : 'Demo'} Mode
          </button>
        </div>
      </div>

      {/* Speech Engine Settings */}
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
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
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
            <option value="gtts">gtts (Demo Mode)</option>
            <option value="elevenLabs" disabled={mode === 'demo'}>ElevenLabs (Production Mode)</option>
            <option value="awsPolly" disabled={mode === 'demo'}>AWS Polly (Production Mode)</option>
            <option value="googleCloud" disabled={mode === 'demo'}>Google Cloud TTS (Production Mode)</option>
            <option value="azureTTS" disabled={mode === 'demo'}>Azure TTS (Production Mode)</option>
            <option value="ibmWatson" disabled={mode === 'demo'}>IBM Watson TTS (Production Mode)</option>
          </select>
        </div>

        {/* Voice Selection */}
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
              No voices available. Check your TTSContext configuration or add custom voices.
            </p>
          ) : languages.length === 0 ? (
            <p className="text-sm text-red-600">
              All voices are currently active for this engine.
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
                    onChange={(e) => {
                      const voice = voicesForLanguage.find(v => v.id === e.target.value);
                      if (voice) persistentActions.setSelectedVoice(speechEngine, voice);
                    }}
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
        </div>

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
                  onClick={addCustomVoice} 
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
                      onClick={() => removeCustomVoice(voice.id)}
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

        {/* API Key Sections */}
        {speechEngine === 'elevenLabs' && (
          <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ElevenLabs API Keys
            </label>
            <div className="mb-2">
              {elevenLabsApiKeys.map((key, index) => (
                <div key={index} className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    Key {index + 1}: {key.slice(0, 4)}...{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeElevenLabsApiKey(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                id="elevenlabs-key-input"
                data-testid="elevenlabs-key-input"
                type="password"
                value={newElevenLabsKey}
                onChange={(e) => setNewElevenLabsKey(e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Enter new ElevenLabs API key"
              />
              <button
                id="add-elevenlabs-key-button"
                data-testid="add-elevenlabs-key-button"
                onClick={addElevenLabsApiKey}
                className="btn btn-primary rounded-l-none"
              >
                Add Key
              </button>
            </div>
          </div>
        )}

        {speechEngine === 'awsPolly' && (
          <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AWS Polly Credentials
            </label>
            <div className="mb-2">
              {awsPollyCredentials.map((cred, index) => (
                <div key={index} className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    Access Key {index + 1}: {cred.accessKey.slice(0, 4)}...{cred.accessKey.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeAwsPollyCredential(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <input
                id="aws-access-key-input"
                data-testid="aws-access-key-input"
                type="text"
                value={newAwsAccessKey}
                onChange={(e) => setNewAwsAccessKey(e.target.value)}
                className="input-field w-full"
                placeholder="Enter AWS Access Key"
              />
              <input
                id="aws-secret-key-input"
                data-testid="aws-secret-key-input"
                type="password"
                value={newAwsSecretKey}
                onChange={(e) => setNewAwsSecretKey(e.target.value)}
                className="input-field w-full"
                placeholder="Enter AWS Secret Key"
              />
              <button
                id="add-aws-credentials-button"
                data-testid="add-aws-credentials-button"
                onClick={addAwsPollyCredential}
                className="btn btn-primary w-full"
              >
                Add Credentials
              </button>
            </div>
          </div>
        )}

        {speechEngine === 'googleCloud' && (
          <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Cloud TTS API Keys
            </label>
            <div className="mb-2">
              {googleCloudCredentials.map((key, index) => (
                <div key={index} className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    Key {index + 1}: {key.slice(0, 4)}...{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeGoogleCloudKey(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                id="google-cloud-key-input"
                type="password"
                value={newGoogleCloudKey}
                onChange={(e) => setNewGoogleCloudKey(e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Enter new Google Cloud API key"
              />
              <button
                id="add-google-cloud-key-button"
                onClick={addGoogleCloudKey}
                className="btn btn-primary rounded-l-none"
              >
                Add Key
              </button>
            </div>
          </div>
        )}

        {speechEngine === 'azureTTS' && (
          <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Azure TTS API Keys
            </label>
            <div className="mb-2">
              {azureTTSCredentials.map((key, index) => (
                <div key={index} className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    Key {index + 1}: {key.slice(0, 4)}...{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeAzureTTSKey(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                id="azure-key-input"
                type="password"
                value={newAzureKey}
                onChange={(e) => setNewAzureKey(e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Enter new Azure TTS API key"
              />
              <button
                id="add-azure-key-button"
                onClick={addAzureTTSKey}
                className="btn btn-primary rounded-l-none"
              >
                Add Key
              </button>
            </div>
          </div>
        )}

        {speechEngine === 'ibmWatson' && (
          <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: 'var(--card-bg)' }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IBM Watson TTS API Keys
            </label>
            <div className="mb-2">
              {ibmWatsonCredentials.map((key, index) => (
                <div key={index} className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    Key {index + 1}: {key.slice(0, 4)}...{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeIbmWatsonKey(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                id="ibm-watson-key-input"
                type="password"
                value={newIbmWatsonKey}
                onChange={(e) => setNewIbmWatsonKey(e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Enter new IBM Watson API key"
              />
              <button
                id="add-ibm-watson-key-button"
                onClick={addIbmWatsonKey}
                className="btn btn-primary rounded-l-none"
              >
                Add Key
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Provider Settings */}
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
              value={openaiApiKey || ''}
              onChange={(e) => persistentActions.setApiKey('openaiApiKey', e.target.value)}
              className="input-field rounded-r-none"
              placeholder="Enter your OpenAI API key"
            />
            <button
              id="save-openai-key-button"
              data-testid="save-openai-key-button"
              onClick={() => saveApiKey('openaiApiKey', openaiApiKey)}
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
              value={anthropicApiKey || ''}
              onChange={(e) => persistentActions.setApiKey('anthropicApiKey', e.target.value)}
              className="input-field rounded-r-none"
              placeholder="Enter your Anthropic API key"
            />
            <button
              id="save-anthropic-key-button"
              data-testid="save-anthropic-key-button"
              onClick={() => saveApiKey('anthropicApiKey', anthropicApiKey)}
              className="btn btn-primary rounded-l-none"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Reset Settings */}
      <div className="flex justify-end">
        <button
          id="reset-settings-button"
          onClick={() => {
            if (window.confirm('Are you sure you want to reset all settings?')) {
              persistentActions.resetState();
              sessionActions.setNotification({ type: 'success', message: 'All settings have been reset' });
            }
          }}
          className="btn btn-danger"
        >
          Reset All Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;