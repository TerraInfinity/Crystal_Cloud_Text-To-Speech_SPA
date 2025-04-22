import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state for the TTS application
const initialState = {
  // Text input state
  inputText: '',
  inputType: 'text', // 'text' or 'audio'
  
  // Template and sections
  currentTemplate: 'general',
  sections: [],
  
  // Speech engine settings
  speechEngine: 'webSpeech', // webSpeech, elevenLabs, awsPolly
  selectedVoice: null,
  availableVoices: [],
  
  // API keys
  elevenLabsApiKey: '',
  awsPollyAccessKey: '',
  awsPollySecretKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  
  // UI state
  activeTab: 'main', // main, tools, settings
  isProcessing: false,
  errorMessage: null,
  notification: null,
  
  // Audio state
  generatedAudios: {},
  mergedAudio: null,
  isPlaying: false,
  
  // Audio library
  savedAudios: {},
  selectedAudioId: null,
  
  // Mode
  mode: 'demo', // demo, production
};

// Reducer to handle all state changes
function ttsReducer(state, action) {
  switch (action.type) {
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };
    
    case 'SET_INPUT_TYPE':
      return { ...state, inputType: action.payload };
      
    case 'SET_TEMPLATE':
      return { ...state, currentTemplate: action.payload };
      
    case 'SET_SECTIONS':
      return { ...state, sections: action.payload };
      
    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.payload] };
      
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map(section => 
          section.id === action.payload.id ? action.payload : section
        )
      };
      
    case 'REMOVE_SECTION':
      return {
        ...state,
        sections: state.sections.filter(section => section.id !== action.payload)
      };
      
    case 'REORDER_SECTIONS':
      return { ...state, sections: action.payload };
      
    case 'SET_SPEECH_ENGINE':
      return { ...state, speechEngine: action.payload };
      
    case 'SET_SELECTED_VOICE':
      return { ...state, selectedVoice: action.payload };
      
    case 'SET_AVAILABLE_VOICES':
      return { ...state, availableVoices: action.payload };
      
    case 'SET_API_KEY':
      return { ...state, [action.payload.key]: action.payload.value };
      
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
      
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
      
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };
      
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
      
    case 'SET_GENERATED_AUDIO':
      return {
        ...state,
        generatedAudios: {
          ...state.generatedAudios,
          [action.payload.sectionId]: action.payload.audioUrl
        }
      };
      
    case 'SET_MERGED_AUDIO':
      return { ...state, mergedAudio: action.payload };
      
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
      
    case 'SAVE_AUDIO':
      return {
        ...state,
        savedAudios: {
          ...state.savedAudios,
          [action.payload.id]: action.payload
        }
      };
      
    case 'DELETE_AUDIO':
      const { [action.payload]: removedAudio, ...remainingAudios } = state.savedAudios;
      return {
        ...state,
        savedAudios: remainingAudios
      };
      
    case 'LOAD_AUDIO_LIBRARY':
      return {
        ...state,
        savedAudios: action.payload
      };
      
    case 'SET_SELECTED_AUDIO':
      return { ...state, selectedAudioId: action.payload };
      
    case 'SET_MODE':
      return { ...state, mode: action.payload };
      
    case 'LOAD_DEMO_CONTENT':
      return { ...state, ...action.payload };
      
    case 'RESET_STATE':
      return { ...initialState };
      
    default:
      return state;
  }
}

// Create context
const TTSContext = createContext();

// Provider component
export const TTSProvider = ({ children }) => {
  const [state, dispatch] = useReducer(ttsReducer, initialState);
  
  // Initialize app data when the component mounts
  useEffect(() => {
    let isMounted = true;
    
    const initApp = () => {
      if (typeof window !== 'undefined' && isMounted) {
        // Initialize voices if speech synthesis is available
        if (window.speechSynthesis) {
          // Get Web Speech API voices
          const synth = window.speechSynthesis;
          
          // Wait for voices to be loaded
          const getVoices = () => {
            if (!isMounted) return;
            
            const voices = synth.getVoices();
            if (voices.length > 0) {
              // Only dispatch if component is still mounted
              dispatch({
                type: 'SET_AVAILABLE_VOICES',
                payload: voices
              });
              
              // Find a good default voice (prefer English)
              const defaultVoice = voices.find(v => v.lang === 'en-US') || voices[0];
              dispatch({
                type: 'SET_SELECTED_VOICE',
                payload: defaultVoice
              });
            } else {
              setTimeout(getVoices, 100);
            }
          };
          
          // Check if voices are already loaded
          if (synth.getVoices().length > 0) {
            getVoices();
          } else {
            // Otherwise wait for voiceschanged event
            synth.addEventListener('voiceschanged', getVoices, { once: true });
          }
        }
        
        // Load saved audio library from localStorage
        try {
          const savedAudioLibrary = localStorage.getItem('tts_audio_library');
          if (savedAudioLibrary) {
            const audios = JSON.parse(savedAudioLibrary);
            dispatch({
              type: 'LOAD_AUDIO_LIBRARY',
              payload: audios
            });
          }
        } catch (error) {
          console.error('Error loading audio library from localStorage:', error);
        }
      }
    };
    
    // Only initialize once
    initApp();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Load demo content
  const loadDemoContent = async () => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      
      // Fetch demo content
      const response = await fetch('/demo_kundalini_kriya.json');
      if (!response.ok) throw new Error('Failed to load demo content');
      
      const demoData = await response.json();
      
      // Update state with demo data
      dispatch({
        type: 'LOAD_DEMO_CONTENT',
        payload: {
          currentTemplate: 'yogaKriya',
          sections: demoData.sections,
          mode: 'demo'
        }
      });
      
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'success', message: 'Demo content loaded successfully!' }
      });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: `Error loading demo content: ${error.message}`
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };
  
  // Clear notification after 5 seconds
  useEffect(() => {
    if (state.notification) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: null });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [state.notification]);
  
  // Prepare the value object with state and actions
  const value = {
    ...state,
    dispatch,
    actions: {
      setInputText: (text) => dispatch({ type: 'SET_INPUT_TEXT', payload: text }),
      setInputType: (type) => dispatch({ type: 'SET_INPUT_TYPE', payload: type }),
      setTemplate: (template) => dispatch({ type: 'SET_TEMPLATE', payload: template }),
      addSection: (section) => dispatch({ type: 'ADD_SECTION', payload: section }),
      updateSection: (section) => dispatch({ type: 'UPDATE_SECTION', payload: section }),
      removeSection: (sectionId) => dispatch({ type: 'REMOVE_SECTION', payload: sectionId }),
      reorderSections: (sections) => dispatch({ type: 'REORDER_SECTIONS', payload: sections }),
      setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
      setSelectedVoice: (voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: voice }),
      setActiveTab: (tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
      setApiKey: (key, value) => dispatch({ type: 'SET_API_KEY', payload: { key, value } }),
      setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
      loadDemoContent,
      setNotification: (notification) => dispatch({ type: 'SET_NOTIFICATION', payload: notification }),
      setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
      setProcessing: (isProcessing) => dispatch({ type: 'SET_PROCESSING', payload: isProcessing }),
      setGeneratedAudio: (sectionId, audioUrl) => 
        dispatch({ type: 'SET_GENERATED_AUDIO', payload: { sectionId, audioUrl } }),
      setMergedAudio: (audioUrl) => dispatch({ type: 'SET_MERGED_AUDIO', payload: audioUrl }),
      setPlaying: (isPlaying) => dispatch({ type: 'SET_PLAYING', payload: isPlaying }),
      
      // Audio library actions
      saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
      deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),
      setSelectedAudio: (audioId) => dispatch({ type: 'SET_SELECTED_AUDIO', payload: audioId }),
      updateAudio: (audioId, audioData) => dispatch({ type: 'SAVE_AUDIO', payload: { ...audioData, id: audioId } }),
      
      // Add audio to a section
      addAudioToSection: (audio) => {
        // First, create a section from the audio
        const newSection = {
          id: `section-${Date.now()}`,
          title: `Audio: ${audio.name}`,
          type: 'audio-only',
          audioId: audio.id
        };
        
        dispatch({ type: 'ADD_SECTION', payload: newSection });
        
        // Then set the generated audio for this section
        dispatch({ 
          type: 'SET_GENERATED_AUDIO',
          payload: { sectionId: newSection.id, audioUrl: audio.url }
        });
      },
      
      resetState: () => dispatch({ type: 'RESET_STATE' })
    }
  };
  
  return (
    <TTSContext.Provider value={value}>
      {children}
    </TTSContext.Provider>
  );
};

// Custom hook to use the TTS context
export const useTTS = () => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};
