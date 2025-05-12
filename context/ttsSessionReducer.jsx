// context/ttsSessionReducer.jsx
import { devLog } from '../utils/logUtils';

/**
 * Helper function to normalize TTS section objects
 * Ensures consistent structure and default values for section properties
 * 
 * @param {Object} section - The section to normalize
 * @returns {Object} Normalized section with default values applied
 */
const normalizeSection = (section) => {
  devLog('Normalizing section before:', section);
  
  const defaultVoice = {
    engine: 'gtts',
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
  };
  const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

  // Make sure we preserve the original type
  const originalType = section.type || 'text-to-speech';
  
  const normalizedSection = {
    id: section.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: section.title || 'Untitled Section',
    // Preserve the original type exactly as it was
    type: originalType,
    text: section.text || '',
  };

  // Handle voice and voice settings based on the section type
  if (originalType === 'text-to-speech') {
    // Only set a default voice if section.voice is undefined, not if it's null
    normalizedSection.voice = section.voice === undefined ? defaultVoice : section.voice;
    normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
  } else if (originalType === 'audio-only') {
    // Make sure we explicitly set voice and voiceSettings to undefined for audio-only
    normalizedSection.voice = undefined;
    normalizedSection.voiceSettings = undefined;
    
    // Preserve audioId if it exists in the section or updates
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
  switch (action.type) {
    case 'SET_INPUT_TEXT':
      // Set the input text for TTS
      const newInputTextState = { ...state, inputText: action.payload };
      return newInputTextState;

    case 'SET_SELECTED_INPUT_VOICE':
      // Set the selected voice for input text
      const newSelectedVoiceState = { ...state, selectedInputVoice: action.payload };
      return newSelectedVoiceState;

    case 'SET_INPUT_TYPE':
      // Set input type (text or audio)
      const newInputTypeState = { ...state, inputType: action.payload };
      return newInputTypeState;

    case 'SET_TEMPLATE':
      // Set the current template
      const newTemplateState = { ...state, currentTemplate: action.payload };
      return newTemplateState;

    case 'SET_SECTIONS':
      // Set all sections (overwriting existing ones)
      const newSectionsState = {
        ...state,
        sections: action.payload.map(normalizeSection),
      };
      return newSectionsState;

    case 'ADD_SECTION':
      // Add a new section to the end of the sections array
      const newAddSectionState = {
        ...state,
        sections: [...state.sections, normalizeSection(action.payload)],
      };
      return newAddSectionState;

    case 'UPDATE_SECTION':
      // Update an existing section by ID
      devLog('Updating section with payload:', action.payload);
      const updatedSections = state.sections.map((section) =>
        section.id === action.payload.id ? normalizeSection(action.payload) : section
      );
      devLog('Updated sections:', updatedSections);
      const newUpdateSectionState = { ...state, sections: updatedSections };
      return newUpdateSectionState;

    case 'REMOVE_SECTION':
      // Remove a section by ID
      const filteredSections = state.sections.filter((section) => section.id !== action.payload);
      const newRemoveSectionState = { ...state, sections: filteredSections };
      return newRemoveSectionState;

    case 'REORDER_SECTIONS':
      // Reorder all sections based on the provided array
      const newReorderSectionsState = {
        ...state,
        sections: action.payload.map(normalizeSection),
      };
      return newReorderSectionsState;

    case 'SET_ACTIVE_TAB':
      // Set the active tab in the UI
      const newActiveTabState = { ...state, activeTab: action.payload };
      return newActiveTabState;

    case 'SET_PROCESSING':
      // Set the processing state (loading indicator)
      const newProcessingState = { ...state, isProcessing: action.payload };
      return newProcessingState;

    case 'SET_ERROR':
      // Set an error message
      const newErrorState = { ...state, errorMessage: action.payload };
      return newErrorState;

    case 'SET_NOTIFICATION':
      // Set a notification message
      const newNotificationState = { ...state, notification: action.payload };
      return newNotificationState;

    case 'SET_GENERATED_AUDIO':
      // Set generated audio data for a specific section
      const { sectionId, audioData } = action.payload;
      
      // Ensure we only store minimal data (url and essential metadata)
      const minimalAudioData = {
        url: audioData.url,
        contentType: audioData.contentType || 'audio/wav',
        duration: audioData.duration || null,
        size: audioData.size || null
      };
      
      return {
        ...state,
        generatedTTSAudios: {
          ...state.generatedTTSAudios,
          [sectionId]: minimalAudioData,
        },
      };

    case 'SET_MERGED_AUDIO':
      // Set the merged audio URL for playback (ensure it's just a string)
      const mergedAudioUrl = typeof action.payload === 'object' && action.payload?.url
        ? action.payload.url 
        : action.payload;
        
      const newMergedAudioState = { ...state, mergedAudio: mergedAudioUrl };
      return newMergedAudioState;

    case 'SET_PLAYING':
      // Set the playing state for audio playback
      const newPlayingState = { ...state, isPlaying: action.payload };
      return newPlayingState;

    case 'SET_SELECTED_AUDIO':
      // Set the selected audio from the library
      const newSelectedAudioState = { ...state, selectedAudioLibraryId: action.payload };
      return newSelectedAudioState;

    case 'SET_SECTION_VOICE':
      // Set the voice for a specific section
      devLog('Setting voice for section:', action.payload.sectionId, 'Voice:', action.payload.voice);
      const updatedSectionsWithVoice = state.sections.map((section) =>
        section.id === action.payload.sectionId
          ? { ...section, voice: action.payload.voice }
          : section
      );
      devLog('Updated sections with voice:', updatedSectionsWithVoice);
      return { ...state, sections: updatedSectionsWithVoice };

    case 'SET_VOICE_SETTINGS':
      // Set voice settings for a specific section
      devLog('Setting voice settings for section:', action.payload.sectionId, 'Settings:', action.payload.settings);
      const updatedSectionsWithSettings = state.sections.map((section) =>
        section.id === action.payload.sectionId
          ? { ...section, voiceSettings: action.payload.settings }
          : section
      );
      devLog('Updated sections with settings:', updatedSectionsWithSettings);
      return { ...state, sections: updatedSectionsWithSettings };

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
        sections: action.payload.sections ? action.payload.sections.map(normalizeSection) : state.sections,
        templateCreation: action.payload.templateCreation
          ? {
              ...action.payload.templateCreation,
              sections: action.payload.templateCreation.sections.map(normalizeSection),
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
        sections: action.payload.sections.map(normalizeSection),
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
          sections: action.payload.map(normalizeSection),
        },
      };

    case 'ADD_TEMPLATE_CREATION_SECTION':
      // Add a section to template creation
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: [...state.templateCreation.sections, normalizeSection(action.payload)],
        },
      };

    case 'UPDATE_TEMPLATE_CREATION_SECTION':
      // Update a section in template creation
      const { index, updates } = action.payload;
      const newTemplateSections = [...state.templateCreation.sections];
      newTemplateSections[index] = normalizeSection({ ...newTemplateSections[index], ...updates });
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
              voice: null,
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
        notification: null,
        isProcessing: false,
        isPlaying: false
      };

    case 'SET_DESCRIPTION':
      // Set the session description
      return {
        ...state,
        description: action.payload
      };

    case 'SET_TITLE':
      // Set the session title
      return {
        ...state,
        title: action.payload
      };

    case 'SET_LAST_AUDIO_INPUT_SELECTION': // Add this
      devLog('Setting last audio input selection:', action.payload);
      return { ...state, lastAudioInputSelection: action.payload };


    default:
      devLog('Unhandled action type in ttsSessionReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}