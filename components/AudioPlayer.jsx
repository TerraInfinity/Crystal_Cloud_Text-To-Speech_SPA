/**
 * @fileoverview Audio playback and export component for the Text-to-Speech application.
 * Orchestrates audio generation, merging, and downloading via button components.
 *
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../utils/AudioProcessor
 */

import React, { useState, useEffect } from 'react';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import SpeechServiceAPI from '../services/api/speechEngineAPIs/speechServiceAPI';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '../context/notificationContext';
import AudioPlayerGenerateAudioButton from './audioPlayer/AudioPlayerGenerateAudioButton';
import AudioPlayerMergeAudioButton from './audioPlayer/AudioPlayerMergeAudioButton';
import AudioPlayerDownloadAudioButton from './audioPlayer/AudioPlayerDownloadAudioButton';

/**
 * Exported function to refresh the audio workflow state
 * This function can be called from other components
 * 
 * @param {Object} params - Parameters for refreshing workflow
 * @param {Function} params.setIsTitleLocked - Function to set title lock state
 * @param {Function} params.setIsSaving - Function to set saving state
 * @param {Function} params.setIsSaved - Function to set saved state
 * @param {Function} params.setUploadProgress - Function to set upload progress
 * @param {Function} params.setCustomTitle - Function to set custom title
 * @param {boolean} params.mergedAudio - Current merged audio state
 * @param {boolean} params.isAudioAvailable - Whether audio is available
 * @param {Object} params.sessionActions - Session actions for state updates
 */
export const handleRefreshWorkflow = ({
  setIsTitleLocked, 
  setIsSaving, 
  setIsSaved,
  setUploadProgress,
  setCustomTitle,
  mergedAudio,
  isAudioAvailable,
  sessionActions
}) => {
  // Reset UI state
  setIsTitleLocked(false);
  setIsSaving(false);
  setIsSaved(false);
  setUploadProgress(0);

  // Generate a new title if needed
  if (!mergedAudio) {
    setCustomTitle(`Merged-${uuidv4().substring(0, 8)}`);
  }

  // Clear merged audio if not available
  if (mergedAudio && !isAudioAvailable) {
    sessionActions.setMergedAudio(null);
  }
  
  console.log('Audio workflow refreshed');
};

/**
 * Audio Player component for TTS application.
 * Provides controls for generating, merging, playing, and downloading audio.
 *
 * @component
 * @returns {JSX.Element} The rendered AudioPlayer component
 */
