import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

const TextInput = () => {
  const { state } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { addNotification } = useNotification();

  const inputText = sessionState?.inputText || '';
  const selectedVoice = sessionState.selectedInputVoice;
  const sections = sessionState?.sections || [];

  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute voices for selection
  const allActiveVoices = useMemo(() => {
    return state?.settings?.activeVoices || [];
  }, [state?.settings?.activeVoices]);

  // Get the default voice
  const defaultVoice = useMemo(() => {
    return state?.settings?.defaultVoice || null;
  }, [state?.settings?.defaultVoice]);

  // Event handlers
  const handleTextChange = (e) => {
    sessionActions.setInputText(e.target.value);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'text/plain') {
      addNotification({
        type: 'error',
        message: 'Please upload a .txt file'
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const text = await file.text();
      sessionActions.setInputText(text);
      
      addNotification({
        type: 'success',
        message: `File "${file.name}" loaded successfully`
      });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Error reading file: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput) {
      addNotification({
        type: 'error',
        message: 'Please enter a URL'
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Add URL validation
      let url = urlInput;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      const response = await fetch('/api/extractTextFromUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch URL content');
      }
      
      const { text } = await response.json();
      sessionActions.setInputText(text);
      
      addNotification({
        type: 'success',
        message: 'URL content imported successfully'
      });
      
      setUrlInput('');
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Error importing URL: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const createNewSection = () => {
    if (!inputText.trim()) {
      addNotification({
        type: 'error',
        message: 'Please enter some text first'
      });
      return;
    }
    
    // Create new section with input text
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Text Section ${sections.length + 1}`,
      type: 'text-to-speech',
      text: inputText,
      voice: selectedVoice || defaultVoice
    };
    
    sessionActions.addSection(newSection);
    
    addNotification({
      type: 'success',
      message: 'New text-to-speech section created'
    });
    
    // Clear input text after creating section
    sessionActions.setInputText('');
  };

  const handleVoiceChange = (e) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === '') {
      // Use default voice (null)
      sessionActions.setSelectedInputVoice(null);
    } else {
      // Find selected voice
      const selectedVoiceObj = allActiveVoices.find(
        (v) => `${v.engine}-${v.id}` === selectedValue
      );
      
      if (selectedVoiceObj) {
        sessionActions.setSelectedInputVoice(selectedVoiceObj);
      }
    }
  };

  return (
    <div className="text-input-container bg-[var(--card-bg)] rounded-lg p-4 mb-4 border border-[var(--card-border)]">
      <h3 className="text-lg font-medium mb-3">Add Text-to-Speech Section</h3>
      
      {/* Text Input Area */}
      <div className="mb-4">
        <textarea
          id="text-input-area"
          className="w-full h-64 p-3 border border-[var(--border-color)] rounded-md bg-[var(--input-bg)] text-[var(--text-color)] font-mono text-sm resize-y"
          value={inputText}
          onChange={handleTextChange}
          placeholder="Enter your text here or import from a file or URL..."
          disabled={isProcessing}
        />
      </div>
      
      {/* Voice Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2" htmlFor="voice-select">
          Select Voice
        </label>
        <select
          id="voice-select"
          value={selectedVoice ? `${selectedVoice.engine}-${selectedVoice.id}` : ''}
          onChange={handleVoiceChange}
          className="w-full p-2 border border-[var(--border-color)] rounded-md bg-[var(--input-bg)] text-[var(--text-color)] select-field"
          disabled={isProcessing || allActiveVoices.length === 0}
        >
          <option value="">
            {defaultVoice ? 
              `Default Voice: ${defaultVoice.name} (${defaultVoice.engine})` : 
              'Default Voice'}
          </option>
          {allActiveVoices
            .filter(v => !defaultVoice || !(v.engine === defaultVoice.engine && v.id === defaultVoice.id))
            .map(voice => (
              <option key={`${voice.engine}-${voice.id}`} value={`${voice.engine}-${voice.id}`}>
                {voice.name} ({voice.engine})
              </option>
            ))}
        </select>
        {defaultVoice && (
          <p className="text-xs mt-1 text-[var(--text-secondary)]">
            Default voice will be used if none is selected.
          </p>
        )}
      </div>
      
      {/* Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* File Import */}
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="file-upload-input">
            Import from file
          </label>
          <div className="flex items-center">
            <label htmlFor="file-upload-input" className="cursor-pointer bg-[var(--secondary-bg)] text-[var(--text-color)] py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium inline-flex items-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Choose File
              <input
                id="file-upload-input"
                type="file"
                ref={fileInputRef}
                accept=".txt"
                className="hidden"
                disabled={isProcessing}
                onChange={handleFileUpload}
              />
            </label>
            <span className="text-xs text-[var(--text-secondary)]">.txt files only</span>
          </div>
        </div>
        
        {/* URL Import */}
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="url-input">
            Import from URL
          </label>
          <div className="flex">
            <input
              id="url-input"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-grow p-2 border border-[var(--border-color)] rounded-l-md bg-[var(--input-bg)] text-[var(--text-color)]"
              disabled={isProcessing}
            />
            <button
              id="url-import-button"
              onClick={handleUrlImport}
              className="bg-[var(--accent-color)] text-white py-2 px-4 rounded-r-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
              disabled={isProcessing || !urlInput}
            >
              Import
            </button>
          </div>
        </div>
      </div>
      
      {/* Create Section Button */}
      <div>
        <button
          id="create-section-button"
          onClick={createNewSection}
          className="w-full inline-flex items-center justify-center bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium disabled:opacity-50"
          disabled={isProcessing || !inputText.trim()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create Text-to-Speech Section
        </button>
      </div>
    </div>
  );
};

export default TextInput;