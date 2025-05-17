/**
 * @fileoverview TTS Service API Keys management component for the TTS application settings tab.
 * Manages the display and modification of API keys for a specific TTS service.
 */

import React, { useState, useEffect } from 'react';
import { useTTSContext } from '../../context/TTSContext';
import {
  ApiKey,
  addApiKey,
  removeApiKey,
  toggleActiveStatus,
  updateApiKeyName,
  moveApiKeyUp,
  moveApiKeyDown,
  refreshApiKeyTokens,
  getApiKeys,
} from '../../utils/apiKeyManagement';
import { devLog } from '../../utils/logUtils';

type TTSEngine = 'elevenlabs' | 'aws_polly' | 'googlecloud' | 'azuretts' | 'ibmwatson' | 'gtts';

interface Props {
  service: TTSEngine;
  addNotification: (notification: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const SettingsTabTTSServiceApiKeys: React.FC<Props> = ({ service, addNotification }) => {
  const { state: { settings: { speechEngine } } } = useTTSContext();
  const [credentials, setCredentials] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newAccessKey, setNewAccessKey] = useState(''); // For AWS Polly
  const [newSecretKey, setNewSecretKey] = useState(''); // For AWS Polly

  const isAwsPolly = service === 'aws_polly';

  // Load credentials on mount and service change
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedKeys = await getApiKeys(service);
        setCredentials(storedKeys);
        devLog(`Loaded ${service} API keys:`, storedKeys);
      } catch (error) {
        devLog(`Error loading ${service} API keys:`, error);
        addNotification({ type: 'error', message: 'Failed to load API keys' });
      }
    };
    loadCredentials();
  }, [service, addNotification]);

  const handleAddKey = async () => {
    if (!newKeyName || (!newKeyValue && !isAwsPolly) || (isAwsPolly && (!newAccessKey || !newSecretKey))) {
      addNotification({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    try {
      const keyObj: ApiKey = {
        name: newKeyName,
        active: true,
        ...(isAwsPolly
          ? { accessKey: newAccessKey, secretKey: newSecretKey }
          : { key: newKeyValue }),
      };
      await addApiKey(service, keyObj);
      setCredentials(await getApiKeys(service));
      setNewKeyName('');
      setNewKeyValue('');
      setNewAccessKey('');
      setNewSecretKey('');
      addNotification({ type: 'success', message: 'API key added successfully' });
    } catch (error) {
      devLog(`Error adding ${service} API key:`, error);
      addNotification({ type: 'error', message: 'Failed to add API key' });
    }
  };

  const handleRemoveKey = async (index: number) => {
    try {
      await removeApiKey(service, index);
      setCredentials(await getApiKeys(service));
      addNotification({ type: 'success', message: 'API key removed successfully' });
    } catch (error) {
      devLog(`Error removing ${service} API key:`, error);
      addNotification({ type: 'error', message: 'Failed to remove API key' });
    }
  };

  const handleToggleActiveStatus = async (index: number) => {
    try {
      await toggleActiveStatus(service, index);
      const updatedKeys = await getApiKeys(service);
      setCredentials(updatedKeys);
      addNotification({
        type: 'success',
        message: `API key ${updatedKeys[index].active ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      devLog(`Error toggling ${service} API key status:`, error);
      addNotification({ type: 'error', message: 'Failed to toggle API key status' });
    }
  };

  const handleUpdateKeyName = async (index: number, newName: string) => {
    try {
      await updateApiKeyName(service, index, newName);
      setCredentials(await getApiKeys(service));
    } catch (error) {
      devLog(`Error updating ${service} API key name:`, error);
      addNotification({ type: 'error', message: 'Failed to update API key name' });
    }
  };

  const handleMoveKeyUp = async (index: number) => {
    try {
      await moveApiKeyUp(service, index);
      setCredentials(await getApiKeys(service));
    } catch (error) {
      devLog(`Error moving ${service} API key up:`, error);
      addNotification({ type: 'error', message: 'Failed to move API key' });
    }
  };

  const handleMoveKeyDown = async (index: number) => {
    try {
      await moveApiKeyDown(service, index);
      setCredentials(await getApiKeys(service));
    } catch (error) {
      devLog(`Error moving ${service} API key down:`, error);
      addNotification({ type: 'error', message: 'Failed to move API key' });
    }
  };

  const handleRefreshTokens = async (index: number) => {
    if (service !== 'elevenlabs') return;
    try {
      // Show a loading notification
      addNotification({ type: 'info', message: 'Refreshing tokens from ElevenLabs API...' });
      
      await refreshApiKeyTokens(service, index);
      const updatedKeys = await getApiKeys(service);
      setCredentials(updatedKeys);
      
      // Show the updated token count in the notification
      const keyName = updatedKeys[index]?.name || `Key ${index}`;
      const tokenCount = updatedKeys[index]?.remaining_tokens || 0;
      addNotification({ 
        type: 'success', 
        message: `Tokens refreshed successfully for ${keyName}: ${tokenCount} tokens remaining` 
      });
    } catch (error) {
      devLog('Error refreshing ElevenLabs tokens:', error);
      const errorMessage = error.message?.includes('401') ? 
        'Invalid API key: Authentication failed' : 
        `Failed to refresh tokens: ${error.message || 'Unknown error'}`;
      
      addNotification({ type: 'error', message: errorMessage });
    }
  };

  return (
    <div className="mb-4">
      <h4 className="text-md font-medium mb-2">
        {service === 'elevenlabs' ? 'ElevenLabs' :
         service === 'aws_polly' ? 'AWS Polly' :
         service === 'googlecloud' ? 'Google Cloud TTS' :
         service === 'azuretts' ? 'Azure TTS' :
         service === 'ibmwatson' ? 'IBM Watson TTS' : 'TTS Service'} API Keys
      </h4>

      {/* Current Keys List */}
      <div className="mb-4">
        <h5 className="text-sm font-medium mb-2">Current Keys</h5>
        {credentials.length === 0 ? (
          <p className="text-sm text-gray-600">No API keys added yet.</p>
        ) : (
          <ul className="space-y-2">
            {credentials.map((key, index) => (
              <li key={index} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <input
                    type="text"
                    value={key.name}
                    onChange={(e) => handleUpdateKeyName(index, e.target.value)}
                    className="input-field mr-2"
                  />
                  <span className={key.active ? 'text-green-500' : 'text-red-500'}>
                    ({key.active ? 'Active' : 'Inactive'})
                  </span>
                  {key.remaining_tokens !== undefined && (
                    <span className="ml-2">Tokens: {key.remaining_tokens}</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToggleActiveStatus(index)}
                    className="btn btn-sm"
                  >
                    {key.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleMoveKeyUp(index)}
                    disabled={index === 0}
                    className="btn btn-sm"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveKeyDown(index)}
                    disabled={index === credentials.length - 1}
                    className="btn btn-sm"
                  >
                    ↓
                  </button>
                  {service === 'elevenlabs' && (
                    <button
                      onClick={() => handleRefreshTokens(index)}
                      className="btn btn-sm"
                    >
                      Refresh Tokens
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveKey(index)}
                    className="btn btn-sm btn-danger"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add New Key Form */}
      <div>
        <h5 className="text-sm font-medium mb-2">Add New Key</h5>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="input-field flex-1"
          />
          {isAwsPolly ? (
            <>
              <input
                type="text"
                placeholder="Access Key"
                value={newAccessKey}
                onChange={(e) => setNewAccessKey(e.target.value)}
                className="input-field flex-1"
              />
              <input
                type="password"
                placeholder="Secret Key"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                className="input-field flex-1"
              />
            </>
          ) : (
            <input
              type="password"
              placeholder="API Key"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              className="input-field flex-1"
            />
          )}
          <button onClick={handleAddKey} className="btn btn-primary">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTabTTSServiceApiKeys;