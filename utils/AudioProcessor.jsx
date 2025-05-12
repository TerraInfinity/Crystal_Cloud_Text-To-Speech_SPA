import speechServiceAPI from '../services/api/speechEngineAPIs/speechServiceAPI';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { devLog, devError, devWarn, devDebug } from './logUtils';


/**
 * Estimates the size of data in bytes
 * @param {Object|String} data - The data to estimate size for
 * @returns {number} Approximate size in bytes
 */
const estimateDataSize = (data) => {
  if (!data) return 0;
  if (typeof data === 'string') return data.length * 2; // UTF-16 chars are 2 bytes each
  try {
    const jsonStr = JSON.stringify(data);
    return jsonStr ? jsonStr.length * 2 : 0;
  } catch (e) {
    return 0; // If can't stringify, return 0
  }
};

/**
 * Retrieves the credentials needed for a specific TTS engine from the persistent state
 * 
 * @param {string} engine - The TTS engine name ('elevenlabs', 'awspolly', 'googlecloud', 'azuretts', 'ibmwatson', or 'gtts')
 * @param {Object} persistentState - The application's persistent state containing settings and credentials
 * @returns {Object} Credentials object formatted for the specific engine
 */
const getCredentials = (engine, persistentState) => {
  switch (engine.toLowerCase()) {
    case 'elevenlabs':
      return { apiKey: persistentState.settings?.elevenLabsApiKeys?.[0] };
    case 'awspolly':
      const cred = persistentState.settings?.awsPollyCredentials?.[0];
      return cred ? { accessKey: cred.accessKey, secretKey: cred.secretKey } : {};
    case 'googlecloud':
      return { apiKey: persistentState.settings?.googleCloudCredentials?.[0] };
    case 'azuretts':
      return { apiKey: persistentState.settings?.azureTTSCredentials?.[0] };
    case 'ibmwatson':
      return { apiKey: persistentState.settings?.ibmWatsonCredentials?.[0] };
    case 'gtts':
    default:
      return {};
  }
};

/**
 * Generates audio for all valid text sections using the specified speech engine
 * 
 * Processes each section individually, applying the appropriate voice and language settings.
 * Updates the application state with generated audio URLs and handles any errors.
 * 
 * @param {Object} options - Configuration options
 * @param {Array} options.validSections - Array of valid section objects containing text to convert
 * @param {string} options.speechEngine - TTS engine to use for conversion
 * @param {Object} options.persistentState - Application persistent state with settings and credentials
 * @param {Object} options.sessionActions - Actions for updating session state
 * @param {Function} options.setIsGenerating - State setter for generation in-progress indicator
 * @param {Function} options.setIsAudioGenerated - State setter for generation complete indicator
 * @param {Function} options.setGenerationProgress - State setter for tracking generation progress percentage
 * @returns {Promise<void>}
 */
