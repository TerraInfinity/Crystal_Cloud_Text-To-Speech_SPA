# Crystal Cloud Text-To-Speech Utils Documentation

This document provides comprehensive documentation for the utility modules of the Crystal Cloud Text-To-Speech application. Each module provides specific helper functions to support the application's functionality.

## Table of Contents

1. [Audio Processor](#audio-processor)
2. [File Utilities](#file-utilities)
3. [Logging Utilities](#logging-utilities)
4. [Text Utilities](#text-utilities)

## Audio Processor

The Audio Processor (`AudioProcessor.jsx`) handles text-to-speech audio generation, merging, and download operations.

### Core Functions

#### `getCredentials(engine, persistentState)`

Retrieves the credentials needed for a specific TTS engine from the persistent state.

- **Parameters**:
  - `engine` (string): The TTS engine name ('elevenlabs', 'awspolly', 'googlecloud', 'azuretts', 'ibmwatson', or 'gtts')
  - `persistentState` (Object): The application's persistent state containing settings and credentials
- **Returns**: Object formatted with the appropriate credentials for the specified engine

#### `generateAllAudio(options)`

Generates audio for all valid text sections using the specified speech engine.

- **Parameters**:
  - `options` (Object): Configuration options including:
    - `validSections` (Array): Array of valid section objects containing text to convert
    - `speechEngine` (string): TTS engine to use for conversion
    - `persistentState` (Object): Application persistent state with settings and credentials
    - `sessionActions` (Object): Actions for updating session state
    - `setIsGenerating` (Function): State setter for generation in-progress indicator
    - `setIsAudioGenerated` (Function): State setter for generation complete indicator
- **Returns**: Promise\<void\>

#### `mergeAllAudio(options)`

Merges all generated audio files into a single audio file.

- **Parameters**:
  - `options` (Object): Configuration options including:
    - `validSections` (Array): Array of valid section objects
    - `generatedAudios` (Object): Object mapping section IDs to generated audio data
    - `sessionActions` (Object): Actions for updating session state
    - `setIsMerging` (Function): State setter for merging in-progress indicator
    - `setIsAudioMerged` (Function): State setter for merging complete indicator
- **Returns**: Promise\<void\>

#### `downloadAudio(options)`

Initiates a download of the merged audio file.

- **Parameters**:
  - `options` (Object): Configuration options including:
    - `mergedAudio` (string): URL of the merged audio file to download
    - `setIsDownloading` (Function): State setter for download in-progress indicator
    - `setIsAudioDownloaded` (Function): State setter for download complete indicator
- **Returns**: void

## File Utilities

The File Utilities module (`fileUtils.js`) provides functions for file operations including reading, downloading, and validation.

#### `readTextFile(file)`

Read a text file into a string.

- **Parameters**:
  - `file` (File): File object to read
- **Returns**: Promise\<string\> resolving to file contents as a string
- **Throws**: Error if file reading fails

#### `readAudioFile(file)`

Read an audio file into a data URL.

- **Parameters**:
  - `file` (File): File object to read
- **Returns**: Promise\<string\> resolving to audio data URL
- **Throws**: Error if file reading fails

#### `downloadFile(url, filename)`

Download a file from a URL or data URL.

- **Parameters**:
  - `url` (string): URL or data URL of the file to download
  - `filename` (string): Name for the downloaded file

#### `isAudioFile(file)`

Check if a file is an audio file based on its MIME type.

- **Parameters**:
  - `file` (File): File to check
- **Returns**: boolean indicating if the file has an audio MIME type

#### `isTextFile(file)`

Check if a file is a text file based on MIME type or extension.

- **Parameters**:
  - `file` (File): File to check
- **Returns**: boolean indicating if the file is a text file

#### `locate_sound_effect_file(dirPath, extensions)`

Locate sound effect files in a directory.

- **Parameters**:
  - `dirPath` (string): Directory path to search
  - `extensions` (Array\<string\>, optional): Array of allowed sound effect file extensions (default: ['.mp3', '.wav', '.ogg'])
- **Returns**: Promise\<Array\<string\>\> resolving to array of full file paths
- **Throws**: Error if directory reading fails or in client-side environment

#### `delete_temporary_files(dirPath, extensions)`

Delete temporary files in a directory.

- **Parameters**:
  - `dirPath` (string): Directory path to clean
  - `extensions` (Array\<string\>, optional): Array of file extensions to delete (default: ['.tmp', '.temp'])
- **Returns**: Promise\<number\> resolving to number of files deleted
- **Throws**: Error if directory reading/deleting fails or in client-side environment

## Logging Utilities

The Logging Utilities module (`logUtils.js`) provides consistent logging functions that only output in development environments.

#### `devLog(...args)`

Log information messages in development environment.

- **Parameters**:
  - `args` (...any): Arguments to log (will be passed directly to console.log)
- **Example**:
  ```javascript
  devLog('User logged in:', userId);
  ```

#### `devError(...args)`

Log error messages in development environment.

- **Parameters**:
  - `args` (...any): Arguments to log (will be passed directly to console.error)
- **Example**:
  ```javascript
  devError('Failed to fetch data:', error);
  ```

#### `devWarn(...args)`

Log warning messages in development environment.

- **Parameters**:
  - `args` (...any): Arguments to log (will be passed directly to console.warn)
- **Example**:
  ```javascript
  devWarn('Deprecated function used:', functionName);
  ```

## Text Utilities

The Text Utilities module (`textUtils.js`) provides functions for text manipulation and processing.

#### `parseTextFromHtml(html)`

Parse plain text from HTML content.

- **Parameters**:
  - `html` (string): HTML content to parse
- **Returns**: string - Plain text extracted from HTML with whitespace normalized

#### `extractSections(text, sectionMarkers)`

Extract sections from text based on headings or markers.

- **Parameters**:
  - `text` (string): Input text to parse
  - `sectionMarkers` (string[]): Array of section marker strings to look for
- **Returns**: Object with section names as keys and section content as values
- **Example**:
  ```javascript
  // Input: "[Introduction] This is intro. [Conclusion] This is the end."
  // Returns: { Introduction: "This is intro.", Conclusion: "This is the end." }
  ```

#### `processVoiceTags(text)`

Process text for special tags (voice and sound effects).

- **Parameters**:
  - `text` (string): Input text to process
- **Returns**: Object containing:
  - `text` (string): Cleaned text with all tags removed
  - `voiceSettings` (Array): Array of objects with voice settings:
    - `voice` (string): Voice identifier
    - `start` (number): Start position in the cleaned text
    - `end` (number): End position in the cleaned text
- **Example**:
  ```javascript
  // Input: "[voice:male] Hello world"
  // Returns: { text: "Hello world", voiceSettings: [{ voice: "male", start: 0, end: 11 }] }
  ```
