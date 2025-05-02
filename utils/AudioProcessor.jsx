import speechService from '../services/speechService';

const devLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[AudioProcessor]', ...args);
  }
};

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


const generateAllAudio = async ({
    validSections,
    speechEngine,
    persistentState,
    sessionActions,
    setIsGenerating,
    setIsAudioGenerated,
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
    const failedSections = [];
  
    try {
      const engine = speechEngine;
      devLog('Using engine:', engine);
  
      // Retrieve activeVoices from persistentState and flatten it into an array
      const activeVoices = Object.values(persistentState.settings.activeVoices).flat();
      devLog('Active voices:', activeVoices);
  
      for (const section of validSections) {
        devLog('Processing section:', section);
        console.log('Voice for section:', section.voice); // Debug voice
  
        // Additional validation for voice
        if (!section.voice) {
          console.warn(`[AudioProcessor] Warning: No voice specified for section "${section.title}"`);
        }
  
        try {
          const credentials = getCredentials(engine, persistentState);
          devLog('Credentials for engine:', credentials);
  
          // Pass activeVoices to the speech service along with existing options
          const result = await speechService.convert_text_to_speech_and_upload(
            section.text,
            engine,
            {
              voice: section.voice,           // Selected voice for this section
              language: section.language || 'en-US',
              sampleRate: 44100,
              activeVoices,                   // Include activeVoices for validation and mapping
              ...credentials,
            }
          );
  
          if (!result.url) {
            throw new Error('No URL returned from speech service');
          }
          if (result.url.startsWith('data:')) {
            console.warn(
              `[AudioProcessor] Warning: Data URL generated for section "${section.title}". Expected server URL.`
            );
          } else {
            devLog(
              `[AudioProcessor] Server URL generated for section "${section.title}":`,
              result.url
            );
          }
          devLog('Audio generated for section:', section.id, result);
          sessionActions.setGeneratedAudio(section.id, {
            url: result.url,
            duration: result.duration,
            sampleRate: result.sampleRate,
          });
        } catch (error) {
          devLog(`Error for section "${section.title}":`, error);
          console.error(`Error for section "${section.title}":`, error);
          failedSections.push(section.title);
        }
      }
  
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

  

const mergeAllAudio = async ({
  validSections,
  generatedAudios,
  sessionActions,
  setIsMerging,
  setIsAudioMerged,
}) => {
  devLog('mergeAllAudio called');
  devLog('Generated audios:', generatedAudios);
  devLog('Valid sections:', validSections);

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

  if (audioUrls.some((url) => url.startsWith('data:'))) {
    console.warn(
      '[AudioProcessor] Warning: Sending data URLs to /api/mergeAudio. Server URLs are preferred.'
    );
  }

  setIsMerging(true);
  sessionActions.setProcessing(true);
  try {
    const response = await fetch('/api/mergeAudio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrls }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to merge audio');
    }

    const data = await response.json();
    devLog('Received mergedAudioUrl:', data.mergedAudioUrl);
    sessionActions.setMergedAudio(data.mergedAudioUrl);
    sessionActions.setNotification({
      type: 'success',
      message: 'Audio merged successfully',
    });
    setIsAudioMerged(true);
  } catch (error) {
    devLog('Merging failed:', error);
    sessionActions.setError(`Merging failed: ${error.message}`);
  } finally {
    devLog('mergeAllAudio finished');
    setIsMerging(false);
    sessionActions.setProcessing(false);
  }
};

const downloadAudio = ({ mergedAudio, setIsDownloading, setIsAudioDownloaded }) => {
  devLog('downloadAudio called');
  if (!mergedAudio) {
    devLog('No merged audio to download');
    return;
  }

  setIsDownloading(true);
  const a = document.createElement('a');
  a.href = mergedAudio;
  a.download = 'tts-audio.wav';
  a.click();
  setTimeout(() => {
    setIsDownloading(false);
    setIsAudioDownloaded(true);
  }, 1000);
};

export { generateAllAudio, mergeAllAudio, downloadAudio, getCredentials, devLog };