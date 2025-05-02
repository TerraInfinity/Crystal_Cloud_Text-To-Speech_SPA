# Developer Guide: Crystal Cloud Text-to-Speech SPA

## Project Overview

Crystal Cloud Text-to-Speech SPA is a Next.js-based single-page application (SPA) that facilitates text-to-speech (TTS) with integrated audio effects. It combines a frontend for user interaction, a Python server for local TTS processing, and API integrations for external TTS services (e.g., Eleven Labs, AWS Polly, IBM Watson, Google Cloud). The app supports customizable workflows for audio content creation.

## Technical Structure

### Frontend
- **Framework**: Next.js with React.
- **State Management**: React Context (e.g., `TTSContext.jsx`).
- **Key Files**:
  - `pages/index.jsx`: Main entry point, renders the UI.
  - `components/SectionCard.jsx`: Handles individual text or audio sections.
  - `components/SectionList.jsx`: Manages the list of section cards.

### Backend
- **Python Server**: Located in `py_server/`, uses gTTS for local TTS and manages audio storage.
- **API Routes**: In `pages/api/`, handle external TTS service calls and audio merging.
- **Key Files**:
  - `py_server/gtts_server.py`: Local TTS processing.
  - `pages/api/aiTransform.jsx`: Routes TTS requests.

### Storage
- **Options**: Local (via Python server), remote server, or cloud (e.g., S3, Google Drive).
- **Configuration**: Set in `settings.json` or environment variables.
- **Metadata**: Stored in JSON files or a database, per settings.

## Key Components

- **`pages/index.jsx`**:
  - Main UI entry point, integrates all tabs (Main, Settings, Templates, etc.).
  - Uses `TTSContext.jsx` for state.

- **`components/SectionCard.jsx`**:
  - Manages section types (Text-to-Speech or Audio-Only).
  - Interacts with `speechService.jsx` for TTS generation.

- **`services/speechService.jsx`**:
  - Abstracts TTS API calls (e.g., Eleven Labs, AWS Polly, gTTS).
  - Handles fallback logic for multiple API keys.

- **`py_server/gtts_server.py`**:
  - Processes local TTS requests using gTTS.
  - Saves audio to `py_server/uploads/` or configured storage.

## Data Flow
1. User inputs text or selects a template on the **Main Tab**.
2. **Section Cards** are populated in the **Section List**.
3. **Generate Audio** triggers TTS requests (via APIs or gTTS) per card.
4. Audio files are stored based on settings (local, remote, cloud).
5. **Merge** combines audio files in order into a final file for download.

## Development Environment
1. Clone the repository.
2. Install frontend dependencies: `npm install`.
3. Set up the Python server: `pip install -r py_server/requirements.txt`.
4. Configure environment variables:
   - API keys for TTS services.
   - Storage settings (local, remote, cloud).
5. Run the app: `npm run dev`.

## Contributing
- Adhere to coding standards in `developer_best-practice_README.md`.
- Test new features with Jest and React Testing Library.
- Submit pull requests with detailed change descriptions.

## Notes
- The app’s scalable design supports adding new TTS providers or tools.
- Templates and file history storage can be extended to databases for persistence.