/**
 * @fileoverview API key management utilities for the TTS application.
 * Provides functions for processing uploaded API key JSON, initializing keys from storage,
 * encrypting/decrypting keys, and managing key priorities and token refresh.
 */

import { loadFromStorage, saveToStorage } from '../context/storage';
import { devLog } from './logUtils';
import CryptoJS from 'crypto-js';

export interface ApiKey {
  name: string;
  key?: string;
  active: boolean;
  accessKey?: string;
  secretKey?: string;
  remaining_tokens?: number;
}

// Encryption key from environment variable
const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY || 'default-secret-key';

// Valid service types (TTS engines and AI providers)
export type Service = 'elevenlabs' | 'aws_polly' | 'googlecloud' | 'azuretts' | 'ibmwatson' | 'gtts' | 'openai' | 'anthropic';

// Encrypt a key
export const encryptKey = (key: string): string => {
  try {
    return CryptoJS.AES.encrypt(key, ENCRYPTION_SECRET_KEY).toString();
  } catch (error) {
    devLog('Encryption error:', error);
    return key; // Fallback to plain text
  }
};

// Helper function to log encrypted and decrypted keys (for debugging)
const logDecryptedKey = (encrypted: string, decrypted: string): void => {
  const maskedDecrypted = decrypted.length > 8 ? 
    `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}` : decrypted;
  devLog('Key decryption details:', { 
    encryptedLength: encrypted.length,
    decryptedLength: decrypted.length,
    maskedDecrypted,
    decryptionSuccessful: !!decrypted
  });
};

export const decryptKey = (encryptedKey: string): string => {
  try {
    if (!encryptedKey) {
      devLog('decryptKey: Empty or null key provided');
      return '';
    }
    
    devLog('decryptKey: Attempting decryption', { encryptedKeyLength: encryptedKey.length });
    
    // If the key doesn't look like an encrypted string (no special chars), just return it
    if (!/[^A-Za-z0-9]/.test(encryptedKey)) {
      devLog('decryptKey: Key appears to be plaintext (no special chars), skipping decryption');
      return encryptedKey;
    }
    
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        devLog('decryptKey: Decryption returned empty string');
        // If decryption failed, return the original key as fallback
        return encryptedKey;
      }
      
      logDecryptedKey(encryptedKey, decrypted);
      devLog('decryptKey: Decryption successful', { decryptedLength: decrypted.length });
      return decrypted;
    } catch (error) {
      devLog('decryptKey: CryptoJS decryption error:', error.message);
      // If decryption with CryptoJS fails, try a basic decoding as fallback
      try {
        // Try basic base64 decoding as a last resort
        if (encryptedKey.match(/^[A-Za-z0-9+/=]+$/)) {
          const decoded = atob(encryptedKey);
          devLog('decryptKey: Attempted base64 decoding as fallback', { decodedLength: decoded.length });
          return decoded;
        }
      } catch (decodeError) {
        devLog('decryptKey: Fallback decoding also failed:', decodeError.message);
      }
      
      return encryptedKey;
    }
  } catch (error) {
    devLog('decryptKey: Outer error handling caught:', error.message);
    return encryptedKey;
  }
};


// Retrieve API keys for a service from localStorage
export const getApiKeys = async (service: Service): Promise<ApiKey[]> => {
  devLog('getApiKeys: Attempting to load keys for', service);
  try {
    const keys = await loadFromStorage(`tts_api_key_${service}`, false, 'localStorage');
    devLog(`getApiKeys: Raw keys from localStorage for ${service}:`, keys ? `${keys.length} keys` : 'null');
    if (Array.isArray(keys) && keys.every(key => key && typeof key === 'object' && 'name' in key && 'active' in key)) {
      const decryptedKeys = keys.map(key => ({
        ...key,
        key: key.key ? decryptKey(key.key) : undefined,
        accessKey: key.accessKey ? decryptKey(key.accessKey) : undefined,
        secretKey: key.secretKey ? decryptKey(key.secretKey) : undefined,
      }));
      devLog(`getApiKeys: Decrypted ${service} API keys:`, decryptedKeys.map(k => ({
        name: k.name,
        active: k.active,
        hasKey: !!k.key,
        keyLength: k.key?.length || 0,
        remaining_tokens: k.remaining_tokens
      })));
      return decryptedKeys;
    }
    devLog(`getApiKeys: Invalid or empty ${service} API keys:`, keys);
    return [];
  } catch (error) {
    devLog(`getApiKeys: Error retrieving ${service} API keys:`, error);
    return [];
  }
};

