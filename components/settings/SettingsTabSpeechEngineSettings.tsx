/**
 * @fileoverview Speech engine settings component for the TTS application settings tab
 *
 * Manages the selection of the speech engine and displays active voices.
 */

import React from 'react';
import { devLog } from '../../utils/logUtils';
import { Voice } from '../../utils/voiceUtils';
import { useTTSContext } from '../../context/TTSContext';
import { createTtsActions } from '../../context/ttsActions';

interface Props {
  speechEngine: string;
  mode: string;
  allActiveVoices: Voice[];
  defaultVoice: Voice | null;
  handleSpeechEngineChange: (engine: string) => void;
  setDefaultVoice: (voice: Voice) => void;
  handleRemoveActiveVoice: (engine: string, voiceId: string) => void;
  addNotification: (notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
}

const SettingsTabSpeechEngineSettings: React.FC<Props> = ({
  speechEngine,
  mode,
  allActiveVoices,
  defaultVoice,
  handleSpeechEngineChange,
  setDefaultVoice,
  handleRemoveActiveVoice,
  addNotification,
}) => {
  const { dispatch } = useTTSContext();
  const actions = createTtsActions(dispatch, addNotification);

  return (
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
            {allActiveVoices.map((voice) => {
              const isDefault = defaultVoice?.id === voice.id && defaultVoice?.engine === voice.engine;
              return (
                <li
                  key={`${voice.engine}-${voice.id}`}
                  className="flex justify-between items-center"
                >
                  <span>
                    {voice.name} ({voice.language}) - {voice.engine}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setDefaultVoice(voice);
                        devLog('Set default voice:', voice);
                      }}
                      className={`p-1 ${
                        isDefault ? 'text-yellow-500' : 'text-gray-400'
                      } hover:text-yellow-600`}
                      title="Set as default voice"
                      disabled={isDefault}
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
                      onClick={() => {
                        handleRemoveActiveVoice(voice.engine, voice.id);
                        devLog('Removed active voice:', { engine: voice.engine, voiceId: voice.id });
                      }}
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
          onChange={(e) => {
            const engine = e.target.value;
            if (mode === 'demo' && engine !== 'gtts') {
              addNotification({
                type: 'error',
                message: 'Cannot select this engine in demo mode. Switch to production mode first.',
              });
              return;
            }
            handleSpeechEngineChange(engine);
          }}
          className="select-field w-full p-2 border rounded"
        >
          <option value="gtts">gTTS</option>
          <option value="elevenlabs" disabled={mode === 'demo'}>ElevenLabs</option>
          <option value="aws_polly" disabled={mode === 'demo'}>AWS Polly</option>
          <option value="googleCloud" disabled={mode === 'demo'}>Google Cloud TTS</option>
          <option value="azureTTS" disabled={mode === 'demo'}>Azure TTS</option>
          <option value="ibmWatson" disabled={mode === 'demo'}>IBM Watson TTS</option>
        </select>
        {mode === 'demo' && (
          <p className="text-sm text-gray-500 mt-1">
            Only gTTS is available in demo mode. Switch to production mode to use other engines.
          </p>
        )}
      </div>
    </div>
  );
};

export default SettingsTabSpeechEngineSettings;