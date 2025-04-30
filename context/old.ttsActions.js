// ttsActions.js
import { loadFromStorage, saveToStorage } from './storage';
import { devLog } from '../utils/logUtils'

export function createTtsActions(dispatch, loadDemoContent) {
    return {
        setInputText: (text) => dispatch({ type: 'SET_INPUT_TEXT', payload: text }),
        setInputType: (type) => dispatch({ type: 'SET_INPUT_TYPE', payload: type }),
        setTemplate: (template) => dispatch({ type: 'SET_TEMPLATE', payload: template }),
        addSection: (section) => dispatch({ type: 'ADD_SECTION', payload: section }),
        updateSection: (section) => dispatch({ type: 'UPDATE_SECTION', payload: section }),
        removeSection: (sectionId) => dispatch({ type: 'REMOVE_SECTION', payload: sectionId }),
        reorderSections: (sections) => dispatch({ type: 'REORDER_SECTIONS', payload: sections }),
        setSpeechEngine: (engine) => dispatch({ type: 'SET_SPEECH_ENGINE', payload: engine }),
        setSelectedVoice: (engine, voice) => dispatch({ type: 'SET_SELECTED_VOICE', payload: { engine, voice } }),
        addCustomVoice: (engine, voice) => dispatch({ type: 'ADD_CUSTOM_VOICE', payload: { engine, voice } }),
        removeCustomVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_CUSTOM_VOICE', payload: { engine, voiceId } }),
        addActiveVoice: (engine, voice) => dispatch({ type: 'ADD_ACTIVE_VOICE', payload: { engine, voice } }),
        removeActiveVoice: (engine, voiceId) => dispatch({ type: 'REMOVE_ACTIVE_VOICE', payload: { engine, voiceId } }),
        setApiKey: (keyName, value) => dispatch({ type: 'SET_API_KEY', payload: { keyName, value } }),
        addApiKey: (keyArray, keyValue) => dispatch({ type: 'ADD_API_KEY', payload: { keyArray, keyValue } }),
        removeApiKey: (keyArray, index) => dispatch({ type: 'REMOVE_API_KEY', payload: { keyArray, index } }),
        setActiveTab: (tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
        setMode: (mode) => dispatch({ type: 'SET_MODE', payload: mode }),
        setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
        loadDemoContent,
        setNotification: (notification) => dispatch({ type: 'SET_NOTIFICATION', payload: notification }),
        setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
        setProcessing: (isProcessing) => dispatch({ type: 'SET_PROCESSING', payload: isProcessing }),
        setGeneratedAudio: (sectionId, audioUrl) => {
            devLog('Action: setGeneratedAudio', { sectionId, audioUrl });
            dispatch({ type: 'SET_GENERATED_AUDIO', payload: { sectionId, audioUrl } });
        },
        setMergedAudio: (audioUrl) => {
            devLog('Action: setMergedAudio', audioUrl);
            dispatch({ type: 'SET_MERGED_AUDIO', payload: audioUrl });
        },
        setPlaying: (isPlaying) => dispatch({ type: 'SET_PLAYING', payload: isPlaying }),
        saveAudio: (audioData) => dispatch({ type: 'SAVE_AUDIO', payload: audioData }),
        deleteAudio: (audioId) => dispatch({ type: 'DELETE_AUDIO', payload: audioId }),
        setSelectedAudio: (audioId) => dispatch({ type: 'SET_SELECTED_AUDIO', payload: audioId }),
        updateAudio: (audioId, audioData) =>
            dispatch({ type: 'SAVE_AUDIO', payload: {...audioData, id: audioId } }),
        addAudioToSection: (audio) => {
            const newSection = {
                id: `section-${Date.now()}`,
                title: `Audio: ${audio.name}`,
                type: 'audio-only',
                audioId: audio.id,
            };
            dispatch({ type: 'ADD_SECTION', payload: newSection });
            dispatch({
                type: 'SET_GENERATED_AUDIO',
                payload: { sectionId: newSection.id, audioUrl: audio.url },
            });
        },
        resetState: () => dispatch({ type: 'RESET_STATE' }),
        saveTemplate: (template) => {
            dispatch({ type: 'SAVE_TEMPLATE', payload: template });
            try {
                const templates = loadFromStorage('tts_templates') || {};
                templates[template.id] = template;
                saveToStorage('tts_templates', templates);
            } catch (error) {
                console.error('Error saving template:', error);
            }
        },
        deleteTemplate: (templateId) => {
            dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
            try {
                const templates = loadFromStorage('tts_templates') || {};
                delete templates[templateId];
                saveToStorage('tts_templates', templates);
            } catch (error) {
                console.error('Error deleting template:', error);
            }
        },
        loadTemplates: () => {
            try {
                const templates = loadFromStorage('tts_templates');
                if (templates) {
                    dispatch({ type: 'LOAD_TEMPLATES', payload: templates });
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            }
        },
        setDefaultVoice: (engine, voiceId) =>
            dispatch({ type: 'SET_DEFAULT_VOICE', payload: { engine, voiceId } }),
    };
}