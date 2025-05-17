import { v4 as uuidv4 } from 'uuid';
import { devLog, devError, devWarn, devDebug } from './logUtils';
import { loadCurrentMetadata } from '../context/fileStorageMetadataActions'; // Import to access audio library metadata

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
      const allKeys = persistentState.settings?.elevenLabsApiKeys || [];
      const activeKeys = allKeys.filter(key => key.active);
      devLog('getCredentials: Active ElevenLabs keys:', activeKeys.map(k => ({
        name: k.name,
        hasKey: !!k.key,
        remaining_tokens: k.remaining_tokens
      })));
      return { apiKeys: activeKeys };
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
 * Generates audio for all valid text sections using the engine specified in each section's voice.
 * 
 * Processes each section individually, applying the appropriate voice and language settings.
 * Updates the application state with generated audio URLs and handles any errors.
 * 
 * @param {Object} options - Configuration options
 * @param {Array} options.validSections - Array of valid section objects containing text and voice
 * @param {Object} options.persistentState - Application persistent state with settings and credentials
 * @param {Object} options.sessionActions - Actions for updating session state
 * @param {Function} options.setIsGenerating - State setter for generation in-progress indicator
 * @param {Function} options.setIsAudioGenerated - State setter for generation complete indicator
 * @param {Function} options.setGenerationProgress - State setter for tracking generation progress percentage
 * @param {Object} options.speechServiceAPI - SpeechServiceAPI instance
 * @returns {Promise<void>}
 */
