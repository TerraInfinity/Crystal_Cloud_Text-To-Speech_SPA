import React from 'react';
import { useTTS } from '../context/TTSContext';

const SettingsTab = () => {
  const {
    mode,
    speechEngine,
    elevenLabsApiKey,
    awsPollyAccessKey,
    awsPollySecretKey,
    anthropicApiKey,
    openaiApiKey,
    actions
  } = useTTS();
  
  // Toggle between demo and production mode
  const toggleMode = () => {
    const newMode = mode === 'demo' ? 'production' : 'demo';
    actions.setMode(newMode);
    
    // Auto-select appropriate speech engine based on mode
    if (newMode === 'demo') {
      actions.setSpeechEngine('webSpeech');
    } else {
      // Default to ElevenLabs for production if key exists
      if (elevenLabsApiKey) {
        actions.setSpeechEngine('elevenLabs');
      } else if (awsPollyAccessKey && awsPollySecretKey) {
        actions.setSpeechEngine('awsPolly');
      }
    }
    
    actions.setNotification({
      type: 'success',
      message: `Switched to ${newMode === 'demo' ? 'Demo' : 'Production'} mode`
    });
  };
  
  // Handle speech engine change
  const handleSpeechEngineChange = (engine) => {
    actions.setSpeechEngine(engine);
    
    // Set appropriate mode based on engine
    if (engine === 'webSpeech') {
      actions.setMode('demo');
    } else {
      actions.setMode('production');
    }
  };
  
  // Save API key
  const saveApiKey = (keyName, value) => {
    actions.setApiKey(keyName, value);
    actions.setNotification({
      type: 'success',
      message: 'API key saved successfully'
    });
  };
  
  return (
    <div className="space-y-8">
      {/* Mode Settings */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium mb-4">Mode Settings</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
          <div>
            <h4 className="font-medium">Current Mode: {mode === 'demo' ? 'Demo' : 'Production'}</h4>
            <p className="text-sm text-gray-600 mt-1">
              {mode === 'demo' 
                ? 'Using Web Speech API with no character limit.' 
                : 'Using cloud-based speech engines (requires API keys).'}
            </p>
          </div>
          
          <button
            onClick={toggleMode}
            className={`btn ${mode === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Switch to {mode === 'demo' ? 'Production' : 'Demo'} Mode
          </button>
        </div>
      </div>
      
      {/* Speech Engine Settings */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium mb-4">Speech Engine Settings</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Speech Engine
          </label>
          <select
            value={speechEngine}
            onChange={(e) => handleSpeechEngineChange(e.target.value)}
            className="select-field"
          >
            <option value="webSpeech">Web Speech API (Browser-based, Demo Mode)</option>
            <option value="elevenLabs">ElevenLabs (Production Mode)</option>
            <option value="awsPolly">AWS Polly (Production Mode)</option>
          </select>
        </div>
        
        {speechEngine === 'elevenLabs' && (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ElevenLabs API Key
            </label>
            <div className="flex">
              <input
                type="password"
                value={elevenLabsApiKey || ''}
                onChange={(e) => actions.setApiKey('elevenLabsApiKey', e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Enter your ElevenLabs API key"
              />
              <button
                onClick={() => saveApiKey('elevenLabsApiKey', elevenLabsApiKey)}
                className="btn btn-primary rounded-l-none"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from <a href="https://elevenlabs.io/api" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">ElevenLabs</a>
            </p>
          </div>
        )}
        
        {speechEngine === 'awsPolly' && (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AWS Access Key
              </label>
              <div className="flex">
                <input
                  type="password"
                  value={awsPollyAccessKey || ''}
                  onChange={(e) => actions.setApiKey('awsPollyAccessKey', e.target.value)}
                  className="input-field rounded-r-none"
                  placeholder="Enter your AWS Access Key"
                />
                <button
                  onClick={() => saveApiKey('awsPollyAccessKey', awsPollyAccessKey)}
                  className="btn btn-primary rounded-l-none"
                >
                  Save
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AWS Secret Key
              </label>
              <div className="flex">
                <input
                  type="password"
                  value={awsPollySecretKey || ''}
                  onChange={(e) => actions.setApiKey('awsPollySecretKey', e.target.value)}
                  className="input-field rounded-r-none"
                  placeholder="Enter your AWS Secret Key"
                />
                <button
                  onClick={() => saveApiKey('awsPollySecretKey', awsPollySecretKey)}
                  className="btn btn-primary rounded-l-none"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get your AWS keys from the <a href="https://aws.amazon.com/console/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">AWS Console</a>
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* AI Provider Settings */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium mb-4">AI Provider Settings</h3>
        
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key
          </label>
          <div className="flex">
            <input
              type="password"
              value={openaiApiKey || ''}
              onChange={(e) => actions.setApiKey('openaiApiKey', e.target.value)}
              className="input-field rounded-r-none"
              placeholder="Enter your OpenAI API key"
            />
            <button
              onClick={() => saveApiKey('openaiApiKey', openaiApiKey)}
              className="btn btn-primary rounded-l-none"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">OpenAI</a>
          </p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anthropic API Key
          </label>
          <div className="flex">
            <input
              type="password"
              value={anthropicApiKey || ''}
              onChange={(e) => actions.setApiKey('anthropicApiKey', e.target.value)}
              className="input-field rounded-r-none"
              placeholder="Enter your Anthropic API key"
            />
            <button
              onClick={() => saveApiKey('anthropicApiKey', anthropicApiKey)}
              className="btn btn-primary rounded-l-none"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">Anthropic</a>
          </p>
        </div>
      </div>
      
      {/* Reset Settings */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to reset all settings? This will clear all API keys and preferences.')) {
              actions.resetState();
              actions.setNotification({
                type: 'success',
                message: 'All settings have been reset'
              });
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
