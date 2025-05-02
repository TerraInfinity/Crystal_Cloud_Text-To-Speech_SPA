# Text-to-Speech Application Component Documentation

## Overview

This document provides a comprehensive overview of the React components that make up the Text-to-Speech (TTS) application. The application allows users to:

- Create text-to-speech and audio-only sections
- Select from various TTS voices and engines
- Customize voice settings (volume, rate, pitch)
- Generate, merge, and download audio files
- Save and load templates
- Manage audio files library
- Apply different visual themes
- Configure TTS engines and API keys
- Parse content from HTML and URLs
- Apply AI transformations to text

## Component Architecture

### Main Components

1. **TTSApp** - The main container component that handles tab navigation
2. **TextInput** - Handles text and audio input for creating sections
3. **SectionsList** - Displays and manages the list of sections
4. **SectionCard** - Individual section component with editing capabilities
   - **SectionCardTTS** - Handles text-to-speech section content
   - **SectionCardAudio** - Handles audio-only section content
5. **AudioPlayer** - Generates, merges, plays, and downloads audio
6. **TemplateSelector** - Loads pre-defined templates for section structures
7. **SettingsTab** - Manages TTS settings, voices, and API keys
8. **AudioFilesTab** / **AudioLibrary** - Manages uploaded audio files
9. **TemplatesTab** - Manages creation and editing of templates
10. **ToolsTab** - Provides HTML/URL parsing and AI transformation utilities
11. **FileHistory** - Displays and manages history of generated files
12. **ThemeToggle** - Controls the application's visual theme

### Component Relationships

```
TTSApp
├── ThemeToggle
├── TemplateSelector
├── TextInput
├── SectionsList
│   └── SectionCard (multiple)
│       ├── SectionCardTTS
│       └── SectionCardAudio
├── AudioPlayer
├── SettingsTab
├── TemplatesTab
├── ToolsTab
├── AudioFilesTab / AudioLibrary
└── FileHistory
```

## Context Usage

The application uses two main context providers:

1. **TTSContext** - Manages persistent state like settings, templates, and API keys
   - Themes, voice configuration, API keys, audio library, templates
   - Data that should persist between sessions
   
2. **TTSSessionContext** - Manages session state like current sections, generated audio, and UI state
   - Current sections, generated audio files, active tab
   - Transient data specific to the current session

## Component Details

### TTSApp

The main container component that manages tab navigation between different sections of the application.

**Props:**
- `initialText`: Initial text to populate in the text input
- `initialTemplate`: Initial template to use

**Functions:**
- `handleTabChange(tab)`: Switches between different tabs of the application

### TextInput

Handles user input for creating new TTS or audio-only sections.

**State:**
- Input text content
- Input type (text or audio)
- Voice selection
- Audio source selection

**Functions:**
- `handleTextChange(e)`: Updates the input text
- `handleFileUpload(e)`: Uploads and reads text files
- `handleUrlImport()`: Imports text from a URL
- `handleAudioUpload(e)`: Uploads audio files
- `createNewSection()`: Creates a new TTS section
- `createAudioSection()`: Creates a new audio-only section

### SectionsList

Manages the list of TTS and audio sections.

**Functions:**
- `createNewSection()`: Creates a new empty section
- `moveUp(index)`: Moves a section up in the list
- `moveDown(index)`: Moves a section down in the list

### SectionCard

Renders and manages individual TTS or audio-only sections.

**Props:**
- `section`: The section data
- `index`: The section's index in the list
- `moveUp`: Function to move the section up
- `moveDown`: Function to move the section down

**Functions:**
- `toggleSectionType()`: Switches between TTS and audio-only types
- `saveSection()`: Saves section changes
- `deleteSection()`: Deletes the section

### SectionCardTTS

Handles the content and functionality of text-to-speech sections.

**Props:**
- `section`: The section data
- `isEditing`: Whether the section is being edited
- `setIsEditing`: Function to set editing state
- `editedText`: The current edited text
- `setEditedText`: Function to update edited text
- `editedVoice`: The current edited voice
- `setEditedVoice`: Function to update edited voice
- `voiceSettings`: The current voice settings
- `setVoiceSettings`: Function to update voice settings