const generateAllAudio = async ({
  validSections,
  persistentState,
  sessionActions,
  setIsGenerating,
  setIsAudioGenerated,
  setGenerationProgress,
  speechServiceAPI,
}) => {
  devLog('generateAllAudio called');
  devLog('Valid sections:', validSections);

  // Filter to only include text-to-speech sections for generation
  const ttsValidSections = validSections.filter(section => section.type === 'text-to-speech' && section.text?.trim());
  
  if (ttsValidSections.length === 0) {
    devLog('No valid text-to-speech sections with text');
    sessionActions.setError('No valid text-to-speech sections with text');
    return;
  }

  setIsGenerating(true);
  sessionActions.setProcessing(true);
  setGenerationProgress(0);
  const failedSections = [];
  let totalAudioDataSize = 0;

  try {
    const activeVoices = Object.values(persistentState.settings.activeVoices).flat();
    devLog('Active voices:', activeVoices);

    for (let i = 0; i < ttsValidSections.length; i++) {
      const section = ttsValidSections[i];
      devLog('Processing section:', section);
      devDebug('Voice for section:', section.voice);

      // Use the engine from section.voice.engine, with a fallback if missing
      const engine = section.voice?.engine || 'gtts'; // Fallback to 'gtts' if no engine
      devLog('Using engine for section:', engine);

      if (!section.voice) {
        devWarn(`[AudioProcessor] Warning: No voice specified for section "${section.title}"`);
        failedSections.push(section.title);
        continue; // Skip this section
      }

      try {
        const credentials = getCredentials(engine, persistentState);
        devLog('Credentials for engine:', credentials);

        // Create a single-item scripts array for this section
        const scripts = [
          {
            type: 'speech',
            text: section.text,
            engine: engine, // Use section-specific engine
            options: {
              voice: section.voice.id, // Use voice ID
              language: section.voice.language || 'en-US', // Use voice language
              sampleRate: 44100,
              activeVoices,
              voiceName: section.voice.name, // Pass voice name for engine-specific use
              ...credentials,
              title: section.title, // For file naming consistency
            },
          },
        ];

        // Call generate_audio_segments with the provided speechServiceAPI
        const segments = await speechServiceAPI.generate_audio_segments(scripts);

        // Validate the result
        if (segments.length !== 1 || segments[0].type !== 'audio') {
          throw new Error('Expected one audio segment');
        }

        const segment = segments[0];

        if (!segment.url) {
          throw new Error('No URL returned from speech service');
        }

        if (segment.url.startsWith('data:')) {
          devWarn(
            `[AudioProcessor] Warning: Data URL generated for section "${section.title}". Expected server URL.`
          );
        } else {
          devLog(
            `[AudioProcessor] Server URL generated for section "${section.title}":`,
            segment.url
          );
        }

        // Track data size for debugging
        const audioDataSize = estimateDataSize(segment);
        totalAudioDataSize += audioDataSize;
        devLog(`Audio size for section "${section.title}": ${Math.round(audioDataSize / 1024)} KB`);

        // Update state with generated audio
        const isDataUrl = segment.url.startsWith('data:');
        const urlForLogging = isDataUrl 
          ? `${segment.url.substring(0, 50)}... (total length: ${segment.url.length})` 
          : segment.url;

        devLog(`Generated audio URL for section "${section.title}":`, urlForLogging);

        if (isDataUrl) {
          // Validate the data URL
          const isValid = isValidDataUrl(segment.url);
          devLog(`Data URL validation: ${isValid ? 'VALID' : 'INVALID'}, length: ${segment.url.length}`);
          
          if (!isValid) {
            devWarn(`Invalid or incomplete data URL for section "${section.title}"`);
          }
          
          // Log the first 50 and last 10 characters to verify it's complete
          devLog(`URL start: ${segment.url.substring(0, 50)}`);
          devLog(`URL end: ${segment.url.substring(segment.url.length - 10)}`);
        }

        sessionActions.setGeneratedAudio(section.id, {
          url: segment.url,
          duration: segment.duration,
          sampleRate: segment.sampleRate,
        });
        
        // Also update section with audioUrl directly
        const currentSection = validSections.find(s => s.id === section.id);
        if (currentSection) {
          // Make sure we have a full URL for the section
          let fullUrl = segment.url;
          
          // For data URLs and blob URLs, preserve them as-is
          if (segment.url.startsWith('data:') || segment.url.startsWith('blob:')) {
            devLog(`Preserving ${segment.url.startsWith('data:') ? 'data' : 'blob'} URL as-is for section ${section.id}`);
            sessionActions.updateSection({
              ...currentSection,
              audioUrl: segment.url // Store URL directly in the section
            });
            devLog(`Updated section ${section.id} with audioUrl: ${segment.url.substring(0, 50)}...`);
            continue; // Changed from "return" to "continue" to proceed with the next section
          }
          
          // For http URLs, preserve them as-is
          if (segment.url.startsWith('http')) {
            devLog(`Preserving http URL as-is for section ${section.id}`);
            sessionActions.updateSection({
              ...currentSection,
              audioUrl: segment.url // Store URL directly in the section
            });
            devLog(`Updated section ${section.id} with audioUrl: ${segment.url}`);
            continue; // Changed from "return" to "continue" to proceed with the next section
          }
          
          // If it's a relative URL, convert it to a full URL
          const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
          // Ensure the URL starts with a slash if it doesn't already
          const normalizedPath = segment.url.startsWith('/') ? segment.url : `/${segment.url}`;
          fullUrl = `${serverUrl}${normalizedPath}`;
          devLog(`Converting relative URL to full URL: ${segment.url} -> ${fullUrl}`);
          
          sessionActions.updateSection({
            ...currentSection,
            audioUrl: fullUrl // Store FULL URL directly in the section
          });
          devLog(`Updated section ${section.id} with audioUrl (full): ${fullUrl}`);
        }

        // Update progress
        const progressPercentage = Math.round(((i + 1) / ttsValidSections.length) * 100);
        setGenerationProgress(progressPercentage);
        devLog(`Generation progress: ${progressPercentage}%`);
      } catch (error) {
        devLog(`Error for section "${section.title}":`, error);
        devError(`Error for section "${section.title}":`, error);
        failedSections.push(section.title);

        const progressPercentage = Math.round(((i + 1) / ttsValidSections.length) * 100);
        setGenerationProgress(progressPercentage);
      }
    }

    devLog(`Total audio data size: ${Math.round(totalAudioDataSize / 1024)} KB`);
    devLog(`IMPORTANT: Audio data is NOT stored in sessionStorage`);

    if (failedSections.length > 0) {
      devLog('Failed sections:', failedSections);
      sessionActions.setError(`Failed to generate audio for sections: ${failedSections.join(', ')}`);
    } else {
      devLog('All sections processed successfully');
      setIsAudioGenerated(true);
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
 * Merges all generated audio files and selected audio library files into a single audio file
 * 
 * Verifies that all sections have associated audio before attempting to merge.
 * Uploads blob: and data: URLs to the storage backend to obtain server-hosted URLs.
 * Includes audio library files (e.g., background music) from metadata.
 * Sends the server-hosted URLs to the server-side API for merging and updates the application
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
 * @param {Object} options.speechServiceAPI - SpeechServiceAPI instance for uploading audio
 * @returns {Promise<Object>} Object containing mergedAudioUrl and optionally uploadedAudioUrl
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
  setMergeProgress,
  speechServiceAPI,
}) => {
  let result = null;
  
  try {
    devLog('mergeAllAudio called');
    if (!validSections || validSections.length === 0) {
      throw new Error('No valid sections provided for merging');
    }

    setIsMerging(true);
    sessionActions.setProcessing(true);

    // Process all audio URLs from sections - convert blob: to data: URLs
    const audioUrls = await Promise.all(
      validSections.map(async (section, index) => {
        if (setMergeProgress) setMergeProgress(Math.floor((index / validSections.length) * 30));

        // Determine the URL source for this section
        let url = null;

        // First check generatedAudios map
        if (generatedAudios[section.id]) {
          url = generatedAudios[section.id].url;
          if (!url) {
            devWarn(`generatedAudios for section ${section.id} exists but has no URL`);
          }
        }

        // If not found there, check section.audioUrl (direct property)
        if (!url && section.audioUrl) {
          url = section.audioUrl;
          devLog(`URL from section.audioUrl for section ${section.id}: ${url}`);
        }

        // Last resort - try other properties or strategies
        if (!url) {
          if (section.audioSource === 'library' && section.audioId) {
            url = `/audio-library/${section.audioId}.wav`;
            devLog(`URL from library audio for section ${section.id}: ${url}`);
          } else {
            devWarn(`No audio URL found for section "${section.title || section.id}"`);
            return null; // Skip this section
          }
        }
        
        // Log section type for debugging
        devLog(`Processing section ${section.id} of type ${section.type}`, {
          url: url.startsWith('data:') ? `${url.substring(0, 50)}...` : url,
          audioSource: generatedAudios[section.id]?.source,
          sectionData: section
        });
        
        // Convert blob URLs to data URLs
        if (url.startsWith('blob:')) {
          try {
            if (setMergeProgress) setMergeProgress(Math.floor((index / validSections.length) * 40));
            
            devLog(`Converting blob URL from generatedTTSAudios to data URL for section ${section.id}`);
            const dataUrl = await blobToDataURL(url);
            
            // Validate the data URL is complete
            if (!isValidDataUrl(dataUrl)) {
              devWarn(`Failed to properly convert blob URL to data URL for section ${section.id}`);
              throw new Error(`Invalid data URL conversion for section ${section.title || section.id}`);
            }
            
            devLog(`Successfully converted blob URL to data URL for section ${section.id} (length: ${dataUrl.length})`);
            
            // Update both generatedAudios and section with data URL for future use
            sessionActions.setGeneratedAudio(section.id, {
              ...generatedAudios[section.id],
              url: dataUrl
            });
            
            // Also update the section
            sessionActions.updateSection({
              ...section,
              audioUrl: dataUrl
            });
            
            return dataUrl;
          } catch (conversionError) {
            devWarn(`Error converting blob URL to data URL for section ${section.id}:`, conversionError);
            throw new Error(`Failed to convert audio format for section ${section.title || section.id}: ${conversionError.message}`);
          }
        } else if (url.startsWith('data:')) {
          // Validate data URL before using
          if (!isValidDataUrl(url)) {
            devWarn(`Invalid data URL in generatedTTSAudios for section ${section.id}`);
            throw new Error(`Invalid data URL in section ${section.title || section.id}`);
          }
          
          // Store valid data URL in section for future use
          sessionActions.updateSection({
            ...section,
            audioUrl: url
          });
          
          devLog(`Using valid data URL from generatedTTSAudios for section ${section.id}`);
          return url;
        } else if (url.startsWith('http')) {
          // Use HTTP URLs directly
          // Store this URL in the section for future use
          sessionActions.updateSection({
            ...section,
            audioUrl: url
          });
          
          devLog(`Using HTTP URL from generatedTTSAudios for section ${section.id}: ${url}`);
          return url;
        } else {
          // If it's a relative URL, convert it to a full URL
          const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
          const normalizedPath = url.startsWith('/') ? url : `/${url}`;
          const fullUrl = `${serverUrl}${normalizedPath}`;
          devLog(`Converting relative URL to full URL for merging: ${url} -> ${fullUrl}`);
          
          // Store this full URL in the section for future use
          sessionActions.updateSection({
            ...section,
            audioUrl: fullUrl
          });
          
          return fullUrl;
        }
      })
    );
    
    if (setMergeProgress) setMergeProgress(50);
    
    // Filter out any nulls and check URL validity
    const audioUrlsForMerging = audioUrls.filter(url => url !== null);
    
    devLog('Processed audio URLs for merging:', audioUrlsForMerging.map(url => {
      if (url.startsWith('data:')) return `data URL (length: ${url.length})`;
      return url;
    }));

    if (audioUrlsForMerging.length === 0) {
      throw new Error('No valid audio URLs available from sections for merging');
    }
    
    if (audioUrlsForMerging.length !== validSections.length) {
      devWarn(`Some sections couldn't be processed: got ${audioUrlsForMerging.length} URLs for ${validSections.length} sections`);
    }
    
    // Type count for debugging
    const dataUrls = audioUrlsForMerging.filter(url => url.startsWith('data:')).length;
    const blobUrls = audioUrlsForMerging.filter(url => url.startsWith('blob:')).length;
    const httpUrls = audioUrlsForMerging.filter(url => url.startsWith('http')).length;
    
    devLog(`URL types for merging: ${dataUrls} data URLs, ${blobUrls} blob URLs, ${httpUrls} HTTP URLs`);
    
    // All URLs should now be either data: or http: - if we still have blob URLs, something went wrong
    if (blobUrls > 0) {
      throw new Error(`${blobUrls} blob URLs couldn't be converted to data URLs for merging`);
    }

    // For now, just use the section audio URLs
    const allAudioUrls = [...audioUrlsForMerging];
    devLog('All audio URLs for merging:', allAudioUrls.map(url => {
      if (url.startsWith('data:')) return `data URL (length: ${url.length})`;
      return url;
    }));

    if (allAudioUrls.length === 0) {
      throw new Error('No valid audio URLs available for merging');
    }

    // Prepare request data for merge API
    const requestData = {
      audioUrls: allAudioUrls,
      metadata: customTitle ? {
        name: customTitle,
        placeholder: customTitle.toLowerCase().replace(/\s+/g, '_').replace(/\.+/g, ''),
      } : undefined,
      config: config ? { ...config, title: customTitle } : undefined,
    };
    devLog('Request data sent to /api/mergeAudio:', {
      urlCount: requestData.audioUrls.length,
      metadata: requestData.metadata,
      configTitle: requestData.config?.title,
    });

    if (setMergeProgress) setMergeProgress(60);

    // Simulate progress
    let simulatedProgress = 60;
    const progressInterval = setInterval(() => {
      simulatedProgress += 2;
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
    if (setMergeProgress) setMergeProgress(90);

    devLog('Merge API status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      devLog('Merge API error:', errorData);
      throw new Error(errorData.message || 'Failed to merge audio');
    }

    const data = await response.json();
    devLog('Merge API response:', data);
    
    // Enhanced error checking for missing URL
    if (!data.uploadedAudioUrl && !data.mergedAudioUrl) {
      devLog('Missing audio URLs in response:', data);
      // Instead of throwing an error, try to recover
      if (data.audioId) {
        // If we at least have an audioId, construct a likely URL
        const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
        data.uploadedAudioUrl = `${serverUrl}/audio/merged-${data.audioId}.wav`;
        devLog('Constructed fallback URL:', data.uploadedAudioUrl);
      } else {
        throw new Error('No audio URL or ID returned from merge API');
      }
    }

    if (setMergeProgress) setMergeProgress(100);

    const finalAudioUrl = data.uploadedAudioUrl || data.mergedAudioUrl;
    devLog(`Merged audio URL:`, finalAudioUrl);

    // Store result for return
    result = { 
      mergedAudioUrl: finalAudioUrl, 
      uploadedAudioUrl: data.uploadedAudioUrl,
      audioId: data.audioId 
    };

    sessionActions.setMergedAudio(finalAudioUrl);
    setIsAudioMerged(true);

    // Add to file history if metadataEntry is provided
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
        template: 'merged',
      };
      addHistoryEntry(historyEntry);
    }

    // Auto-save to history if enabled
    if (autoSave && finalAudioUrl && addHistoryEntry) {
      devLog('Auto-saving to file history:', finalAudioUrl);
      devLog('Using config for auto-save:', config);

      if (setUploadProgress) {
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 5;
          if (progress >= 100) {
            clearInterval(progressInterval);
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
              audioUrl: finalAudioUrl,
              title: customTitle,
              config,
            });
            devLog('Added to file history:', finalAudioUrl);
          } catch (error) {
            devError('Error adding to file history:', error);
          }
        }, 1000);
      } else {
        addHistoryEntry({
          id: data.audioId || uuidv4(),
          date: new Date().toISOString(),
          template: 'merged',
          audioUrl: finalAudioUrl,
          title: customTitle,
          config,
        });
      }
    }

    return result; // Return object with mergedAudioUrl and other info
  } catch (error) {
    devError('Merging failed:', error);
    sessionActions.setError(`Merging failed: ${error.message}`);
    if (setUploadProgress) setUploadProgress(0);
    if (setIsSaving) setIsSaving(false);
    if (setMergeProgress) setMergeProgress(0);
    
    // Create and return a fallback result with error information
    // This prevents undefined returns that cause issues in the UI
    return {
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    };
  } finally {
    devLog('mergeAllAudio finished');
    setIsMerging(false);
    sessionActions.setProcessing(false);
    
    // Final safeguard - if somehow result is still null, return an empty object
    if (result === null) {
      return { 
        success: false, 
        error: 'Unknown error during merge process',
        timestamp: new Date().toISOString()
      };
    }
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
    filename = sanitizedTitle.endsWith('wav') ? sanitizedTitle : `${sanitizedTitle}.wav`;
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

/**
 * Validates a data URL to ensure it's complete and properly formatted
 * @param {string} url - The URL to validate
 * @returns {boolean} Whether the URL is valid and complete
 */
const isValidDataUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's a data URL
  if (!url.startsWith('data:')) return false;
  
  // Split the URL to get the data part
  const parts = url.split(',');
  if (parts.length !== 2) return false;
  
  const [header, base64Data] = parts;
  
  // Check if the header is valid
  if (!header.includes(';base64')) return false;
  
  // Check if the base64 data is valid
  // Base64 data should have a length that's a multiple of 4
  // or end with padding characters (=)
  return base64Data && (
    base64Data.length % 4 === 0 || 
    base64Data.endsWith('=') || 
    base64Data.endsWith('==')
  );
};

async function blobToDataURL(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert blob URL to data URL:", error);
    throw error;
  }
}

export { generateAllAudio, mergeAllAudio, downloadAudio, getCredentials, devLog, isValidDataUrl };