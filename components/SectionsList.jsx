/**
 * @fileoverview Sections list component for the Text-to-Speech application.
 * Manages the list of TTS and audio sections, providing functionality for
 * creating, reordering, and rendering sections.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ./SectionCard
 * @requires ../context/TTSSessionContext
 * @requires ../utils/logUtils
 * @requires ../utils/voiceUtils
 * @requires ./SaveToTemplateButton
 */

import React from 'react';
import { useTTSContext } from '../context/TTSContext';
import SectionCard from './SectionCard';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';
import { validateVoice } from '../utils/voiceUtils';
import SaveToTemplateButton from './SaveToTemplateButton';

/**
 * SectionsList component for managing TTS and audio sections.
 * Renders a list of sections and provides functionality to create,
 * move up/down, and reorder sections.
 * 
 * @component
 * @returns {JSX.Element} The rendered SectionsList component
 */
const SectionsList = () => {
  const { state, actions } = useTTSContext(); 
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();

  const sections = sessionState?.sections || []; // Safely access sections with a fallback

  /**
   * Creates a new section with default settings.
   * Adds the section to the session state.
   */
  const createNewSection = () => {
    // Use defaultVoice from TTSContext or fallback
    const ttsDefaultVoice = state?.settings?.defaultVoice || null;
    const activeVoices = state?.settings?.activeVoices || [];
    const defaultVoice = validateVoice(
      ttsDefaultVoice,
      activeVoices,
      ttsDefaultVoice, // Fallback to ttsDefaultVoice if validation fails
      true
    ) || ttsDefaultVoice; // Ensure non-null fallback

    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
  
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-speech',
      text: '',
      voice: defaultVoice,
      voiceSettings: defaultVoiceSettings,
    };
  
    sessionActions.addSection(newSection);
    
    // Reset the loading flag after a short delay to prevent infinite loops
    setTimeout(() => {
      sessionActions.setProcessing(false); // Reset isProcessing
    }, 200);
  };

  /**
   * Moves a section up in the order.
   * Swaps the section with the one above it.
   * 
   * @param {number} index - The index of the section to move up
   */
  const moveUp = (index) => {
    if (index === 0) return;
    const items = Array.from(sections);
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    sessionActions.reorderSections(items);
  };

  /**
   * Moves a section down in the order.
   * Swaps the section with the one below it.
   * 
   * @param {number} index - The index of the section to move down
   */
  const moveDown = (index) => {
    if (index === sections.length - 1) return;
    const items = Array.from(sections);
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    sessionActions.reorderSections(items);
  };

  // If there are no sections, show a message and create section button
  if (sections.length === 0) {
    return (
      <div
        id="empty-sections-container"
        className="rounded-lg p-6 text-center"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          borderStyle: 'solid', // Ensure border is visible
        }}
      >
        <p id="no-sections-message" className="text-gray-600 mb-4">No sections created yet.</p>
        <button
          id="create-section-button"
          onClick={createNewSection}
          className="btn btn-primary"
        >
          Create New Section
        </button>
      </div>
    );
  }

  return (
    <div id="sections-list-container">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Sections</h3>
        <SaveToTemplateButton />
      </div>
      <div id="sections-wrapper" className="mb-4">
        {sections.map((section, index) => (
          <div key={section.id} id={`section-${section.id}`} className="mb-4">
            <SectionCard 
              section={section}
              index={index}
              moveUp={() => moveUp(index)}
              moveDown={() => moveDown(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionsList;