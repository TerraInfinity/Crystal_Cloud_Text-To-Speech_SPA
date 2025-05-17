/**
 * @fileoverview Generate Audio button component for the AudioPlayer.
 * Handles the audio generation process for TTS sections, including state and logic.
 *
 * @requires React
 * @requires ../utils/AudioProcessor
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { generateAllAudio } from '../../utils/AudioProcessor';

/**
 * Generate Audio button component for the AudioPlayer.
 * Manages audio generation, including state, progress, and API calls.
 *
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isProcessing - Whether any processing is occurring
 * @param {Array} props.validSections - Filtered sections valid for TTS
 * @param {Object} props.persistentState - TTSContext persistent state
 * @param {Object} props.sessionActions - TTSSessionContext actions
 * @param {Object} props.speechServiceAPI - SpeechServiceAPI instance
 * @returns {JSX.Element} The rendered Generate Audio button component
 */
const AudioPlayerGenerateAudioButton = ({
  isProcessing,
  validSections,
  persistentState,
  sessionActions,
  speechServiceAPI,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAudioGenerated, setIsAudioGenerated] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);

  /**
   * Resets the generate button state to its initial values
   */
  const resetGenerateState = () => {
    setIsGenerating(false);
    setIsAudioGenerated(false);
    setGenerationProgress(0);
    setIsProcessingGeneration(false);
    console.log('Generate audio button state reset');
  };

  // Listen for clicks on the refresh-workflow-btn
  useEffect(() => {
    const handleWorkflowRefresh = () => {
      resetGenerateState();
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

  const handleGenerateAudio = () => {
    setIsProcessingGeneration(true);
    setGenerationProgress(0);

    generateAllAudio({
      validSections,
      persistentState,
      sessionActions,
      setIsGenerating,
      setIsAudioGenerated,
      setGenerationProgress,
      speechServiceAPI,
    })
      .then(() => {
        // Check if any sections have data URLs and log their lengths
        const sectionsWithDataUrls = validSections.filter(
          section => section.audioUrl && section.audioUrl.startsWith('data:')
        );
        
        if (sectionsWithDataUrls.length > 0) {
          console.log(`Found ${sectionsWithDataUrls.length} sections with data URLs`);
          sectionsWithDataUrls.forEach(section => {
            console.log(`Section ${section.id} data URL length: ${section.audioUrl ? section.audioUrl.length : 0}`);
            // Log the first 50 chars and last 50 chars to verify it's complete
            if (section.audioUrl && section.audioUrl.length > 100) {
              console.log(`URL start: ${section.audioUrl.substring(0, 50)}`);
              console.log(`URL end: ${section.audioUrl.substring(section.audioUrl.length - 50)}`);
            }
          });
        }
      })
      .catch((error) => {
        console.error('Generation failed:', error);
        sessionActions.setError(`Audio generation failed: ${error.message || 'Unknown error'}`);
      })
      .finally(() => {
        setIsProcessingGeneration(false);
      });
  };

  return (
    <div className="relative">
      <button
        id="generate-audio-btn"
        onClick={handleGenerateAudio}
        className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
          isProcessing ||
          validSections.length === 0 ||
          isAudioGenerated ||
          isProcessingGeneration
            ? 'opacity-50 cursor-not-allowed'
            : ''
        }`}
        disabled={
          isProcessing ||
          validSections.length === 0 ||
          isAudioGenerated ||
          isProcessingGeneration
        }
      >
        {isProcessingGeneration ? 'Processing...' : 'Generate Audio'}
      </button>
      <div
        id="generate-audio-status"
        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"
      >
        {isGenerating ? (
          <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {Math.round(generationProgress)}%
            </span>
          </div>
        ) : isAudioGenerated ? (
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
      {isGenerating && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-100 p-1.5 rounded flex items-center">
          <span className="text-xs mr-2">Processing:</span>
          <div className="flex-1 bg-gray-300 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            ></div>
          </div>
          <span className="text-xs ml-2">
            {Math.round(generationProgress)}%
          </span>
        </div>
      )}
    </div>
  );
};

AudioPlayerGenerateAudioButton.propTypes = {
  isProcessing: PropTypes.bool.isRequired,
  validSections: PropTypes.array.isRequired,
  persistentState: PropTypes.object.isRequired,
  sessionActions: PropTypes.object.isRequired,
  speechServiceAPI: PropTypes.object.isRequired,
};

export default AudioPlayerGenerateAudioButton;