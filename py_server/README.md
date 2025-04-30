

# Python Server API for Text-to-Speech and Audio File Management

This Flask-based Python server provides APIs for a text-to-speech (TTS) application, supporting:
- An HTML frontend (`templates/index.html`) uploading multiple files under the `'files'` key.
- A React frontend uploading single files under the `'audio'` key.

Below are the API endpoints for uploading, listing, retrieving, deleting, and managing audio files, as well as TTS functionality.

## API Endpoints

### POST /upload
Uploads audio files and stores metadata.

- **Method**: POST
- **URL**: `http://localhost:5000/upload`
- **Content-Type**: `multipart/form-data`
- **Body** (FormData):
  - **React Frontend**: Single file, key: `'audio'`.
  - **HTML Frontend**: Multiple files, key: `'files'`, optional `fileType` (e.g., `'sound_effect'`, `'voice'`, `'other'`; defaults to `'unknown'`).
- **Response**:
  - **React Success** (200): `{"url": "/audio/filename"}` (e.g., `{"url": "/audio/CHIME.wav"}`)
  - **HTML Success** (200): Array of metadata: `[{"id": "uuid", "name": "CHIME", "url": "/audio/CHIME.wav", "fileType": "sound_effect", ...}]`
  - **Error** (400): `{"error": "No files provided"}` or `{"error": "No selected file"}`

### GET /audio/list
Lists metadata for all stored audio files.

- **Method**: GET
- **URL**: `http://localhost:5000/audio/list`
- **Response**:
  - **Success** (200): Array of metadata: `[{"id": "uuid", "name": "CHIME", "fileType": "unknown", "url": "/audio/CHIME.wav", ...}]`
  - **Error** (500, rare): `{"error": "message"}`

### GET /audio/<filename>
Retrieves an audio file.

- **Method**: GET
- **URL**: `http://localhost:5000/audio/<filename>` (e.g., `/audio/CHIME.wav`)
- **Response**:
  - **Success** (200): File binary data (`Content-Type: audio/*`)
  - **Error** (404): File not found

### DELETE /audio/<filename>
Deletes an audio file.

- **Method**: DELETE
- **URL**: `http://localhost:5000/audio/<filename>`
- **Response**:
  - **Success** (200): `{"message": "File deleted"}`
  - **Error** (404): `{"error": "File not found"}`

### POST /gtts
Generates TTS audio from text.

- **Method**: POST
- **URL**: `http://localhost:5000/gtts`
- **Content-Type**: `application/json`
- **Body**: `{"text": "Hello, world!"}`
- **Response**:
  - **Success** (200): `{"audioBase64": "base64-string", "duration": 2.5, "mimeType": "audio/wav"}`
  - **Error** (400): `{"message": "Text is required"}`

### GET /gtts/voices
Lists available TTS voices.

- **Method**: GET
- **URL**: `http://localhost:5000/gtts/voices`
- **Response**:
  - **Success** (200): `{"voices": [{"id": "com", "name": "English (US)", "language": "en"}]}`

### POST /purge
Deletes all files and metadata.

- **Method**: POST
- **URL**: `http://localhost:5000/purge`
- **Response**:
  - **Success** (200): `{"message": "All files purged successfully"}`
  - **Error** (500): `{"error": "Failed to purge files"}`

## Notes for React Frontend
- **Upload**: Use `FormData` with key `'audio'` for single file uploads to `/upload`. Expect `{"url": "/audio/filename"}`.
- **Server URL**: Set to `http://localhost:5000`.
- **File URLs**: Use `/audio/filename` for retrieval (not `/Uploads/`).
