# Crystal Cloud Text-to-Speech SPA Documentation

## Overview

Crystal Cloud Text-to-Speech is a Single Page Application (SPA) that provides a feature-rich text-to-speech conversion system with support for multiple TTS engines, voice customization, audio management, and templating. The application is built using React with Context API for state management and offers both demo and production modes.

## Architecture

The application follows a context-based architecture using React's Context API and useReducer hook to manage application state. The architecture is divided into two main contexts:

1. **TTSContext**: Manages global application state including settings, configurations, and persistent data
2. **TTSSessionContext**: Manages the current working session including active sections, audio data, and UI state

### Folder Structure

```
/context
  ├── demoContentLoader.jsx    - Utility for loading demo content
  ├── storage.jsx              - Storage abstraction for persisting data
  ├── ttsActions.jsx           - Actions creators for TTS context
  ├── TTSContext.jsx           - Main application context provider
  ├── ttsDefaults.jsx          - Default values and initial states
  ├── ttsReducer.jsx           - Reducer for TTS context
  ├── ttsSessionActions.jsx    - Action creators for Session context
  ├── TTSSessionContext.jsx    - Session context provider
  └── ttsSessionReducer.jsx    - Reducer for Session context
```

## State Management

The application uses a two-tiered state management approach:

### TTSContext (Global/Persistent State)

The TTSContext manages global application state that persists between sessions, including:

- Theme settings
- Voice settings and configurations
- API keys and credentials
- Audio library
- Templates
- Storage configuration

This state is saved to `localStorage` and persists between page reloads.

### TTSSessionContext (Temporary Session State)

The TTSSessionContext manages the current working session, including:

- Current template and sections
- Generated audio data
- UI state (active tab, notifications, processing state)
- Playback state

This state is saved to `sessionStorage` and is maintained during page refreshes but cleared when the browser is closed.

## Core Components

### Storage System

The application implements a flexible storage system that supports:

- **Local Storage**: For configuration and settings
- **Session Storage**: For temporary session data
- **File Storage**: For audio files with support for local server, remote server, or cloud storage services

The storage system is abstracted through a unified API in `storage.jsx`, providing functions like:

- `saveToStorage` - Saves data to the specified storage type
- `loadFromStorage` - Loads data from the specified storage type
- `removeFromStorage` - Removes data from the specified storage type
- `listFromStorage` - Lists all items in the specified storage type
- `replaceInStorage` - Replaces data in the specified storage type
- `updateFileMetadata` - Updates metadata for an audio file on the server

### Voice Management

The application supports multiple TTS engines including:

- Google Text-to-Speech (gTTS)
- ElevenLabs
- AWS Polly
- Google Cloud TTS
- Azure TTS
- IBM Watson

For each engine, the application manages:

- Available voices
- Custom voices
- Active voices
- Voice settings (pitch, rate, volume)
- API credentials

### Audio Management

The application includes a comprehensive audio management system:

- Upload and store audio files
- Categorize and tag audio
- Set volume and other metadata
- Integrate audio files into TTS projects
- Merge audio sections into a single file

### Template System

The application supports templates for creating structured TTS projects:

- Predefined section structures
- Custom section ordering
- Section voice assignments
- Save and load templates

## Key Features

### Demo Mode

In demo mode, the application operates with limited functionality:

- Uses only the free gTTS engine
- Loads demo content (e.g., Yoga Kriya template)
- Limits certain features

The demo content is loaded via `loadDemoContent` which fetches a JSON file and normalizes the sections.

### Multi-Engine Support

The application seamlessly integrates multiple TTS engines:

- Configuration management for each engine
- API key storage and management
- Engine-specific voice selection
- Consistent interface across engines

### Section-Based Projects

TTS projects are divided into sections, each with:

- Type (text-to-speech or audio-only)
- Voice selection
- Voice settings
- Custom text content
- Optional audio file integration

### Theme Support

The application includes theme support with:

- Multiple theme options
- Theme persistence
- Dynamic theme application

## Usage Flow

1. **Initialization**: Application loads, retrieves settings from localStorage
2. **Engine Selection**: User selects a TTS engine
3. **Voice Setup**: User configures available voices
4. **Template Selection**: User selects or creates a template
5. **Section Configuration**: User configures sections with text and voice settings
6. **Audio Generation**: Text is converted to speech for each section
7. **Audio Management**: Generated audio can be played, merged, or exported
8. **Project Saving**: Project can be saved as a template for future use

## Technical Implementation

### Context Creation and Usage

The application creates context providers:

```jsx
/**
 * Provider component for TTS functionality
 * Manages global TTS state, settings, and configuration
 */
export const TTSProvider = ({ children }) => {
  // ...implementation
};

/**
 * Provider component for TTS session functionality
 * Manages session state for the current working text-to-speech project
 */
export const TTSSessionProvider = ({ children }) => {
  // ...implementation
};
```

And provides hooks to access them:

