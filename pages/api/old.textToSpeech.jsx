/**
 * @file pages/api/textToSpeech.js
 * @description
 *   API route handler for converting text to speech using different engines.
 *   Supports:
 *     - gTTS (via Python server)
 *     - ElevenLabs API
 *     - AWS Polly
 *     - Google Cloud Text-to-Speech
 *     - Microsoft Azure Cognitive Services TTS
 *     - IBM Watson Text-to-Speech
 *   Accepts POST requests with text, engine, voice, and language parameters, and returns
 *   an audio URL and duration (if available) or an error message.
 */

import AWS from 'aws-sdk';
import textToSpeech from '@google-cloud/text-to-speech';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import TextToSpeechV1 from 'ibm-watson/text-to-speech/v1';
import { IamAuthenticator } from 'ibm-watson/auth';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Readable } from 'stream';

ffmpeg.setFfmpegPath(ffmpegPath);

const devLog = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[textToSpeech API]', ...args);
    }
};

export default async function handler(req, res) {
    devLog('Request received:', req.method, req.body);

    if (req.method !== 'POST') {
        devLog('Invalid method:', req.method);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { text, engine, voice, language = 'en-US' } = req.body;

    if (!text) {
        devLog('No text provided');
        return res.status(400).json({ message: 'Text is required' });
    }

    // Normalize engine name to lowercase for consistency
    const normalizedEngine = engine.toLowerCase();
    devLog('Normalized engine:', normalizedEngine);

    try {
        let audioBuffer;
        let mimeType;
        let duration = 0; // Default duration, can be updated by engines that support it

        if (normalizedEngine === 'gtts') {
            devLog('Using gtts handler');
            ({ audioBuffer, mimeType, duration } = await handleGTTS(text, voice, language));
        } else if (normalizedEngine === 'elevenlabs') {
            devLog('Using ElevenLabs handler');
            const apiKey = process.env.ELEVENLABS_API_KEY || req.headers['x-elevenlabs-api-key'];
            if (!apiKey) {
                devLog('Missing ElevenLabs API key');
                return res.status(400).json({ message: 'ElevenLabs API key is required' });
            }
            ({ audioBuffer, mimeType } = await handleElevenLabs(text, voice, apiKey));
        } else if (normalizedEngine === 'awspolly') {
            devLog('Using AWS Polly handler');
            const accessKey = process.env.AWS_ACCESS_KEY_ID || req.headers['x-aws-access-key'];
            const secretKey = process.env.AWS_SECRET_ACCESS_KEY || req.headers['x-aws-secret-key'];
            const region = process.env.AWS_REGION || req.body.region || 'us-west-1';
            if (!accessKey || !secretKey) {
                devLog('Missing AWS credentials');
                return res.status(400).json({ message: 'AWS credentials are required' });
            }
            ({ audioBuffer, mimeType } = await handleAwsPolly(text, voice, accessKey, secretKey, region));
        } else if (normalizedEngine === 'googlecloud') {
            devLog('Using Google Cloud handler');
            ({ audioBuffer, mimeType } = await handleGoogleCloud(text, voice, language));
        } else if (normalizedEngine === 'azuretts') {
            devLog('Using Azure TTS handler');
            ({ audioBuffer, mimeType } = await handleAzureTTS(text, voice, language));
        } else if (normalizedEngine === 'ibmwatson') {
            devLog('Using IBM Watson handler');
            ({ audioBuffer, mimeType } = await handleIbmWatson(text, voice, language));
        } else {
            devLog('Unsupported engine:', normalizedEngine);
            return res.status(400).json({ message: 'Unsupported speech engine' });
        }

        devLog('Audio buffer received, normalizing audio...');
        // Standardize audio output (normalize sample rate/format)
        const normalizedBuffer = await normalizeAudioBuffer(audioBuffer, mimeType, 44100, 'mp3');
        devLog('Audio normalized, encoding to base64...');
        const base64Audio = Buffer.from(normalizedBuffer).toString('base64');
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        devLog('Returning audioUrl of length:', audioUrl.length);
        return res.status(200).json({ audioUrl, duration });
    } catch (error) {
        // Enhanced error handling
        devLog(`TTS Error [${normalizedEngine}]:`, error);

        // Example: handle common error codes/messages
        if (
            error.code === 'UNAUTHENTICATED' ||
            error.statusCode === 401 ||
            error.message?.toLowerCase().includes('invalid api key') ||
            error.message?.toLowerCase().includes('unauthorized')
        ) {
            return res.status(401).json({ message: 'Invalid API key or credentials' });
        }
        if (
            error.statusCode === 429 ||
            error.message?.toLowerCase().includes('rate limit')
        ) {
            return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
        }
        if (
            error.statusCode === 403 ||
            error.message?.toLowerCase().includes('forbidden')
        ) {
            return res.status(403).json({ message: 'Access forbidden. Check your permissions.' });
        }
        // Add more specific error handling as needed

        // Fallback: generic error
        return res.status(500).json({ message: `Speech generation failed: ${error.message}` });
    }
}

// Handler for gTTS (Python server)
async function handleGTTS(text, voice, language) {
    devLog('handleGTTS called', { text, voice, language });
    const gttsUrl = process.env.GTTS_SERVER_URL || 'http://localhost:5000/gtts';

    const response = await fetch(gttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, language }),
    });

    devLog('gTTS server response status:', response.status);

    if (!response.ok) {
        const error = await response.json();
        devLog('gTTS server error:', error);
        throw new Error(error.message || 'gTTS server error');
    }

    const data = await response.json();
    devLog('gTTS server returned data:', data && Object.keys(data));
    const audioBuffer = Buffer.from(data.audioBase64, 'base64');
    return { audioBuffer, mimeType: 'audio/wav', duration: data.duration || 0 };
}

