import React, { useState, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import speechService from '../services/speechService';

const AudioPlayer = () => {
  const { 
    sections, 
    generatedAudios, 
    mergedAudio, 
    isProcessing,
    actions 
  } = useTTS();

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioElement, setAudioElement] = useState(null);

  // Check if all sections have audio
  const allSectionsHaveAudio = sections.length > 0 && 
    sections.every(section => section.id in generatedAudios);

  // Generate audio for all sections using Web Speech API
  const generateAllAudio = async () => {
    if (sections.length === 0) {
      actions.setError('No sections to generate audio from');
      return;
    }

    actions.setProcessing(true);
    const timestamp = Date.now();
    const historyEntry = {
      id: `history-${timestamp}`,
      date: new Date().toISOString(),
      sections: JSON.parse(JSON.stringify(sections)),
      template: currentTemplate
    };

    try {
      // Check if Web Speech API is available
      if (!window.speechSynthesis) {
        throw new Error('Web Speech API is not supported in this browser');
      }

      const voices = window.speechSynthesis.getVoices();

      // Generate audio for any sections that don't have it
      for (const section of sections) {
        if (!generatedAudios[section.id] && section.type === 'text-to-audio' && section.text) {
          try {
            const audioUrl = await speechService.webSpeechTTS(section.text, {
              voice: section.voice,
              rate: section.voiceSettings?.rate || 1,
              pitch: section.voiceSettings?.pitch || 1,
              volume: section.voiceSettings?.volume || 1
            });
            actions.setGeneratedAudio(section.id, audioUrl);
          } catch (error) {
            actions.setError(`Error generating audio for section "${section.title}": ${error.message}`);
            return;
          }
        }
      }


      // Proceed to merge the audio files
      await mergeAllAudio();

    } catch (error) {
      actions.setError(`Error generating speech: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };

  // Merge all audio files
  const mergeAllAudio = async () => {
    if (!allSectionsHaveAudio) {
      actions.setError('Not all sections have audio. Generate audio for all sections first.');
      return;
    }

    try {
      actions.setProcessing(true);

      // For client-side merging (Web Audio API)
      if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffers = [];

        // Load all audio files
        for (const section of sections) {
          const audioUrl = generatedAudios[section.id];

          // Fetch the audio data
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();

          // Decode the audio data
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);
        }

        // Calculate total duration
        const totalDuration = audioBuffers.reduce((acc, buffer) => acc + buffer.duration, 0);

        // Create a buffer for the merged audio
        const mergedBuffer = audioContext.createBuffer(
          1, // Mono
          audioContext.sampleRate * totalDuration,
          audioContext.sampleRate
        );

        // Merge the audio buffers
        let offset = 0;
        for (const buffer of audioBuffers) {
          const channelData = buffer.getChannelData(0);
          mergedBuffer.getChannelData(0).set(channelData, offset);
          offset += buffer.length;
        }

        // Convert merged buffer to WAV file
        const mergedWav = bufferToWav(mergedBuffer);

        // Create Blob URL for the merged audio
        const mergedAudioUrl = URL.createObjectURL(new Blob([mergedWav], { type: 'audio/wav' }));

        // Set the merged audio URL
        actions.setMergedAudio(mergedAudioUrl);

        actions.setNotification({
          type: 'success',
          message: 'Audio files merged successfully'
        });
      } else {
        // Fallback to server-side merging
        const response = await fetch('/api/mergeAudio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioUrls: sections.map(section => generatedAudios[section.id])
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to merge audio files');
        }

        const { mergedAudioUrl } = await response.json();
        actions.setMergedAudio(mergedAudioUrl);

        actions.setNotification({
          type: 'success',
          message: 'Audio files merged successfully'
        });
      }
    } catch (error) {
      actions.setError(`Error merging audio: ${error.message}`);
    } finally {
      actions.setProcessing(false);
    }
  };

  // Convert AudioBuffer to WAV format
  const bufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;

    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return wavBuffer;
  };

  // Helper function to write strings to DataView
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // Play merged audio
  const playAudio = () => {
    if (!mergedAudio) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(mergedAudio);

      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(progress);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setAudioProgress(0);
      });

      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  // Download merged audio
  const downloadAudio = () => {
    if (!mergedAudio) return;

    const a = document.createElement('a');
    a.href = mergedAudio;
    a.download = 'tts-audio.wav';
    a.click();
  };

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <button
          onClick={async () => {
            await generateAllAudio();
            
          }}
          className="btn btn-primary"
          disabled={isProcessing || sections.length === 0}
        >
          Generate Speech
        </button>
      </div>

      {mergedAudio && (
        <div>
          <div className="flex items-center mb-2">
            <button
              onClick={playAudio}
              className="btn btn-secondary mr-2"
              disabled={isProcessing}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2"
                style={{ width: `${audioProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={downloadAudio}
              className="btn btn-primary flex items-center"
              disabled={isProcessing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Audio
            </button>
          </div>
        </div>
      )}

      {!mergedAudio && (
        <p className="text-gray-600 text-center">
          {sections.length === 0 
            ? 'Create sections and add text to generate audio' 
            : allSectionsHaveAudio
              ? 'All sections have audio. Click "Generate Speech" to merge them.'
              : 'Generating audio...'}
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;