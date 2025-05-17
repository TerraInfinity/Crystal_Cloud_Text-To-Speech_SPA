import React from 'react';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import TextInput from './TextInput';
import AudioInput from './AudioInput';

const InputSection = () => {
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const inputType = sessionState?.inputType || 'text';

  return (
    <div className="mb-6">
      <div className="mb-4 flex rounded-lg p-1" style={{ backgroundColor: 'var(--card-bg)' }}>
        <button
          onClick={() => sessionActions.setInputType('text')}
          className={`flex-1 py-2 px-4 rounded-md shadow-sm transition-colors duration-150 ${
            inputType === 'text' ? '' : 'hover:[color:var(--text-hover)]'
          }`}
          style={{
            backgroundColor: inputType === 'text' ? 'var(--active-bg)' : 'transparent',
            color: inputType === 'text' ? 'var(--active-text-color)' : 'var(--text-color)',
          }}
        >
          Text Input
        </button>
        <button
          onClick={() => sessionActions.setInputType('audio')}
          className={`flex-1 py-2 px-4 rounded-md shadow-sm transition-colors duration-150 ${
            inputType === 'audio' ? '' : 'hover:[color:var(--text-hover)]'
          }`}
          style={{
            backgroundColor: inputType === 'audio' ? 'var(--active-bg)' : 'transparent',
            color: inputType === 'audio' ? 'var(--active-text-color)' : 'var(--text-color)',
          }}
        >
          Audio Input
        </button>
      </div>
      {inputType === 'text' ? <TextInput /> : <AudioInput />}
    </div>
  );
};

export default InputSection;