import React from 'react';
import { useTTS } from '../context/TTSContext';
import SectionCard from './SectionCard';
import { useTTSSession } from '../context/TTSSessionContext';

const SectionsList = () => {
  const { state, actions } = useTTS(); 
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const sections = sessionState?.sections || []; // Safely access sections with a fallback
 


  // Create a new section
  const createNewSection = () => {
    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
  
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-audio', // Default to text-to-audio
      text: '',
    };
  
    if (newSection.type === 'text-to-audio') {
      newSection.voice = defaultVoice;
      newSection.voiceSettings = defaultVoiceSettings;
    }
  
    devLog('Creating new section:', newSection);
    sessionActions.addSection(newSection);
  };

  // Move section up
  const moveUp = (index) => {
    if (index === 0) return;
    const items = Array.from(sections);
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    sessionActions.reorderSections(items);
  };

  // Move section down
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
        className="rounded-lg p-6 text-center"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          borderStyle: 'solid', // Ensure border is visible
        }}
      >
        <p className="text-gray-600 mb-4">No sections created yet.</p>
        <button
          onClick={createNewSection}
          className="btn btn-primary"
        >
          Create New Section
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        {sections.map((section, index) => (
          <div key={section.id} className="mb-4">
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