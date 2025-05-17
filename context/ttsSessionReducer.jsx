// src/reducers/ttsSessionReducer.jsx
import { devLog, devWarn } from '../utils/logUtils';
import { Voice, validateVoice, validateVoiceObject } from '../utils/voiceUtils';
import { isValidDataUrl } from '../utils/AudioProcessor';
import { isValidAudioUrl } from '../utils/audioUtils';

/**
 * Helper function to normalize TTS section objects
 * Ensures consistent structure and validates voices against activeVoices
 * 
 * @param {Object} section - The section to normalize
 * @param {Array} activeVoices - List of active voices from context
 * @param {Object} defaultVoice - Default voice from context
 * @param {boolean} shouldLog - Whether to log warnings about voice validation
 * @returns {Object} Normalized section with validated voice
 */
const normalizeSection = (section, activeVoices, defaultVoice, shouldLog = true) => {
  const shouldDebugLog = process.env.NODE_ENV === 'development' && false;
  
  if (shouldDebugLog) devLog('Normalizing section before:', section);

  const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
  const originalType = section.type || 'text-to-speech';

  const normalizedSection = {
    id: section.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: section.title || 'Untitled Section',
    type: originalType,
    text: section.text || '',
  };
  
  // Preserve audioUrl for ALL section types
  if (section.audioUrl) {
    normalizedSection.audioUrl = section.audioUrl;
    if (shouldLog) devLog(`Preserving audioUrl in section ${section.id}:`, section.audioUrl);
  }

  if (originalType === 'text-to-speech') {
    if (section.voice) {
      const formattedVoice = validateVoiceObject(section.voice);
      const activeVoice = validateVoice(formattedVoice, activeVoices, null, false);
      normalizedSection.voice = activeVoice || formattedVoice;
      
      if (shouldLog && !activeVoice) {
        devLog('Template voice not in active voices, but preserving it:', formattedVoice);
      }
    } else {
      normalizedSection.voice = defaultVoice;
      if (shouldLog) devLog('No voice specified, using default voice');
    }
    
    normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
  } else if (originalType === 'audio-only') {
    normalizedSection.voice = undefined;
    normalizedSection.voiceSettings = undefined;
    if ('audioId' in section) normalizedSection.audioId = section.audioId;
    if ('audioSource' in section) normalizedSection.audioSource = section.audioSource;
  }

  if (shouldDebugLog) devLog('Normalized section after:', normalizedSection);
  return normalizedSection;
};

