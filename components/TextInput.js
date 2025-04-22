import React, { useState, useRef } from 'react';
import { useTTS } from '../context/TTSContext';
import { parseTextFromHtml } from '../utils/textUtils';

const TextInput = () => {
  const { inputText, sections, currentTemplate, actions, isProcessing } = useTTS();
  const [selectedSection, setSelectedSection] = useState(null);
  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState('');
  
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
  
  // Add text to selected section
  const addToSection = () => {
    if (!selectedSection || !inputText.trim()) {
      actions.setError('Please select a section and enter some text');
      return;
    }
    
    const section = sections.find(s => s.id === selectedSection);
    if (section) {
      // Only add to text-to-audio sections
      if (section.type === 'text-to-audio') {
        const updatedSection = {
          ...section,
          text: section.text ? `${section.text}\n\n${inputText}` : inputText
        };
        
        actions.updateSection(updatedSection);
        actions.setNotification({
          type: 'success',
          message: `Text added to "${section.title}" section`
        });
        
        // Clear input text if needed
        actions.setInputText('');
      } else {
        actions.setError('Cannot add text to audio-only sections');
      }
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
  
  return (
    <div className="mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Add to section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add to existing section</label>
          <div className="flex">
            <select
              value={selectedSection || ''}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="select-field rounded-r-none"
              disabled={isProcessing || sections.length === 0}
            >
              <option value="">Select a section</option>
              {sections
                .filter(section => section.type === 'text-to-audio')
                .map(section => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
            </select>
            <button
              onClick={addToSection}
              className="btn btn-primary rounded-l-none"
              disabled={isProcessing || !selectedSection || !inputText.trim()}
            >
              Add
            </button>
          </div>
        </div>
        
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
    </div>
  );
};

export default TextInput;
