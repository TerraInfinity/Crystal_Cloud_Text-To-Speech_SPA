# Python Server Documentation

## Overview

This Python server provides a RESTful API for text-to-speech conversion and audio file management. It consists of the following key components:

1. **Text-to-Speech Engine** (`gtts_server.py`): Converts text to speech using Google's Text-to-Speech (gTTS) API
2. **File Storage System** (`file_storage.py`): Manages audio file uploading, retrieval, and metadata
3. **Database Integration** (`db.ts`): Optional Neon PostgreSQL database connection
4. **HTML Demo Interface** (`templates/index.html`): Simple web interface for testing functionality

## Installation & Setup

### Prerequisites

- Python 3.x
- ffmpeg (must be installed and available in your system PATH)
- Node.js (for TypeScript database integration, optional)

### Installation

1. Install required Python packages:
   ```
   pip install -r requirements.txt
   ```

2. If using database integration, set the `DATABASE_URL` environment variable:
   ```
   export DATABASE_URL=your-neon-database-url
   ```

3. Start the server:
   ```
   python gtts_server.py
   ```

The server will start on http://localhost:5000 by default.

## Core Modules

### gtts_server.py

This is the main server module that initializes the Flask application and handles text-to-speech requests.

#### Key Features

- Converts text to speech using Google's TTS service
- Transforms MP3 output from gTTS to WAV format using ffmpeg
- Returns audio as base64-encoded data
- Supports multiple language voices
- Integrates with file_storage.py for audio management

#### Configuration

- `ADVANCED_LOGGING`: Set to `True` for detailed logs
- `SUPPORTED_VOICES`: Dictionary of supported voice configurations
- `UPLOAD_DIR`: Directory for storing audio files
- `METADATA_FILE`: JSON file for storing audio metadata

### file_storage.py

This module provides a comprehensive system for managing audio files and their metadata.

#### Key Features

- File upload with metadata (name, category, volume settings)
- Support for both single and multiple file uploads
- JSON-based metadata storage
- File serving, updating, and deletion
- Unique filename generation

#### Metadata Structure

Each audio file has metadata with the following structure:

```json
{
  "id": "uuid-string",
  "name": "Display Name",
  "type": "audio/wav",
  "size": 12345,
  "category": "sound_effect|voice|song|text|json|other",
  "source": {
    "type": "local",
    "metadata": {
      "name": "filename.wav",
      "type": "audio/wav",
      "size": 12345
    }
  },
  "date": "2023-05-01T12:34:56.789Z",
  "volume": 1.0,
  "placeholder": "display_name",
  "url": "/audio/filename.wav"
}
```

### db.ts

This TypeScript module provides optional database integration using Neon's serverless PostgreSQL.

#### Key Features

- Configures connection to Neon database
- Exports a database pool and Drizzle ORM instance
- Validates database connection settings

## API Endpoints

### Text-to-Speech Endpoints

#### POST /gtts

Converts text to speech and returns the audio data.

- **Request Body**:
  ```json
  {
    "text": "Text to be converted to speech",
    "voice": "us" // Optional, defaults to "us" (American English)
  }
  ```

- **Response**:
  ```json
  {
    "audioBase64": "base64-encoded-wav-data",
    "duration": 2.5, // Audio duration in seconds
    "mimeType": "audio/wav"
  }
  ```

- **Status Codes**:
  - 200: Success
  - 400: Missing text parameter
  - 500: Server error

#### GET /gtts/voices

Returns a list of available voice options.

- **Response**:
  ```json
  {
    "voices": [
      {
        "id": "us",
        "name": "American English",
        "language": "en",
        "tld": "com"
      },
      // Additional voices...
    ]
  }
  ```

- **Status Codes**:
  - 200: Success
  - 500: Server error

### File Management Endpoints

#### POST /upload

Uploads one or more audio files with metadata.

- **Request**: `multipart/form-data` with:
  - Single file upload: `audio` field (React frontend)
  - Multiple file upload: `files` field (HTML frontend)
  - Optional fields:
    - `category`: File category (sound_effect, voice, song, text, json, other)
    - `name`: Custom name for the file(s)
    - `placeholder`: Text replacement placeholder
    - `volume`: Playback volume (0.0-1.0)

- **Response for Single File**:
  ```json
  {
    "url": "/audio/filename.wav"
  }
  ```

- **Response for Multiple Files**:
  ```json
  [
    {
      "id": "uuid-string",
      "name": "File Name",
      "url": "/audio/filename1.wav",
      // Additional metadata...
    },
    // Additional files...
  ]
  ```

