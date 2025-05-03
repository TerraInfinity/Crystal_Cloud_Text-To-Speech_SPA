# Crystal Cloud Text-To-Speech Services Documentation

This document provides comprehensive documentation for the service layer of the Crystal Cloud Text-To-Speech application. Each service is implemented as a singleton that handles specific functionality of the application.

## Table of Contents

1. [Speech Service](#speech-service)
2. [Storage Service](#storage-service)
3. [Audio Processing Service](#audio-processing-service)
4. [AI Service](#ai-service)

## Speech Service API

The Speech Service API (`speechServiceAPI.jsx`) handles text-to-speech conversion using various engines and provides voice management capabilities.

### Core Methods

#### `normalizeAudioResponse(data)`

Normalizes audio response data to a standard format.

- **Parameters**:
  - `data` (Object): The response data from TTS API
- **Returns**: Object with format `{ url, duration, sampleRate }`
- **Throws**: Error if invalid audio response format is provided

#### `convert_text_to_speech_and_upload(text, engine, options)`

Converts text to speech using the specified engine and returns audio details.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `engine` (string): TTS engine ('gtts', 'awsPolly', 'elevenLabs', 'googleCloud', 'azureTTS', 'ibmWatson')
  - `options` (Object, optional): Options for speech synthesis including:
    - `voice` (Object): Voice object from activeVoices
    - `activeVoices` (Array): List of active voices for validation
    - `language` (string): Language code (default: 'en-US')
    - `apiKey` (string): API key for engines requiring authentication
    - `accessKey` (string): AWS access key (for awsPolly)
    - `secretKey` (string): AWS secret key (for awsPolly)
- **Returns**: Promise resolving to `{ url, duration, sampleRate }`
- **Throws**: Error if engine is unsupported or request fails

#### `generate_audio_segments(script)`

Generates audio segments from a script, orchestrating TTS, pauses, and sound effects.

- **Parameters**:
  - `script` (Array): Array of script items defining the audio sequence
    - `type` (string): Type of segment ('speech', 'pause', or 'sound')
    - `text` (string, for 'speech'): Text to convert
    - `engine` (string, for 'speech'): Engine to use
    - `options` (Object, for 'speech'): Options including activeVoices
    - `duration` (number, for 'pause'/'sound'): Duration in seconds
    - `url` (string, for 'sound'): Audio URL
- **Returns**: Promise resolving to an array of audio segments
- **Throws**: Error if an unsupported script item type is encountered

### Engine-Specific Methods

#### `gTTSTTS(text, options)`

Converts text to speech using gTTS via a Python server endpoint.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object, optional):
    - `voice` (Object): Voice object from activeVoices
    - `activeVoices` (Array): List of active voices for validation
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if API request fails or voice is invalid

#### `elevenLabsTTS(text, options)`

Converts text to speech using ElevenLabs API.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object):
    - `apiKey` (string): ElevenLabs API key (required)
    - `voice` (Object, optional): Voice object (default: { id: '21m00Tcm4TlvDq8ikWAM' })
    - `activeVoices` (Array, optional): List of active voices for validation
    - `stability` (number, optional): Stability setting (0-1, default: 0.75)
    - `similarity_boost` (number, optional): Similarity boost (0-1, default: 0.75)
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if API key is missing or request fails

#### `awsPollyTTS(text, options)`

Converts text to speech using AWS Polly via an API endpoint.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object):
    - `accessKey` (string): AWS access key (required)
    - `secretKey` (string): AWS secret key (required)
    - `voice` (Object, optional): Voice object (default: { id: 'Joanna' })
    - `activeVoices` (Array, optional): List of active voices for validation
    - `language` (string, optional): Language code (default: 'en-US')
    - `outputFormat` (string, optional): Audio output format (default: 'mp3')
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if credentials are missing or request fails

#### `googleCloudTTS(text, options)`

Converts text to speech using Google Cloud Text-to-Speech via an API endpoint.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object, optional):
    - `apiKey` (string, optional): Google Cloud API key
    - `voice` (Object, optional): Voice object (default: { id: 'en-US-Wavenet-D' })
    - `activeVoices` (Array, optional): List of active voices for validation
    - `language` (string, optional): Language code (default: 'en-US')
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if request fails

#### `azureTTS(text, options)`