const generateAllAudio = async ({
    validSections,
    speechEngine,
    persistentState,
    sessionActions,
    setIsGenerating,
    setIsAudioGenerated,
    setGenerationProgress,
  }) => {
    devLog('generateAllAudio called');
    devLog('Valid sections:', validSections);
  
    if (validSections.length === 0) {
      devLog('No valid text-to-speech sections with text');
      sessionActions.setError('No valid text-to-speech sections with text');
      return;
    }
  
    setIsGenerating(true);
    sessionActions.setProcessing(true);
    // Initialize progress to 0
    setGenerationProgress(0);
    const failedSections = [];
    let totalAudioDataSize = 0;
  
    try {
      const engine = speechEngine;
      devLog('Using engine:', engine);
  
      // Retrieve activeVoices from persistentState and flatten it into an array
      const activeVoices = Object.values(persistentState.settings.activeVoices).flat();
      devLog('Active voices:', activeVoices);
  
      // Process each section in sequence, updating progress as we go
      for (let i = 0; i < validSections.length; i++) {
        const section = validSections[i];
        devLog('Processing section:', section);
        devDebug('Voice for section:', section.voice); // Debug voice
  
        // Additional validation for voice
        if (!section.voice) {
          devWarn(`[AudioProcessor] Warning: No voice specified for section "${section.title}"`);
        }
  
        try {
          const credentials = getCredentials(engine, persistentState);
          devLog('Credentials for engine:', credentials);
  
          // Pass activeVoices to the speech service along with existing options
          const result = await speechServiceAPI.convert_text_to_speech_and_upload(
            section.text,
            engine,
            {
              voice: section.voice,
              language: section.language || 'en-US',
              sampleRate: 44100,
              activeVoices,
              ...credentials,
            }
          );
  
          if (!result.url) {
            throw new Error('No URL returned from speech service');
          }
          if (result.url.startsWith('data:')) {
            devWarn(
              `[AudioProcessor] Warning: Data URL generated for section "${section.title}". Expected server URL.`
            );
          } else {
            devLog(
              `[AudioProcessor] Server URL generated for section "${section.title}":`,
              result.url
            );
          }
          
          // Track data size for debugging
          const audioDataSize = estimateDataSize(result);
          totalAudioDataSize += audioDataSize;
          devLog(`Audio size for section "${section.title}": ${Math.round(audioDataSize / 1024)} KB`);
          
          // Update state with generated audio
          sessionActions.setGeneratedAudio(section.id, {
            url: result.url,
            duration: result.duration,
            sampleRate: result.sampleRate,
          });
          
          // Update progress percentage based on sections completed
          const progressPercentage = Math.round(((i + 1) / validSections.length) * 100);
          setGenerationProgress(progressPercentage);
          devLog(`Generation progress: ${progressPercentage}%`);
        } catch (error) {
          devLog(`Error for section "${section.title}":`, error);
          devError(`Error for section "${section.title}":`, error);
          failedSections.push(section.title);
          
          // Still update progress even if there was an error
          const progressPercentage = Math.round(((i + 1) / validSections.length) * 100);
          setGenerationProgress(progressPercentage);
        }
      }
      
      // Log total audio data size
      devLog(`Total audio data size: ${Math.round(totalAudioDataSize / 1024)} KB`);
      devLog(`IMPORTANT: Audio data is NOT stored in sessionStorage`);
  
      if (failedSections.length > 0) {
        devLog('Failed sections:', failedSections);
        sessionActions.setError(`Failed to generate audio for sections: ${failedSections.join(', ')}`);
      } else {
        devLog('All sections processed successfully');
        setIsAudioGenerated(true);
        sessionActions.setNotification({
          type: 'success',
          message: 'All audio generated successfully',
        });
      }
    } catch (error) {
      devLog('Unexpected error in generateAllAudio:', error);
      sessionActions.setError(`Unexpected error: ${error.message}`);
    } finally {
      devLog('generateAllAudio finished');
      setIsGenerating(false);
      sessionActions.setProcessing(false);
    }
  };

/**
 * Merges all generated audio files into a single audio file
 * 
 * Verifies that all sections have associated audio before attempting to merge.
 * Sends the audio URLs to the server-side API for merging and updates the application
 * state with the merged audio URL.
 * 
 * @param {Object} options - Configuration options
 * @param {Array} options.validSections - Array of valid section objects
 * @param {Object} options.generatedAudios - Object mapping section IDs to generated audio data
 * @param {Object} options.sessionActions - Actions for updating session state
 * @param {Function} options.setIsMerging - State setter for merging in-progress indicator
 * @param {Function} options.setIsAudioMerged - State setter for merging complete indicator
 * @param {boolean} [options.autoSave=true] - Whether to automatically save to storage
 * @param {string} [options.customTitle] - Custom title for the merged audio
 * @param {Object} [options.config] - Configuration object containing sections and metadata
 * @param {Function} [options.addHistoryEntry] - Optional function to add to file history
 * @param {Function} [options.setUploadProgress] - Optional function to update upload progress
 * @param {Function} [options.setIsSaving] - Optional function to set saving state
 * @param {Function} [options.setIsSaved] - Optional function to set saved state
 * @param {Function} [options.setMergeProgress] - Optional function to track merging progress
 * @returns {Promise<void>}
 */
