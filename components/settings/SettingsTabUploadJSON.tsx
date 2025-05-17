/**
 * @fileoverview JSON upload component for the TTS application settings tab.
 * Handles the upload of API keys JSON files for TTS services,
 * and provides a template download for API keys.
 */

import React, { useState } from 'react';
import { processUploadedApiKeysJson } from '../../utils/apiKeyManagement';
import { devLog } from '../../utils/logUtils';

interface Props {
  addNotification: (notification: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  onUploadSuccess?: () => void;
}

const SettingsTabUploadJSON: React.FC<Props> = ({ addNotification, onUploadSuccess }) => {
  const [apiKeyUploadStatus, setApiKeyUploadStatus] = useState<string | null>(null);

  const handleApiKeyJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setApiKeyUploadStatus('No file selected');
      addNotification({ type: 'error', message: 'No file selected' });
      return;
    }
    if (file.type !== 'application/json') {
      setApiKeyUploadStatus('Invalid file type');
      addNotification({ type: 'error', message: 'Please upload a valid JSON file' });
      return;
    }
    try {
      const success = await processUploadedApiKeysJson(file);
      setApiKeyUploadStatus(success ? 'Upload successful' : 'Failed to process JSON');
      addNotification({
        type: success ? 'success' : 'error',
        message: success ? 'API keys uploaded for all services' : 'Failed to process API keys JSON',
      });
      if (success && onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setApiKeyUploadStatus('Upload error');
      addNotification({ type: 'error', message: 'Error uploading API keys' });
      devLog('API key upload error:', error);
    }
  };

  return (
    <div className="mb-4 section-card">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="upload-api-keys" className="block text-sm font-medium">
            Upload API Keys JSON (All Services)
          </label>
          <a
            href="/assets/speechengine_api_keys_template.json"
            download="speechengine_api_keys_template.json"
            className="text-blue-600 hover:text-blue-800"
            title="Download API Keys JSON Template"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
              />
            </svg>
          </a>
        </div>
        <input
          type="file"
          id="upload-api-keys"
          accept=".json"
          onChange={handleApiKeyJsonUpload}
          className="w-full theme-file-input input-field"
        />
        {apiKeyUploadStatus && <p className="text-sm text-secondary mt-1">{apiKeyUploadStatus}</p>}
      </div>
    </div>
  );
};

export default SettingsTabUploadJSON;