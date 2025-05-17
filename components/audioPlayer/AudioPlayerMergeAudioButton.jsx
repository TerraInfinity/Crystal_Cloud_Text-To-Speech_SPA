/**
 * @fileoverview Merge Audio button component for the AudioPlayer.
 * Handles the audio merging process for TTS sections, including state and logic.
 *
 * @requires React
 * @requires ../utils/AudioProcessor
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { mergeAllAudio } from '../../utils/AudioProcessor';
import { useNotification } from '../../context/notificationContext';

/**
 * Merge Audio button component for the AudioPlayer.
 * Manages audio merging, including state, progress, and API calls.
 *
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isProcessing - Whether any processing is occurring
 * @param {Array} props.validSections - Filtered sections valid for TTS
 * @param {Object} props.generatedAudios - Generated audio URLs by section ID
 * @param {Object} props.sessionActions - TTSSessionContext actions
 * @param {Object} props.speechServiceAPI - SpeechServiceAPI instance
 * @param {boolean} props.autoSave - Whether auto-save is enabled
 * @param {string} props.customTitle - Custom title for the merged audio
 * @param {Object} props.config - Configuration object for merging
 * @param {Function} props.addHistoryEntry - Function to add to file history
 * @param {Function} props.setIsTitleLocked - Function to lock the title field
 * @param {Function} props.setCurrentAudioTitle - Function to set the current audio title
 * @returns {JSX.Element} The rendered Merge Audio button component
 */
