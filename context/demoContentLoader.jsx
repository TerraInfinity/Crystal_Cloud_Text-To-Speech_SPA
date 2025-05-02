// context/demoContentLoader.jsx
import { devLog } from '../utils/logUtils';

// Helper function to normalize sections
const normalizeSection = (section) => {
  const defaultVoice = {
    engine: 'gtts',
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
  };
  const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };

  const normalizedSection = {
    ...section,
    id: section.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: section.type || 'text-to-speech',
  };

  if (section.type === 'text-to-speech') {
    normalizedSection.voice = section.voice || defaultVoice;
    normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
  } else {
    normalizedSection.voice = undefined;
    normalizedSection.voiceSettings = undefined;
  }

  devLog('Normalized section:', normalizedSection);
  return normalizedSection;
};

export const loadDemoContent = async (dispatch) => {
  try {
    dispatch({ type: 'SET_PROCESSING', payload: true });
    const response = await fetch('/demo_kundalini_kriya.json');
    if (!response.ok) throw new Error('Failed to load demo content');
    const demoData = await response.json();

    // Normalize sections
    const normalizedSections = demoData.sections.map(normalizeSection);
    devLog('Normalized demo sections:', normalizedSections);

    dispatch({
      type: 'LOAD_DEMO_CONTENT',
      payload: {
        currentTemplate: 'yogaKriya',
        sections: normalizedSections,
        mode: 'demo',
        speechEngine: 'gtts',
      },
    });
    dispatch({
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: 'Demo content loaded successfully!' },
    });
  } catch (error) {
    dispatch({
      type: 'SET_ERROR',
      payload: `Error loading demo content: ${error.message}`,
    });
  } finally {
    dispatch({ type: 'SET_PROCESSING', payload: false });
  }
};