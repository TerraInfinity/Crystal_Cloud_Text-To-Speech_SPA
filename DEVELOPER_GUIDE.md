# Developer Guide: Crystal Cloud Text-to-Speech SPA

## Project Overview

Crystal Cloud Text-to-Speech SPA is a Next.js-based single-page application (SPA) that facilitates text-to-speech (TTS) with integrated audio effects. It combines a React frontend for user interaction, a Python server for local TTS processing, and API integrations for external TTS services (e.g., Eleven Labs, AWS Polly). The app supports customizable workflows for audio content creation with features for template management, audio file management, and sophisticated text processing.

## Technical Architecture

### Frontend Architecture
- **Framework**: Next.js with React
- **Styling**: Tailwind CSS with custom theming
- **State Management**: Dual-context system
  - `TTSContext`: Global persistent state (stored in localStorage)
  - `TTSSessionContext`: Session-specific state (stored in sessionStorage)

### Backend Services
- **Python Server**: Located in `py_server/`, provides local TTS capabilities using gTTS
- **API Routes**: Next.js API routes that proxy requests to external services
- **External Services**: Integration with multiple TTS providers (ElevenLabs, AWS Polly)

### Storage Strategy
- **Local Storage**: For settings, templates, and configurations
- **Session Storage**: For active work session data
- **File Storage**: Local (via Python server) or cloud-based (configurable)

## Core Components and Files

### Application Entry Points
- **`pages/index.jsx`**: Main application entry point, renders the primary TTS interface
- **`pages/audioLibraryPage.jsx`**: Audio library management interface
- **`pages/_app.jsx`**: Root component that initializes the global context providers

### Tab Components
The UI is organized into tabs for different functionalities:
- **`components/TTSApp.jsx`**: Main container that manages tab navigation
- **`components/TemplatesTab.jsx`**: Template creation and management
- **`components/AudioFilesTab.jsx`**: Audio file management interface
- **`components/FileHistory.jsx`**: History of generated/merged files
- **`components/SettingsTab.jsx`**: Application settings and API configuration
- **`components/ToolsTab.jsx`**: Utilities for text processing and transformation

### Core TTS Functionality
- **`components/TextInput.jsx`**: Text input with formatting options
- **`components/SectionsList.jsx`**: Container for all audio/text sections
- **`components/SectionCard.jsx`**: Individual section representation with variants:
  - **`SectionCardTTS.jsx`**: For text-to-speech sections
  - **`SectionCardAudio.jsx`**: For audio-only sections
- **`components/AudioPlayer.jsx`**: Controls for playback and audio file handling
- **`components/TemplateSelector.jsx`**: Template loading interface

### State Management
- **Persistent Storage (localStorage)**:
  - **`context/TTSContext.jsx`**: Context provider for global state
  - **`context/ttsReducer.jsx`**: State update logic
  - **`context/ttsActions.jsx`**: Action creators
  - **`context/ttsDefaults.jsx`**: Default configuration values

- **Session Storage (sessionStorage)**:
  - **`context/TTSSessionContext.jsx`**: Session state provider
  - **`context/ttsSessionReducer.jsx`**: Session state update logic
  - **`context/ttsSessionActions.jsx`**: Session action creators

### Services and APIs
- **TTS Services**:
  - **`services/api/speechServiceAPI.jsx`**: Central TTS service coordinator
  - **`services/api/speechEngineAPIs/elevenLabsAPI.js`**: ElevenLabs integration
  - **`services/api/speechEngineAPIs/awsPollyAPI.js`**: AWS Polly integration
  
- **Tool Services**:
  - **`services/api/tools/aiServiceAPI.js`**: AI-powered text transformation
  - **`services/api/tools/extractTextFromUrlAPI.js`**: Web content extraction

- **Storage Service**:
  - **`services/api/storageServiceAPI.js`**: Storage abstraction layer

### Utility Functions
- **`utils/AudioProcessor.jsx`**: Audio generation and merging utilities
- **`utils/fileUtils.js`**: File handling helpers
- **`utils/textUtils.js`**: Text processing functions
- **`utils/logUtils.js`**: Logging utilities for development (Configure log visibility in there by defining log levels.)

## Data Flow

1. **User Input Flow**:
   - User enters text in `TextInput` or loads a template via `TemplateSelector`
   - Sections are created and managed in `SectionsList`
   - Each section is represented by a `SectionCard` (TTS or Audio variant)

2. **TTS Generation Flow**:
   - User triggers TTS generation from `SectionCard` or globally
   - Request flows through `speechServiceAPI` to the appropriate TTS engine
   - Generated audio is stored and linked to the section

3. **Audio Manipulation Flow**:
   - `AudioProcessor` handles audio file operations
   - `AudioPlayer` provides playback controls
   - Merge functionality combines multiple audio files sequentially

4. **State Management Flow**:
   - Global settings/configurations stored in `TTSContext`
   - Current session data (sections, audio files) in `TTSSessionContext`
   - Actions dispatch through reducers to update state

## Setup and Development

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Python 3.x (for local TTS server)
- ffmpeg (must be in PATH for audio processing)

### Development Environment Setup
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd crystal-cloud-tts-spa
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Set up the Python server** (optional, for local/remote TTS):
   ```bash
   cd py_server
   pip install -r requirements.txt
   ```

4. **(Optional) Configure environment variables (Can be done in the App itself)**:
   Create a `.env` file with:
   ```
   ELEVENLABS_API_KEY=your_key_here
   AWS_POLLY_ACCESS_KEY=your_key_here
   AWS_POLLY_SECRET_KEY=your_key_here
   # Other API keys as needed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

   ~or, if separating frontend (next.js) & backend (python)...

   ```bash
   npm run dev:frontend
   and
   npm run dev:backend
   ```

### Testing
- Run the test suite with:
  ```bash
  npm test
  ```

- Component tests are located adjacent to their components
- Context and utility tests are in dedicated test files

## Adding New Features

### Adding a New TTS Provider
1. Create a new API file in `services/api/speechEngineAPIs/`
2. Implement the standard interface (matching other providers)
3. Add the provider to `speechServiceAPI.jsx`
4. Update the settings UI in `SettingsTab.jsx`

### Creating a New Tool
1. Add the tool implementation in `services/api/tools/`
2. Create UI components as needed
3. Add to `ToolsTab.jsx`
4. Update actions and state as required

## Deployment Considerations
- The application can be deployed as a static site with Next.js export
- Python server can be deployed separately as a microservice (or not at all if configured not to)
- Consider serverless functions for API integrations
- Storage options include:
  - Local file system (development only)
  - S3 or similar cloud storage
  - Database for metadata and small files

## Design Principles
- Component modularity for easy extension
- Context separation for persistent vs. session state
- Service abstraction for provider independence
- Progressive enhancement for core functionality