**Functions:**
- `togglePlay()`: Plays or pauses the section's audio

### SectionCardAudio

Handles the content and functionality of audio-only sections.

**Props:**
- `section`: The section data

**State:**
- `audioSource`: The source of audio ('library' or 'upload')
- `isPlaying`: Whether the audio is currently playing
- `showAudioPlayer`: Whether to show the audio player

**Functions:**
- `handleAudioUpload(e)`: Uploads a new audio file
- `togglePlayAudio()`: Plays or pauses the section's audio
- `toggleAudioPlayer()`: Shows or hides the audio player

### AudioPlayer

Provides controls for generating, merging, playing, and downloading audio from the sections.

**Functions:**
- `playAudio()`: Plays or pauses the merged audio

**Uses utility functions:**
- `generateAllAudio()`: Generates audio for all TTS sections
- `mergeAllAudio()`: Merges all generated audio files
- `downloadAudio()`: Downloads the final merged audio file

### TemplateSelector

Allows selecting and loading pre-defined templates for section structures.

**Functions:**
- `loadTemplate(templateName)`: Loads a template and creates sections
- `loadDemoContent()`: Loads demo content with sample sections

### SettingsTab

Comprehensive settings management component for the TTS application.

**Functionality:**
- Toggles between demo and production modes
- Selects speech engines (gtts, elevenLabs, awsPolly, googleCloud, azureTTS, ibmWatson)
- Manages API keys for various TTS services
- Configures AI providers (OpenAI, Anthropic)
- Manages voice settings (adding/removing voices, setting default voices)

**State:**
- Mode settings (demo/production)
- Selected speech engine
- API keys for different services
- Available and active voices
- Custom voice configurations

**Functions:**
- `toggleMode()`: Switches between demo and production modes
- `handleSpeechEngineChange(engine)`: Changes the current speech engine
- `addActiveVoice()`: Adds a voice to the active voices list
- `removeActiveVoice(engine, voiceId)`: Removes a voice from active voices
- `addCustomVoice()`: Creates a new custom voice
- `removeCustomVoice(voiceId)`: Removes a custom voice
- `saveApiKey(keyName, value)`: Saves API keys for various services
- `addElevenLabsApiKey()`: Adds a new ElevenLabs API key
- `addAwsPollyCredential()`: Adds AWS Polly credentials
- `addGoogleCloudKey()`: Adds a Google Cloud TTS API key
- `addAzureTTSKey()`: Adds an Azure TTS API key
- `addIbmWatsonKey()`: Adds an IBM Watson TTS API key

### TemplatesTab

Manages the creation, editing, and management of templates for quick section creation.

**Functionality:**
- Creates and saves new templates
- Edits existing templates
- Imports and exports templates
- Categorizes templates for organization
- Provides template previews

**State:**
- Template editing mode (create/edit)
- Current template being edited
- Template categories
- Import/export status

**Functions:**
- `addSection()`: Adds a new section to the template
- `updateSection(index, updates)`: Updates a section with new values
- `removeSection(index)`: Removes a section from the template
- `moveSectionUp(index)`: Moves a section up in the template order
- `moveSectionDown(index)`: Moves a section down in the template order
- `saveTemplate()`: Saves the current template
- `editTemplate(template)`: Begins editing an existing template
- `handleClearTemplateForm()`: Clears the template form

### ToolsTab

Provides utilities for HTML/URL parsing and AI-powered text transformations.

**Functionality:**
- Extracts text content from HTML
- Fetches and parses content from URLs
- Applies AI transformations to text using configurable prompts
- Sends processed content to the main application

**State:**
- HTML/URL input and parsed result
- AI input text, prompt, and result
- AI provider selection
- Preset prompt selection

**Functions:**
- `parseHtmlOrUrl()`: Extracts text from HTML input or fetches content from a URL
- `applyParsedResult()`: Applies extracted text to the main input area
- `handlePresetPromptChange(e)`: Selects from predefined AI prompts
- `processWithAI()`: Sends text to AI service for processing with specified prompt
- `applyAiResult()`: Applies AI-processed text to the main input area

