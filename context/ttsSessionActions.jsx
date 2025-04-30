// context/ttsSessionActions.jsx
import { devLog } from '../utils/logUtils';

export function createSessionActions(sessionDispatch, loadDemoContent) {
  return {
    /** Set the input text */
    setInputText: (text) => {
      sessionDispatch({ type: 'SET_INPUT_TEXT', payload: text });
    },

    /** Set the selected voice for the input text area */
    setSelectedInputVoice: (voice) => {
      sessionDispatch({ type: 'SET_SELECTED_INPUT_VOICE', payload: voice });
    },

    /** Set the input type ('text' or 'audio') */
    setInputType: (type) => {
      sessionDispatch({ type: 'SET_INPUT_TYPE', payload: type });
    },

    /** Set the current template */
    setTemplate: (templateId) => {
      sessionDispatch({ type: 'SET_TEMPLATE', payload: templateId });
    },

    /** Set all sections (overwrites existing sections) */
    setSections: (sections) => {
      sessionDispatch({ type: 'SET_SECTIONS', payload: sections });
    },

    /** Add a new section */
    addSection: (section) => {
      sessionDispatch({ type: 'ADD_SECTION', payload: section });
    },

    /** Update an existing section */
    updateSection: (section) => {
      sessionDispatch({ type: 'UPDATE_SECTION', payload: section });
    },

    /** Remove a section by ID */
    removeSection: (sectionId) => {
      sessionDispatch({ type: 'REMOVE_SECTION', payload: sectionId });
    },

    /** Reorder sections */
    reorderSections: (sections) => {
      sessionDispatch({ type: 'REORDER_SECTIONS', payload: sections });
    },

    /** Set the active tab ('main', 'tools', or 'settings') */
    setActiveTab: (tab) => {
      sessionDispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    },

    /** Set the processing state (true or false) */
    setProcessing: (isProcessing) => {
      sessionDispatch({ type: 'SET_PROCESSING', payload: isProcessing });
    },

    /** Set an error message */
    setError: (errorMessage) => {
      sessionDispatch({ type: 'SET_ERROR', payload: errorMessage });
    },

    /** Set a notification */
    setNotification: (notification) => {
      sessionDispatch({ type: 'SET_NOTIFICATION', payload: notification });
    },

    /** Set generated audio for a specific section */
    setGeneratedAudio: (sectionId, audioData) => {
      if (!audioData || typeof audioData.url !== 'string') {
        devLog('Invalid audio data for setGeneratedAudio:', { sectionId, audioData });
        return;
      }
      sessionDispatch({
        type: 'SET_GENERATED_AUDIO',
        payload: { sectionId, audioData },
      });
      devLog(`Set generated audio for section ${sectionId}:`, audioData);
    },

    /** Set the merged audio */
    setMergedAudio: (audioUrl) => {
      sessionDispatch({ type: 'SET_MERGED_AUDIO', payload: audioUrl });
    },

    /** Set the playing state (true or false) */
    setPlaying: (isPlaying) => {
      sessionDispatch({ type: 'SET_PLAYING', payload: isPlaying });
    },

    /** Set the selected audio library ID */
    setSelectedAudio: (audioId) => {
      sessionDispatch({ type: 'SET_SELECTED_AUDIO', payload: audioId });
    },

    /** Set the voice for a specific section */
    setSectionVoice: (sectionId, voice) => {
      sessionDispatch({
        type: 'SET_SECTION_VOICE',
        payload: { sectionId, voice },
      });
      devLog(`Set voice for section ${sectionId}:`, voice);
    },

    /** Set voice settings for a specific section */
    setVoiceSettings: (sectionId, settings) => {
      sessionDispatch({
        type: 'SET_VOICE_SETTINGS',
        payload: { sectionId, settings },
      });
      devLog(`Set voice settings for section ${sectionId}:`, settings);
    },

    /** Load demo content */
    loadDemoContent: () => loadDemoContent(sessionDispatch),

    // New actions for templateCreation
    setTemplateName: (name) => {
      sessionDispatch({ type: 'SET_TEMPLATE_NAME', payload: name });
    },

    setTemplateDescription: (description) => {
      sessionDispatch({ type: 'SET_TEMPLATE_DESCRIPTION', payload: description });
    },

    setTemplateCreationSections: (sections) => {
      sessionDispatch({ type: 'SET_TEMPLATE_CREATION_SECTIONS', payload: sections });
    },

    addTemplateCreationSection: (section) => {
      sessionDispatch({ type: 'ADD_TEMPLATE_CREATION_SECTION', payload: section });
    },

    updateTemplateCreationSection: (index, updates) => {
      sessionDispatch({ type: 'UPDATE_TEMPLATE_CREATION_SECTION', payload: { index, updates } });
    },

    removeTemplateCreationSection: (index) => {
      sessionDispatch({ type: 'REMOVE_TEMPLATE_CREATION_SECTION', payload: index });
    },

    moveTemplateCreationSectionUp: (index) => {
      sessionDispatch({ type: 'MOVE_TEMPLATE_CREATION_SECTION_UP', payload: index });
    },

    moveTemplateCreationSectionDown: (index) => {
      sessionDispatch({ type: 'MOVE_TEMPLATE_CREATION_SECTION_DOWN', payload: index });
    },

    setEditingTemplate: (template) => {
      sessionDispatch({ type: 'SET_EDITING_TEMPLATE', payload: template });
    },

    clearTemplateCreationForm: () => {
      sessionDispatch({ type: 'CLEAR_TEMPLATE_CREATION_FORM' });
    },
  };
}