export function ttsSessionReducer(state, action) {
  const activeVoices = action.context?.activeVoices || [];
  const defaultVoice = action.context?.defaultVoice || {
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
    engine: 'gtts',
  };

  switch (action.type) {
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };

    case 'SET_SELECTED_INPUT_VOICE':
      devLog('Setting selected input voice:', action.payload);
      return {
        ...state,
        selectedInputVoice: action.payload
          ? validateVoice(action.payload, activeVoices, defaultVoice)
          : null,
      };

    case 'SET_INPUT_TYPE':
      return { ...state, inputType: action.payload };

    case 'SET_TEMPLATE':
      return { ...state, currentTemplate: action.payload };

    case 'SET_SECTIONS':
      return {
        ...state,
        sections: action.payload.map(section =>
          normalizeSection(section, activeVoices, defaultVoice, false)
        ),
        isLoadingDemo: true,
        isProcessing: false, // Reset isProcessing
      };

    case 'ADD_SECTION':
      return {
        ...state,
        sections: [
          ...state.sections,
          normalizeSection(action.payload, activeVoices, defaultVoice, true),
        ],
        isLoadingDemo: true,
        isProcessing: false, // Reset isProcessing
      };

    case 'UPDATE_SECTION':
      devLog('Updating section with payload:', action.payload);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.id
            ? normalizeSection(action.payload, activeVoices, defaultVoice, false)
            : section
        ),
        isProcessing: false, // Reset isProcessing
      };

    case 'REMOVE_SECTION':
      return {
        ...state,
        sections: state.sections.filter(section => section.id !== action.payload),
        isProcessing: false, // Reset isProcessing
      };

    case 'REORDER_SECTIONS':
      return {
        ...state,
        sections: action.payload.map(section =>
          normalizeSection(section, activeVoices, defaultVoice, false)
        ),
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload, isProcessing: false }; // Reset isProcessing

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload, isProcessing: false }; // Reset isProcessing

    case 'SET_GENERATED_AUDIO':
      const { sectionId, audioData } = action.payload;
      const minimalAudioData = audioData ? {
        url: audioData.url,
        contentType: audioData.contentType || audioData.type || 'audio/wav',
        duration: audioData.duration || null,
        size: audioData.size || null,
        source: audioData.source || null,
        name: audioData.name || null,
        type: audioData.type || null,
        format: audioData.format || null,
      } : null;
      
      // Also update the section with audioUrl directly
      const updatedSections = minimalAudioData && minimalAudioData.url ? 
        state.sections.map(section => {
          if (section.id === sectionId) {
            let fullUrl = minimalAudioData.url;
            
            // For data URLs, validate completeness
            if (fullUrl.startsWith('data:')) {
              const isValid = isValidDataUrl(fullUrl);
              devLog(`SET_GENERATED_AUDIO: Data URL validation for section ${sectionId}: ${isValid ? 'VALID' : 'INVALID'}`);
              
              if (isValid) {
                devLog(`SET_GENERATED_AUDIO: Data URL length: ${fullUrl.length}`);
                devLog(`SET_GENERATED_AUDIO: Data URL start: ${fullUrl.substring(0, 50)}`);
                devLog(`SET_GENERATED_AUDIO: Data URL end: ${fullUrl.substring(fullUrl.length - 10)}`);
              } else {
                devLog(`SET_GENERATED_AUDIO: Invalid or incomplete data URL for section ${sectionId}`);
              }
              
              return { ...section, audioUrl: fullUrl };
            }
            
            // For blob URLs, preserve them as-is
            if (fullUrl.startsWith('blob:')) {
              devLog(`SET_GENERATED_AUDIO: Preserving blob URL as-is`);
              return { ...section, audioUrl: fullUrl };
            }
            
            // For http URLs, preserve them as-is
            if (fullUrl.startsWith('http')) {
              devLog(`SET_GENERATED_AUDIO: Preserving http URL as-is`);
              return { ...section, audioUrl: fullUrl };
            }
            
            // If it's a relative URL, convert it to a full URL
            const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
            // Ensure the URL starts with a slash if it doesn't already
            const normalizedPath = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
            fullUrl = `${serverUrl}${normalizedPath}`;
            devLog(`SET_GENERATED_AUDIO: Converting relative URL to full URL: ${minimalAudioData.url} -> ${fullUrl}`);
            
            return { ...section, audioUrl: fullUrl };
          }
          return section;
        }) : 
        state.sections;
      
      devLog(`SET_GENERATED_AUDIO: Updating audioUrl for section ${sectionId}:`, 
        minimalAudioData ? (minimalAudioData.url.startsWith('data:') ? 
          `${minimalAudioData.url.substring(0, 50)}... (length: ${minimalAudioData.url.length})` : 
          minimalAudioData.url) : 'null');
      
      return {
        ...state,
        sections: updatedSections,
        generatedTTSAudios: {
          ...state.generatedTTSAudios,
          [sectionId]: minimalAudioData,
        },
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_MERGED_AUDIO':
      const mergedAudioUrl =
        typeof action.payload === 'object' && action.payload?.url
          ? action.payload.url
          : action.payload;
      
      // Validate the mergedAudio URL
      const isValidMergedUrl = mergedAudioUrl ? isValidAudioUrl(mergedAudioUrl) : false;
      
      if (mergedAudioUrl && !isValidMergedUrl) {
        devWarn('Invalid merged audio URL:', mergedAudioUrl);
        return { ...state, isProcessing: false }; // Don't update with invalid URL
      }
      
      devLog('Setting merged audio URL:', mergedAudioUrl);
      return { ...state, mergedAudio: mergedAudioUrl, isProcessing: false }; // Reset isProcessing

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'SET_SELECTED_AUDIO':
      return { ...state, selectedAudioLibraryId: action.payload };

    case 'SET_SECTION_VOICE':
      devLog('Setting voice for section:', action.payload.sectionId, 'Voice:', action.payload.voice);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.sectionId
            ? {
                ...section,
                voice: validateVoice(action.payload.voice, activeVoices, defaultVoice),
                audioUrl: section.audioUrl,
              }
            : section
        ),
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_VOICE_SETTINGS':
      devLog('Setting voice settings for section:', action.payload.sectionId, 'Settings:', action.payload.settings);
      return {
        ...state,
        sections: state.sections.map(section =>
          section.id === action.payload.sectionId
            ? { 
                ...section, 
                voiceSettings: action.payload.settings,
                // Explicitly preserve audioUrl when updating voice settings
                audioUrl: section.audioUrl 
              }
            : section
        ),
        isProcessing: false, // Reset isProcessing
      };

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
        sections: action.payload.sections
          ? action.payload.sections.map(section =>
              normalizeSection(section, activeVoices, defaultVoice, false)
            )
          : state.sections,
        templateCreation: action.payload.templateCreation
          ? {
              ...action.payload.templateCreation,
              sections: action.payload.templateCreation.sections.map(section =>
                normalizeSection(section, activeVoices, defaultVoice, false)
              ),
            }
          : state.templateCreation,
        generatedTTSAudios: normalizedGeneratedAudios,
        isProcessing: false, // Reset isProcessing
      };

    case 'LOAD_DEMO_CONTENT':
      devLog('Loading demo content:', action.payload);
      return {
        ...state,
        currentTemplate: action.payload.currentTemplate,
        sections: action.payload.sections,
        isLoadingDemo: true,
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_TEMPLATE_NAME':
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateName: action.payload },
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_TEMPLATE_DESCRIPTION':
      return {
        ...state,
        templateCreation: { ...state.templateCreation, templateDescription: action.payload },
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_TEMPLATE_CREATION_SECTIONS':
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: action.payload.map(section =>
            normalizeSection(section, activeVoices, defaultVoice)
          ),
        },
        isProcessing: false, // Reset isProcessing
      };

    case 'ADD_TEMPLATE_CREATION_SECTION':
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: [
            ...state.templateCreation.sections,
            normalizeSection(action.payload, activeVoices, defaultVoice),
          ],
        },
        isProcessing: false, // Reset isProcessing
      };

    case 'UPDATE_TEMPLATE_CREATION_SECTION':
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
        isProcessing: false, // Reset isProcessing
      };

    case 'REMOVE_TEMPLATE_CREATION_SECTION':
      if (state.templateCreation.sections.length === 1) return state;
      return {
        ...state,
        templateCreation: {
          ...state.templateCreation,
          sections: state.templateCreation.sections.filter((_, i) => i !== action.payload),
        },
        isProcessing: false, // Reset isProcessing
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
        isProcessing: false, // Reset isProcessing
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
        isProcessing: false, // Reset isProcessing
      };

    case 'SET_EDITING_TEMPLATE':
      return {
        ...state,
        templateCreation: { ...state.templateCreation, editingTemplate: action.payload },
        isProcessing: false, // Reset isProcessing
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
              voice: validateVoice(null, activeVoices, defaultVoice),
              voiceSettings: { pitch: 1, rate: 1, volume: 1 },
            },
          ],
          editingTemplate: null,
        },
        isProcessing: false, // Reset isProcessing
      };

    case 'RESET_SESSION':
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
      return { ...state, description: action.payload, isProcessing: false }; // Reset isProcessing

    case 'SET_TITLE':
      return { ...state, title: action.payload, isProcessing: false }; // Reset isProcessing

    case 'SET_LAST_AUDIO_INPUT_SELECTION':
      devLog('Setting last audio input selection:', action.payload);
      return { ...state, lastAudioInputSelection: action.payload, isProcessing: false }; // Reset isProcessing

    case 'SET_NOTIFICATION':
      return {
        ...state,
        notification: action.payload,
        isProcessing: false, // Reset isProcessing
      };

    case 'RESET_LOADING_FLAG':
      return {
        ...state,
        isLoadingDemo: false,
        isProcessing: false, // Reset isProcessing
      };

    default:
      devLog('Unhandled action type in ttsSessionReducer:', action.type, 'Payload:', action.payload);
      return state;
  }
}