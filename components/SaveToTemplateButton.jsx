/**
 * @fileoverview Save to Template Button component for the Text-to-Speech application.
 * Provides functionality for saving the current set of sections as a new template
 * through a modal interface.
 * 
 * @requires React
 * @requires react-icons/fa
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../context/notificationContext
 */

import React, { useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { useNotification } from '../context/notificationContext';

/**
 * SaveToTemplateButton component that allows users to save their current sections
 * as a new template that can be reused later.
 * 
 * @component
 * @returns {JSX.Element} The rendered SaveToTemplateButton component
 */
const SaveToTemplateButton = () => {
  const { actions: ttsActions } = useTTSContext();
  const { state: sessionState } = useTTSSessionContext();
  const { addNotification } = useNotification();

  // State for modal visibility and form fields
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  /**
   * Opens the save template modal after validating sections exist
   */
  const openSaveTemplateModal = () => {
    if (sessionState.sections.length === 0) {
      addNotification({
        type: 'warning',
        message: 'No sections available to save as a template.',
      });
      return;
    }
    setShowModal(true);
  };

  /**
   * Saves the current sections as a new template
   */
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      addNotification({
        type: 'error',
        message: 'Please provide a template name.',
      });
      return;
    }

    // Format sections for template storage (strip out any unnecessary properties)
    const templateSections = sessionState.sections.map(section => {
      const templateSection = {
        id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: section.title,
        type: section.type,
        text: section.text || '',
      };

      if (section.type === 'text-to-speech') {
        templateSection.voice = section.voice;
        templateSection.voiceSettings = section.voiceSettings;
      } else if (section.type === 'audio-only') {
        templateSection.audioId = section.audioId;
        templateSection.audioSource = section.audioSource;
      }

      return templateSection;
    });

    // Create new template object
    const newTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      description: templateDescription,
      sections: templateSections,
    };

    // Save the template using the TTSContext actions
    ttsActions.saveTemplate(newTemplate);
    
    // Reset form and close modal
    setTemplateName('');
    setTemplateDescription('');
    setShowModal(false);

    // Notify user
    addNotification({
      type: 'success',
      message: `Template "${templateName}" saved successfully.`,
    });
  };

  return (
    <>
      {/* Save as Template Button */}
      <button 
        id="save-as-template-button"
        onClick={openSaveTemplateModal}
        className="btn btn-sm btn-outline flex items-center gap-1"
        title="Save as Template"
      >
        <FaSave /> Save as Template
      </button>

      {/* Save Template Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium">Save as Template</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-[var(--text-secondary)] hover:text-[var(--text-color)]"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="mb-4">
              <label htmlFor="template-name" className="block text-sm font-medium mb-1">Template Name</label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="input-field w-full"
                placeholder="Enter template name"
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="template-description" className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                className="input-field w-full"
                rows={3}
                placeholder="Enter template description"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowModal(false)} 
                className="btn btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTemplate} 
                className="btn btn-primary px-4 py-2 flex items-center gap-2"
              >
                <FaSave /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SaveToTemplateButton; 