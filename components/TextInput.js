import React, { useState, useRef } from 'react';
import { useTTS } from '../context/TTSContext';
import { parseTextFromHtml } from '../utils/textUtils';
import Link from 'next/link';

const TextInput = () => {
  const { 
    inputText, 
    inputType, 
    sections, 
    currentTemplate, 
    savedAudios, 
    actions, 
    isProcessing 
  } = useTTS();
  
  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState('');
  
  // Handle input type change
  const handleInputTypeChange = (type) => {
    actions.setInputType(type);
  };
  
  // Handle text input change
  const handleTextChange = (e) => {
    actions.setInputText(e.target.value);
  };
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Only process text files
    if (file.type !== 'text/plain') {
      actions.setError('Please upload a .txt file');
      return;
    }
    
    try {
      actions.setProcessing(true);
      const text = await file.text();
      actions.setInputText(text);
      actions.setNotification({ 
        type: 'success', 
        message: `File "${file.name}" loaded successfully` 
      });
    } catch (error) {
      actions.setError(`Error reading file: ${error.message}`);
    } finally {
      actions.setProcessing(false);
      // Reset file input so the same file can be selected again
      fileInputRef.current.value = '';
    }
  };
  
  // Handle URL import
  const handleUrlImport = async () => {
    if (!urlInput) {
      actions.setError('Please enter a URL');
      return;
    }
    
    try {
      actions.setProcessing(true);
      
      // Fetch URL content using the API route
      const response = await fetch('/api/processUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch URL content');
      }
      
      const data = await response.json();
      actions.setInputText(data.text);
      actions.setNotification({ 
        type: 'success', 
        message: 'URL content imported successfully' 
      });
      
      // Clear URL input
      setUrlInput('');
    } catch (error) {
      actions.setError(`Error importing URL: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };
  
  // Create new section from text
  const createNewSection = () => {
    if (!inputText.trim()) {
      actions.setError('Please enter some text first');
      return;
    }
    
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-audio',
      text: inputText,
      voice: null, // Will use default voice
    };
    
    actions.addSection(newSection);
    actions.setNotification({
      type: 'success',
      message: 'New section created'
    });
    
    // Clear input text
    actions.setInputText('');
  };
  
  // Create new section from selected audio
  const createAudioSection = () => {
    if (!selectedAudioId) {
      actions.setError('Please select an audio file first');
      return;
    }
    
    const audio = savedAudios[selectedAudioId];
    if (!audio) {
      actions.setError('Selected audio not found');
      return;
    }
    
    actions.addAudioToSection(audio);
    actions.setNotification({
      type: 'success',
      message: `New section created from audio "${audio.name}"`
    });
    
    // Reset selected audio
    setSelectedAudioId('');
  };

  return (
    <div className="mb-6">
      {/* Input type switcher */}
      <div className="mb-4 flex bg-gray-50 rounded-lg p-1">
        <button
          onClick={() => handleInputTypeChange('text')}
          className={`flex-1 py-2 px-4 rounded-md ${
            inputType === 'text' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Text Input
        </button>
        <button
          onClick={() => handleInputTypeChange('audio')}
          className={`flex-1 py-2 px-4 rounded-md ${
            inputType === 'audio' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Audio Input
        </button>
      </div>
      
      {inputType === 'text' ? (
        /* Text input mode */
        <>
          <div className="mb-4">
            <textarea
              className="input-field h-64 font-mono text-sm"
              value={inputText}
              onChange={handleTextChange}
              placeholder="Enter your text here or import from a file or URL..."
              disabled={isProcessing}
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Import from file</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt"
                className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100"
                disabled={isProcessing}
              />
            </div>
            
            {/* URL import */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Import from URL</label>
              <div className="flex">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/page"
                  className="input-field rounded-r-none"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleUrlImport}
                  className="btn btn-primary rounded-l-none"
                  disabled={isProcessing || !urlInput}
                >
                  Import
                </button>
              </div>
            </div>
          </div>

          <div>
            {/* Create new section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Create new section</label>
              <button
                onClick={createNewSection}
                className="btn btn-primary w-full"
                disabled={isProcessing || !inputText.trim()}
              >
                Create New Section
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Audio input mode */
        <div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium mb-3">Select Audio</h3>
            
            {Object.keys(savedAudios).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No audio files available in your library.</p>
                <Link href="/audio" legacyBehavior>
                  <a className="btn btn-primary">
                    Go to Audio Library
                  </a>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select an audio file from your library
                  </label>
                  <select
                    value={selectedAudioId}
                    onChange={(e) => setSelectedAudioId(e.target.value)}
                    className="select-field"
                    disabled={isProcessing}
                  >
                    <option value="">-- Select Audio --</option>
                    {Object.values(savedAudios).map((audio) => (
                      <option key={audio.id} value={audio.id}>
                        {audio.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedAudioId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preview
                    </label>
                    <audio 
                      controls 
                      className="w-full" 
                      src={savedAudios[selectedAudioId]?.url}
                    ></audio>
                  </div>
                )}
                
                <div className="mt-4 flex justify-between">
                  <Link href="/audio" legacyBehavior>
                    <a className="btn btn-secondary">
                      Manage Audio Library
                    </a>
                  </Link>
                  
                  <button
                    onClick={createAudioSection}
                    className="btn btn-primary"
                    disabled={isProcessing || !selectedAudioId}
                  >
                    Create Section from Audio
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextInput;