```jsx
/**
 * Custom hook to access the TTS context
 * @returns {Object} The TTS context object containing state, dispatch, and actions
 */
export const useTTSContext = () => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};

/**
 * Custom hook to access the TTS session context
 * @returns {Object} The session context object {state, actions}
 */
export const useTTSSession = () => {
  const context = useContext(TTSSessionContext);
  if (!context) {
    throw new Error('useTTSSession must be used within a TTSSessionProvider');
  }
  return context;
};
```

### Reducers

The application uses reducers to handle state updates:

- `ttsReducer`: Handles global state updates
  ```jsx
  /**
   * Reducer function for the TTS global state
   * Handles all state updates for the persistent application state
   * 
   * @param {Object} state - Current state object
   * @param {Object} action - Action object with type and payload
   * @returns {Object} The new state after applying the action
   */
  export function ttsReducer(state = initialPersistentState, action) {
    // Implementation...
  }
  ```

- `ttsSessionReducer`: Handles session state updates
  ```jsx
  /**
   * Reducer function for the TTS session state
   * Handles all state updates for the current working session
   * 
   * @param {Object} state - Current session state
   * @param {Object} action - Action object with type and payload
   * @returns {Object} The new state after applying the action
   */
  export function ttsSessionReducer(state, action) {
    // Implementation...
  }
  ```

Each reducer processes various action types to update its respective state.

### Actions

Actions are dispatched to update state:

- `createTtsActions`: Creates global state actions
  ```jsx
  /**
   * Creates and returns all TTS-related actions that can be dispatched
   * @param {Function} dispatch - The dispatch function from the TTS reducer context
   * @returns {Object} Object containing all TTS action functions
   */
  export function createTtsActions(dispatch) {
    // Implementation...
  }
  ```

- `createSessionActions`: Creates session state actions
  ```jsx
  /**
   * Creates and returns all session-related actions that can be dispatched
   * @param {Function} sessionDispatch - The dispatch function from the session context
   * @param {Function} loadDemoContent - Function to load demo content
   * @returns {Object} Object containing all session action functions
   */
  export function createSessionActions(sessionDispatch, loadDemoContent) {
    // Implementation...
  }
  ```

### Section Normalization

Both contexts use a `normalizeSection` function to ensure consistent section structure:

```jsx
/**
 * Helper function to normalize TTS section objects
 * Ensures consistent structure and default values for section properties
 * 
 * @param {Object} section - The section to normalize
 * @returns {Object} Normalized section with default values applied
 */
const normalizeSection = (section) => {
  // Default values for voice and settings
  const defaultVoice = {
    engine: 'gtts',
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
  };
  const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

  // Create normalized section with defaults
  const normalizedSection = {
    ...section,
    id: section.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: section.type || 'text-to-speech',
  };

  // Apply type-specific defaults
  if (section.type === 'text-to-speech') {
    normalizedSection.voice = section.voice || defaultVoice;
    normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
  } else {
    normalizedSection.voice = undefined;
    normalizedSection.voiceSettings = undefined;
  }

  return normalizedSection;
};
```

## Default Values and Configuration

The application provides default values for various components:

```jsx
/**
 * Initial persistent state for the TTS application
 * Contains default settings, voices, and configurations
 * @type {Object}
 */
export const initialPersistentState = {
  theme: 'glitch',
  fileHistory: [],
  templates: {
    yogaKriya: yogaKriyaTemplate,
  },
  settings: {
    speechEngine: 'gtts',
    // ... other settings
  },
  // ... other state properties
};

/**
 * Initial session state for the TTS application
 * Contains temporary state for the current working session
 * @type {Object}
 */
export const initialSessionState = {
  inputText: '',
  inputType: 'text',
  currentTemplate: 'general',
  // ... other session properties
};
```

## Integration Points

### Server APIs

The application communicates with a backend server for:

- Fetching available voices
- Converting text to speech
- Storing and retrieving audio files
- Managing audio metadata

The default server URL is `http://localhost:5000`, but can be configured to use remote endpoints.

### External TTS Services

The application integrates with external TTS services through their APIs, securely storing and managing API credentials.

## Demo Content

The application provides a demo content loader:

```jsx
/**
 * Loads demo content from the server and dispatches it to the application state
 * @param {Function} dispatch - The dispatch function from the TTS reducer context
 * @returns {Promise<void>} A promise that resolves when the demo content is loaded
 */
export const loadDemoContent = async (dispatch) => {
  // Implementation...
};
```

## Conclusion

Crystal Cloud Text-to-Speech SPA is a sophisticated application for text-to-speech conversion with support for multiple engines, comprehensive audio management, and templating. Its architecture is built on React's Context API for state management, providing a clean separation between global persistent state and temporary session state.

The application is thoroughly documented with JSDoc comments that clearly explain the purpose and functionality of each component, making it easier for developers to understand, maintain, and extend the codebase.

The application's modular design allows for easy extension with additional TTS engines or features while maintaining a consistent user experience. 