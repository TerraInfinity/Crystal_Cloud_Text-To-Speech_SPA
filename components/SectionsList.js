import React from 'react';
import { useTTS } from '../context/TTSContext';
import SectionCard from './SectionCard';

const SectionsList = () => {
  const { sections, actions } = useTTS();
  
  // Create a new section
  const createNewSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-audio',
      text: '',
      voice: null,
    };
    
    actions.addSection(newSection);
  };
  
  // Move section up
  const moveUp = (index) => {
    if (index === 0) return;
    const items = Array.from(sections);
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    actions.reorderSections(items);
  };
  
  // Move section down
  const moveDown = (index) => {
    if (index === sections.length - 1) return;
    const items = Array.from(sections);
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    actions.reorderSections(items);
  };
  
  // If there are no sections, show a message and create section button
  if (sections.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
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
      
      <div className="mt-4 flex justify-center">
        <button
          onClick={createNewSection}
          className="btn btn-secondary"
        >
          Add New Section
        </button>
      </div>
    </div>
  );
};

export default SectionsList;
