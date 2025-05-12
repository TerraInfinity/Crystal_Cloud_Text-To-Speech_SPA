// context/ttsSessionActions.jsx
import { devLog } from '../utils/logUtils';

/**
 * Creates and returns all session-related actions that can be dispatched
 * @param {Function} sessionDispatch - The dispatch function from the session context
 * @param {Function} loadDemoContent - Function to load demo content
 * @returns {Object} Object containing all session action functions
 */
export function createSessionActions(sessionDispatch, loadDemoContent) {
  return {
    /**
     * Sets the input text for TTS
     * @param {string} text - The text to be synthesized
     */
    setInputText: (text) => {
      sessionDispatch({ type: 'SET_INPUT_TEXT', payload: text });
    },

    /**
     * Sets the selected voice for the input text area
     * @param {Object} voice - The voice object to set
     */
    setSelectedInputVoice: (voice) => {
      sessionDispatch({ type: 'SET_SELECTED_INPUT_VOICE', payload: voice });
    },

    /**
     * Sets the input type ('text' or 'audio')
     * @param {string} type - The input type
     */
    setInputType: (type) => {
      sessionDispatch({ type: 'SET_INPUT_TYPE', payload: type });
    },

    /**
     * Sets the current template
     * @param {string} templateId - The ID of the template to set
     */
    setTemplate: (templateId) => {
      sessionDispatch({ type: 'SET_TEMPLATE', payload: templateId });
    },

    /**
     * Sets all sections (overwrites existing sections)
     * @param {Array<Object>} sections - The sections to set
     */
    setSections: (sections) => {
      sessionDispatch({ type: 'SET_SECTIONS', payload: sections });
    },

    /**
     * Adds a new section to the session
     * @param {Object} section - The section to add
     */
    addSection: (section) => {
      sessionDispatch({ type: 'ADD_SECTION', payload: section });
    },

    /**
     * Updates an existing section
     * @param {Object} section - The section with updated properties
     */
    updateSection: (section) => {
      sessionDispatch({ type: 'UPDATE_SECTION', payload: section });
    },

    /**
     * Removes a section by ID
     * @param {string} sectionId - The ID of the section to remove
     */
    removeSection: (sectionId) => {
      sessionDispatch({ type: 'REMOVE_SECTION', payload: sectionId });
    },

    /**
     * Reorders sections
     * @param {Array<Object>} sections - The reordered sections array
     */
    reorderSections: (sections) => {
      sessionDispatch({ type: 'REORDER_SECTIONS', payload: sections });
    },

    /**
     * Sets the active tab ('main', 'tools', or 'settings')
     * @param {string} tab - The tab to set as active
     */
    setActiveTab: (tab) => {
      sessionDispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    },

    /**
     * Sets the processing state
     * @param {boolean} isProcessing - Whether the app is currently processing
     */
    setProcessing: (isProcessing) => {
      sessionDispatch({ type: 'SET_PROCESSING', payload: isProcessing });
    },

    /**
     * Sets an error message
     * @param {string} errorMessage - The error message to display
     */
    setError: (errorMessage) => {
      sessionDispatch({ type: 'SET_ERROR', payload: errorMessage });
    },

    /**
     * Sets a notification message
     * @param {Object} notification - The notification object {type, message}
     */
    setNotification: (notification) => {
      sessionDispatch({ type: 'SET_NOTIFICATION', payload: notification });
    },

    /**
     * Sets generated audio for a specific section
     * @param {string} sectionId - The ID of the section
     * @param {Object} audioData - The audio data {url, blob, etc.}
     */
    setGeneratedAudio: (sectionId, audioData) => {
      if (!audioData || typeof audioData.url !== 'string') {
        devLog('Invalid audio data for setGeneratedAudio:', { sectionId, audioData });
        return;
      }
      
      // Only store the URL and minimal metadata to prevent storage quota issues
      const minimalAudioData = {
        url: audioData.url,
        // Add other essential metadata if needed
        contentType: audioData.contentType || 'audio/wav',
        duration: audioData.duration || null,
        size: audioData.size || null,
      };
      
      sessionDispatch({
        type: 'SET_GENERATED_AUDIO',
        payload: { sectionId, audioData: minimalAudioData },
      });
      devLog(`Set generated audio for section ${sectionId}:`, minimalAudioData);
    },

    /**
     * Sets the merged audio URL for playback
     * @param {string} audioUrl - The URL to the merged audio file
     */
    setMergedAudio: (audioUrl) => {
      // Ensure we're only storing the URL string, not a complex object
      const url = typeof audioUrl === 'object' && audioUrl.url ? audioUrl.url : audioUrl;
      sessionDispatch({ type: 'SET_MERGED_AUDIO', payload: url });
    },

    /**
     * Sets the playing state
     * @param {boolean} isPlaying - Whether audio is currently playing
     */
    setPlaying: (isPlaying) => {
      sessionDispatch({ type: 'SET_PLAYING', payload: isPlaying });
    },

    /**
     * Sets the selected audio from the library
     * @param {string} audioId - The ID of the selected audio
     */
    setSelectedAudio: (audioId) => {
      sessionDispatch({ type: 'SET_SELECTED_AUDIO', payload: audioId });
    },

    /**
     * Sets the voice for a specific section
     * @param {string} sectionId - The ID of the section
     * @param {Object} voice - The voice object to set
     */
    setSectionVoice: (sectionId, voice) => {
      sessionDispatch({
        type: 'SET_SECTION_VOICE',
        payload: { sectionId, voice },
      });
      devLog(`Set voice for section ${sectionId}:`, voice);
    },

    /**
     * Sets voice settings for a specific section
     * @param {string} sectionId - The ID of the section
     * @param {Object} settings - The settings object {pitch, rate, volume}
     */
    setVoiceSettings: (sectionId, settings) => {
      sessionDispatch({
        type: 'SET_VOICE_SETTINGS',
        payload: { sectionId, settings },
      });
      devLog(`Set voice settings for section ${sectionId}:`, settings);
    },
    
    /**
     * Sets the last audio input selection
     * @param {Object} selection - The selection object { audioId, audioCategory }
     */
    setLastAudioInputSelection: (selection) => {
      sessionDispatch({ type: 'SET_LAST_AUDIO_INPUT_SELECTION', payload: selection });
      devLog('Dispatched setLastAudioInputSelection:', selection);
    },

    /**
     * Loads demo content into the session
     */
    loadDemoContent: () => loadDemoContent(sessionDispatch),

    /**
     * Sets the name for a template during creation
     * @param {string} name - The template name
     */
    setTemplateName: (name) => {
      sessionDispatch({ type: 'SET_TEMPLATE_NAME', payload: name });
    },

    /**
     * Sets the description for a template during creation
     * @param {string} description - The template description
     */
    setTemplateDescription: (description) => {
      sessionDispatch({ type: 'SET_TEMPLATE_DESCRIPTION', payload: description });
    },

    /**
     * Sets all sections for template creation
     * @param {Array<Object>} sections - The sections for the template
     */
    setTemplateCreationSections: (sections) => {
      sessionDispatch({ type: 'SET_TEMPLATE_CREATION_SECTIONS', payload: sections });
    },

    /**
     * Adds a section to template creation
     * @param {Object} section - The section to add
     */
    addTemplateCreationSection: (section) => {
      sessionDispatch({ type: 'ADD_TEMPLATE_CREATION_SECTION', payload: section });
    },

    /**
     * Updates a section in template creation
     * @param {number} index - The index of the section to update
     * @param {Object} updates - The properties to update
     */
    updateTemplateCreationSection: (index, updates) => {
      sessionDispatch({ type: 'UPDATE_TEMPLATE_CREATION_SECTION', payload: { index, updates } });
    },

    /**
     * Removes a section from template creation
     * @param {number} index - The index of the section to remove
     */
    removeTemplateCreationSection: (index) => {
      sessionDispatch({ type: 'REMOVE_TEMPLATE_CREATION_SECTION', payload: index });
    },

    /**
     * Moves a template section up in the order
     * @param {number} index - The index of the section to move up
     */
    moveTemplateCreationSectionUp: (index) => {
      sessionDispatch({ type: 'MOVE_TEMPLATE_CREATION_SECTION_UP', payload: index });
    },

    /**
     * Moves a template section down in the order
     * @param {number} index - The index of the section to move down
     */
    moveTemplateCreationSectionDown: (index) => {
      sessionDispatch({ type: 'MOVE_TEMPLATE_CREATION_SECTION_DOWN', payload: index });
    },

    /**
     * Sets the template being edited
     * @param {Object} template - The template to edit
     */
    setEditingTemplate: (template) => {
      sessionDispatch({ type: 'SET_EDITING_TEMPLATE', payload: template });
    },

    /**
     * Clears the template creation form
     */
    clearTemplateCreationForm: () => {
      sessionDispatch({ type: 'CLEAR_TEMPLATE_CREATION_FORM' });
    },
  };
}