// Load API keys for multiple services
export const loadApiKeys = async (services: Service[]): Promise<Record<string, { keys: ApiKey[] }>> => {
  const result: Record<string, { keys: ApiKey[] }> = {};
  for (const service of services) {
    const keys = await getApiKeys(service);
    const decryptedKeys = keys.map(key => {
      const decrypted = {
        ...key,
        key: key.key ? decryptKey(key.key) : undefined,
        accessKey: key.accessKey ? decryptKey(key.accessKey) : undefined,
        secretKey: key.secretKey ? decryptKey(key.secretKey) : undefined,
      };
      devLog(`loadApiKeys: Decrypted key for ${service} - ${key.name}:`, {
        name: key.name,
        active: key.active,
        hasKey: !!decrypted.key,
        remaining_tokens: key.remaining_tokens
      });
      return decrypted;
    });
    result[service] = { keys: decryptedKeys };
  }
  devLog(`loadApiKeys: Final result:`, Object.keys(result).map(s => ({
    service: s,
    keyCount: result[s].keys.length
  })));
  return result;
};
// Save API keys for a service to localStorage
export const saveApiKeys = async (service: Service, keys: ApiKey[]): Promise<void> => {
  try {
    await saveToStorage(`tts_api_key_${service}`, keys, 'localStorage');
    devLog(`Saved ${service} API keys to localStorage:`, keys);
  } catch (error) {
    devLog(`Error saving ${service} API keys:`, error);
    throw new Error(`Failed to save API keys for ${service}`);
  }
};

// Process uploaded API key JSON
export const processUploadedApiKeysJson = async (file: File): Promise<boolean> => {
  try {
    const text = await file.text();
    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch (error) {
      devLog('Error parsing uploaded JSON:', error);
      return false;
    }

    // Normalize service names
    const serviceMap: { [key: string]: Service } = {
      elevenlabs: 'elevenlabs',
      elevenLabs: 'elevenlabs',
      aws_polly: 'aws_polly',
      awsPolly: 'aws_polly',
      googlecloud: 'googlecloud',
      google_cloud: 'googlecloud',
      googleCloud: 'googlecloud',
      azuretts: 'azuretts',
      azure: 'azuretts',
      azureTTS: 'azuretts',
      ibmwatson: 'ibmwatson',
      ibm_watson: 'ibmwatson',
      ibmWatson: 'ibmwatson',
      openai: 'openai',
      anthropic: 'anthropic',
    };

    // Valid services
    const services: Service[] = [
      'elevenlabs',
      'aws_polly',
      'googlecloud',
      'azuretts',
      'ibmwatson',
      'openai',
      'anthropic',
    ];
    for (const [service, data] of Object.entries(jsonData)) {
      const normalizedService = serviceMap[service.toLowerCase()] || service.toLowerCase();
      if (!services.includes(normalizedService as Service)) {
        devLog(`Skipping unknown service: ${service}`);
        continue;
      }
      if (data && Array.isArray((data as any).keys)) {
        const existingKeys = await getApiKeys(normalizedService as Service);
        const newKeys = (data as any).keys.map((keyObj: any) => {
          if (normalizedService === 'aws_polly') {
            if (!keyObj.accessKey || !keyObj.secretKey) {
              devLog(`Invalid AWS Polly key object:`, keyObj);
              return null;
            }
            return {
              ...keyObj,
              accessKey: encryptKey(keyObj.accessKey),
              secretKey: encryptKey(keyObj.secretKey),
              active: keyObj.active !== undefined ? keyObj.active : true,
            };
          } else if (keyObj.key) {
            return {
              ...keyObj,
              key: encryptKey(keyObj.key),
              active: keyObj.active !== undefined ? keyObj.active : true,
              remaining_tokens: normalizedService === 'elevenlabs' ? keyObj.remaining_tokens || 10000 : undefined,
            };
          } else {
            devLog(`Invalid key object for ${normalizedService}:`, keyObj);
            return null;
          }
        }).filter((key: any) => key !== null);
        await saveApiKeys(normalizedService as Service, [...existingKeys, ...newKeys]);
        devLog(`Added keys for ${normalizedService}:`, newKeys);
      } else {
        devLog(`Invalid structure for ${normalizedService} in uploaded JSON`);
      }
    }
    return true;
  } catch (error) {
    devLog('Error processing uploaded JSON:', error);
    return false;
  }
};

// Initialize API keys from localStorage (optional, for backward compatibility)
export const initializeApiKeysFromJson = async (): Promise<boolean> => {
  try {
    const storedApiKeys = await loadFromStorage('tts_api_keys', false, 'localStorage');
    if (!storedApiKeys) {
      devLog('No tts_api_keys found in localStorage');
      return false;
    }

    let jsonData;
    try {
      jsonData = JSON.parse(storedApiKeys);
    } catch (error) {
      devLog('Error parsing tts_api_keys:', error);
      return false;
    }

    const services: Service[] = [
      'elevenlabs',
      'aws_polly',
      'googlecloud',
      'azuretts',
      'ibmwatson',
      'openai',
      'anthropic',
    ];
    for (const service of services) {
      if (jsonData[service] && Array.isArray(jsonData[service].keys)) {
        await saveApiKeys(service, jsonData[service].keys);
        devLog(`Migrated ${service} keys to tts_api_key_${service}:`, jsonData[service].keys);
      }
    }
    localStorage.removeItem('tts_api_keys');
    return true;
  } catch (error) {
    devLog('Error initializing API keys:', error);
    return false;
  }
};

