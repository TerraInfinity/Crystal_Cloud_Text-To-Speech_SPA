/**
 * @fileoverview Templates Tab component for the Text-to-Speech application.
 * Provides functionality for creating, editing, and managing templates
 * that define predefined structures for TTS projects.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires react-icons/fa
 */

import React, { useState, useEffect, useMemo } from 'react';
import {useTTSContext} from '../context/TTSContext';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { FaPlus, FaTrash, FaSave, FaRedo, FaEdit, FaTimes, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { devLog, devDebug } from '../utils/logUtils';

/**
 * TemplatesTab component for creating and managing templates.
 * Allows users to create, edit, save, and delete templates that define
 * predefined structures for TTS projects.
 * 
 * @component
 * @returns {JSX.Element} The rendered TemplatesTab component
 */
const TemplatesTab = () => {
  const { state, actions } = useTTSContext();
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext ();

  const templates = state.templates;
  const audioLibrary = state?.AudioLibrary || {};
  
  /**
   * Get available voices for the template sections.
   * @type {Array}
   */
  const activeVoices = useMemo(() => {
    const voices = Object.values(state.settings.activeVoices || {}).flat();
    return voices.length > 0 ? voices : (state?.settings?.defaultVoices?.gtts || []);
  }, [state.settings.activeVoices, state?.settings?.defaultVoices]);

  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Use templateCreation state from TTSSessionContext
  const { templateName, templateDescription, sections, editingTemplate } = sessionState.templateCreation;

  /**
   * Debug state updates when templates change.
   */
  useEffect(() => {
    devDebug('Templates updated:', templates);
  }, [templates]);

  /**
   * Check if voices are loaded for dropdown selection.
   */
  useEffect(() => {
    devDebug('state.settings.activeVoices:', state.settings.activeVoices);
    devDebug('activeVoices:', activeVoices);
    if (activeVoices.length > 0) {
      setVoicesLoaded(true);
      devLog('Voices loaded, rendering dropdown');
    } else {
      devDebug('No voices loaded yet');
    }
  }, [state.settings.activeVoices, activeVoices]);

  /**
   * Adds a new section to the template being created or edited.
   */
  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-speech',
      text: '',
      voice: null,
      voiceSettings: { pitch: 1, rate: 1, volume: 1 },
    };
    sessionActions.addTemplateCreationSection(newSection);
  };

  /**
   * Updates a section in the template with new values.
   * 
   * @param {number} index - The index of the section to update
   * @param {Object} updates - The properties to update
   */
  const updateSection = (index, updates) => {
    devDebug('Updating section at index:', index, 'with updates:', updates);
    sessionActions.updateTemplateCreationSection(index, updates);
    setTimeout(() => {
      devDebug('Updated templateCreation state after updateSection:', sessionState.templateCreation);
    }, 0);
  };

  /**
   * Removes a section from the template.
   * Ensures at least one section remains in the template.
   * 
   * @param {number} index - The index of the section to remove
   */
  const removeSection = (index) => {
    if (sections.length === 1) {
      sessionActions.setNotification({ type: 'warning', message: 'At least one section is required!' });
      return;
    }
    sessionActions.removeTemplateCreationSection(index);
  };

  /**
   * Moves a section up in the template order.
   * 
   * @param {number} index - The index of the section to move up
   */
  const moveSectionUp = (index) => {
    sessionActions.moveTemplateCreationSectionUp(index);
  };

  /**
   * Moves a section down in the template order.
   * 
   * @param {number} index - The index of the section to move down
   */
  const moveSectionDown = (index) => {
    sessionActions.moveTemplateCreationSectionDown(index);
  };

  /**
   * Saves the current template.
   * Validates and processes sections before saving.
   */
  const saveTemplate = () => {
    if (!templateName.trim()) {
      sessionActions.setError('Please enter a template name');
      return;
    }
    
    // Ensure each section has the correct properties based on type
    const processedSections = sections.map(section => {
      // Create a deep copy to avoid mutation
      const processedSection = { ...section };
      
      // Make sure type is explicitly set
      processedSection.type = section.type || 'text-to-speech';
      
      devDebug('Processing section for template:', processedSection);
      
      if (processedSection.type === 'text-to-speech') {
        // Ensure text-to-speech sections have voice and voiceSettings
        processedSection.voice = section.voice || null;
        processedSection.voiceSettings = section.voiceSettings || { volume: 1, rate: 1, pitch: 1 };
        // Make sure audioId is removed to avoid confusion
        delete processedSection.audioId;
        delete processedSection.audioSource;
      } else if (processedSection.type === 'audio-only') {
        // Ensure audio-only sections don't have voice-related properties
        delete processedSection.voice;
        delete processedSection.voiceSettings;
        // But they should have audioId preserved if it exists
        processedSection.audioId = section.audioId;
        processedSection.audioSource = section.audioSource || 'library';
      }
      
      return processedSection;
    });
    
    const template = {
      id: editingTemplate?.id || `template-${Date.now()}`,
      name: templateName,
      description: templateDescription,
      sections: processedSections,
    };
    
    devLog('Saving template with sections:', processedSections);
    actions.saveTemplate(template);
    devDebug('Saved template:', template);
    handleClearTemplateForm();
    sessionActions.setNotification({ type: 'success', message: 'Template saved successfully!' });
  };

  /**
   * Begins editing an existing template.
   * Loads the template data into the form for editing.
   * 
   * @param {Object} template - The template to edit
   */
  const editTemplate = (template) => {
    if (template.id === 'general') return;
    sessionActions.setEditingTemplate(template);
    sessionActions.setTemplateName(template.name);
    sessionActions.setTemplateDescription(template.description || '');
    sessionActions.setTemplateCreationSections(template.sections);
  };

  /**
   * Ensures all sections have the correct type property.
   */
  useEffect(() => {
    // Check if the initial section is created with proper type
    if (sections.length > 0) {
      sections.forEach((section, index) => {
        // Make sure all sections have the correct type
        if (section.type !== 'text-to-speech' && section.type !== 'audio-only') {
          updateSection(index, { type: 'text-to-speech' });
        }
      });
    }
  }, [sections.length]);

  /**
   * Clears the template form and adds a default section if needed.
   * Wrapper for clearTemplateCreationForm that ensures at least one section exists.
   */
  const handleClearTemplateForm = () => {
    sessionActions.clearTemplateCreationForm();
    
    // After clearing, add a default section if needed
    setTimeout(() => {
      if (sessionState.templateCreation.sections.length === 0) {
        const defaultSection = {
          id: `section-${Date.now()}`,
          title: 'Section 1',
          type: 'text-to-speech',
          text: '',
          voice: null,
          voiceSettings: { pitch: 1, rate: 1, volume: 1 },
        };
        sessionActions.addTemplateCreationSection(defaultSection);
      }
    }, 0);
  };

  devLog('Rendering saved templates:', Object.values(templates || {}));

  return (
    <div className="templates-tab p-4">
      {/* Template Creation/Editing Section */}
      <div className="section-card">
        <div className="header-section flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h2>
          <button onClick={handleClearTemplateForm} className="btn btn-secondary p-2" title="Start Over">
            <FaRedo className="text-lg" />
          </button>
        </div>

        <div className="form-container flex flex-col gap-4">
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="template-name" className="text-sm font-medium text-[var(--text-secondary)]">Template Name</label>
            <input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => sessionActions.setTemplateName(e.target.value)}
              className="input-field"
              placeholder="Enter template name"
            />
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="template-description" className="text-sm font-medium text-[var(--text-secondary)]">Template Description (optional)</label>
            <textarea
              id="template-description"
              value={templateDescription}
              onChange={(e) => sessionActions.setTemplateDescription(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="Enter template description"
            />
          </div>

          <div className="sections-container">
            <div className="header-section flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium">Sections</h3>
              <button onClick={addSection} className="btn btn-secondary p-2" title="Add Section">
                <FaPlus className="text-lg" />
              </button>
            </div>

            {sections.map((section, index) => (
              <div key={section.id} className="section-item flex items-start mb-4">
                {/* Arrows on the left, within the sections-container */}
                <div className="flex flex-col gap-2 mr-1 mt-2">
                  <button
                    onClick={() => moveSectionUp(index)}
                    className={`text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Move Up"
                    disabled={index === 0}
                  >
                    <FaChevronUp className="text-sm" />
                  </button>
                  <button
                    onClick={() => moveSectionDown(index)}
                    className={`text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors ${index === sections.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Move Down"
                    disabled={index === sections.length - 1}
                  >
                    <FaChevronDown className="text-sm" />
                  </button>
                </div>

                {/* Section card content */}
                <div className="section-card flex-1">
                  <div className="section-header flex justify-between items-center mb-4">
                    <input
                      id={`section-title-${section.id}`}
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      className="input-field flex-1 mr-2"
                      placeholder="Section title"
                    />
                    <div className="section-actions flex gap-2">
                      <button
                        onClick={() => removeSection(index)}
                        className="btn btn-danger p-2"
                        title="Remove Section"
                      >
                        <FaTrash className="text-lg" />
                      </button>
                    </div>
                  </div>

                  <div className="section-content flex flex-col gap-4">
                    <div className="form-group flex flex-col gap-2">
                      <label className="text-sm font-medium text-[var(--text-secondary)]">Section Type</label>
                      <select
                        id={`section-type-${section.id}`}
                        value={section.type}
                        onChange={(e) => updateSection(index, { type: e.target.value })}
                        className="select-field"
                      >
                        <option value="text-to-speech">Text to Speech</option>
                        <option value="audio-only">Audio Only</option>
                      </select>
                    </div>

                    {section.type === 'text-to-speech' && (
                      <>
                        <div className="form-group flex flex-col gap-2">
                          <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor={`section-voice-${section.id}`}>Voice</label>
                          {voicesLoaded ? (
                            <select
                              id={`section-voice-${section.id}`}
                              data-testid={`section-voice-${section.id}`}
                              value={section.voice ? `${section.voice.engine}-${section.voice.id}` : ''}
                              onChange={(e) => {
                                const selectedValue = e.target.value;
                                let voice = null;
                                if (selectedValue) {
                                  voice = activeVoices.find(
                                    (v) => `${v.engine}-${v.id}` === selectedValue
                                  );
                                }
                                updateSection(index, { voice });
                              }}
                              className="select-field"
                            >
                              <option value="">Default Voice</option>
                              {activeVoices.map((voice) => (
                                <option
                                  key={`${voice.engine}-${voice.id}`}
                                  value={`${voice.engine}-${voice.id}`}
                                >
                                  {voice.name} ({voice.language}) - {voice.engine}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-yellow-500">Loading voices...</p>
                          )}
                        </div>

                        <div className="form-group flex flex-col gap-2">
                          <label className="text-sm font-medium text-[var(--text-secondary)]">Default Text</label>
                          <textarea
                            id={`section-text-${section.id}`}
                            value={section.text}
                            onChange={(e) => updateSection(index, { text: e.target.value })}
                            className="input-field"
                            rows={4}
                            placeholder="Enter default text or leave empty"
                          />
                        </div>
                      </>
                    )}

                    {section.type === 'audio-only' && (
                      <div className="form-group flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor={`section-audio-${section.id}`}>Select Audio</label>
                        <select
                          id={`section-audio-${section.id}`}
                          data-testid={`section-audio-${section.id}`}
                          value={section.audioId || ''}
                          onChange={(e) => {
                            const audioId = e.target.value;
                            updateSection(index, { audioId: audioId || null });
                          }}
                          className="select-field"
                        >
                          <option value="">Select an audio file...</option>
                          {Object.values(audioLibrary).map((audio) => (
                            <option key={audio.id} value={audio.id}>
                              {audio.name}
                            </option>
                          ))}
                        </select>
                        {section.audioId && audioLibrary[section.audioId] && (
                          <p className="text-sm mt-2 flex items-center" style={{ color: 'var(--text-secondary)' }}>
                            Selected audio: {audioLibrary[section.audioId].name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions flex justify-end gap-2">
            <button id="save-template-btn" onClick={saveTemplate} className="btn btn-primary button-gradient p-2" title="Save Template">
              <FaSave className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* Saved Templates Section */}
      <div className="section-card">
        <h2 className="text-2xl font-semibold mb-4">Saved Templates</h2>
        <div className="templates-list flex flex-col gap-2">
          {Object.values(templates || {}).map(
            (template) =>
              template.id !== 'general' && (
                <div key={template.id} className="template-item section-card flex justify-between items-center">
                  <span className="template-name">
                    {template.name} - {template.description || 'No description'}
                  </span>
                  <div className="template-actions flex gap-2">
                    <button
                      id={`edit-template-${template.id}`}
                      onClick={() => editTemplate(template)}
                      className="btn btn-secondary p-2"
                      title="Edit Template"
                    >
                      <FaEdit className="text-lg" />
                    </button>
                    <button
                      id={`delete-template-${template.id}`}
                      onClick={() => {
                        actions.deleteTemplate(template.id);
                        if (editingTemplate?.id === template.id) handleClearTemplateForm();
                      }}
                      className="btn btn-danger p-2"
                      title="Delete Template"
                    >
                      <FaTimes className="text-lg" />
                    </button>
                  </div>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesTab;