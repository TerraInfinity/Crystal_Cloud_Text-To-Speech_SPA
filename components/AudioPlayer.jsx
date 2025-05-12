/**
 * @fileoverview Audio playback and export component for the Text-to-Speech application.
 * This component provides functionality to generate, merge, play, and download audio
 * from TTS sections.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../utils/AudioProcessor
 * @requires ../utils/logUtils
 */

import React, { useState, useEffect, useRef } from 'react';
import {useTTSContext} from '../context/TTSContext';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { generateAllAudio, mergeAllAudio, downloadAudio } from '../utils/AudioProcessor';
import { v4 as uuidv4 } from 'uuid';
import { withLoggingDisabled } from '../utils/logUtils';

/**
 * Audio Player component for TTS application.
 * Provides controls for generating audio from text sections, merging audio files,
 * playing back the merged audio, and downloading the final audio file.
 * 
 * @component
 * @returns {JSX.Element} The rendered AudioPlayer component
 */
const AudioPlayer = () => {
  const { state: persistentState, actions: persistentActions } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext ();

  // Extract necessary state from context
  const sections = sessionState?.sections || [];
  const generatedAudios = sessionState?.generatedTTSAudios || {};
  const mergedAudio = sessionState?.mergedAudio || null;
  const isProcessing = sessionState?.isProcessing || false;
  const speechEngine = persistentState?.settings?.speechEngine || 'googlecloud';

  // Component state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioGenerated, setIsAudioGenerated] = useState(false);
  const [isAudioMerged, setIsAudioMerged] = useState(false);
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);
  const [isAudioAvailable, setIsAudioAvailable] = useState(true);
  
  // New state for the new features
  const [autoSave, setAutoSave] = useState(true);
  const [customTitle, setCustomTitle] = useState(`Merged-${uuidv4().substring(0, 8)}`);
  const [currentAudioTitle, setCurrentAudioTitle] = useState(''); // Track current audio title
  const [isTitleLocked, setIsTitleLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // New state for tracking generation and merge progress
  const [generationProgress, setGenerationProgress] = useState(0);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);
  const [isProcessingMerge, setIsProcessingMerge] = useState(false);
  
  /**
   * Filters valid sections that contain text for TTS processing
   * @type {Array}
   */
  const validSections = sections.filter(
    (section) => section.type === 'text-to-speech' && section.text?.trim()
  );
  
  /**
   * Determines if all valid sections have generated audio
   * @type {boolean}
   */
  const allSectionsHaveAudio =
    validSections.length > 0 &&
    validSections.every(
      (section) =>
        section.id in generatedAudios &&
        generatedAudios[section.id] &&
        typeof generatedAudios[section.id].url === 'string'
    );

  /**
   * Handles starting the audio generation process
   */
  const handleGenerateAudio = () => {
    setIsProcessingGeneration(true);
    setGenerationProgress(0);
    
    generateAllAudio({
      validSections,
      speechEngine,
      persistentState,
      sessionActions,
      setIsGenerating,
      setIsAudioGenerated,
      setGenerationProgress
    }).catch(error => {
      console.error('Generation failed:', error);
      sessionActions.setError(`Audio generation failed: ${error.message || 'Unknown error'}`);
    }).finally(() => {
      setIsProcessingGeneration(false);
    });
  };

  /**
   * Handles merging of audio files
   */
  const handleMergeAudio = async () => {
    setIsTitleLocked(true); // Lock the title field when merging starts
    setMergeProgress(0); // Reset merge progress
    setIsProcessingMerge(true);
    
    // Construct the configuration object from sessionState.sections
    const config = {
      title: customTitle,
      description: sessionState.description || '',
      sections: sessionState.sections, // Directly use the sections array
    };
    
    // Save the current title for the current audio
    setCurrentAudioTitle(customTitle);
    
    try {
      // Call mergeAllAudio with the configuration
      const result = await mergeAllAudio({
        validSections,
        generatedAudios,
        sessionActions,
        setIsMerging,
        setIsAudioMerged,
        autoSave,
        customTitle, // Pass the custom title explicitly
        config,      // Pass the full config including title
        setMergeProgress,
        addHistoryEntry: persistentActions.addToFileHistory // Pass the function to add to history
      });
      
      if (result && result.mergedAudioUrl) {
        setMergedAudio(result.mergedAudioUrl);
        
        // Store title with the merged audio
        setPersistentMergedAudioData({
          url: result.mergedAudioUrl,
          title: customTitle, // Make sure we store the title explicitly 
          date: new Date().toISOString()
        });
        
        if (result.uploadedAudioUrl) {
          setUploadedAudioUrl(result.uploadedAudioUrl);
        }
      }
    } catch (error) {
      console.error('Error merging audio:', error);
      sessionActions.setNotification({
        type: 'error',
        message: `Error merging audio: ${error.message}`,
      });
    } finally {
      setIsProcessingMerge(false);
    }
  };

  /**
   * Handles downloading the merged audio file
   */
  const handleDownloadAudio = () => {
    if (!mergedAudio) return;
    
    setIsDownloading(true);
    
    // Call the downloadAudio function
    downloadAudio({
      mergedAudio,
      setIsDownloading,
      setIsAudioDownloaded,
      customTitle  // Pass the custom title explicitly
    });
  };

  /**
   * Handles manual saving to storage
   */
  const handleSaveToStorage = async () => {
    if (!mergedAudio || isSaved || isSaving) return;
    
    setIsSaving(true);
    setUploadProgress(0);
    
    try {
      // Create a simulated progress indicator
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Construct the configuration
      const config = {
        title: customTitle,
        description: sessionState.description || '',
        sections: sessionState.sections,
      };

      // Use the existing ttsActions to upload the merged audio
      const result = await persistentActions.mergeAndUploadAudio(
        [mergedAudio], 
        { 
          name: customTitle,
          template: 'merged',
          date: new Date().toISOString(),
          volume: 1
        },
        config // Pass the configuration
      );
      
      // Add to file history with title
      if (mergedAudio) {
        persistentActions.addToFileHistory({
          id: uuidv4(),
          title: customTitle, // Use the custom title explicitly
          audioUrl: result?.uploadedAudioUrl || mergedAudio,
          template: 'merged',
          date: new Date().toISOString(),
          config: config
        });
      }
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setIsSaved(true);
      
      // Add a slight delay before completing to ensure the 100% is visible
      setTimeout(() => {
        setIsSaving(false);
      }, 500);

    } catch (error) {
      console.error('Error saving to storage:', error);
      sessionActions.setNotification({
        type: 'error',
        message: `Error saving to storage: ${error.message}`,
      });
      setIsSaving(false);
    }
  };

  /**
   * Handles resetting the audio generation workflow
   * Preserves the last merged audio if it exists and is available
   */
  const handleRefresh = () => {
    // Reset only the states related to the workflow buttons
    setIsAudioGenerated(false);
    setIsAudioMerged(false);
    
    // Don't reset download status if user has downloaded
    if (!isAudioDownloaded) {
      setIsAudioDownloaded(false);
    }
    
    // Always unlock the title field so it can be edited again
    setIsTitleLocked(false);
    
    // Reset saving states
    setIsSaving(false);
    setIsSaved(false);
    setUploadProgress(0);
    
    // Set a new default title if no merged audio
    if (!mergedAudio) {
      setCustomTitle(`Merged-${uuidv4().substring(0, 8)}`);
    }
    
    // If the audio file is not available, clear the reference
    if (mergedAudio && !isAudioAvailable) {
      sessionActions.setMergedAudio(null);
    }
  };

  // Reset title and other states when there is no merged audio
  useEffect(() => {
    if (!mergedAudio) {
      setIsTitleLocked(false);
      setIsSaved(false);
      setUploadProgress(0);
      if (!customTitle || isTitleLocked) {
        setCustomTitle(`Merged-${uuidv4().substring(0, 8)}`);
      }
    }
  }, [mergedAudio, isTitleLocked]);

  // Initialize currentAudioTitle from the mergedAudio URL when component mounts or mergedAudio changes
  useEffect(() => {
    if (mergedAudio) {
      try {
        // Extract filename from the URL
        const urlParts = mergedAudio.split('/');
        let filename = urlParts[urlParts.length - 1];
        
        // Remove file extension
        if (filename.includes('.')) {
          filename = filename.substring(0, filename.lastIndexOf('.'));
        }
        
        // Use the filename as the title
        setCurrentAudioTitle(filename);
      } catch (error) {
        console.error('Error extracting title from URL:', error);
        setCurrentAudioTitle('Merged Audio');
      }
    }
  }, [mergedAudio]);

  /**
   * Checks if an audio file exists at the given URL
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} True if the file exists, false otherwise
   */
  const checkAudioFileExists = async (url) => {
    // Don't check if there's no URL
    if (!url) return false;
    
    // Temporarily disable console.log for this operation to prevent spam
    const originalConsoleLog = console.log;
    console.log = function(...args) {
      if (args.length > 0 && (typeof args[0] === 'string') && 
          (args[0].includes('[TTS]') || args[0].includes('API request'))) {
        return; // Skip TTS and API logs
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
      // Restore console.log
      console.log = originalConsoleLog;
    }
  };

  // Check if the merged audio is still available when it changes
  useEffect(() => {
    if (mergedAudio) {
      checkAudioFileExists(mergedAudio)
        .then(exists => {
          setIsAudioAvailable(exists);
          if (!exists) {
            console.warn('Merged audio file is no longer available:', mergedAudio);
          }
        });
    }
  }, [mergedAudio]);

  // Add a handler for audio element errors
  const handleAudioError = () => {
    console.warn('Error loading audio file:', mergedAudio);
    setIsAudioAvailable(false);
  };

  // Display a general error message if we encountered storage errors
  useEffect(() => {
    // Check if there are any errors from sessionStorage in the notification
    if (sessionState.notification && 
        sessionState.notification.type === 'warning' && 
        sessionState.notification.message && 
        sessionState.notification.message.includes('storage')) {
      
      console.warn('Storage issue detected:', sessionState.notification.message);
    }
  }, [sessionState.notification]);

  return (
    <div
      id="audio-player-container"
      className="section-card relative rounded-lg p-6 font-sans"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="audio-player-title" className="text-lg font-semibold">Preview and Download</h2>
        <div className="flex-1 flex justify-center mx-4">
          <div className="w-[40%]">
            <label htmlFor="custom-title" className="block text-sm font-medium text-gray-700 mb-1">
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
            disabled={isAudioMerged || isMerging}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="auto-save-checkbox" className="ml-2 text-sm text-gray-700">
            Auto-save
          </label>
          <div className="relative ml-2">
            <div 
              className="text-gray-500 hover:text-gray-700 cursor-pointer"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            {showTooltip && (
              <div className="absolute right-0 top-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                When enabled, merged audio will be automatically saved to the server and appear in the file history. Disable to review before saving.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div id="audio-controls" className="flex items-center justify-center space-x-4 flex-wrap">
        <div className="relative">
          <button
            id="generate-audio-btn"
            onClick={handleGenerateAudio}
            className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
              isProcessing || validSections.length === 0 || isAudioGenerated || isProcessingGeneration
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={isProcessing || validSections.length === 0 || isAudioGenerated || isProcessingGeneration}
          >
            {isProcessingGeneration ? 'Processing...' : 'Generate Audio'}
          </button>
          <div id="generate-audio-status" className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            {isGenerating ? (
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs font-semibold">{Math.round(generationProgress)}%</span>
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
              <span className="text-xs ml-2">{Math.round(generationProgress)}%</span>
            </div>
          )}
        </div>

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            isAudioGenerated ? 'text-black opacity-100' : 'text-gray-300 opacity-50'
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

        <div className="relative">
          <button
            id="merge-audio-btn"
            onClick={handleMergeAudio}
            className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
              isProcessing || !allSectionsHaveAudio || isAudioMerged || isProcessingMerge
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={isProcessing || !allSectionsHaveAudio || isAudioMerged || isProcessingMerge}
          >
            {isProcessingMerge ? 'Processing...' : 'Merge Audio'}
          </button>
          <div id="merge-audio-status" className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            {isMerging ? (
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs font-semibold">{Math.round(mergeProgress)}%</span>
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
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-100 p-1.5 rounded flex items-center">
              <span className="text-xs mr-2">Processing:</span>
              <div className="flex-1 bg-gray-300 rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${mergeProgress}%` }}
                ></div>
              </div>
              <span className="text-xs ml-2">{Math.round(mergeProgress)}%</span>
            </div>
          )}
        </div>

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            isAudioMerged ? 'text-black opacity-100' : 'text-gray-300 opacity-50'
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
          <div id="download-audio-status" className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
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
        
        {/* Refresh button */}
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
      
      {/* Save to Storage button - only visible when autosave is off and audio is merged */}
      {!autoSave && isAudioMerged && !isSaved && (
        <div className="mt-4 flex justify-center">
          <div className="relative">
            <button
              id="save-to-storage-btn"
              onClick={handleSaveToStorage}
              disabled={!mergedAudio || isSaving || isSaved}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-all duration-300
                ${(!mergedAudio || isSaving || isSaved) ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Save to Storage
            </button>
            
            {isSaving && (
              <div className="absolute inset-0 rounded-lg bg-blue-600 bg-opacity-90 flex items-center justify-center">
                <div className="w-full px-3">
                  <div className="flex items-center justify-center mb-1">
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2"></div>
                    <span className="text-white text-sm">{Math.round(uploadProgress)}%</span>
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
      
      {/* Auto Save indicator - only visible when autosave is on and uploading/uploaded */}
      {autoSave && isAudioMerged && (isSaving || isSaved) && (
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center">
            {isSaving ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mr-2"></div>
                <span className="text-gray-700 text-sm">Saving to storage: {Math.round(uploadProgress)}%</span>
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
            <h3 className="text-md font-medium">Last Merged Audio: {currentAudioTitle}</h3>
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
        <div id="audio-unavailable-message" className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            <span className="font-medium">Note:</span> The previously merged audio file is no longer available.
            Please generate and merge your audio again.
          </p>
        </div>
      )}

      {!mergedAudio && (
        <p id="audio-status-message" className="text-gray-600 text-center mt-4">
          {validSections.length === 0
            ? 'Create text-to-speech sections with text to generate audio'
            : allSectionsHaveAudio
            ? 'All sections have audio. Click "Merge Audio" to merge them.'
            : 'Generate audio for your sections to proceed.'}
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;