const mergeAllAudio = async ({
  validSections,
  generatedAudios,
  sessionActions,
  setIsMerging,
  setIsAudioMerged,
  autoSave = true,
  customTitle,
  config,
  addHistoryEntry,
  setUploadProgress,
  setIsSaving,
  setIsSaved,
  setMergeProgress
}) => {
  devLog('mergeAllAudio called');
  devLog('Generated audios:', generatedAudios);
  devLog('Valid sections:', validSections);
  devLog('Auto save:', autoSave);
  devLog('Custom title:', customTitle);
  devLog('Config:', config);

  const allSectionsHaveAudio =
    validSections.length > 0 &&
    validSections.every(
      (section) =>
        section.id in generatedAudios &&
        generatedAudios[section.id] &&
        typeof generatedAudios[section.id].url === 'string'
    );

  if (!allSectionsHaveAudio) {
    devLog('Not all valid sections have audio');
    sessionActions.setError('Not all valid sections have audio');
    return;
  }

  const audioUrls = validSections.map((section) => {
    const audioData = generatedAudios[section.id];
    return typeof audioData === 'string' ? audioData : audioData.url;
  });
  devLog('Sending audioUrls to API:', audioUrls);

  // Log the total size of all audio URLs
  let totalAudioSize = 0;
  for (const url of audioUrls) {
    const urlSize = estimateDataSize(url);
    totalAudioSize += urlSize;
  }
  devLog(`Total audio URLs size: ${Math.round(totalAudioSize / 1024)} KB`);
  devLog('IMPORTANT: Audio data will not be stored in sessionStorage');

  if (audioUrls.some((url) => url.startsWith('data:'))) {
    devWarn(
      '[AudioProcessor] Warning: Sending data URLs to /api/mergeAudio. Server URLs are preferred.'
    );
  }

  setIsMerging(true);
  sessionActions.setProcessing(true);

  // Initialize merge progress
  if (setMergeProgress) {
    setMergeProgress(0);
  }

  try {
    // Build the request data with additional metadata if a custom title is provided
    const requestData = {
      audioUrls
    };

    if (customTitle) {
      requestData.metadata = {
        name: customTitle,
        placeholder: customTitle.toLowerCase().replace(/\s+/g, '_').replace(/\.+/g, '')
      };
    }

    if (config) {
      requestData.config = config;
      if (customTitle && config.title !== customTitle) {
        requestData.config.title = customTitle;
      }
    }

    devLog('Request data sent to /api/mergeAudio:', JSON.stringify(requestData, null, 2));

    // Simulate progress for the first part of the merge process
    let simulatedProgress = 0;
    const progressInterval = setInterval(() => {
      simulatedProgress += 5;
      if (simulatedProgress > 80) {
        clearInterval(progressInterval);
      } else if (setMergeProgress) {
        setMergeProgress(simulatedProgress);
      }
    }, 200);

    const response = await fetch('/api/mergeAudio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });

    clearInterval(progressInterval);

    if (setMergeProgress) {
      setMergeProgress(90);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to merge audio');
    }

    const data = await response.json();
    devLog('Received response:', data);
    if (!data.uploadedAudioUrl) {
      throw new Error('No audio URL returned from merge API');
    }

    if (setMergeProgress) {
      setMergeProgress(100);
    }

    const finalAudioUrl = data.uploadedAudioUrl;
    devLog(`Merged audio URL size: ${Math.round(estimateDataSize(finalAudioUrl) / 1024)} KB`);

    sessionActions.setMergedAudio(finalAudioUrl);
    sessionActions.setNotification({
      type: 'success',
      message: 'Audio merged successfully',
    });

    setIsAudioMerged(true);

    // Add to file history using metadataEntry from response
    if (data.metadataEntry && addHistoryEntry) {
      devLog('Adding metadata entry to file history:', data.metadataEntry);
      const historyEntry = {
        id: data.audioId,
        title: data.metadataEntry.name || 'Merged Audio',
        audio_url: data.metadataEntry.audio_url,
        config_url: data.metadataEntry.config_url || null,
        type: data.metadataEntry.type || 'audio/wav',
        date: data.metadataEntry.date || new Date().toISOString(),
        category: data.metadataEntry.category || 'merged_audio',
        template: 'merged'
      };
      addHistoryEntry(historyEntry);
    }

    // If autoSave is enabled, add to history (existing logic)
    if (autoSave && data.uploadedAudioUrl && addHistoryEntry) {
      devLog('Auto-saving to file history:', data.uploadedAudioUrl);
      devLog('Using config for auto-save:', config);

      if (setUploadProgress) {
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 5;
          if (progress >= 100) {
            clearInterval(progressInterval);
            progress = 100;
            if (setIsSaved) setIsSaved(true);
            if (setIsSaving) setIsSaving(false);
          }
          setUploadProgress(progress);
        }, 100);

        setTimeout(() => {
          try {
            addHistoryEntry({
              id: data.audioId || uuidv4(),
              date: new Date().toISOString(),
              template: 'merged',
              audioUrl: data.uploadedAudioUrl,
              title: customTitle,
              config: config
            });
            devLog('Added to file history:', data.uploadedAudioUrl);
          } catch (error) {
            devError('Error adding to file history:', error);
          }
        }, 1000);
      } else {
        addHistoryEntry({
          id: data.audioId || uuidv4(),
          date: new Date().toISOString(),
          template: 'merged',
          audioUrl: data.uploadedAudioUrl,
          title: customTitle,
          config: config
        });
      }
    } else {
      devLog('Not auto-saving to file history (autoSave:', autoSave, ', uploadedAudioUrl:', data.uploadedAudioUrl, ')');
    }
  } catch (error) {
    devLog('Merging failed:', error);
    sessionActions.setError(`Merging failed: ${error.message}`);

    if (setUploadProgress) setUploadProgress(0);
    if (setIsSaving) setIsSaving(false);
    if (setMergeProgress) setMergeProgress(0);
  } finally {
    devLog('mergeAllAudio finished');
    setIsMerging(false);
    sessionActions.setProcessing(false);
  }
};