Converts text to speech using Microsoft Azure Cognitive Services TTS via an API endpoint.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object, optional):
    - `apiKey` (string, optional): Azure API key
    - `voice` (Object, optional): Voice object (default: { id: 'en-US-JennyNeural' })
    - `activeVoices` (Array, optional): List of active voices for validation
    - `language` (string, optional): Language code (default: 'en-US')
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if request fails

#### `ibmWatsonTTS(text, options)`

Converts text to speech using IBM Watson TTS via an API endpoint.

- **Parameters**:
  - `text` (string): The text to convert to speech
  - `options` (Object, optional):
    - `apiKey` (string, optional): IBM Watson API key
    - `voice` (Object, optional): Voice object (default: { id: 'en-US_AllisonV3Voice' })
    - `activeVoices` (Array, optional): List of active voices for validation
    - `language` (string, optional): Language code (default: 'en-US')
- **Returns**: Promise resolving to normalized audio response
- **Throws**: Error if request fails

### Voice Management Methods

#### `getAvailableVoices(engine, options)`

Gets available voices for a specified speech engine, prioritizing activeVoices from TTSContext.

- **Parameters**:
  - `engine` (string): Speech engine ('gTTS', 'elevenLabs', 'awsPolly', 'googleCloud', 'azureTTS', 'ibmWatson')
  - `options` (Object, optional):
    - `activeVoices` (Array, optional): List of active voices from TTSContext
    - `apiKey` (string, optional): API key for engines requiring authentication
- **Returns**: Promise resolving to an array of available voices
- **Throws**: Error if API request fails for dynamic fetching

## Storage Service API

The Storage Service API (`storageServiceAPI.js`) handles data persistence using localStorage, IndexedDB, and cloud storage providers like Amazon S3.

### Local Storage Methods

#### `saveSettings(settings)`

Saves settings to localStorage.

- **Parameters**:
  - `settings` (Object): Settings object to save
- **Returns**: Boolean indicating success or failure

#### `loadSettings()`

Loads settings from localStorage.

- **Returns**: Object containing settings or null if not found

#### `saveTemplate(templateName, templateData)`

Saves a template to localStorage.

- **Parameters**:
  - `templateName` (string): Unique name of the template
  - `templateData` (Object): Template data to save
- **Returns**: Boolean indicating success or failure

#### `loadTemplates()`

Loads all templates from localStorage.

- **Returns**: Object containing all templates or null if not found

#### `loadTemplate(templateName)`

Loads a specific template from localStorage.

- **Parameters**:
  - `templateName` (string): Name of the template to load
- **Returns**: Object containing template data or null if not found

#### `deleteTemplate(templateName)`

Deletes a template from localStorage.

- **Parameters**:
  - `templateName` (string): Name of the template to delete
- **Returns**: Boolean indicating success or failure

#### `saveSection(sectionId, sectionData)`

Saves section to localStorage for auto-recovery.

- **Parameters**:
  - `sectionId` (string): Unique ID of the section
  - `sectionData` (Object): Section data to save
- **Returns**: Boolean indicating success or failure

#### `loadSections()`

Loads all sections from localStorage.

- **Returns**: Object containing all sections or null if not found

#### `saveApiKeys(keys)`

Saves API keys securely (basic encoding, not true encryption).

- **Parameters**:
  - `keys` (Object): API keys object to save
- **Returns**: Boolean indicating success or failure

#### `loadApiKeys()`

Loads API keys from localStorage.

- **Returns**: Object containing API keys or null if not found

#### `clearAllData()`

Clears all stored data from localStorage and IndexedDB.

- **Returns**: Boolean indicating success or failure

### IndexedDB Methods

#### `saveAudio(audioId, audioBlob)`

Saves audio to IndexedDB for offline use.

- **Parameters**:
  - `audioId` (string): Unique ID for the audio
  - `audioBlob` (Blob): Audio data as a Blob
- **Returns**: Promise resolving to boolean indicating success

#### `loadAudio(audioId)`

Loads audio from IndexedDB.

- **Parameters**:
  - `audioId` (string): ID of the audio to load
- **Returns**: Promise resolving to audio Blob or null if not found

#### `deleteAudio(audioId)`

Deletes audio from IndexedDB.

- **Parameters**:
  - `audioId` (string): ID of the audio to delete
- **Returns**: Promise resolving to boolean indicating success

