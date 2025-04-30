// context/ttsActions.jsx
import { saveToStorage, removeFromStorage, listFromStorage, updateFileMetadata, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';

export function createTtsActions(dispatch) {
  return {
    setStorageConfig: (config) => dispatch({ type: 'SET_STORAGE_CONFIG', payload: config }),
    setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
    setSelectedVoice: (engine, voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: { engine, voice } }),
    addCustomVoice: (engine, voice) => dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice } }),
    removeCustomVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } }),
    addActiveVoice: (engine, voice) => dispatch({ type: 'ADD_ACTIVE_VOICE', payload: { engine, voice } }),
    removeActiveVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } }),
    setApiKey: (keyName, value) => dispatch({ type: 'SET_API_KEY', payload: { keyName, value } }),
    addApiKey: (keyArray, keyValue) => dispatch({ type: 'ADD_API_KEY', payload: { keyArray, keyValue } }),
    removeApiKey: (keyArray, index) => dispatch({ type: 'REMOVE_API_KEY', payload: { keyArray, index } }),
    setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),

    // Action to upload an audio file
    uploadAudio: async (file, audioData) => {
      try {
        // Extract metadata to send to the server
        const metadata = {
          category: audioData.category || 'sound_effect',
          name: audioData.name,
          placeholder: audioData.placeholder,
          volume: audioData.volume.toString(),
        };
        const url = await saveToStorage(file.name, file, 'fileStorage', metadata);
        const updatedAudioData = { ...audioData, url };
        dispatch({ type: 'SAVE_AUDIO', payload: updatedAudioData });
      } catch (error) {
        console.error('Error uploading audio:', error);
        throw error;
      }
    },

    // Action to delete an audio file
    deleteAudioFromStorage: async (audioId, filename) => {
      try {
        await removeFromStorage(filename, 'fileStorage');
        dispatch({ type: 'DELETE_AUDIO', payload: audioId });
      } catch (error) {
        console.error('Error deleting audio:', error);
        throw error;
      }
    },

    // Action to list audio files from storage
    listFromStorage: async (storageType) => {
      try {
        return await listFromStorage(storageType);
      } catch (error) {
        console.error('Error listing from storage:', error);
        throw error;
      }
    },

    // Action to update audio metadata (e.g., placeholder, volume)
    updateAudio: async (audioId, updatedAudioData) => {
      try {
        console.log('Updating audio with ID:', audioId, 'Data:', updatedAudioData);
        // Update metadata on server using audioId (UUID)
        const updatedMetadata = await updateFileMetadata(audioId, {
          name: updatedAudioData.name || '',
          placeholder: updatedAudioData.placeholder || '',
          volume: typeof updatedAudioData.volume === 'number' ? updatedAudioData.volume : 1,
        });
        
        // Update local state with server response
        dispatch({ type: 'SAVE_AUDIO', payload: { ...updatedAudioData, ...updatedMetadata } });
      } catch (error) {
        console.error('Error updating audio metadata:', error);
        throw error;
      }
    },

    // Action to load the audio library
    loadAudioLibrary: (audioLibrary) => {
      dispatch({ type: 'LOAD_AUDIO_LIBRARY', payload: audioLibrary });
    },

    saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
    deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),

    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
      saveToStorage('tts_persistent_state', initialPersistentState, 'localStorage');
    },

    saveTemplate: async (template) => {
      dispatch({ type: 'SAVE_TEMPLATE', payload: template });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        templates[template.id] = template;
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        console.error('Error saving template:', error);
        throw error;
      }
    },

    deleteTemplate: async (templateId) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      try {
        const templates = (await loadFromStorage('tts_templates', false, 'localStorage')) || {};
        delete templates[templateId];
        await saveToStorage('tts_templates', templates, 'localStorage');
      } catch (error) {
        console.error('Error deleting template:', error);
        throw error;
      }
    },

    loadTemplates: async () => {
      try {
        const templates = await loadFromStorage('tts_templates', false, 'localStorage');
        if (templates) {
          dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        throw error;
      }
    },

    setDefaultVoice: (engine, voiceId) =>
      dispatch({ type: 'SET_DEFAULT_VOICE', payload: { engine, voiceId } }),
    
  };
  
}