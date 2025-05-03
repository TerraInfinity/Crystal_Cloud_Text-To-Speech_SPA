# Project Structure - Architecture

<details>
<summary>Root</summary>

- **ARCHITECHTURE.md** - Describes the project structure
- **DEVELOPER_GUIDE.md** - Developer guide for the project
- **developer_best-practice_README.md** - Best practices for developers
- **MY_STORY.md** - Project background or story
- **PITCH.md** - Project pitch or proposal
- **README.md** - Project overview and setup instructions
- **USER_GUIDE.md** - User guide for the application

- <details>
  <summary>Configuration</summary>

  - **next.config.js** - Configures Next.js settings, enabling strict React mode
  - **tailwind.config.js** - Configures Tailwind CSS with custom colors and content paths
  - **tsconfig.json** - Configures TypeScript compiler options for the project
  - **tsconfig.test.json** - Extends tsconfig.json for Jest testing with specific includes
  - **postcss.config.js** - Configures PostCSS with Tailwind CSS and Autoprefixer plugins
  - **package.json** - Defines project dependencies, scripts, and metadata
  - **next-env.d.ts** - Provides TypeScript type definitions for Next.js
  - **jest.config.js** - Jest configuration for testing
  - **jest.setup.js** - Jest setup script

  </details>
</details>

<details>
<summary>Frontend</summary>

- <details>
  <summary>components/</summary>

    - <details>
      <summary>Tabs</summary>

      - **TemplatesTab.jsx** - Manages creation and editing of templates
      - **AudioFilesTab.jsx** - User Interface to manage uploaded audio files
      - **FileHistory.jsx** - Displays and manages history of generated/merged files
      - **SettingsTab.jsx** - Manages TTS settings, voices, and API keys
      - **ToolsTab.jsx** - Provides HTML/URL parsing and AI transformation utilities
      - **TTSApp.jsx** - The main tab and container component that handles tab navigation
        - **TemplateSelector.jsx** - Loads pre-defined templates for section structures
        - **TextInput.jsx** - Handles text and audio input for creating sections
        - **SectionsList.jsx** - Displays and manages the list of section cards
          - **SectionCard.jsx** - Main section card component for the SectionList component with editing capabilities
            - **SectionCardAudio.jsx** - Handles audio-only section card content
            - **SectionCardTTS.jsx** - Handles text-to-speech section card content

      </details>

    - <details>
      <summary>General</summary>

      - **AudioLibrary.jsx** - For managing sound effects
      - **AudioPlayer.jsx** - Generates, merges, plays, and downloads audio
      - **ThemeToggle.jsx** - Controls the application's visual theme

      </details>
  </details>

- <details>
  <summary>context/</summary>

    - <details>
      <summary>General</summary>

      - **demoContentLoader.jsx** - Utility for loading demo content
      - **storage.jsx** - Storage abstraction for persisting data

      </details>

    - <details>
      <summary>Local Storage State Context</summary>

      - **ttsActions.jsx** - Defines **action creators** for the TTS context, which are functions that produce standardized objects (actions) describing changes to the application state, such as updating settings or adding configurations. These actions are dispatched to the reducer to trigger state updates in a predictable way
      - **TTSContext.jsx** - Provides a **React Context** to manage and share **global application state** across components, including settings (e.g., voice preferences), configurations (e.g., API keys), and persistent data stored in local storage. This context ensures components can access and update this state without prop drilling
      - **ttsDefaults.jsx** - Specifies default values and initial states for the TTS context, such as default voice settings or configuration presets, used to initialize the application state when it first loads
      - **ttsReducer.jsx** - Contains the **reducer function** for the TTS context, which processes dispatched actions and updates the global application state accordingly. The reducer takes the current state and an action, then returns a new state based on the action’s instructions, ensuring predictable state management

      </details>

    - <details>
      <summary>Session Storage State Context</summary>

      - **ttsSessionActions.jsx** - Defines **action creators** for the Session context, which generate standardized objects (actions) to describe changes to the current working session, such as adding audio sections or updating UI state. These actions are sent to the session reducer to manage session-specific state changes
      - **TTSSessionContext.jsx** - Provides a **React Context** to manage and share **session-specific state** across components, including active sections (e.g., text or audio segments), audio data (e.g., generated speech), and UI state (e.g., current tab or selection). This context uses session storage to persist data temporarily for the user’s session
      - **ttsSessionReducer.jsx** - Contains the **reducer function** for the Session context, which handles dispatched actions to update the session-specific state. It processes actions like modifying sections or updating audio data, returning a new state to keep the session consistent and predictable

      </details>
  </details>