/**
 * Initiates a download of the merged audio file
 * 
 * Creates a temporary anchor element to trigger the browser's download functionality.
 * Updates state to indicate download completion.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.mergedAudio - URL of the merged audio file to download
 * @param {Function} options.setIsDownloading - State setter for download in-progress indicator
 * @param {Function} options.setIsAudioDownloaded - State setter for download complete indicator
 * @param {string} [options.customTitle] - Optional custom title for the downloaded file
 * @returns {void}
 */
const downloadAudio = ({ mergedAudio, setIsDownloading, setIsAudioDownloaded, customTitle }) => {
  devLog('downloadAudio called');
  if (!mergedAudio) {
    devLog('No merged audio to download');
    return;
  }

  setIsDownloading(true);
  
  // Extract a filename from the URL or use the custom title
  let filename = 'tts-audio.wav';
  
  if (customTitle) {
    // Use the custom title, ensuring it has a .wav extension
    // Remove any existing dots before adding the extension to prevent double dots
    const sanitizedTitle = customTitle.replace(/\.+/g, '');
    filename = sanitizedTitle.endsWith('wav') ? `${sanitizedTitle}.wav` : `${sanitizedTitle}.wav`;
  } else {
    // Try to extract the filename from the URL
    try {
      const url = new URL(mergedAudio);
      const pathSegments = url.pathname.split('/');
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment.includes('.')) {
          filename = lastSegment;
        }
      }
    } catch (e) {
      // If URL parsing fails, just use the default filename
      devLog('Error extracting filename from URL:', e);
    }
  }
  
  const a = document.createElement('a');
  a.href = mergedAudio;
  a.download = filename;
  a.click();
  setTimeout(() => {
    setIsDownloading(false);
    setIsAudioDownloaded(true);
  }, 1000);
};

export { generateAllAudio, mergeAllAudio, downloadAudio, getCredentials, devLog };