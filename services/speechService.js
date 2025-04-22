/**
 * Speech service to handle different text-to-speech engines
 */
class SpeechService {
  /**
   * Convert text to speech using Web Speech API
   * @param {string} text - Text to convert
   * @param {Object} options - Options for speech synthesis
   * @returns {Promise<string>} - Promise resolving to audio URL
   */
  async webSpeechTTS(text, options = {}) {
    // This method needs to run in the browser
    if (typeof window === 'undefined') {
      throw new Error('Web Speech API can only be used in the browser');
    }
    
    if (!window.speechSynthesis) {
      throw new Error('Web Speech API not supported in this browser');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set options
        if (options.voice) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => 
            v.name === options.voice || 
            v.voiceURI === options.voice
          );
          if (voice) {
            utterance.voice = voice;
          }
        }
        
        if (options.rate) utterance.rate = options.rate;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.volume) utterance.volume = options.volume;
        if (options.lang) utterance.lang = options.lang;
        
        // Create audio context and recorder
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioDestination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(audioDestination.stream, {
          mimeType: 'audio/webm'
        });
        
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          resolve(audioUrl);
        };
        
        mediaRecorder.start();
        
        // Create an oscillator node to capture the speech
        const oscillator = audioContext.createOscillator();
        oscillator.connect(audioDestination);
        oscillator.start();
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
        
        utterance.onend = () => {
          oscillator.stop();
          mediaRecorder.stop();
          window.speechSynthesis.cancel();
        };
        
        utterance.onerror = (event) => {
          oscillator.stop();
          mediaRecorder.stop();
          window.speechSynthesis.cancel();
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          resolve(audioUrl);
        };
        
        mediaRecorder.start();
        
        // Speak and handle completion
        window.speechSynthesis.speak(utterance);
        
        utterance.onend = () => {
          mediaRecorder.stop();
          window.speechSynthesis.cancel(); // Clear the queue
        };
        
        utterance.onerror = (event) => {
          mediaRecorder.stop();
          window.speechSynthesis.cancel(); // Clear the queue
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Convert text to speech using ElevenLabs API
   * @param {string} text - Text to convert
   * @param {Object} options - Options for speech synthesis
   * @returns {Promise<string>} - Promise resolving to audio URL
   */
  async elevenLabsTTS(text, options = {}) {
    const apiKey = options.apiKey;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    
    // Default voice ID if not specified
    const voiceId = options.voice || '21m00Tcm4TlvDq8ikWAM'; // Rachel (default)
    
    try {
      // Make request to ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: options.stability || 0.75,
            similarity_boost: options.similarity_boost || 0.75
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || `ElevenLabs API error: ${response.statusText}`);
      }
      
      // Get audio data
      const audioBuffer = await response.arrayBuffer();
      
      // Convert to blob and create URL
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Convert text to speech using AWS Polly
   * @param {string} text - Text to convert
   * @param {Object} options - Options for speech synthesis
   * @returns {Promise<string>} - Promise resolving to audio URL
   */
  async awsPollyTTS(text, options = {}) {
    const accessKey = options.accessKey;
    const secretKey = options.secretKey;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials are required');
    }
    
    try {
      // Since we can't directly use the AWS SDK without installing it,
      // we'll use the API route to handle AWS Polly requests
      const response = await fetch('/api/textToSpeech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-aws-access-key': accessKey,
          'x-aws-secret-key': secretKey
        },
        body: JSON.stringify({
          text,
          engine: 'awsPolly',
          voice: options.voice || 'Joanna',
          language: options.language || 'en-US',
          outputFormat: options.outputFormat || 'mp3'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `AWS Polly error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.audioUrl;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get available voices for a given speech engine
   * @param {string} engine - Speech engine ('webSpeech', 'elevenLabs', 'awsPolly')
   * @param {Object} options - Options for getting voices
   * @returns {Promise<Array>} - Promise resolving to array of available voices
   */
  async getAvailableVoices(engine, options = {}) {
    switch (engine) {
      case 'webSpeech':
        // Web Speech API voices
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          return [];
        }
        
        return new Promise((resolve) => {
          let voices = window.speechSynthesis.getVoices();
          
          if (voices.length) {
            resolve(voices);
          } else {
            // Wait for voices to be loaded
            window.speechSynthesis.onvoiceschanged = () => {
              voices = window.speechSynthesis.getVoices();
              resolve(voices);
            };
          }
        });
        
      case 'elevenLabs':
        // ElevenLabs voices
        try {
          const apiKey = options.apiKey;
          
          if (!apiKey) {
            throw new Error('ElevenLabs API key is required');
          }
          
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
              'xi-api-key': apiKey
            }
          });
          
          if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
          }
          
          const data = await response.json();
          return data.voices || [];
        } catch (error) {
          console.error('Error fetching ElevenLabs voices:', error);
          return [];
        }
        
      case 'awsPolly':
        // AWS Polly voices (hardcoded list for demo)
        return [
          { id: 'Joanna', name: 'Joanna (Female, US English)', language: 'en-US' },
          { id: 'Matthew', name: 'Matthew (Male, US English)', language: 'en-US' },
          { id: 'Nicole', name: 'Nicole (Female, Australian English)', language: 'en-AU' },
          { id: 'Russell', name: 'Russell (Male, Australian English)', language: 'en-AU' },
          { id: 'Amy', name: 'Amy (Female, British English)', language: 'en-GB' },
          { id: 'Brian', name: 'Brian (Male, British English)', language: 'en-GB' },
          { id: 'Aditi', name: 'Aditi (Female, Indian English)', language: 'en-IN' },
          { id: 'Raveena', name: 'Raveena (Female, Indian English)', language: 'en-IN' },
          { id: 'Ivy', name: 'Ivy (Female, US English, Child)', language: 'en-US' },
          { id: 'Justin', name: 'Justin (Male, US English, Child)', language: 'en-US' },
          { id: 'Kendra', name: 'Kendra (Female, US English)', language: 'en-US' },
          { id: 'Kimberly', name: 'Kimberly (Female, US English)', language: 'en-US' },
          { id: 'Salli', name: 'Salli (Female, US English)', language: 'en-US' },
          { id: 'Joey', name: 'Joey (Male, US English)', language: 'en-US' }
        ];
        
      default:
        return [];
    }
  }
}

// Export a singleton instance
export default new SpeechService();