- <details>
  <summary>services/</summary>

    - <details>
      <summary>api/</summary>

        - <details>
          <summary>speechEngineAPIs/</summary>

          - **awsPollyAPI.js** - Converts text to speech using AWS Polly
          - **elevenLabsAPI.js** - Converts text to speech using ElevenLabs API
          - **speechServiceAPI.jsx** - Manages multiple TTS engines (gTTS, ElevenLabs, AWS Polly)

          </details>

        - <details>
          <summary>tools/</summary>

          - **aiServiceAPI.js** - Transforms text using AI providers (OpenAI, Anthropic)
          - **extractTextFromUrlAPI.js** - Extracts text from URLs

          </details>

        - **storageServiceAPI.js** - Manages data persistence (localStorage, IndexedDB, S3)

      </details>
  </details>

- <details>
  <summary>utils/</summary>

  - **AudioProcessor.jsx** - Generates and merges audio using TTS engines
  - **fileUtils.js** - Utilities for file handling (reading, downloading, validating)
  - **logUtils.js** - Development-only logging utilities
  - **textUtils.js** - Text processing utilities (HTML parsing, voice tags)

  </details>

- <details>
  <summary>shared/</summary>

  - **schema.ts** - Defines TypeScript schemas for the project

  </details>

- <details>
  <summary>Pages</summary>

  - **_app.jsx** - Wraps the app with global styles and TTS context provider
  - **audioLibraryPage.jsx** - Contains the Audio Library, accessible at /audio URL
  - **index.jsx** - Main landing page with TTS functionality and navigation
  - **[...path].js** - API catch-all route handler that routes requests to the appropriate service handlers in different files. (tpyically services/api)

  </details>

- <details>
  <summary>Styles</summary>

  - **globals.css** - Global and component-specific styles with Tailwind CSS
  - **themes.css** - Theme styles (light, dark, retro) using CSS variables

  </details>

- <details>
  <summary>Public</summary>

  - **demo_kundalini_kriya.json** - Demo content for Kundalini Kriya

  </details>
</details>

<details>
<summary>Backend</summary>

- <details>
  <summary>py_server/</summary>

  - **file_storage.py** - Manages audio file storage and metadata
  - **gtts_server.py** - Converts text to speech using Google’s gTTS API

  </details>

- <details>
  <summary>Other</summary>

  - **db.ts** - Optional Neon PostgreSQL database connection

  </details>
</details>

<details>
<summary>Functional Layers</summary>

- <details>
  <summary>services/api/</summary>

  - **mergeAudioAPI.js** - Merges multiple audio files into a single file

  </details>
</details>

<details>
<summary>Tests</summary>

- <details>
  <summary>__mocks__/</summary>

  - **fileMock.js** - Mock file for Jest testing
  - **storage.ts** - Mock storage implementation for testing

  </details>

- <details>
  <summary>components/</summary>

  - **AudioFilesTab.test.tsx**
  - **AudioLibrary.test.tsx**
  - **AudioPlayer.test.tsx**
  - **FileHistory.test.tsx**
  - **SectionCard.test.tsx**
  - **SectionCardAudio.test.tsx**
  - **SectionCardTTS.test.tsx**
  - **SectionsList.test.tsx**
  - **SettingsTab.test.tsx**
  - **TemplateSelector.test.tsx**
  - **TemplatesTab.test.tsx**
  - **TextInput.test.tsx**
  - **ThemeToggle.test.tsx**
  - **ToolsTab.test.tsx**
  - **TTSApp.test.tsx**

  </details>

- <details>
  <summary>context/</summary>

  - **demoContentLoader.test.tsx**
  - **storage.test.tsx**
  - **ttsActions.test.ts**
  - **TTSContext.test.tsx**
  - **ttsDefaults.test.ts**
  - **ttsReducer.test.ts**
  - **ttsSessionActions.test.ts**
  - **TTSSessionContext.test.tsx**
  - **ttsSessionReducer.test.ts**

  </details>

- <details>
  <summary>pages/</summary>

  - **app.test.tsx**
  - **audioLibraryPage.test.tsx**
  - **index.test.tsx**

  </details>

- <details>
  <summary>services/</summary>

  - **aiServiceAPI.test.ts**
  - **awsPollyAPI.test.tsx**
  - **extractTextFromUrlAPI.test.tsx**
  - **mergeAudioAPI.test.tsx**
  - **speechServiceAPI.test.tsx**
  - **storageServiceAPI.test.ts**

  </details>

- <details>
  <summary>shared/</summary>

  - **schema.test.ts**

  </details>

- <details>
  <summary>utils/</summary>

  - **AudioProcessor.test.tsx**
  - **fileUtils.test.ts**
  - **logUtils.test.ts**
  - **textUtils.test.ts**

  </details>
</details>