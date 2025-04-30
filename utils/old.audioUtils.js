/**
 * audioUtils.js
 * Convert a text to speech using the Web Speech API
 * @param {string} text - Text to convert to speech
 * @param {Object} voiceOptions - Voice options
 * @returns {Promise<Blob>} - Promise resolving to audio blob
 */
export function textToSpeechWebAPI(text, voiceOptions = {}) {
    return new Promise((resolve, reject) => {
        // Check if the Web Speech API is supported
        if (!window.speechSynthesis) {
            reject(new Error('Web Speech API is not supported in this browser.'));
            return;
        }

        // Create speech synthesis utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Set utterance properties if provided
        if (voiceOptions.voice) {
            // Find the requested voice
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.name === voiceOptions.voice || v.voiceURI === voiceOptions.voice);
            if (voice) {
                utterance.voice = voice;
            }
        }

        if (voiceOptions.rate) utterance.rate = voiceOptions.rate;
        if (voiceOptions.pitch) utterance.pitch = voiceOptions.pitch;
        if (voiceOptions.volume) utterance.volume = voiceOptions.volume;
        if (voiceOptions.lang) utterance.lang = voiceOptions.lang;

        // Set up MediaRecorder to capture audio output
        const audioChunks = [];
        const audioContext = new(window.AudioContext || window.webkitAudioContext)();
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            resolve(audioBlob);
        };

        mediaRecorder.start();

        // Start speech synthesis
        speechSynthesis.speak(utterance);

        // Handle completion
        utterance.onend = () => {
            mediaRecorder.stop();
            speechSynthesis.cancel(); // Clear the queue
        };

        // Handle errors
        utterance.onerror = (event) => {
            mediaRecorder.stop();
            speechSynthesis.cancel(); // Clear the queue
            reject(new Error(`Speech synthesis error: ${event.error}`));
        };
    });
}

/**
 * Convert audio blob to base64 data URL
 * @param {Blob} audioBlob - Audio blob to convert
 * @returns {Promise<string>} - Promise resolving to base64 data URL
 */
export function blobToDataURL(audioBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });
}

/**
 * Merge multiple audio files into a single audio file
 * @param {string[]} audioUrls - Array of audio URLs to merge
 * @returns {Promise<string>} - Promise resolving to merged audio URL
 */
export async function mergeAudioFiles(audioUrls) {
    // Create audio context
    const audioContext = new(window.AudioContext || window.webkitAudioContext)();
    const audioBuffers = [];

    // Load all audio files
    for (const url of audioUrls) {
        // Fetch the audio data
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
    }

    // Calculate total duration
    const totalDuration = audioBuffers.reduce((acc, buffer) => acc + buffer.duration, 0);

    // Create a buffer for the merged audio
    const mergedBuffer = audioContext.createBuffer(
        1, // Mono
        audioContext.sampleRate * totalDuration,
        audioContext.sampleRate
    );

    // Merge the audio buffers
    let offset = 0;
    for (const buffer of audioBuffers) {
        const channelData = buffer.getChannelData(0);
        mergedBuffer.getChannelData(0).set(channelData, offset);
        offset += buffer.length;
    }

    // Convert to WAV
    const wavBuffer = bufferToWav(mergedBuffer);

    // Create object URL
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

/**
 * Convert AudioBuffer to WAV format
 * @param {AudioBuffer} buffer - Audio buffer to convert
 * @returns {ArrayBuffer} - WAV file as ArrayBuffer
 */
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;

    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }

    return wavBuffer;
}

/**
 * Write string to DataView
 * @param {DataView} view - DataView to write to
 * @param {number} offset - Offset to write at
 * @param {string} string - String to write
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}