const AudioPlayer = () => {
  const { state: persistentState, actions: persistentActions } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { addNotification } = useNotification();

  // Extract necessary state from context
  const sections = sessionState?.sections || [];
  const generatedAudios = sessionState?.generatedTTSAudios || {};
  const mergedAudio = sessionState?.mergedAudio || null;
  const isProcessing = sessionState?.isProcessing || false;

  // Create SpeechServiceAPI instance
  const fileStorageActions = persistentActions.fileStorageActions;
  const speechServiceAPI = new SpeechServiceAPI(fileStorageActions);

  // Component state
  const [autoSave, setAutoSave] = useState(true);
  const [customTitle, setCustomTitle] = useState(`Merged-${uuidv4().substring(0, 8)}`);
  const [currentAudioTitle, setCurrentAudioTitle] = useState('');
  const [isTitleLocked, setIsTitleLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isAudioAvailable, setIsAudioAvailable] = useState(true);

  // Debug all sections in the console
  console.log('All sections:', sections.map(s => ({
    id: s.id,
    type: s.type, 
    hasAudio: !!(generatedAudios[s.id]?.url),
    url: generatedAudios[s.id]?.url,
    audioId: s.audioId,
    audioSource: s.audioSource
  })));

  // Filter valid sections
  const validSections = sections.filter(
    (section) =>
      // Include text-to-speech sections with voice and text
      (section.type === 'text-to-speech' &&
       section.text?.trim() &&
       section.voice &&
       section.voice.engine) ||
      // Include ANY section that has generated audio data (more permissive)
      (generatedAudios[section.id] && 
       generatedAudios[section.id].url) ||
      // Also look for sections with audioId specifically (for library audio)
      (section.audioId && section.audioSource === 'library')
  );

  // After the filter, add this for debugging:
  console.log('Valid sections for merging:', validSections.map(s => ({
    id: s.id,
    type: s.type,
    url: generatedAudios[s.id]?.url,
    audioId: s.audioId,
    audioSource: s.audioSource
  })));

  // Merge configuration
  const config = {
    title: customTitle,
    description: sessionState.description || '',
    sections: sessionState.sections,
  };

  /**
   * Handles manual saving to storage
   */
  const handleSaveToStorage = async () => {
    if (!mergedAudio || isSaved || isSaving) return;

    setIsSaving(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const result = await persistentActions.mergeAndUploadAudio(
        [mergedAudio],
        {
          name: customTitle,
          template: 'merged',
          date: new Date().toISOString(),
          volume: 1,
        },
        config
      );

      if (mergedAudio) {
        persistentActions.addToFileHistory({
          id: uuidv4(),
          title: customTitle,
          audioUrl: result?.uploadedAudioUrl || mergedAudio,
          template: 'merged',
          date: new Date().toISOString(),
          config,
        });
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      setIsSaved(true);

      setTimeout(() => {
        setIsSaving(false);
      }, 500);
    } catch (error) {
      console.error('Error saving to storage:', error);
      addNotification({
        type: 'error',
        message: `Error saving to storage: ${error.message}`,
      });
      setIsSaving(false);
    }
  };

  /**
   * Handles resetting the workflow
   */
  const handleRefresh = () => {
    handleRefreshWorkflow({
      setIsTitleLocked,
      setIsSaving, 
      setIsSaved,
      setUploadProgress,
      setCustomTitle,
      mergedAudio,
      isAudioAvailable,
      sessionActions
    });
  };

  // Reset title and saving states when no merged audio
  useEffect(() => {
    if (!mergedAudio) {
      setIsTitleLocked(false);
      setIsSaved(false);
      setUploadProgress(0);
      if (!customTitle || isTitleLocked) {
        setCustomTitle(`Merged-${uuidv4().substring(0, 8)}`);
      }
    }
  }, [mergedAudio, isTitleLocked, customTitle]);

  // Initialize currentAudioTitle from mergedAudio URL
  useEffect(() => {
    if (mergedAudio) {
      try {
        const urlParts = mergedAudio.split('/');
        let filename = urlParts[urlParts.length - 1];
        if (filename.includes('.')) {
          filename = filename.substring(0, filename.lastIndexOf('.'));
        }
        setCurrentAudioTitle(filename);
      } catch (error) {
        console.error('Error extracting title from URL:', error);
        setCurrentAudioTitle('Merged Audio');
      }
    }
  }, [mergedAudio]);

  /**
   * Checks if an audio file exists
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} True if the file exists
   */
  const checkAudioFileExists = async (url) => {
    if (!url) return false;

    const originalConsoleLog = console.log;
    console.log = function (...args) {
      if (
        args.length > 0 &&
        typeof args[0] === 'string' &&
        (args[0].includes('[TTS]') || args[0].includes('API request'))
      ) {
        return;
      }
      originalConsoleLog.apply(console, args);
    };

    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Error checking audio file existence:', error);
      return false;
    } finally {
      console.log = originalConsoleLog;
    }
  };

  // Check merged audio availability
  useEffect(() => {
    if (mergedAudio) {
      checkAudioFileExists(mergedAudio).then((exists) => {
        setIsAudioAvailable(exists);
        if (!exists) {
          console.warn('Merged audio file is no longer available:', mergedAudio);
        }
      });
    }
  }, [mergedAudio]);

  // Handle audio element errors
  const handleAudioError = () => {
    console.warn('Error loading audio file:', mergedAudio);
    setIsAudioAvailable(false);
  };

  // Display storage error notifications
  useEffect(() => {
    if (
      sessionState.notification &&
      sessionState.notification.type === 'warning' &&
      sessionState.notification.message &&
      sessionState.notification.message.includes('storage')
    ) {
      console.warn('Storage issue detected:', sessionState.notification.message);
    }
  }, [sessionState.notification]);

  return (
    <div
      id="audio-player-container"
      className="section-card relative rounded-lg p-6 font-sans"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="audio-player-title" className="text-lg font-semibold">
          Preview and Download
        </h2>
        <div className="flex-1 flex justify-center mx-4">
          <div className="w-[40%]">
            <label
              htmlFor="custom-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title:
            </label>
            <input
              type="text"
              id="custom-title"
              className={`input-field ${isTitleLocked ? 'bg-gray-100' : ''}`}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              disabled={isTitleLocked}
              placeholder="Enter a title for the merged audio"
            />
          </div>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="auto-save-checkbox"
            checked={autoSave}
            onChange={() => setAutoSave(!autoSave)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="auto-save-checkbox"
            className="ml-2 text-sm text-gray-700"
          >
            Auto-save
          </label>
          <div className="relative ml-2">
            <div
              className="text-gray-500 hover:text-gray-700 cursor-pointer"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            {showTooltip && (
              <div className="absolute right-0 top-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                When enabled, merged audio will be automatically saved to the
                server and appear in the file history. Disable to review before
                saving.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        id="audio-controls"
        className="flex items-center justify-center space-x-4 flex-wrap"
      >
        <AudioPlayerGenerateAudioButton
          isProcessing={isProcessing}
          validSections={validSections}
          persistentState={persistentState}
          sessionActions={sessionActions}
          speechServiceAPI={speechServiceAPI}
        />

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            generatedAudios && Object.keys(generatedAudios).length > 0
              ? 'text-black opacity-100'
              : 'text-gray-300 opacity-50'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <AudioPlayerMergeAudioButton
          isProcessing={isProcessing}
          validSections={validSections}
          generatedAudios={generatedAudios}
          sessionActions={sessionActions}
          speechServiceAPI={speechServiceAPI}
          autoSave={autoSave}
          customTitle={customTitle}
          config={config}
          addHistoryEntry={persistentActions.addToFileHistory}
          setIsTitleLocked={setIsTitleLocked}
          setCurrentAudioTitle={setCurrentAudioTitle}
        />

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            mergedAudio ? 'text-black opacity-100' : 'text-gray-300 opacity-50'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <AudioPlayerDownloadAudioButton
          isProcessing={isProcessing}
          mergedAudio={mergedAudio}
          customTitle={customTitle}
        />

        <div className="ml-4">
          <button
            onClick={handleRefresh}
            className="p-2 hover:opacity-80 transition-opacity duration-200"
            title="Reset workflow"
            id="refresh-workflow-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {!autoSave && mergedAudio && !isSaved && (
        <div className="mt-4 flex justify-center">
          <div className="relative">
            <button
              id="save-to-storage-btn"
              onClick={handleSaveToStorage}
              disabled={!mergedAudio || isSaving || isSaved}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-all duration-300
                ${!mergedAudio || isSaving || isSaved ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Save to Storage
            </button>

            {isSaving && (
              <div className="absolute inset-0 rounded-lg bg-blue-600 bg-opacity-90 flex items-center justify-center">
                <div className="w-full px-3">
                  <div className="flex items-center justify-center mb-1">
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2"></div>
                    <span className="text-white text-sm">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-800 rounded-full h-1.5">
                    <div
                      className="bg-white h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {isSaved && (
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                <svg
                  className="h-4 w-4 text-white"
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
            )}
          </div>
        </div>
      )}

      {autoSave && mergedAudio && (isSaving || isSaved) && (
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center">
            {isSaving ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mr-2"></div>
                <span className="text-gray-700 text-sm">
                  Saving to storage: {Math.round(uploadProgress)}%
                </span>
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5 text-green-600 mr-2"
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
                <span className="text-gray-700 text-sm">Saved to storage</span>
              </>
            )}
          </div>
        </div>
      )}

      {mergedAudio && isAudioAvailable && (
        <div id="audio-preview" className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium">
              Last Merged Audio: {currentAudioTitle}
            </h3>
          </div>
          <audio
            controls
            src={mergedAudio}
            className="w-full audio-player"
            id="merged-audio-player"
            onError={handleAudioError}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {mergedAudio && !isAudioAvailable && (
        <div
          id="audio-unavailable-message"
          className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <p className="text-yellow-800">
            <span className="font-medium">Note:</span> The previously merged audio
            file is no longer available. Please generate and merge your audio
            again.
          </p>
        </div>
      )}

      {!mergedAudio && (
        <p id="audio-status-message" className="text-gray-600 text-center mt-4">
          {validSections.length === 0
            ? 'Create text-to-speech sections with text to generate audio'
            : Object.keys(generatedAudios).length > 0
            ? 'All sections have audio. Click "Merge Audio" to merge them.'
            : 'Generate audio for your sections to proceed.'}
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;