/**
 * @fileoverview Download Audio button component for the AudioPlayer.
 * Handles the audio download process for the merged audio, including state and logic.
 *
 * @requires React
 * @requires ../utils/AudioProcessor
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { downloadAudio } from '../../utils/AudioProcessor';

/**
 * Download Audio button component for the AudioPlayer.
 * Manages audio download, including state and download logic.
 *
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isProcessing - Whether any processing is occurring
 * @param {string|null} props.mergedAudio - The URL of the merged audio
 * @param {string} props.customTitle - Custom title for the downloaded audio
 * @returns {JSX.Element} The rendered Download Audio button component
 */
const AudioPlayerDownloadAudioButton = ({
  isProcessing,
  mergedAudio,
  customTitle,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);

  /**
   * Resets the download button state to initial values
   */
  const resetDownloadState = () => {
    setIsDownloading(false);
    setIsAudioDownloaded(false);
    console.log('Download audio button state reset');
  };

  // Listen for clicks on the refresh-workflow-btn
  useEffect(() => {
    const handleWorkflowRefresh = () => {
      resetDownloadState();
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

  const handleDownloadAudio = () => {
    if (!mergedAudio) return;

    setIsDownloading(true);

    downloadAudio({
      mergedAudio,
      setIsDownloading,
      setIsAudioDownloaded,
      customTitle,
    });
  };

  return (
    <div className="relative">
      <button
        id="download-audio-btn"
        onClick={handleDownloadAudio}
        className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center ${
          isProcessing || !mergedAudio || isDownloading
            ? 'opacity-50 cursor-not-allowed'
            : ''
        }`}
        disabled={isProcessing || !mergedAudio || isDownloading}
      >
        <svg
          id="download-icon"
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        {isDownloading ? 'Downloading...' : 'Download Audio'}
      </button>
      <div
        id="download-audio-status"
        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"
      >
        {isDownloading ? (
          <div className="h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center animate-spin">
            <svg
              className="h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l5 5-5 5v4a8 8 0 01-8-8z"
              ></path>
            </svg>
          </div>
        ) : isAudioDownloaded ? (
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
    </div>
  );
};

AudioPlayerDownloadAudioButton.propTypes = {
  isProcessing: PropTypes.bool.isRequired,
  mergedAudio: PropTypes.string,
  customTitle: PropTypes.string.isRequired,
};

export default AudioPlayerDownloadAudioButton;