// context/demoContentLoader.jsx
import { devLog } from '../utils/logUtils';

/**
 * Loads demo content from the server and dispatches it to the application state
 * @param {Function} dispatch - The dispatch function from the TTS reducer context
 * @returns {Promise<void>} A promise that resolves when the demo content is loaded
 */
export const loadDemoContent = async (dispatch) => {
  try {
    // Start processing
    dispatch({ type: 'SET_PROCESSING', payload: true });
    
    // Load the demo content
    const response = await fetch('/demo_kundalini_kriya.json');
    if (!response.ok) throw new Error('Failed to load demo content');
    const demoData = await response.json();

    // Set the template name first
    dispatch({
      type: 'SET_TEMPLATE',
      payload: 'yogaKriya'
    });
    
    // Reset the session before loading new content to avoid conflicts
    dispatch({ type: 'RESET_SESSION' });
    
    // Use the global ttsState to get defaultVoice for the sections
    const defaultVoice = window.ttsState?.settings.defaultVoice;
    
    // Process sections and assign default voice where needed
    const sections = demoData.sections.map(section => {
      // Only process text-to-speech sections
      if (section.type === 'text-to-speech' && !section.voice && defaultVoice) {
        return {
          ...section,
          voice: defaultVoice
        };
      }
      return section;
    });

    // Use LOAD_DEMO_CONTENT action type for direct loading
    dispatch({
      type: 'LOAD_DEMO_CONTENT',
      payload: {
        currentTemplate: 'yogaKriya',
        sections
      }
    });
    
    // Set notification
    dispatch({ 
      type: 'SET_NOTIFICATION', 
      payload: { 
        type: 'success', 
        message: 'Demo content loaded successfully!' 
      } 
    });
    
    // After a short delay, reset the isLoadingDemo flag to prevent infinite loops
    setTimeout(() => {
      dispatch({ type: 'RESET_LOADING_FLAG' });
    }, 500);
  } catch (error) {
    dispatch({
      type: 'SET_ERROR',
      payload: `Error loading demo content: ${error.message}`,
    });
  } finally {
    dispatch({ type: 'SET_PROCESSING', payload: false });
  }
};