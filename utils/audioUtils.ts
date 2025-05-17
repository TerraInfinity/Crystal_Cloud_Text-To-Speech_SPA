import { devLog, devError, devWarn } from './logUtils';

/**
 * Validates an audio URL to ensure it's in a proper format
 * @param url - The URL to validate
 * @returns Whether the URL is valid
 */
export const isValidAudioUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Merges multiple audio files into a single file
 * @param audioUrls - Array of audio URLs to merge
 * @param serverUrl - Base URL of the server
 * @returns Promise resolving to the merged audio URL or null if failed
 */
export const mergeAudioFiles = async (audioUrls: string[], serverUrl: string = 'http://localhost:5000'): Promise<string | null> => {
  if (!audioUrls || audioUrls.length === 0) {
    devWarn('No audio URLs provided for merging');
    return null;
  }

  try {
    // Filter and validate URLs
    const validUrls = audioUrls.filter(url => url && isValidAudioUrl(url));
    if (validUrls.length === 0) {
      devWarn('No valid audio URLs for merging');
      return null;
    }

    devLog('Merging audio files:', validUrls.map(url => 
      url.startsWith('data:') ? `${url.substring(0, 30)}... (data URL)` : url));
    
    // Log the types of URLs we're merging
    const blobUrls = validUrls.filter(url => url.startsWith('blob:'));
    const dataUrls = validUrls.filter(url => url.startsWith('data:'));
    const httpUrls = validUrls.filter(url => url.startsWith('http'));
    devLog(`URL types: ${blobUrls.length} blob URLs, ${dataUrls.length} data URLs, ${httpUrls.length} HTTP URLs`);

    // Define a type for our audio blob item
    type AudioBlobItem = { blob: Blob; type: string } | null;

    // For blob/data URLs, convert to blobs
    const audioBlobs = await Promise.all(
      validUrls.map(async (url, index): Promise<AudioBlobItem> => {
        try {
          devLog(`Fetching audio from URL ${index + 1}/${validUrls.length}: ${url.startsWith('data:') ? 'data:URL' : url}`);
          
          let blob: Blob;
          if (url.startsWith('blob:')) {
            // Special handling for blob URLs
            try {
              // For blob URLs, we need to try a different approach
              const response = await fetch(url, { 
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin'
              });
              
              if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
              }
              
              blob = await response.blob();
              devLog(`Successfully fetched blob URL audio ${index + 1}/${validUrls.length} (${blob.type}, ${blob.size} bytes)`);
              
              // If the blob doesn't have a type, try to detect it
              if (!blob.type || blob.type === '') {
                // Default to wav if we can't detect the type
                const blobWithType = blob.slice(0, blob.size, 'audio/wav');
                return { blob: blobWithType, type: 'audio/wav' };
              }
              
              return { blob, type: blob.type };
            } catch (blobError) {
              devWarn(`Error with direct fetch of blob URL, trying XHR: ${blobError.message}`);
              
              // If fetch fails, try using XMLHttpRequest as a fallback for blob URLs
              return new Promise<AudioBlobItem>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.responseType = 'blob';
                xhr.onload = () => {
                  if (xhr.status === 200) {
                    const xhrBlob = xhr.response as Blob;
                    devLog(`Successfully fetched blob URL with XHR (${xhrBlob.type}, ${xhrBlob.size} bytes)`);
                    
                    // If the blob doesn't have a type, try to detect it
                    if (!xhrBlob.type || xhrBlob.type === '') {
                      // Default to wav if we can't detect the type
                      const blobWithType = xhrBlob.slice(0, xhrBlob.size, 'audio/wav');
                      resolve({ blob: blobWithType, type: 'audio/wav' });
                    } else {
                      resolve({ blob: xhrBlob, type: xhrBlob.type });
                    }
                  } else {
                    devError(`XHR failed for blob URL: ${xhr.statusText}`);
                    resolve(null);
                  }
                };
                xhr.onerror = () => {
                  devError('XHR error for blob URL');
                  resolve(null);
                };
                xhr.send();
              });
            }
          } else {
            // Standard handling for data URLs and http URLs
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch audio: ${response.statusText}`);
            }
            blob = await response.blob();
            devLog(`Successfully fetched audio ${index + 1}/${validUrls.length} (${blob.type}, ${blob.size} bytes)`);
            return { blob, type: blob.type || 'audio/wav' };
          }
        } catch (error) {
          devError(`Error fetching audio from URL ${index + 1}/${validUrls.length}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls
    const validBlobs = audioBlobs.filter((item): item is { blob: Blob; type: string } => item !== null);
    if (validBlobs.length === 0) {
      devWarn('Could not fetch any valid audio files');
      return null;
    }

    devLog(`Successfully fetched ${validBlobs.length}/${validUrls.length} audio files`);

    // Create FormData to send to server
    const formData = new FormData();
    validBlobs.forEach((item, index) => {
      const { blob, type } = item;
      // Use the correct file extension based on the MIME type
      let extension = 'wav';
      if (type.includes('mp3')) extension = 'mp3';
      else if (type.includes('mpeg')) extension = 'mp3';
      else if (type.includes('ogg')) extension = 'ogg';
      else if (type.includes('aac')) extension = 'aac';
      
      formData.append('audioFiles', blob, `audio-${index}.${extension}`);
    });

    // Send to server endpoint
    devLog(`Sending ${validBlobs.length} audio files to server for merging`);
    const response = await fetch(`${serverUrl}/api/merge-audio`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Merge request failed (${response.status}): ${errorText || response.statusText}`);
    }

    const result = await response.json();
    if (!result.audioUrl) {
      throw new Error('No audioUrl returned from server');
    }
    
    const mergedUrl = result.audioUrl.startsWith('http')
      ? result.audioUrl
      : `${serverUrl}${result.audioUrl.startsWith('/') ? '' : '/'}${result.audioUrl}`;

    devLog('Merged audio URL:', mergedUrl);
    return mergedUrl;
  } catch (error) {
    devError('Error merging audio files:', error);
    return null;
  }
};

/**
 * Client-side alternative for merging audio using Web Audio API 
 * (fallback if server endpoint is unavailable)
 */
export const mergeAudioClientSide = async (audioUrls: string[]): Promise<string | null> => {
  if (!audioUrls || audioUrls.length === 0) {
    devWarn('No audio URLs provided for client-side merging');
    return null;
  }
  
  try {
    // Filter and validate URLs
    const validUrls = audioUrls.filter(url => url && isValidAudioUrl(url));
    if (validUrls.length === 0) {
      devWarn('No valid audio URLs for client-side merging');
      return null;
    }

    devLog('Client-side merging of audio files:', validUrls.map(url => 
      url.startsWith('data:') ? `${url.substring(0, 30)}... (data URL)` : url));
    
    // Log the types of URLs we're merging
    const blobUrls = validUrls.filter(url => url.startsWith('blob:'));
    const dataUrls = validUrls.filter(url => url.startsWith('data:'));
    const httpUrls = validUrls.filter(url => url.startsWith('http'));
    devLog(`URL types for client-side merging: ${blobUrls.length} blob URLs, ${dataUrls.length} data URLs, ${httpUrls.length} HTTP URLs`);
    
    // Create an audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Fetch audio data
    const audioBuffers = await Promise.all(
      validUrls.map(async (url, index) => {
        try {
          devLog(`Fetching audio ${index + 1}/${validUrls.length} for client-side merging`);
          
          if (url.startsWith('blob:')) {
            try {
              // Special handling for blob URLs
              const response = await fetch(url, { 
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin'
              });
              
              if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              try {
                const buffer = await audioContext.decodeAudioData(arrayBuffer);
                devLog(`Successfully decoded blob URL audio ${index + 1}/${validUrls.length} (${buffer.duration.toFixed(2)}s, ${buffer.numberOfChannels} channels)`);
                return buffer;
              } catch (decodeError) {
                devError(`Error decoding blob URL audio ${index + 1}/${validUrls.length}:`, decodeError);
                return null;
              }
            } catch (blobError) {
              devWarn(`Error with direct fetch of blob URL for client-side merging, trying XHR: ${blobError.message}`);
              
              // If fetch fails, try using XMLHttpRequest as a fallback for blob URLs
              return new Promise<AudioBuffer | null>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.responseType = 'arraybuffer';
                xhr.onload = async () => {
                  if (xhr.status === 200) {
                    try {
                      const buffer = await audioContext.decodeAudioData(xhr.response);
                      devLog(`Successfully decoded blob URL with XHR (${buffer.duration.toFixed(2)}s, ${buffer.numberOfChannels} channels)`);
                      resolve(buffer);
                    } catch (decodeError) {
                      devError(`Error decoding blob URL audio from XHR:`, decodeError);
                      resolve(null);
                    }
                  } else {
                    devError(`XHR failed for blob URL: ${xhr.statusText}`);
                    resolve(null);
                  }
                };
                xhr.onerror = () => {
                  devError('XHR error for blob URL');
                  resolve(null);
                };
                xhr.send();
              });
            }
          } else {
            // Standard handling for data URLs and http URLs
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch audio: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            try {
              const buffer = await audioContext.decodeAudioData(arrayBuffer);
              devLog(`Successfully decoded audio ${index + 1}/${validUrls.length} (${buffer.duration.toFixed(2)}s, ${buffer.numberOfChannels} channels)`);
              return buffer;
            } catch (decodeError) {
              devError(`Error decoding audio ${index + 1}/${validUrls.length}:`, decodeError);
              return null;
            }
          }
        } catch (error) {
          devError(`Error processing audio ${index + 1}/${validUrls.length}:`, error);
          return null;
        }
      })
    );
    
    // Filter out nulls
    const validBuffers = audioBuffers.filter((buffer): buffer is AudioBuffer => buffer !== null);
    if (validBuffers.length === 0) {
      devWarn('Could not fetch any valid audio buffers');
      return null;
    }
    
    devLog(`Successfully loaded ${validBuffers.length}/${validUrls.length} audio buffers for client-side merging`);
    
    // Calculate total duration
    let totalDuration = 0;
    validBuffers.forEach(buffer => {
      totalDuration += buffer.duration;
    });
    
    // Create a buffer for the merged audio
    const mergedBuffer = audioContext.createBuffer(
      validBuffers[0].numberOfChannels,
      audioContext.sampleRate * totalDuration,
      audioContext.sampleRate
    );
    
    // Merge buffers
    let offset = 0;
    for (const buffer of validBuffers) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        mergedBuffer.copyToChannel(channelData, channel, Math.floor(offset * audioContext.sampleRate));
      }
      offset += buffer.duration;
    }
    
    devLog(`Created merged buffer (${totalDuration.toFixed(2)}s, ${validBuffers[0].numberOfChannels} channels)`);
    
    // Convert to WAV file
    const mergedSource = audioContext.createBufferSource();
    mergedSource.buffer = mergedBuffer;
    
    // Create a MediaStreamDestination to get audio data
    const dest = audioContext.createMediaStreamDestination();
    mergedSource.connect(dest);
    mergedSource.start(0);
    
    // Record the stream
    const recorder = new MediaRecorder(dest.stream);
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };
    
    const recorderPromise = new Promise<string>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        resolve(url);
      };
    });
    
    recorder.start();
    
    // Stop recording after the expected duration
    setTimeout(() => {
      recorder.stop();
      mergedSource.stop();
      devLog('Client-side audio merging completed');
    }, totalDuration * 1000 + 100); // Adding a small buffer
    
    const blobUrl = await recorderPromise;
    devLog('Client-side merged audio URL:', blobUrl);
    return blobUrl;
  } catch (error) {
    devError('Error in client-side audio merging:', error);
    return null;
  }
}; 