// Handler for ElevenLabs TTS
async function handleElevenLabs(text, voice, apiKey) {
    devLog('handleElevenLabs called', { text, voice });
    const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
        },
        body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.75,
                similarity_boost: 0.75,
            },
        }),
    });

    devLog('ElevenLabs response status:', response.status);

    if (!response.ok) {
        const error = await response.json();
        devLog('ElevenLabs error:', error);
        throw new Error(error.detail?.message || 'Error calling ElevenLabs API');
    }

    const audioBuffer = await response.arrayBuffer();
    devLog('ElevenLabs audioBuffer length:', audioBuffer.byteLength);
    return { audioBuffer, mimeType: 'audio/wav' };
}

// Handler for AWS Polly TTS
async function handleAwsPolly(text, voice, accessKey, secretKey, region) {
    devLog('handleAwsPolly called', { text, voice, region });
    const polly = new AWS.Polly({
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region, // Now configurable
    });

    const params = {
        OutputFormat: 'mp3',
        Text: text,
        VoiceId: voice || 'Joanna', // Default: Joanna
    };

    const data = await polly.synthesizeSpeech(params).promise();
    devLog('AWS Polly synthesizeSpeech result:', !!data.AudioStream, data.AudioStream && data.AudioStream.length);
    return { audioBuffer: data.AudioStream, mimeType: 'audio/wav' };
}

// Handler for Google Cloud TTS
async function handleGoogleCloud(text, voice, language) {
    devLog('handleGoogleCloud called', { text, voice, language });
    const client = new textToSpeech.TextToSpeechClient();
    const request = {
        input: { text },
        voice: { languageCode: language, name: voice || 'en-US-Wavenet-D' },
        audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);
    devLog('Google Cloud response received');
    return { audioBuffer: response.audioContent, mimeType: 'audio/wav' };
}

// Handler for Azure TTS
async function handleAzureTTS(text, voice, language) {
    devLog('handleAzureTTS called', { text, voice, language });
    const speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SUBSCRIPTION_KEY,
        process.env.AZURE_REGION
    );
    speechConfig.speechSynthesisVoiceName = voice || 'en-US-JennyNeural';
    speechConfig.speechSynthesisLanguage = language;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const result = await new Promise((resolve, reject) => {
        synthesizer.speakTextAsync(
            text,
            (result) => {
                synthesizer.close();
                resolve(result);
            },
            (error) => {
                synthesizer.close();
                reject(error);
            }
        );
    });

    devLog('Azure TTS synthesis result:', result.reason);
    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        devLog('Azure TTS synthesis completed');
        return { audioBuffer: result.audioData, mimeType: 'audio/wav' };
    } else {
        devLog('Azure TTS synthesis failed', result);
        throw new Error('Azure TTS synthesis failed');
    }
}

// Handler for IBM Watson TTS
async function handleIbmWatson(text, voice, language) {
    devLog('handleIbmWatson called', { text, voice, language });
    const textToSpeech = new TextToSpeechV1({
        authenticator: new IamAuthenticator({
            apikey: process.env.IBM_WATSON_API_KEY,
        }),
        serviceUrl: process.env.IBM_WATSON_SERVICE_URL,
    });

    const params = {
        text,
        voice: voice || 'en-US_AllisonV3Voice',
        accept: 'audio/wav',
    };

    const response = await textToSpeech.synthesize(params);
    devLog('IBM Watson response received');
    const audioBuffer = Buffer.from(response.result);
    return { audioBuffer, mimeType: 'audio/wav' };
}

async function normalizeAudioBuffer(inputBuffer, inputMimeType, targetSampleRate = 44100, targetFormat = 'mp3') {
    devLog('normalizeAudioBuffer called', { inputMimeType, targetSampleRate, targetFormat });
    return new Promise((resolve, reject) => {
        const inputStream = new Readable();
        inputStream.push(inputBuffer);
        inputStream.push(null);

        const chunks = [];
        ffmpeg(inputStream)
            .inputFormat(inputMimeType.split('/')[1]) // e.g., 'mp3', 'wav'
            .audioFrequency(targetSampleRate)
            .format(targetFormat)
            .on('data', chunk => chunks.push(chunk))
            .on('end', () => {
                devLog('ffmpeg normalization complete, total chunks:', chunks.length);
                resolve(Buffer.concat(chunks));
            })
            .on('error', (err) => {
                devLog('ffmpeg normalization error:', err);
                reject(err);
            })
            .pipe();
    });
}