### AudioLibrary

Comprehensive interface for managing audio files for use in audio-only sections.

**Functions:**
- `handleAudioUpload(e)`: Uploads and saves new audio files
- `playAudio(audio)`: Plays the selected audio
- `deleteAudio(audioId)`: Deletes an audio file
- `deleteAllAudios()`: Deletes all audio files
- `updateAudioVolume(audioId, newVolume)`: Updates an audio file's volume
- `startEditing(audio)`: Begins editing an audio file's metadata
- `saveEdit(audioId)`: Saves edited audio metadata
- `cancelEdit()`: Cancels the current editing operation

### FileHistory

Displays and manages the history of previously generated TTS files.

**Functions:**
- `handleLoadConfig(historyEntry)`: Loads a previous configuration
- `handleDelete(historyId)`: Deletes a history entry

### ThemeToggle

Controls the application's visual theme.

**Functions:**
- `cycleTheme()`: Cycles to the next theme in the themes array

## Common Props and Types

### Section Object

```javascript
{
  id: String,
  title: String,
  type: 'text-to-speech' | 'audio-only',
  text: String, // For text-to-speech sections
  voice: VoiceObject | null,
  voiceSettings: {
    volume: Number,
    rate: Number,
    pitch: Number
  } | null,
  audioId: String, // For audio-only sections with library audio
  audioSource: 'library' | 'upload' // For audio-only sections
}
```

### Voice Object

```javascript
{
  engine: String, // 'gtts', 'elevenLabs', 'awsPolly', etc.
  id: String,
  name: String,
  language: String,
  tld: String // Optional, used for gtts
}
```

### Audio Object

```javascript
{
  id: String,
  name: String,
  url: String,
  type: String, // MIME type
  size: Number,
  date: String, // ISO date string
  placeholder: String,
  volume: Number,
  category: String // e.g., 'sound_effect'
}
```

### Template Object

```javascript
{
  id: String,
  name: String,
  description: String,
  category: String,
  sections: Array<SectionTemplate>,
  created: String, // ISO date string
  updated: String // ISO date string
}
```

### Preset Prompt Object (for ToolsTab)

```javascript
{
  id: String,     // Unique identifier
  label: String,  // Display name
  prompt: String  // The actual AI instruction
}
```

## Event Flow Example

1. User selects a template via `TemplateSelector`
2. User adds text in `TextInput` and creates a new section
3. The section appears in `SectionsList` as a `SectionCard`
4. User edits the section content and voice settings
5. User clicks "Generate Audio" in `AudioPlayer` to create audio for each section
6. User clicks "Merge Audio" to combine all section audio files
7. User clicks "Download Audio" to save the final audio file

## Theme System

The application supports multiple themes through the `ThemeToggle` component:

1. The current theme is stored in `TTSContext`
2. CSS variables are used to define theme colors and styles
3. The `ThemeToggle` button cycles through available themes
4. Each theme has a corresponding icon for visual identification

## Best Practices for Component Usage

1. Always use the context actions to modify state rather than direct state manipulation
2. When creating TTS sections, ensure they have proper voice settings
3. When creating audio-only sections, provide a valid audio source
4. Use the notification system from session context to provide feedback to users
5. Check isProcessing state before initiating new actions to prevent conflicts
6. Use the appropriate section component (SectionCardTTS or SectionCardAudio) based on section type
7. Handle audio cleanup in useEffect to prevent memory leaks
8. Ensure unique names and placeholders for audio files in the library
9. Use the ToolsTab for extracting and transforming content from external sources
10. Configure appropriate API keys in SettingsTab before attempting to use cloud TTS services
11. Save templates regularly to avoid losing work in the TemplatesTab
12. When using AI transformations, select appropriate preset prompts for best results

## Additional Resources

Each component file includes comprehensive JSDoc documentation that provides detailed information about:

- Component purpose and functionality
- Props and state
- Functions and methods
- Type definitions
- Side effects and cleanup

Refer to individual component files for more detailed documentation. 