// Add a new API key
export const addApiKey = async (service: Service, keyObj: ApiKey): Promise<void> => {
  const keys = await getApiKeys(service);
  const newKey = {
    ...keyObj,
    key: service !== 'aws_polly' ? encryptKey(keyObj.key || '') : undefined,
    accessKey: service === 'aws_polly' ? encryptKey(keyObj.accessKey || '') : undefined,
    secretKey: service === 'aws_polly' ? encryptKey(keyObj.secretKey || '') : undefined,
    active: keyObj.active !== undefined ? keyObj.active : true,
    remaining_tokens: keyObj.remaining_tokens || (service === 'elevenlabs' ? 10000 : undefined),
  };
  await saveApiKeys(service, [...keys, newKey]);
};

// Remove an API key
export const removeApiKey = async (service: Service, index: number): Promise<void> => {
  const keys = await getApiKeys(service);
  await saveApiKeys(service, keys.filter((_, i) => i !== index));
};

// Toggle active status of an API key
export const toggleActiveStatus = async (service: Service, index: number): Promise<void> => {
  const keys = await getApiKeys(service);
  await saveApiKeys(service, keys.map((key, i) =>
    i === index ? { ...key, active: !key.active } : key
  ));
};

// Update API key name
export const updateApiKeyName = async (service: Service, index: number, newName: string): Promise<void> => {
  const keys = await getApiKeys(service);
  await saveApiKeys(service, keys.map((key, i) =>
    i === index ? { ...key, name: newName } : key
  ));
};

// Move API key up
export const moveApiKeyUp = async (service: Service, index: number): Promise<void> => {
  if (index <= 0) return;
  const keys = await getApiKeys(service);
  const newKeys = [...keys];
  [newKeys[index - 1], newKeys[index]] = [newKeys[index], newKeys[index - 1]];
  await saveApiKeys(service, newKeys);
};

// Move API key down
export const moveApiKeyDown = async (service: Service, index: number): Promise<void> => {
  const keys = await getApiKeys(service);
  if (index >= keys.length - 1) return;
  const newKeys = [...keys];
  [newKeys[index], newKeys[index + 1]] = [newKeys[index + 1], newKeys[index]];
  await saveApiKeys(service, newKeys);
};