const AudioPlayerMergeAudioButton = ({
  isProcessing,
  validSections,
  generatedAudios,
  sessionActions,
  speechServiceAPI,
  autoSave,
  customTitle,
  config,
  addHistoryEntry,
  setIsTitleLocked,
  setCurrentAudioTitle,
}) => {
  const [isMerging, setIsMerging] = useState(false);
  const [isAudioMerged, setIsAudioMerged] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [isProcessingMerge, setIsProcessingMerge] = useState(false);
  const [mergingStatus, setMergingStatus] = useState(''); // Status message for UI feedback
  const { addNotification } = useNotification();

  /**
   * Resets the merge button state to initial values
   */
  const resetMergeState = () => {
    setIsMerging(false);
    setIsAudioMerged(false);
    setMergeProgress(0);
    setIsProcessingMerge(false);
    setMergingStatus('');
    console.log('Merge audio button state reset');
  };

  // Listen for clicks on the refresh-workflow-btn
  useEffect(() => {
    const handleWorkflowRefresh = () => {
      resetMergeState();
    };

    // Add event listener for the refresh button
    const refreshButton = document.getElementById('refresh-workflow-btn');
    if (refreshButton) {
      refreshButton.addEventListener('click', handleWorkflowRefresh);
    }

    // Clean up on unmount
    return () => {
      const refreshButton = document.getElementById('refresh-workflow-btn');
      if (refreshButton) {
        refreshButton.removeEventListener('click', handleWorkflowRefresh);
      }
    };
  }, []);

  // Check if all valid sections have associated audio
  const sectionsWithoutAudio = validSections.filter(
    section => {
      // Check in generatedAudios first (main storage for generated audio)
      const hasGeneratedAudio = generatedAudios[section.id] && generatedAudios[section.id].url;
      
      // Also check if the section has a direct audioUrl property (used by both types)
      const hasSectionAudioUrl = section.audioUrl;
      
      // Also check if it's a library audio with an audioId
      const hasLibraryAudio = section.audioId && section.audioSource === 'library';
      
      // If any of these sources has audio, the section is valid
      return !(hasGeneratedAudio || hasSectionAudioUrl || hasLibraryAudio);
    }
  );
  
  const allSectionsHaveAudio = validSections.length > 0 && sectionsWithoutAudio.length === 0;

  const handleMergeAudio = async () => {
    if (sectionsWithoutAudio.length > 0) {
      const missingSections = sectionsWithoutAudio.map(s => s.title || s.id).join(", ");
      addNotification({
        type: 'warning',
        message: `Some sections are missing audio: ${missingSections}`,
      });
      return;
    }

    // Count audio types for debugging and early error detection
    let blobUrlCount = 0;
    let dataUrlCount = 0;
    let httpUrlCount = 0;
    let otherUrlCount = 0;

    validSections.forEach(section => {
      let url = null;
      
      // First check for direct section.audioUrl
      if (section.audioUrl) {
        url = section.audioUrl;
      } 
      // Then check generatedAudios
      else if (generatedAudios[section.id] && generatedAudios[section.id].url) {
        url = generatedAudios[section.id].url;
      }

      if (url) {
        if (url.startsWith('blob:')) blobUrlCount++;
        else if (url.startsWith('data:')) dataUrlCount++;
        else if (url.startsWith('http')) httpUrlCount++; 
        else otherUrlCount++;
      }
    });

    // Log audio URL types for debugging
    console.log(`Audio URL types: ${blobUrlCount} blob, ${dataUrlCount} data, ${httpUrlCount} http, ${otherUrlCount} other`);
    
    setIsTitleLocked(true);
    setMergeProgress(0);
    setIsProcessingMerge(true);
    setMergingStatus('Preparing audio files...');
    setCurrentAudioTitle(customTitle);

    try {
      setMergingStatus('Uploading and merging audio files...');
      const result = await mergeAllAudio({
        validSections,
        generatedAudios,
        sessionActions,
        setIsMerging,
        setIsAudioMerged,
        autoSave,
        customTitle,
        config,
        setMergeProgress,
        addHistoryEntry,
        speechServiceAPI,
      });

      // Improved handling of result with detailed logging
      console.log('Merge result:', result);
      
      // Determine the audio URL with better fallbacks
      let audioUrl = null;
      
      if (result) {
        // Try all possible locations for the URL
        if (typeof result === 'object') {
          audioUrl = result.mergedAudioUrl || result.uploadedAudioUrl;
          
          if (!audioUrl && result.data) {
            // Check if result has nested data property
            audioUrl = result.data.mergedAudioUrl || result.data.uploadedAudioUrl;
          }
        } else if (typeof result === 'string') {
          audioUrl = result;
        }
      }
      
      // Additionally check session state as a fallback
      if (!audioUrl) {
        // Check sessionState directly for the mergedAudio value
        if (sessionActions && sessionActions.getState) {
          // Try to access the session state through the getState action if available
          const sessionState = sessionActions.getState();
          if (sessionState && sessionState.mergedAudio) {
            if (typeof sessionState.mergedAudio === 'string') {
              audioUrl = sessionState.mergedAudio;
            } else if (sessionState.mergedAudio.url) {
              audioUrl = sessionState.mergedAudio.url;
            }
          }
        } else {
          // Direct access to session state through global TTSSessionContext
          // This is a fallback if getState is not available
          const sessionStorageState = JSON.parse(sessionStorage.getItem('tts_session_state') || '{}');
          if (sessionStorageState && sessionStorageState.mergedAudio) {
            if (typeof sessionStorageState.mergedAudio === 'string') {
              audioUrl = sessionStorageState.mergedAudio;
            } else if (sessionStorageState.mergedAudio.url) {
              audioUrl = sessionStorageState.mergedAudio.url;
            }
          }
        }
      }
      
      if (audioUrl) {
        setMergingStatus('Audio merge complete!');
        sessionActions.setMergedAudio(
          typeof audioUrl === 'string' 
            ? audioUrl 
            : {
                url: audioUrl,
                title: customTitle,
                date: new Date().toISOString(),
              }
        );
        
        addNotification({
          type: 'success',
          message: `Audio merged successfully: ${customTitle}`,
        });
      } else {
        setMergingStatus('Merge completed with warnings');
        console.warn('Unexpected result from mergeAllAudio:', result);
        addNotification({
          type: 'warning',
          message: 'Merge completed, but unable to get final URL from server',
        });
      }
    } catch (error) {
      setMergingStatus('Merge failed');
      console.error('Error merging audio:', error);
      addNotification({
        type: 'error',
        message: `Error merging audio: ${error.message || 'Unknown error'}`,
      });
      
      // If there's a specific issue that might help the user, provide more detailed guidance
      if (error.message?.includes('metadata')) {
        addNotification({
          type: 'info',
          message: 'This appears to be a metadata issue. The audio files may still be valid.',
        });
      } else if (error.message?.includes('upload')) {
        addNotification({
          type: 'info',
          message: 'There was an issue uploading the audio files. Please check your network connection.',
        });
      } else if (error.message?.includes('blob URL')) {
        addNotification({
          type: 'info',
          message: 'There was an issue converting blob URLs. Try regenerating audio for affected sections.',
        });
      } else if (error.message?.includes('conversion')) {
        addNotification({
          type: 'info',
          message: 'Audio format conversion failed. Try regenerating audio for some sections.',
        });
      }
    } finally {
      setIsProcessingMerge(false);
      setTimeout(() => {
        setMergingStatus('');
      }, 5000);
    }
  };

  return (
    <div className="relative">
      <button
        id="merge-audio-btn"
        onClick={handleMergeAudio}
        className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
          isProcessing ||
          !allSectionsHaveAudio ||
          isAudioMerged ||
          isProcessingMerge
            ? 'opacity-50 cursor-not-allowed'
            : ''
        }`}
        disabled={
          isProcessing ||
          !allSectionsHaveAudio ||
          isAudioMerged ||
          isProcessingMerge
        }
        title={
          !allSectionsHaveAudio
            ? `${sectionsWithoutAudio.length} sections missing audio`
            : 'Merge all audio into a single file'
        }
      >
        {isProcessingMerge ? 'Processing...' : 'Merge Audio'}
      </button>
      <div
        id="merge-audio-status"
        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"
      >
        {isMerging ? (
          <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {Math.round(mergeProgress)}%
            </span>
          </div>
        ) : isAudioMerged ? (
          <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
            <svg
              className="h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : null}
      </div>
      {isMerging && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-100 p-1.5 rounded flex flex-col">
          {mergingStatus && (
            <div className="text-xs mb-1 text-gray-700">{mergingStatus}</div>
          )}
          <div className="flex items-center">
            <span className="text-xs mr-2">Processing:</span>
            <div className="flex-1 bg-gray-300 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${mergeProgress}%` }}
              ></div>
            </div>
            <span className="text-xs ml-2">{Math.round(mergeProgress)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

AudioPlayerMergeAudioButton.propTypes = {
  isProcessing: PropTypes.bool.isRequired,
  validSections: PropTypes.array.isRequired,
  generatedAudios: PropTypes.object.isRequired,
  sessionActions: PropTypes.object.isRequired,
  speechServiceAPI: PropTypes.object.isRequired,
  autoSave: PropTypes.bool.isRequired,
  customTitle: PropTypes.string.isRequired,
  config: PropTypes.object.isRequired,
  addHistoryEntry: PropTypes.func.isRequired,
  setIsTitleLocked: PropTypes.func.isRequired,
  setCurrentAudioTitle: PropTypes.func.isRequired,
};

export default AudioPlayerMergeAudioButton;