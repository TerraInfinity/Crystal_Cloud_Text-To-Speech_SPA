import React, { useState } from 'react';
import { useTTS } from '../context/TTSContext';

const SectionCard = ({ 
  section, 
  index,
  moveUp,
  moveDown
}) => {
  const { 
    availableVoices, 
    speechEngine, 
    generatedAudios,
    savedAudios,
    actions 
  } = useTTS();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [editedText, setEditedText] = useState(section.text || '');
  const [editedVoice, setEditedVoice] = useState(section.voice || null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    volume: section.voiceSettings?.volume || 1,
    rate: section.voiceSettings?.rate || 1,
    pitch: section.voiceSettings?.pitch || 1
  });
  
  // Toggle between text-to-audio and audio-only
  const toggleSectionType = () => {
    const newType = section.type === 'text-to-audio' ? 'audio-only' : 'text-to-audio';
    
    actions.updateSection({
      ...section,
      type: newType,
    });
  };
  
  // Save edited section
  const saveSection = () => {
    actions.updateSection({
      ...section,
      title: editedTitle,
      text: editedText,
      voice: editedVoice,
      voiceSettings: voiceSettings,
    });
    
    setIsEditing(false);
    actions.setNotification({
      type: 'success',
      message: 'Section updated successfully'
    });
  };
  
  // Delete section
  const deleteSection = () => {
    if (window.confirm(`Are you sure you want to delete "${section.title}"?`)) {
      actions.removeSection(section.id);
      actions.setNotification({
        type: 'success',
        message: 'Section deleted successfully'
      });
    }
  };
  
  // Handle audio file upload for audio-only sections
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is an audio file
    if (!file.type.startsWith('audio/')) {
      actions.setError('Please upload an audio file');
      return;
    }
    
    try {
      // Create object URL for the audio file
      const audioUrl = URL.createObjectURL(file);
      
      // Set the generated audio for this section
      actions.setGeneratedAudio(section.id, audioUrl);
      
      actions.setNotification({
        type: 'success',
        message: `Audio file "${file.name}" uploaded successfully`
      });
    } catch (error) {
      actions.setError(`Error uploading audio: ${error.message}`);
    }
  };
  
  // Generate speech for this section
  const generateSpeech = async () => {
    if (!section.text || section.text.trim() === '') {
      actions.setError('Section text is empty');
      return;
    }
    
    try {
      actions.setProcessing(true);
      
      // Make the API request to convert text to speech
      const response = await fetch('/api/textToSpeech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: section.text,
          engine: speechEngine,
          voice: section.voice || editedVoice,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert text to speech');
      }
      
      const { audioUrl } = await response.json();
      
      // Update the generated audio for this section
      actions.setGeneratedAudio(section.id, audioUrl);
      
      actions.setNotification({
        type: 'success',
        message: 'Speech generated successfully'
      });
    } catch (error) {
      actions.setError(`Error generating speech: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };
  
  // Determine if this section has audio
  const hasAudio = section.id in generatedAudios;
  
  // Determine if this section has a linked audio from the library
  const hasLinkedAudio = section.audioId && section.audioId in savedAudios;
  
  // Get audio information if linked from library
  const linkedAudio = hasLinkedAudio ? savedAudios[section.audioId] : null;
  
  // Play audio for this section
  const playAudio = () => {
    if (hasAudio) {
      const audio = new Audio(generatedAudios[section.id]);
      audio.play();
    } else if (hasLinkedAudio) {
      const audio = new Audio(linkedAudio.url);
      audio.play();
    }
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex flex-col mr-2">
            <button 
              onClick={moveUp}
              className="p-1 text-gray-500 hover:text-gray-700" 
              title="Move Up"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={moveDown}
              className="p-1 text-gray-500 hover:text-gray-700" 
              title="Move Down"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="input-field"
              />
            ) : (
              <h3 className="text-lg font-medium">
                {index + 1}. {section.title}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({section.type === 'text-to-audio' ? 'Text to Speech' : 'Audio Only'})
                </span>
              </h3>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <button
            onClick={toggleSectionType}
            className="p-1 text-indigo-500 hover:text-indigo-700"
            title="Toggle Section Type"
          >
            {section.type === 'text-to-audio' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 text-blue-500 hover:text-blue-700"
            title={isEditing ? 'Cancel Editing' : 'Edit Section'}
          >
            {isEditing ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={deleteSection}
            className="p-1 text-red-500 hover:text-red-700"
            title="Delete Section"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4">
          {section.type === 'text-to-audio' ? (
            /* Text-to-audio section */
            <div>
              {isEditing ? (
                /* Editing mode */
                <div>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="input-field h-32 mb-4 font-mono text-sm"
                    placeholder="Enter text for this section..."
                  ></textarea>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voice (optional)</label>
                    <select
                      value={editedVoice || ''}
                      onChange={(e) => setEditedVoice(e.target.value || null)}
                      className="select-field"
                    >
                      <option value="">Default Voice</option>
                      {availableVoices.map((voice, idx) => (
                        <option key={idx} value={voice.name || voice.id || idx}>
                          {voice.name || voice.id || `Voice ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={saveSection}
                    className="btn btn-primary mr-2"
                  >
                    Save Changes
                  </button>
                  
                  <button
                    onClick={() => setIsEditing(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                /* View mode */
                <div>
                  <p className="whitespace-pre-wrap mb-4 text-gray-700 text-sm">
                    {section.text || <span className="italic text-gray-400">No text content</span>}
                  </p>
                  
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <select
                        value={editedVoice || ''}
                        onChange={(e) => setEditedVoice(e.target.value || null)}
                        className="select-field flex-1 mr-2"
                      >
                        <option value="">Default Voice</option>
                        {availableVoices.map((voice, idx) => (
                          <option key={idx} value={voice.name || voice.id || idx}>
                            {voice.name || voice.id || `Voice ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Voice Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    
                    {showVoiceSettings && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Volume
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={voiceSettings.volume}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              volume: parseFloat(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                        
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rate
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="2"
                            step="0.1"
                            value={voiceSettings.rate}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              rate: parseFloat(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pitch
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={voiceSettings.pitch}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              pitch: parseFloat(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Audio-only section */
            <div>
              <p className="mb-4 text-gray-700">
                This is an audio-only section. You can upload an audio file or use a default one if available.
              </p>
              
              <div className="mb-4">
                <input
                  type="file"
                  onChange={handleAudioUpload}
                  accept="audio/*"
                  className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-indigo-50 file:text-indigo-700
                            hover:file:bg-indigo-100"
                />
              </div>
              
              {hasLinkedAudio ? (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Using audio from library: <span className="font-medium">{linkedAudio.name}</span>
                  </p>
                  <button
                    onClick={playAudio}
                    className="btn btn-secondary flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Play Audio
                  </button>
                </div>
              ) : hasAudio ? (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Using uploaded audio file
                  </p>
                  <button
                    onClick={playAudio}
                    className="btn btn-secondary flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Play
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-yellow-600 text-sm mb-2">
                    No audio file linked or uploaded yet.
                  </p>
                  <p className="text-sm text-gray-500">
                    You can upload a file above or go to the Audio Files tab to select from your library.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionCard;