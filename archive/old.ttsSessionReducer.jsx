// src/reducers/ttsSessionReducer.jsx
import { devLog } from '../utils/logUtils'; // Note: Ensure logUtils.ts exists
import { Voice, validateVoice } from '../utils/voiceUtils'; // Note: Ensure voiceUtils.tsx exists

/**
 * Helper function to normalize TTS section objects
 * Ensures consistent structure and validates voices against activeVoices
 * 
 * @param {Object} section - The section to normalize
 * @param {Array} activeVoices - List of active voices from ttsState
 * @param {Object} defaultVoice - Default voice from ttsState
 * @returns {Object} Normalized section with validated voice
 */
const normalizeSection = (section, activeVoices, defaultVoice) => {
  devLog('Normalizing section before:', section);

  const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
  const originalType = section.type || 'text-to-speech';

  const normalizedSection = {
    id: section.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: section.title || 'Untitled Section',
    type: originalType,
    text: section.text || '',
  };

  // Handle voice and voice settings based on the section type
  if (originalType === 'text-to-speech') {
    normalizedSection.voice = validateVoice(
      section.voice === undefined ? defaultVoice : section.voice,
      activeVoices,
      defaultVoice
    );
    normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
  } else if (originalType === 'audio-only') {
    normalizedSection.voice = undefined;
    normalizedSection.voiceSettings = undefined;

    // Preserve audio-related fields
    if ('audioId' in section) {
      normalizedSection.audioId = section.audioId;
    }
    if ('audioSource' in section) {
      normalizedSection.audioSource = section.audioSource;
    }
    if (section.audioUrl) {
      normalizedSection.audioUrl = section.audioUrl;
    }
  }

  devLog('Normalized section after:', normalizedSection);
  return normalizedSection;
};

/**
 * Reducer function for the TTS session state
 * Handles all state updates for the current working session
 * 
 * @param {Object} state - Current session state
 * @param {Object} action - Action object with type and payload
 * @returns {Object} The new state after applying the action
 */
export function ttsSessionReducer(state, action) {
  // Access ttsState from global or context
  // Note: Replace window.ttsState with context if available (e.g., useTTSContext)
  const activeVoices = window.ttsState?.settings.activeVoices || [];
  const defaultVoice = window.ttsState?.settings.defaultVoice || {
    engine: 'gtts',
    voiceId: 'en-com',
    id: 'en-com',
    name: 'American English',
    language: 'en',
  };

  switch (action.type) {
    case 'SET_INPUT_TEXT':
      // Set the input text for TTS
      return { ...state, inputText: action.payload };

    case 'SET_SELECTED_INPUT_VOICE':
      // Set the selected voice for input text, validating it
      devLog('Setting selected input voice:', action.payload);
      return {
        ...state,
        selectedInputVoice: action.payload
          ? validateVoice(action.payload, activeVoices, defaultVoice)
          : null,
      };

    case 'SET_INPUT_TYPE':
      // Set input type (text or audio)
      return { ...state, inputType: action.payload };

    case 'SET_TEMPLATE':
      // Set the current template
      return { ...state, currentTemplate: action.payload };

    case 'SET_SECTIONS':
      // Set all sections (overwriting existing ones)
      return {
        ...state,
        sections: action.payload.map(section =>
          normalizeSection(section, activeVoices, defaultVoice)
        ),
      };

    case 'ADD_SECTION':
      // Add a new section to the end of the sections array
      return {
        ...state,
        sections: [
          ...state.sections,
          normalizeSection(action.payload, activeVoices, defaultVoice),
        ],
      };

    case 'UPDATE_SECTION':
      // Update an existing section by ID
      devLog('Updating section with payload:', action.payload);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.id
            ? normalizeSection(action.payload, activeVoices, defaultVoice)
            : section
        ),
      };

    case 'REMOVE_SECTION':
      // Remove a section by ID
      return {
        ...state,
        sections: state.sections.filter(section => section.id !== action.payload),
      };

    case 'REORDER_SECTIONS':
      // Reorder all sections based on the provided array
      return {
        ...state,
        sections: action.payload.map(section =>
          normalizeSection(section, activeVoices, defaultVoice)
        ),
      };

    case 'SET_ACTIVE_TAB':
      // Set the active tab in the UI
      return { ...state, activeTab: action.payload };

    case 'SET_PROCESSING':
      // Set the processing state (loading indicator)
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      // Set an error message
      return { ...state, errorMessage: action.payload };

    case 'SET_GENERATED_AUDIO':
      // Set generated audio data for a specific section
      const { sectionId, audioData } = action.payload;
      const minimalAudioData = {
        url: audioData.url,
        contentType: audioData.contentType || 'audio/wav',
        duration: audioData.duration || null,
        size: audioData.size || null,
      };
      return {
        ...state,
        generatedTTSAudios: {
          ...state.generatedTTSAudios,
          [sectionId]: minimalAudioData,
        },
      };

    case 'SET_MERGED_AUDIO':
      // Set the merged audio URL for playback
      const mergedAudioUrl =
        typeof action.payload === 'object' && action.payload?.url
          ? action.payload.url
          : action.payload;
      return { ...state, mergedAudio: mergedAudioUrl };

    case 'SET_PLAYING':
      // Set the playing state for audio playback
      return { ...state, isPlaying: action.payload };

    case 'SET_SELECTED_AUDIO':
      // Set the selected audio from the library
      return { ...state, selectedAudioLibraryId: action.payload };

    case 'SET_SECTION_VOICE':
      // Set the voice for a specific section, validating it
      devLog('Setting voice for section:', action.payload.sectionId, 'Voice:', action.payload.voice);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.sectionId
            ? {
                ...section,
                voice: validateVoice(action.payload.voice, activeVoices, defaultVoice),
              }
            : section
        ),
      };

    case 'SET_VOICE_SETTINGS':
      // Set voice settings for a specific section
      devLog('Setting voice settings for section:', action.payload.sectionId, 'Settings:', action.payload.settings);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.sectionId
            ? { ...section, voiceSettings: action.payload.settings }
            : section
        ),
      };

    case 'LOAD_SESSION_STATE':
      // Load a complete session state (e.g., from storage)
      const loadedGeneratedAudios = action.payload.generatedTTSAudios || {};
      const normalizedGeneratedAudios = Object.keys(loadedGeneratedAudios).reduce(
        (acc, id) => {
          const audio = loadedGeneratedAudios[id];
          acc[id] = typeof audio === 'string' ? { url: audio } : audio;
          return acc;
        },
        {}
      );
      return {
        ...state,
        ...action.payload,
        sections: action.payload.sections
          ? action.payload.sections.map(section =>
              normalizeSection(section, activeVoices, defaultVoice)
            )
          : state.sections,
        templateCreation: action.payload.templateCreation
          ? {
              ...action.payload.templateCreation,
              sections: action.payload.templateCreation.sections.map(section =>
                normalizeSection(section, activeVoices, defaultVoice)
              ),
            }
          : state.templateCreation,
        generatedTTSAudios: normalizedGeneratedAudios,
      };

    case 'LOAD_DEMO_CONTENT':
      // Load demo content (e.g., sample project)
      devLog('Loading demo content:', action.payload);
      return {
        ...state,
        currentTemplate: action.payload.currentTemplate,
        sections: action.payload.sections.map(section =>
          normalizeSection(section, activeVoices, defaultVoice)
        ),
        mode: action.payload.mode,
        speechEngine: action.payload.speechEngine,
      };

    // Template creation actions
    case 'SET_TEMPLATE_NAME':
      // Set the name for a template being created
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateName: action.payload },
      };

    case 'SET_TEMPLATE_DESCRIPTION':
      // Set the description for a template being created
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateDescription: action.payload },
      };

    case 'SET_TEMPLATE_CREATION_SECTIONS':
      // Set all sections for template creation
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: action.payload.map(section =>
            normalizeSection(section, activeVoices, defaultVoice)
          ),
        },
      };

    case 'ADD_TEMPLATE_CREATION_SECTION':
      // Add a section to template creation
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: [
            ...state.templateCreation.sections,
            normalizeSection(action.payload, activeVoices, defaultVoice),
          ],
        },
      };

    case 'UPDATE_TEMPLATE_CREATION_SECTION':
      // Update a section in template creation
      const { index, updates } = action.payload;
      const newTemplateSections = [...state.templateCreation.sections];
      newTemplateSections[index] = normalizeSection(
        { ...newTemplateSections[index], ...updates },
        activeVoices,
        defaultVoice
      );
      return {
        ...state,
        templateCreation: { ...state.templateCreation, sections: newTemplateSections },
      };

    case 'REMOVE_TEMPLATE_CREATION_SECTION':
      // Remove a section from template creation (prevent removing last section)
      if (state.templateCreation.sections.length === 1) return state;
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: state.templateCreation.sections.filter((_, i) => i !== action.payload),
        },
      };

    case 'MOVE_TEMPLATE_CREATION_SECTION_UP':
      // Move a template section up in the order
      if (action.payload === 0) return state;
      const sectionsUp = [...state.templateCreation.sections];
      [sectionsUp[action.payload - 1], sectionsUp[action.payload]] = [
        sectionsUp[action.payload],
        sectionsUp[action.payload - 1],
      ];
      return {
        ...state,
        templateCreation: { ...state.templateCreation, sections: sectionsUp },
      };

    case 'MOVE_TEMPLATE_CREATION_SECTION_DOWN':
      // Move a template section down in the order
      if (action.payload === state.templateCreation.sections.length - 1) return state;
      const sectionsDown = [...state.templateCreation.sections];
      [sectionsDown[action.payload], sectionsDown[action.payload + 1]] = [
        sectionsDown[action.payload + 1],
        sectionsDown[action.payload],
      ];
      return {
        ...state,
        templateCreation: { ...state.templateCreation, sections: sectionsDown },
      };

    case 'SET_EDITING_TEMPLATE':
      // Set the template being edited
      return {
        ...state,
        templateCreation: { ...state.templateCreation, editingTemplate: action.payload },
      };

    case 'CLEAR_TEMPLATE_CREATION_FORM':
      // Reset the template creation form to default values
      return {
        ...state,
        templateCreation: {
          templateName: '',
          templateDescription: '',
          sections: [
            {
              id: `section-${Date.now()}`,
              title: `Section 1`,
              type: 'text-to-speech',
              text: '',
              voice: validateVoice(null, activeVoices, defaultVoice),
              voiceSettings: { pitch: 1, rate: 1, volume: 1 },
            },
          ],
          editingTemplate: null,
        },
      };

    case 'RESET_SESSION':
      // Reset the session state to initial values, but keep settings
      return {
        ...state,
        sections: [],
        inputText: '',
        selectedInputVoice: null,
        generatedTTSAudios: {},
        mergedAudio: null,
        errorMessage: null,
        isProcessing: false,
        isPlaying: false,
      };

    case 'SET_DESCRIPTION':
      // Set the session description
      return { ...state, description: action.payload };

    case 'SET_TITLE':
      // Set the session title
      return { ...state, title: action.payload };

    case 'SET_LAST_AUDIO_INPUT_SELECTION':
      // Set the last audio input selection
      devLog('Setting last audio input selection:', action.payload);
      return { ...state, lastAudioInputSelection: action.payload };

    default:
      devLog('Unhandled action type in ttsSessionReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}