// Refresh ElevenLabs API key tokens
export const refreshApiKeyTokens = async (service: Service, index: number): Promise<void> => {
  if (service !== 'elevenlabs') {
    devLog(`Token refresh not supported for service: ${service}`);
    throw new Error(`Token refresh not supported for ${service}`);
  }
  
  try {
    const keys = await getApiKeys(service);
    
    // Validate index
    if (index < 0 || index >= keys.length) {
      devLog(`Invalid index ${index} for service ${service}, valid range is 0-${keys.length - 1}`);
      throw new Error(`Invalid key index: ${index}`);
    }
    
    const keyObj = keys[index];
    if (!keyObj) {
      devLog(`No key found at index ${index} in ${service}`);
      throw new Error(`No key found at index ${index}`);
    }
    
    if (!keyObj.key) {
      devLog(`Key at index ${index} in ${service} has no key value`);
      throw new Error('Key has no value');
    }
    
    const keyName = keyObj.name || `Key ${index}`;
    devLog(`Refreshing tokens for ${keyName} (index ${index})`);
    
    // Attempt to decrypt the key
    const plainKey = decryptKey(keyObj.key);
    if (!plainKey) {
      devLog(`Failed to decrypt key ${keyName}: Empty result`);
      throw new Error('Failed to decrypt API key: Empty result');
    }
    
    // Validate the key format (should be a string with reasonable length)
    if (typeof plainKey !== 'string' || plainKey.length < 8) {
      devLog(`Suspicious key format for ${keyName}: length ${plainKey.length}`);
      // Don't throw here, still try the API call
    }
    
    devLog(`Making API request to fetch subscription data for ${keyName}`);
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': plainKey },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const status = response.status;
      devLog(`API request failed for ${keyName}: Status ${status}`);
      
      let errorMessage = '';
      try {
        // Try to extract error details from response
        const errorData = await response.json();
        errorMessage = errorData.detail || JSON.stringify(errorData);
        devLog(`Error response for ${keyName}:`, errorData);
      } catch (jsonError) {
        // If JSON parsing fails, try text
        try {
          errorMessage = await response.text();
        } catch (textError) {
          errorMessage = response.statusText;
        }
      }
      
      if (status === 401) {
        throw new Error(`Invalid API key: Authentication failed (401)`);
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded: Too many requests (429)`);
      } else {
        throw new Error(`Failed to fetch tokens: ${status} - ${errorMessage}`);
      }
    }
    
    // Parse the response
    let data;
    try {
      data = await response.json();
      devLog(`API response for ${keyName}:`, data);
    } catch (jsonError) {
      devLog(`Error parsing JSON response for ${keyName}:`, jsonError);
      throw new Error('Invalid response: Failed to parse JSON');
    }
    
    // Validate the response data
    const characterLimit = data.character_limit;
    const characterCount = data.character_count;
    
    if (typeof characterLimit !== 'number') {
      devLog(`Invalid character_limit in response for ${keyName}:`, data);
      throw new Error('Invalid API response: missing or invalid character_limit');
    }
    
    if (typeof characterCount !== 'number') {
      devLog(`Invalid character_count in response for ${keyName}:`, data);
      throw new Error('Invalid API response: missing or invalid character_count');
    }
    
    // Calculate remaining tokens
    const remainingTokens = characterLimit - characterCount;
    devLog(`Calculated remaining tokens for ${keyName}: ${remainingTokens}`);
    
    // Update the key with new token count
    const updatedKeys = keys.map((key, i) =>
      i === index
        ? {
            ...key,
            remaining_tokens: remainingTokens,
            active: remainingTokens > 0 ? key.active : false,
          }
        : key
    );
    
    // Save updated keys to storage
    await saveApiKeys(service, updatedKeys);
    devLog(`Successfully refreshed tokens for ${keyName}: ${remainingTokens} tokens remaining`);
    return;
  } catch (error) {
    // Log and rethrow with useful message
    const errorMessage = error.message || 'Unknown error';
    devLog(`Token refresh error: ${errorMessage}`);
    throw new Error(`Failed to refresh tokens: ${errorMessage}`);
  }
};

// Find key by name or by key value and refresh tokens
export const refreshApiKeyTokensByNameOrValue = async (service: Service, keyName: string, keyValue?: string): Promise<number> => {
  if (service !== 'elevenlabs') {
    devLog(`Token refresh not supported for service: ${service}`);
    throw new Error(`Token refresh not supported for ${service}`);
  }
  
  try {
    const keys = await getApiKeys(service);
    
    // Try to find the key by name or value
    let keyIndex = -1;
    
    // First try to find by name
    if (keyName) {
      keyIndex = keys.findIndex(k => k.name === keyName);
    }
    
    // If not found by name and key value is provided, try to find by key value
    if (keyIndex === -1 && keyValue) {
      // Decrypt all keys for comparison
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].key) {
          const decryptedKey = decryptKey(keys[i].key);
          if (decryptedKey === keyValue) {
            keyIndex = i;
            break;
          }
        }
      }
    }
    
    if (keyIndex === -1) {
      devLog(`Key not found: ${keyName}`);
      throw new Error(`Key not found: ${keyName}`);
    }
    
    // Now refresh the key we found
    await refreshApiKeyTokens(service, keyIndex);
    
    // Return the updated token count
    const updatedKeys = await getApiKeys(service);
    return updatedKeys[keyIndex]?.remaining_tokens || 0;
  } catch (error) {
    devLog(`Token refresh error for ${keyName}:`, error);
    throw error;
  }
};

// Update remaining tokens after successful text-to-speech generation
export const updateRemainingTokensAfterGeneration = async (service: Service, keyName: string, charsUsed: number): Promise<void> => {
  if (service !== 'elevenlabs') {
    devLog(`Token updating not supported for service: ${service}`);
    return;
  }
  
  try {
    const keys = await getApiKeys(service);
    
    // Find key by name
    const keyIndex = keys.findIndex(k => k.name === keyName);
    if (keyIndex === -1) {
      devLog(`Key not found for updating tokens: ${keyName}`);
      return;
    }
    
    const keyObj = keys[keyIndex];
    const currentTokens = keyObj.remaining_tokens ?? 0;
    
    // Update tokens
    const updatedKeys = [...keys];
    updatedKeys[keyIndex] = {
      ...keyObj,
      remaining_tokens: Math.max(0, currentTokens - charsUsed)
    };
    
    await saveApiKeys(service, updatedKeys);
    devLog(`Updated remaining tokens for ${keyName}:`, {
      previousTokens: currentTokens,
      charsUsed,
      newTokens: updatedKeys[keyIndex].remaining_tokens
    });
  } catch (error) {
    devLog(`Error updating tokens after generation for ${keyName}:`, error);
  }
};