import React, { useState, useRef, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';

const AudioFilesTab = () => {
  const { savedAudios, sections, actions, isProcessing } = useTTS();
  const fileInputRef = useRef(null);
  const [audioName, setAudioName] = useState('');
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef(null);
  const [selectedSection, setSelectedSection] = useState('');

  // Handle audio file upload
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is an audio file
    if (!file.type.startsWith('audio/')) {
      actions.setError('Please upload an audio file');
      return;
    }
    
    try {
      actions.setProcessing(true);
      
      // Create object URL for the audio file
      const audioUrl = URL.createObjectURL(file);
      
      // Use file name as default audio name if not provided
      const name = audioName.trim() || file.name.replace(/\.[^/.]+$/, "");
      
      // Generate a unique ID for the audio
      const audioId = `audio-${Date.now()}`;
      
      // Save audio to context
      actions.saveAudio({
        id: audioId,
        name: name,
        url: audioUrl,
        type: file.type,
        size: file.size,
        date: new Date().toISOString()
      });
      
      actions.setNotification({
        type: 'success',
        message: `Audio "${name}" uploaded successfully`
      });
      
      // Reset form
      setAudioName('');
      fileInputRef.current.value = '';
    } catch (error) {
      actions.setError(`Error uploading audio: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };
  
  // Play selected audio
  const playAudio = (audio) => {
    setSelectedAudio(audio);
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audio.url;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };
  
  // Delete audio from library
  const deleteAudio = (audioId) => {
    if (window.confirm('Are you sure you want to delete this audio?')) {
      actions.deleteAudio(audioId);
      
      // Stop playing if the deleted audio is currently selected
      if (selectedAudio && selectedAudio.id === audioId) {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          setIsPlaying(false);
          setSelectedAudio(null);
        }
      }
    }
  };
  
  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Add audio to a new section
  const addToSection = (audio) => {
    actions.addAudioToSection(audio);
    actions.setNotification({
      type: 'success',
      message: `Created new section with "${audio.name}"`
    });
  };
  
  // Link audio to an existing section
  const linkToExistingSection = (audio, sectionId) => {
    if (!sectionId) return;
    
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Update the section to use this audio
    actions.updateSection({
      ...section,
      type: 'audio-only',
      audioId: audio.id
    });
    
    // Set the generated audio URL for this section too
    actions.setGeneratedAudio(section.id, audio.url);
    
    actions.setNotification({
      type: 'success',
      message: `Linked "${audio.name}" to section "${section.title}"`
    });
    
    setSelectedSection(''); // Reset selection
  };
  
  // Handle audio player events
  useEffect(() => {
    const player = audioPlayerRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    if (player) {
      player.addEventListener('ended', handleEnded);
    }
    
    return () => {
      if (player) {
        player.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  // Persist audio library to localStorage
  useEffect(() => {
    if (Object.keys(savedAudios).length > 0) {
      try {
        localStorage.setItem('tts_audio_library', JSON.stringify(savedAudios));
      } catch (error) {
        console.error('Error saving audio library to localStorage:', error);
      }
    }
  }, [savedAudios]);
  
  return (
    <div>
      <h2 className="text-xl font-medium mb-4">Audio Files</h2>
      <p className="text-gray-600 mb-6">
        Upload and manage audio files that can be used in your sections.
        Uploaded files will be available for selection when creating audio sections.
      </p>
      
      {/* Upload form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium mb-3">Upload New Audio</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Audio Name (optional)</label>
          <input
            type="text"
            value={audioName}
            onChange={(e) => setAudioName(e.target.value)}
            className="input-field"
            placeholder="Enter a name for this audio (or leave blank to use filename)"
            disabled={isProcessing}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Audio File</label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept="audio/*"
            className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100"
            disabled={isProcessing}
          />
        </div>
        
        <p className="text-xs text-gray-500 italic">
          Supported file types: MP3, WAV, OGG, and other browser-supported audio formats
        </p>
      </div>
      
      {/* Audio player */}
      {selectedAudio && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium mb-2">Now Playing: {selectedAudio.name}</h3>
          <audio
            ref={audioPlayerRef}
            controls
            className="w-full"
            src={selectedAudio.url}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      
      {/* Audio library list */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-3">Your Audio Library</h3>
        
        {Object.keys(savedAudios).length === 0 ? (
          <p className="text-gray-500 py-4 text-center">
            No audio files in your library yet. Upload some audio files to get started.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {Object.values(savedAudios).map((audio) => (
              <div 
                key={audio.id} 
                className="flex flex-col p-3 bg-gray-50 rounded-md hover:bg-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{audio.name}</h4>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(audio.size)} • 
                      {new Date(audio.date).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => playAudio(audio)}
                      className="p-2 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                      title="Play"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => addToSection(audio)}
                      className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100"
                      title="Create New Section with this Audio"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => deleteAudio(audio.id)}
                      className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {sections.length > 0 && (
                  <div className="mt-2 flex items-end">
                    <div className="flex-1 mr-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Link to existing section:
                      </label>
                      <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="block w-full text-sm rounded-md border border-gray-300 shadow-sm py-1.5 px-3"
                      >
                        <option value="">Select a section...</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      onClick={() => linkToExistingSection(audio, selectedSection)}
                      disabled={!selectedSection}
                      className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                        selectedSection 
                          ? 'bg-blue-500 text-white hover:bg-blue-600' 
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Link
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioFilesTab;