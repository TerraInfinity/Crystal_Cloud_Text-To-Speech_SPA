import React, { useState, useRef, useEffect } from 'react';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { useNotification } from '../context/notificationContext';
import { mergeAudioFiles, isValidAudioUrl, mergeAudioClientSide } from '../utils/audioUtils';
import { devLog, devWarn, devError } from '../utils/logUtils';

/**
 * MergedAudioPlayer component for merging and playing all section audio as a single file
 * 
 * @component
 * @returns {React.ReactElement} The rendered MergedAudioPlayer component
 */
const MergedAudioPlayer: React.FC = () => {
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { addNotification } = useNotification();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Get server URL from settings - fallback to default
  const serverUrl = 'http://localhost:5000'; 

  // Check if we have valid merged audio
  const hasValidMergedAudio = sessionState.mergedAudio && isValidAudioUrl(sessionState.mergedAudio);

  /**
   * Handle merging of all section audio files
   */
  const handleMergeAudio = async () => {
    setIsMerging(true);
    
    // Get audio URLs from all sections, prioritizing section.audioUrl
    const audioUrls = sessionState.sections
      .map(section => {
        // Get the audio URL from section or fallback to generatedTTSAudios
        const url = section.audioUrl || (sessionState.generatedTTSAudios[section.id]?.url || null);
        
        if (!url) {
          devWarn(`No audio URL found for section ${section.id}`);
          return null;
        }
        
        // Validate the URL
        if (!isValidAudioUrl(url)) {
          devWarn(`Invalid audio URL for section ${section.id}: ${url}`);
          return null;
        }
        
        // Log the type of URL for debugging
        if (url.startsWith('data:')) {
          devLog(`Section ${section.id} has data URL (${url.substring(0, 30)}...)`);
        } else if (url.startsWith('blob:')) {
          devLog(`Section ${section.id} has blob URL: ${url}`);
        } else if (url.startsWith('http')) {
          devLog(`Section ${section.id} has HTTP URL: ${url}`);
        }
        
        return url;
      })
      .filter(url => url !== null);
    
    // Log summary of all URLs for debugging
    const blobUrls = audioUrls.filter(url => url?.startsWith('blob:'));
    const dataUrls = audioUrls.filter(url => url?.startsWith('data:'));
    const httpUrls = audioUrls.filter(url => url?.startsWith('http'));
    
    devLog('Initiating audio merge:', { 
      audioUrls, 
      sectionCount: sessionState.sections.length,
      validUrlCount: audioUrls.length,
      blobUrlCount: blobUrls.length,
      dataUrlCount: dataUrls.length,
      httpUrlCount: httpUrls.length
    });

    if (audioUrls.length === 0) {
      addNotification({ type: 'error', message: 'No valid audio files to merge.' });
      setIsMerging(false);
      return;
    }

    try {
      devLog(`Starting server-side merging with ${audioUrls.length} URLs`);
      
      // Try server-side merging first
      let mergedUrl = await mergeAudioFiles(audioUrls, serverUrl);
      
      // If server-side merging fails, try client-side merging as fallback
      if (!mergedUrl) {
        devLog('Server-side merging failed, attempting client-side merging');
        mergedUrl = await mergeAudioClientSide(audioUrls);
      }
      
      if (mergedUrl) {
        // Store the merged URL in session state
        devLog('Audio merge successful, storing URL:', mergedUrl);
        sessionActions.setMergedAudio(mergedUrl);
        addNotification({ type: 'success', message: 'Audio files merged successfully.' });
        
        // Verify the URL was properly stored
        setTimeout(() => {
          const storedMergedAudio = sessionState.mergedAudio;
          devLog('Confirmed merged audio URL in session state:', storedMergedAudio);
        }, 100);
      } else {
        devError('Both server-side and client-side merging failed');
        addNotification({ type: 'error', message: 'Failed to merge audio files.' });
      }
    } catch (error) {
      devError('Error during audio merge:', error);
      addNotification({ type: 'error', message: `Failed to merge audio: ${error.message}` });
    } finally {
      setIsMerging(false);
    }
  };

  /**
   * Set up audio element for merged audio playback
   */
  useEffect(() => {
    if (hasValidMergedAudio) {
      // Create new audio element for playback
      audioRef.current = new Audio(sessionState.mergedAudio);
      
      // Set up event listeners
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        devLog('Merged audio playback ended');
      });
      
      audioRef.current.addEventListener('error', (e) => {
        devError(`Merged audio load error: ${sessionState.mergedAudio}`, e);
        setIsPlaying(false);
        addNotification({ type: 'error', message: 'Failed to load merged audio.' });
      });
      
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          try {
            audioRef.current.removeEventListener('ended', () => {});
            audioRef.current.removeEventListener('error', () => {});
          } catch (e) {
            devWarn('Could not remove event listeners from audio element', e);
          }
          audioRef.current = null;
        }
      };
    }
  }, [sessionState.mergedAudio, hasValidMergedAudio, addNotification]);

  /**
   * Toggle play/pause of the merged audio
   */
  const togglePlay = () => {
    if (!audioRef.current || !hasValidMergedAudio) {
      devWarn('No valid merged audio for playback');
      addNotification({ type: 'error', message: 'No merged audio available to play.' });
      return;
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      devLog('Paused merged audio playback');
    } else {
      devLog('Starting merged audio playback:', { audioUrl: sessionState.mergedAudio });
      audioRef.current.play().catch(error => {
        devError('Merged audio playback error:', error);
        setIsPlaying(false);
        addNotification({ type: 'error', message: 'Failed to play merged audio.' });
      });
      setIsPlaying(true);
    }
  };

  /**
   * Verify mergedAudio in session storage
   */
  useEffect(() => {
    const storedState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
    devLog('Stored merged audio in session storage:', {
      url: storedState.mergedAudio,
      isValid: storedState.mergedAudio ? isValidAudioUrl(storedState.mergedAudio) : false
    });
  }, [sessionState.mergedAudio]);

  return (
    <div className="merged-audio-player p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] mt-4">
      <h3 className="text-lg font-medium mb-4">Merged Audio</h3>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleMergeAudio}
          disabled={isMerging || sessionState.sections.length === 0}
          className={`bg-[var(--accent-color)] text-white py-2 px-4 rounded-md ${
            isMerging || sessionState.sections.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'
          }`}
        >
          {isMerging ? 'Merging...' : 'Merge All Audio'}
        </button>
        
        {hasValidMergedAudio && (
          <>
            <button
              onClick={togglePlay}
              className="bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 flex items-center"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
              <span>{isPlaying ? 'Stop' : 'Play'} Merged Audio</span>
            </button>
            
            <a
              href={sessionState.mergedAudio}
              download="merged-audio.mp3"
              className="bg-[var(--secondary-bg)] text-[var(--text-color)] py-2 px-4 rounded-md hover:bg-opacity-90 flex items-center"
              title="Download merged audio"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Download
            </a>
          </>
        )}
      </div>
      
      {!hasValidMergedAudio && sessionState.mergedAudio && (
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Invalid merged audio URL. Please re-merge the audio.
        </p>
      )}
      
      {sessionState.sections.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Create sections with audio to enable merging.
        </p>
      )}
    </div>
  );
};

export default MergedAudioPlayer; 