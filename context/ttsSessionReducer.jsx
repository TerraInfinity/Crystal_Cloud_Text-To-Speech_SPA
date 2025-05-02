// context/ttsSessionReducer.jsx
import { devLog } from '../utils/logUtils';

// Helper function to normalize sections
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

// The rest of the file remains unchanged
export function ttsSessionReducer(state, action) {
  switch (action.type) {
    case 'SET_INPUT_TEXT':
      const newInputTextState = { ...state, inputText: action.payload };
      return newInputTextState;

    case 'SET_SELECTED_INPUT_VOICE':
      const newSelectedVoiceState = { ...state, selectedInputVoice: action.payload };
      return newSelectedVoiceState;

    case 'SET_INPUT_TYPE':
      const newInputTypeState = { ...state, inputType: action.payload };
      return newInputTypeState;

    case 'SET_TEMPLATE':
      const newTemplateState = { ...state, currentTemplate: action.payload };
      return newTemplateState;

    case 'SET_SECTIONS':
      const newSectionsState = {
        ...state,
        sections: action.payload.map(normalizeSection),
      };
      return newSectionsState;

    case 'ADD_SECTION':
      const newAddSectionState = {
        ...state,
        sections: [...state.sections, normalizeSection(action.payload)],
      };
      return newAddSectionState;

    case 'UPDATE_SECTION':
      devLog('Updating section with payload:', action.payload);
      const updatedSections = state.sections.map((section) =>
        section.id === action.payload.id ? normalizeSection(action.payload) : section
      );
      devLog('Updated sections:', updatedSections);
      const newUpdateSectionState = { ...state, sections: updatedSections };
      return newUpdateSectionState;

    case 'REMOVE_SECTION':
      const filteredSections = state.sections.filter((section) => section.id !== action.payload);
      const newRemoveSectionState = { ...state, sections: filteredSections };
      return newRemoveSectionState;

    case 'REORDER_SECTIONS':
      const newReorderSectionsState = {
        ...state,
        sections: action.payload.map(normalizeSection),
      };
      return newReorderSectionsState;

    case 'SET_ACTIVE_TAB':
      const newActiveTabState = { ...state, activeTab: action.payload };
      return newActiveTabState;

    case 'SET_PROCESSING':
      const newProcessingState = { ...state, isProcessing: action.payload };
      return newProcessingState;

    case 'SET_ERROR':
      const newErrorState = { ...state, errorMessage: action.payload };
      return newErrorState;

    case 'SET_NOTIFICATION':
      const newNotificationState = { ...state, notification: action.payload };
      return newNotificationState;

    case 'SET_GENERATED_AUDIO':
      const { sectionId, audioData } = action.payload;
      return {
        ...state,
        generatedTTSAudios: {
          ...state.generatedTTSAudios,
          [sectionId]: audioData,
        },
      };

    case 'SET_MERGED_AUDIO':
      const newMergedAudioState = { ...state, mergedAudio: action.payload };
      return newMergedAudioState;

    case 'SET_PLAYING':
      const newPlayingState = { ...state, isPlaying: action.payload };
      return newPlayingState;

    case 'SET_SELECTED_AUDIO':
      const newSelectedAudioState = { ...state, selectedAudioLibraryId: action.payload };
      return newSelectedAudioState;

    case 'SET_SECTION_VOICE':
      devLog('Setting voice for section:', action.payload.sectionId, 'Voice:', action.payload.voice);
      const updatedSectionsWithVoice = state.sections.map((section) =>
        section.id === action.payload.sectionId
          ? { ...section, voice: action.payload.voice }
          : section
      );
      devLog('Updated sections with voice:', updatedSectionsWithVoice);
      return { ...state, sections: updatedSectionsWithVoice };

    case 'SET_VOICE_SETTINGS':
      devLog('Setting voice settings for section:', action.payload.sectionId, 'Settings:', action.payload.settings);
      const updatedSectionsWithSettings = state.sections.map((section) =>
        section.id === action.payload.sectionId
          ? { ...section, voiceSettings: action.payload.settings }
          : section
      );
      devLog('Updated sections with settings:', updatedSectionsWithSettings);
      return { ...state, sections: updatedSectionsWithSettings };

    case 'LOAD_SESSION_STATE':
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
      devLog('Loading demo content:', action.payload);
      return {
        ...state,
        currentTemplate: action.payload.currentTemplate,
        sections: action.payload.sections.map(normalizeSection),
        mode: action.payload.mode,
        speechEngine: action.payload.speechEngine,
      };

    // New actions for templateCreation
    case 'SET_TEMPLATE_NAME':
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateName: action.payload },
      };

    case 'SET_TEMPLATE_DESCRIPTION':
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateDescription: action.payload },
      };

    case 'SET_TEMPLATE_CREATION_SECTIONS':
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: action.payload.map(normalizeSection),
        },
      };

    case 'ADD_TEMPLATE_CREATION_SECTION':
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: [...state.templateCreation.sections, normalizeSection(action.payload)],
        },
      };

    case 'UPDATE_TEMPLATE_CREATION_SECTION':
      const { index, updates } = action.payload;
      const newTemplateSections = [...state.templateCreation.sections];
      newTemplateSections[index] = normalizeSection({ ...newTemplateSections[index], ...updates });
      return {
        ...state,
        templateCreation: { ...state.templateCreation, sections: newTemplateSections },
      };

    case 'REMOVE_TEMPLATE_CREATION_SECTION':
      if (state.templateCreation.sections.length === 1) return state;
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: state.templateCreation.sections.filter((_, i) => i !== action.payload),
        },
      };

    case 'MOVE_TEMPLATE_CREATION_SECTION_UP':
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
      return {
        ...state,
        templateCreation: { ...state.templateCreation, editingTemplate: action.payload },
      };

    case 'CLEAR_TEMPLATE_CREATION_FORM':
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

    default:
      devLog('Unhandled action type in ttsSessionReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}