### Cloud Storage Methods (Amazon S3)

#### `upload_file_to_s3(file, bucket, key)`

Uploads a file to Amazon S3.

- **Parameters**:
  - `file` (File|Blob): File or Blob to upload
  - `bucket` (string): S3 bucket name
  - `key` (string): S3 object key (path)
- **Returns**: Promise resolving to the S3 URL of the uploaded file
- **Throws**: Error on upload failure

#### `write_data_to_s3(data, bucket, key)`

Writes data (string or JSON) to Amazon S3.

- **Parameters**:
  - `data` (string|Object): Data to write (string or object to be JSON-stringified)
  - `bucket` (string): S3 bucket name
  - `key` (string): S3 object key (path)
- **Returns**: Promise resolving to the S3 URL of the written data
- **Throws**: Error on write failure or unsupported data type

#### `download_audio_files_from_s3(bucket, keys)`

Downloads audio files from Amazon S3.

- **Parameters**:
  - `bucket` (string): S3 bucket name
  - `keys` (string[]): Array of S3 object keys to download
- **Returns**: Promise resolving to an array of audio Blobs
- **Throws**: Error on download failure

#### `create_presigned_s3_url(bucket, key, expires)`

Creates a presigned URL for an Amazon S3 object.

- **Parameters**:
  - `bucket` (string): S3 bucket name
  - `key` (string): S3 object key (path)
  - `expires` (number, optional): URL expiration time in seconds (default: 3600)
- **Returns**: Promise resolving to the presigned URL
- **Throws**: Error on URL creation failure

#### `configureProvider(providerConfig)`

Configures the storage provider for future extensibility.

- **Parameters**:
  - `providerConfig` (Object): Configuration object (e.g., { audio: 's3', settings: 'googledrive' })


## AI Service

The AI Service (`aiService.js`) handles text transformation using various AI providers like OpenAI and Anthropic.

#### `transformWithOpenAI(text, prompt, apiKey)`

Transforms text using OpenAI (ChatGPT).

- **Parameters**:
  - `text` (string): Text to transform
  - `prompt` (string): Instruction prompt for the AI
  - `apiKey` (string): OpenAI API key
- **Returns**: Promise resolving to transformed text
- **Throws**: Error if API key is missing or request fails

#### `transformWithAnthropic(text, prompt, apiKey)`

Transforms text using Anthropic (Claude).

- **Parameters**:
  - `text` (string): Text to transform
  - `prompt` (string): Instruction prompt for the AI
  - `apiKey` (string): Anthropic API key
- **Returns**: Promise resolving to transformed text
- **Throws**: Error if API key is missing or request fails

#### `extractSections(text, preset, provider, options)`

Extracts sections from text based on presets.

- **Parameters**:
  - `text` (string): Text to process
  - `preset` (string): Preset type ('yoga', 'general', etc.)
  - `provider` (string): AI provider to use ('openai', 'anthropic')
  - `options` (Object, optional): Additional options (apiKeys, etc.)
- **Returns**: Promise resolving to extracted sections as an object
- **Throws**: Error if provider is unsupported

#### `simplifyText(text, provider, options)`

Simplifies text for easier understanding.

- **Parameters**:
  - `text` (string): Text to simplify
  - `provider` (string): AI provider to use ('openai', 'anthropic')
  - `options` (Object, optional): Additional options (apiKeys, etc.)
- **Returns**: Promise resolving to simplified text
- **Throws**: Error if provider is unsupported

#### `formatForSpeech(text, provider, options)`

Formats text for optimal speech synthesis.

- **Parameters**:
  - `text` (string): Text to format
  - `provider` (string): AI provider to use ('openai', 'anthropic')
  - `options` (Object, optional): Additional options (apiKeys, etc.)
- **Returns**: Promise resolving to formatted text
- **Throws**: Error if provider is unsupported

#### `processWithCustomPrompt(text, customPrompt, provider, options)`

Processes text with a custom prompt.

- **Parameters**:
  - `text` (string): Text to process
  - `customPrompt` (string): Custom instruction prompt
  - `provider` (string): AI provider to use ('openai', 'anthropic')
  - `options` (Object, optional): Additional options (apiKeys, etc.)
- **Returns**: Promise resolving to processed text
- **Throws**: Error if provider is unsupported
