
import React, { useState, useRef, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';

const AudioLibrary = () => {
  const { savedAudios, actions, isProcessing } = useTTS();
  const fileInputRef = useRef(null);
  const [audioName, setAudioName] = useState('');
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const [volume, setVolume] = useState(1);
  const audioPlayerRef = useRef(null);

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('audio/')) {
      actions.setError('Please upload an audio file');
      return;
    }

    try {
      actions.setProcessing(true);
      const audioUrl = URL.createObjectURL(file);
      const name = audioName.trim() || file.name.replace(/\.[^/.]+$/, "");
      const audioId = `audio-${Date.now()}`;

      actions.saveAudio({
        id: audioId,
        name: name,
        url: audioUrl,
        type: file.type,
        size: file.size,
        date: new Date().toISOString(),
        placeholder: placeholderText || name.toLowerCase().replace(/\s+/g, '_'),
        volume: volume
      });

      setAudioName('');
      setPlaceholderText('');
      setVolume(1);
      fileInputRef.current.value = '';
    } catch (error) {
      actions.setError(`Error uploading audio: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };

  const playAudio = (audio) => {
    setSelectedAudio(audio);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audio.url;
      audioPlayerRef.current.volume = audio.volume || 1;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const updateAudioVolume = (audioId, newVolume) => {
    actions.updateAudio(audioId, {
      ...savedAudios[audioId],
      volume: newVolume
    });
  };

  const deleteAudio = (audioId) => {
    if (window.confirm('Are you sure you want to delete this audio?')) {
      actions.deleteAudio(audioId);
      if (selectedAudio?.id === audioId) {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          setIsPlaying(false);
          setSelectedAudio(null);
        }
      }
    }
  };

  useEffect(() => {
    const player = audioPlayerRef.current;
    const handleEnded = () => setIsPlaying(false);
    if (player) {
      player.addEventListener('ended', handleEnded);
    }
    return () => {
      if (player) {
        player.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  return (
    <div>
      <h2 className="text-xl font-medium mb-4">Audio Library</h2>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium mb-3">Upload New Audio</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Audio Name</label>
          <input
            type="text"
            value={audioName}
            onChange={(e) => setAudioName(e.target.value)}
            className="input-field"
            placeholder="Enter a name for this audio"
            disabled={isProcessing}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Text</label>
          <input
            type="text"
            value={placeholderText}
            onChange={(e) => setPlaceholderText(e.target.value)}
            className="input-field"
            placeholder="e.g., beep, chime (used like [sound:placeholder])"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 mt-1">
            This placeholder will be used in text like [sound:placeholder]
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Set the default playback volume for this audio file
          </p>
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
      </div>

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
          />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-3">Your Audio Files</h3>

        {Object.keys(savedAudios).length === 0 ? (
          <p className="text-gray-500">No audio files in your library yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.values(savedAudios).map((audio) => (
              <div 
                key={audio.id} 
                className="p-3 bg-gray-50 rounded-md hover:bg-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{audio.name}</h4>
                    <p className="text-xs text-gray-500">
                      Use as: [sound:{audio.placeholder}]
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

                <div className="mt-2">
                  <label className="block text-sm text-gray-600 mb-1">Volume</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={audio.volume || 1}
                    onChange={(e) => updateAudioVolume(audio.id, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioLibrary;