- **Status Codes**:
  - 200: Success
  - 400: No files provided or invalid files
  - 500: Server error

#### GET /audio/list

Returns a list of all audio files with their metadata.

- **Response**:
  ```json
  [
    {
      "id": "uuid-string",
      "name": "File Name",
      "type": "audio/wav",
      "size": 12345,
      "category": "sound_effect",
      // Additional metadata...
      "url": "/audio/filename.wav"
    },
    // Additional files...
  ]
  ```

- **Status Codes**:
  - 200: Success
  - 500: Server error

#### GET /audio/{filename}

Serves an audio file by its filename.

- **Response**: The audio file binary data
- **Status Codes**:
  - 200: Success
  - 404: File not found

#### DELETE /audio/{filename}

Deletes an audio file and its metadata.

- **Response**:
  ```json
  {
    "message": "File deleted"
  }
  ```

- **Status Codes**:
  - 200: Success
  - 404: File not found
  - 500: Server error

#### PATCH /audio/{audio_id}

Updates metadata for an audio file by its ID.

- **Request Body**:
  ```json
  {
    "name": "New Name", // Optional
    "placeholder": "new_placeholder", // Optional
    "volume": 0.8 // Optional
  }
  ```

- **Response**: Updated metadata object
- **Status Codes**:
  - 200: Success
  - 400: No data provided
  - 404: Audio not found
  - 500: Server error

#### PUT /audio/{filename}

Replaces an existing audio file while preserving its URL/ID.

- **Request**: `multipart/form-data` with:
  - `audio`: The new audio file
  - `category` (optional): New category

- **Response**:
  ```json
  {
    "url": "/audio/filename.wav"
  }
  ```

- **Status Codes**:
  - 200: Success
  - 400: No audio file provided
  - 404: File not found
  - 500: Server error

#### POST /purge

Deletes all audio files and clears metadata.

- **Response**:
  ```json
  {
    "message": "All files purged successfully"
  }
  ```

- **Status Codes**:
  - 200: Success
  - 500: Server error

## HTML Demo Interface

A simple HTML demo interface is available at http://localhost:5000/ when the server is running. This interface provides:

- A button to generate sample TTS audio
- Audio playback controls
- File upload functionality
- File listing with filtering options
- Metadata viewing for each file
- Options to refresh the file list or purge all files

## Integration with Other Applications

### Including in Flask Applications

The server is designed to be modular, allowing integration with other Flask applications:

```python
from flask import Flask
from file_storage import setup_routes

app = Flask(__name__)

# Register file storage routes
setup_routes(app)

# Add your own routes
@app.route('/your-route')
def your_function():
    return "Your response"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### Using from Frontend Applications

The API can be accessed from any frontend application:

```javascript
// Text-to-speech example
async function convertTextToSpeech(text, voice = 'us') {
  const response = await fetch('http://localhost:5000/gtts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice
    })
  });
  
  return await response.json();
}

// File upload example
async function uploadAudioFile(file, options = {}) {
  const formData = new FormData();
  formData.append('audio', file);
  
  if (options.category) formData.append('category', options.category);
  if (options.name) formData.append('name', options.name);
  if (options.placeholder) formData.append('placeholder', options.placeholder);
  if (options.volume) formData.append('volume', options.volume);
  
  const response = await fetch('http://localhost:5000/upload', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}
```

## Troubleshooting

### Common Issues

1. **ffmpeg not found**: Ensure ffmpeg is installed and in your system PATH
   - Windows: `where ffmpeg`
   - Mac/Linux: `which ffmpeg`

2. **Permission denied for uploads directory**: Check file permissions
   - Linux/Mac: `chmod 755 Uploads`

3. **CORS issues**: If accessing from a different domain, ensure CORS is properly configured
   - The server has CORS enabled by default, but you may need to adjust if using a custom domain

4. **Audio not playing**: Check that the audio format is supported by your browser
   - The server converts to WAV format which is widely supported

### Logs

The server uses Python's logging module with INFO level by default. For more detailed logs:

1. Set `ADVANCED_LOGGING = True` in `gtts_server.py`
2. Restart the server

Logs include request details, processing information, and error messages.

## Performance Considerations

- The server handles one request at a time and is not designed for high-concurrency applications
- Audio files are stored on the local filesystem, not optimized for large-scale deployments
- For production use, consider:
  - Using a proper database instead of JSON file for metadata
  - Implementing a CDN for audio file serving
  - Adding authentication and rate limiting
