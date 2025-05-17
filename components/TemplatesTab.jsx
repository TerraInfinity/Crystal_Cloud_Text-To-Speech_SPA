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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTTSContext, useFileStorage } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { FaPlus, FaTrash, FaSave, FaRedo, FaEdit, FaTimes, FaChevronUp, FaChevronDown, FaMusic, FaMicrophone, FaQuestion, FaUpload } from 'react-icons/fa';
import { devLog, devDebug } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

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
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext();
  const { state: fileStorageState, actions: fileStorageActions } = useFileStorage();
  const { addNotification } = useNotification();

  const templates = state.templates;
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showTemplateList, setShowTemplateList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [currentFile, setCurrentFile] = useState(null);
  
  // Audio states for template editing
  const [audioCategory, setAudioCategory] = useState('sound_effect');
  const serverUrl = state.settings.storageConfig.serverUrl || 'http://localhost:5000';
  
  // Use the audio library from fileStorageState (array)
  const audioLibrary = useMemo(() => {
    return fileStorageState.audioLibrary || [];
  }, [fileStorageState.audioLibrary]);
  
  // Audio categories for dropdown selection
  const audioCategories = useMemo(() => [
    { value: 'sound_effect', label: 'Sound Effects' },
    { value: 'uploaded_audio', label: 'Uploaded Audio' },
    { value: 'merged_audio', label: 'Merged Audio' },
    { value: 'generated_section_audio', label: 'Generated Audio' },
    { value: 'music', label: 'Music' },
    { value: 'binaural', label: 'Binaural' },
  ], []);
  
  // Filtered audio library based on selected category
  const filteredAudioLibrary = useMemo(() => {
    return audioLibrary.filter(audio => audio.category === audioCategory);
  }, [audioLibrary, audioCategory]);
  
  /**
   * Get available voices for the template sections.
   * @type {Array}
   */
  const activeVoices = useMemo(() => {
    const voices = state.settings.activeVoices || [];
    return voices.length > 0 ? voices : (state?.settings?.defaultVoices?.gtts || []);
  }, [state.settings.activeVoices, state?.settings?.defaultVoices]);

  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Use templateCreation state from TTSSessionContext
  const { templateName, templateDescription, sections, editingTemplate } = sessionState.templateCreation;

  /**
   * Check if voices are loaded for dropdown selection.
   */
  useEffect(() => {
    if (activeVoices.length > 0) {
      setVoicesLoaded(true);
      devLog('Voices loaded, rendering dropdown');
    }
  }, [activeVoices]);

  /**
   * Handle audio file upload
   */
  const handleAudioUpload = async (e, sectionIndex) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      addNotification({ type: 'error', message: 'Please upload an audio file' });
      return;
    }
    
    try {
      setIsUploading(true);
      setCurrentFile(file);
      
      // Prepare data for library storage
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const audioData = {
        name: fileName,
        category: audioCategory,
        audioMetadata: {
          placeholder: fileName.toLowerCase().replace(/\s+/g, '_'),
          volume: 1,
          duration: 0,
          format: file.type.split('/')[1] || 'wav',
        },
      };
      
      // Add to audio library
      const addedAudio = await fileStorageActions.addToAudioLibrary(file, audioData);
      
      // Update template section with the new audio
      updateSection(sectionIndex, { 
        audioId: addedAudio.id,
        audioSource: 'library',
        category: audioCategory
      });
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      addNotification({ type: 'success', message: `Audio saved to library as "${fileName}"` });
      
      // Refresh audio library to show the new file
      fileStorageActions.fetchAudioLibrary();
      
    } catch (error) {
      addNotification({ type: 'error', message: `Error uploading audio: ${error.message}` });
    } finally {
      setIsUploading(false);
      setCurrentFile(null);
    }
  };

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
    sessionActions.updateTemplateCreationSection(index, updates);
  };

  /**
   * Removes a section from the template.
   * Ensures at least one section remains in the template.
   * 
   * @param {number} index - The index of the section to remove
   */
  const removeSection = (index) => {
    if (sections.length === 1) {
      addNotification({ type: 'warning', message: 'At least one section is required!' });
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
      addNotification({ type: 'error', message: 'Please enter a template name' });
      return;
    }
    
    // Ensure each section has the correct properties based on type
    const processedSections = sections.map(section => {
      // Create a deep copy to avoid mutation
      const processedSection = { ...section };
      
      // Make sure type is explicitly set
      processedSection.type = section.type || 'text-to-speech';
      
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
    
    // Use context action to save template - it handles both state update and persistence
    actions.saveTemplate(template);
    
    handleClearTemplateForm();
    setShowTemplateList(true);
    addNotification({ type: 'success', message: 'Template saved successfully!' });
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
    setShowTemplateList(false);
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
    setSelectedTemplateId(null);
    
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

  /**
   * Delete a template with confirmation
   * @param {string} templateId - The ID of the template to delete
   */
  const deleteTemplate = (templateId) => {
    // Use context action to delete template - it handles both state update and persistence
    actions.deleteTemplate(templateId);
    
    setShowDeleteConfirm(null);
    if (editingTemplate?.id === templateId) {
      handleClearTemplateForm();
    }
    addNotification({ type: 'success', message: 'Template deleted successfully' });
  };

  /**
   * Start creating a new template
   */
  const startNewTemplate = () => {
    handleClearTemplateForm();
    setShowTemplateList(false);
  };

  /**
   * Get icon based on section type
   * @param {string} type - Section type
   * @returns {JSX.Element} Icon component
   */
  const getSectionTypeIcon = (type) => {
    switch (type) {
      case 'text-to-speech':
        return <FaMicrophone className="text-lg mr-2" />;
      case 'audio-only':
        return <FaMusic className="text-lg mr-2" />;
      default:
        return <FaQuestion className="text-lg mr-2" />;
    }
  };

  const availableTemplates = useMemo(() => {
    return Object.values(templates || {}).filter(template => template.id !== 'general');
  }, [templates]);

  return (
    <div className="templates-tab p-4 h-full overflow-y-auto">
      {showTemplateList ? (
        // Template List View
        <div className="template-list-view">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Your Templates</h2>
            <button 
              onClick={startNewTemplate}
              className="btn btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              <FaPlus /> Create New Template
            </button>
          </div>
          
          {availableTemplates.length === 0 ? (
            <div className="text-center py-8 bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-6">
              <div className="text-6xl mb-4 opacity-30 flex justify-center">
                <FaMusic />
              </div>
              <h3 className="text-xl font-medium mb-2">No Templates Yet</h3>
              <p className="text-[var(--text-secondary)] mb-4">Create your first template to organize your TTS projects</p>
              <button 
                onClick={startNewTemplate}
                className="btn btn-primary flex items-center gap-2 px-4 py-2 rounded-lg mx-auto"
              >
                <FaPlus /> Create New Template
              </button>
            </div>
          ) : (
            <div className="templates-grid grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {availableTemplates.map(template => (
                <div 
                  key={template.id} 
                  className="template-card bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-4 flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}
                >
                  <div className="template-header flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium truncate">{template.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editTemplate(template);
                        }}
                        className="p-2 text-[var(--text-color)] hover:text-[var(--primary-color)] transition-colors"
                        title="Edit Template"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(template.id);
                        }}
                        className="p-2 text-[var(--text-color)] hover:text-[var(--danger-color)] transition-colors"
                        title="Delete Template"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-[var(--text-secondary)] mb-3 flex-grow">
                    {template.description || 'No description provided'}
                  </p>
                  
                  {selectedTemplateId === template.id && (
                    <div className="template-details mt-2 pt-2 border-t border-[var(--border-color)]">
                      <p className="text-sm font-medium mb-1">Sections ({template.sections.length}):</p>
                      <ul className="max-h-40 overflow-y-auto">
                        {template.sections.map((section, index) => (
                          <li key={section.id || index} className="text-sm py-1 flex items-center">
                            {getSectionTypeIcon(section.type)}
                            {section.title || `Section ${index + 1}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-[var(--bg-color)] p-6 rounded-lg max-w-md w-full">
                <h3 className="text-xl font-medium mb-4">Delete Template?</h3>
                <p className="mb-6">Are you sure you want to delete this template? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(null)} 
                    className="btn btn-secondary px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => deleteTemplate(showDeleteConfirm)} 
                    className="btn btn-danger px-4 py-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Template Creation/Editing View
        <div className="template-edit-view">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">
              {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create New Template'}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowTemplateList(true)}
                className="btn btn-secondary px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={saveTemplate}
                className="btn btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <FaSave /> Save Template
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <div className="form-group mb-4">
                <label htmlFor="template-name" className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  id="template-name"
                  type="text"
                  value={templateName}
                  onChange={(e) => sessionActions.setTemplateName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Enter template name"
                />
              </div>
            </div>
            
            <div className="md:col-span-1">
              <div className="form-group mb-4">
                <label className="block text-sm font-medium mb-1">Add Section</label>
                <button 
                  onClick={addSection} 
                  className="btn btn-primary w-full py-2 flex items-center justify-center gap-2"
                >
                  <FaPlus /> Add New Section
                </button>
              </div>
            </div>
          </div>
          
          <div className="form-group mb-6">
            <label htmlFor="template-description" className="block text-sm font-medium mb-1">Template Description</label>
            <textarea
              id="template-description"
              value={templateDescription}
              onChange={(e) => sessionActions.setTemplateDescription(e.target.value)}
              className="input-field w-full"
              rows={2}
              placeholder="Enter template description"
            />
          </div>
          
          <h3 className="text-xl font-medium mb-4">Template Sections</h3>
          
          <div className="sections-container space-y-4">
            {sections.map((section, index) => (
              <div key={section.id} className="section-card bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-4">
                <div className="section-header flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    {getSectionTypeIcon(section.type)}
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      className="input-field flex-grow"
                      placeholder="Section title"
                    />
                  </div>
                  
                  <div className="section-actions flex items-center gap-2">
                    <button
                      onClick={() => moveSectionUp(index)}
                      disabled={index === 0}
                      className={`p-2 rounded-full hover:bg-[var(--border-color)] transition-colors ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Move Up"
                    >
                      <FaChevronUp />
                    </button>
                    <button
                      onClick={() => moveSectionDown(index)}
                      disabled={index === sections.length - 1}
                      className={`p-2 rounded-full hover:bg-[var(--border-color)] transition-colors ${index === sections.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Move Down"
                    >
                      <FaChevronDown />
                    </button>
                    <button
                      onClick={() => removeSection(index)}
                      className="p-2 rounded-full hover:bg-[var(--danger-color)] hover:text-white transition-colors"
                      title="Remove Section"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                
                <div className="section-content">
                  <div className="form-group mb-4">
                    <label className="block text-sm font-medium mb-2">Section Type</label>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${section.type === 'text-to-speech' ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--border-color)]'}`}>
                        <input
                          type="radio"
                          name={`section-type-${section.id}`}
                          value="text-to-speech"
                          checked={section.type === 'text-to-speech'}
                          onChange={() => updateSection(index, { type: 'text-to-speech' })}
                          className="sr-only"
                        />
                        <FaMicrophone /> Text to Speech
                      </label>
                      
                      <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${section.type === 'audio-only' ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--border-color)]'}`}>
                        <input
                          type="radio"
                          name={`section-type-${section.id}`}
                          value="audio-only"
                          checked={section.type === 'audio-only'}
                          onChange={() => updateSection(index, { type: 'audio-only' })}
                          className="sr-only"
                        />
                        <FaMusic /> Audio Only
                      </label>
                    </div>
                  </div>
                  
                  {section.type === 'text-to-speech' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="block text-sm font-medium mb-2">Voice (Optional)</label>
                        {voicesLoaded ? (
                          <select
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
                            className="select-field w-full"
                          >
                            <option value="">Use Default Voice</option>
                            {activeVoices.map((voice) => (
                              <option
                                key={`${voice.engine}-${voice.id}`}
                                value={`${voice.engine}-${voice.id}`}
                              >
                                {voice.name} ({voice.engine})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2 bg-yellow-100 text-yellow-800 rounded">Loading voices...</div>
                        )}
                      </div>
                      
                      <div className="form-group">
                        <label className="block text-sm font-medium mb-2">Default Text (Optional)</label>
                        <textarea
                          value={section.text || ''}
                          onChange={(e) => updateSection(index, { text: e.target.value })}
                          className="input-field w-full"
                          rows={4}
                          placeholder="Enter default text for this section..."
                        />
                      </div>
                    </div>
                  )}
                  
                  {section.type === 'audio-only' && (
                    <div className="space-y-4">
                      <div className="form-group">
                        <label className="block text-sm font-medium mb-2">Audio Category</label>
                        <select
                          value={audioCategory}
                          onChange={(e) => setAudioCategory(e.target.value)}
                          className="select-field w-full"
                        >
                          {audioCategories.map(category => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="block text-sm font-medium mb-2">Default Audio (Optional)</label>
                        <select
                          value={section.audioId || ''}
                          onChange={(e) => updateSection(index, { audioId: e.target.value || null })}
                          className="select-field w-full"
                        >
                          <option value="">No default audio selected</option>
                          {filteredAudioLibrary.map((audio) => (
                            <option key={audio.id} value={audio.id}>
                              {audio.name}
                            </option>
                          ))}
                        </select>
                        
                        {filteredAudioLibrary.length === 0 && (
                          <p className="mt-2 text-sm text-yellow-600">
                            No audio files in this category. Upload one or select a different category.
                          </p>
                        )}
                      </div>
                      
                      <div className="form-group">
                        <label className="block text-sm font-medium mb-2">Or Upload New Audio</label>
                        <div className="flex items-center space-x-2">
                          <label htmlFor={`audio-upload-${section.id}`} className="cursor-pointer bg-[var(--accent-color)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium inline-flex items-center">
                            <FaUpload className="mr-2" /> Upload Audio File
                            <input
                              id={`audio-upload-${section.id}`}
                              type="file"
                              ref={fileInputRef}
                              onChange={(e) => handleAudioUpload(e, index)}
                              accept="audio/*"
                              className="hidden"
                              disabled={isUploading}
                            />
                          </label>
                          {isUploading && (
                            <span className="text-sm italic flex items-center">
                              <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                              Uploading...
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {section.audioId && (
                        <div className="mt-2 p-2 bg-[var(--border-color)] rounded flex items-center">
                          <FaMusic className="mr-2" />
                          <span>
                            Selected: {
                              audioLibrary.find(a => a.id === section.audioId)?.name || 
                              'Unknown Audio'
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {sections.length === 0 && (
            <div className="text-center py-8 bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-6">
              <p className="text-[var(--text-secondary)]">No sections added yet. Click "Add New Section" to get started.</p>
            </div>
          )}
          
          <div className="sticky bottom-0 mt-6 py-4 bg-[var(--bg-color)] border-t border-[var(--border-color)] flex justify-end gap-3">
            <button 
              onClick={() => setShowTemplateList(true)}
              className="btn btn-secondary px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button 
              onClick={saveTemplate}
              className="btn btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <FaSave /> Save Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesTab;