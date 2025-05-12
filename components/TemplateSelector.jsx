/**
 * @fileoverview Template Selector component for the Text-to-Speech application.
 * Provides functionality for selecting and loading different TTS templates
 * that define the structure and content of TTS sections.
 * 
 * @requires React
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../utils/logUtils
 */

import React, { useCallback } from 'react';
import {useTTSContext} from '../context/TTSContext';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';

/**
 * TemplateSelector component for selecting and loading TTS templates.
 * Allows users to choose from pre-defined templates or load demo content.
 * 
 * @component
 * @returns {JSX.Element} The rendered TemplateSelector component
 */
const TemplateSelector = () => {
  const { state } = useTTSContext(); // Destructure state and actions
  const { state: sessionState, actions: sessionActions } = useTTSSessionContext ();

  const currentTemplate = sessionState.currentTemplate; // Access from state
  const templates = state.templates; // Access from state

  // Default voice to use when no voice is specified
  const defaultVoice = {
    engine: 'gtts',
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
  };

  /**
   * Loads the selected template's content.
   * Creates sections based on the template definition and adds them to the session state.
   * 
   * @param {string} templateName - The name/ID of the template to load
   */
  const loadTemplate = async (templateName) => {
    sessionActions.setTemplate(templateName);
    sessionActions.setProcessing(true);
  
    const defaultVoice = {
      engine: 'gtts',
      id: 'en-US-Standard-A',
      name: 'English (US) Standard A',
      language: 'en-US',
    };
    const defaultVoiceSettings = { volume: 1, rate: 1, pitch: 1 };
  
    try {
      if (templateName === 'general') {
        const newSection = {
          id: `section-${Date.now()}`,
          title: 'Main Section',
          type: 'text-to-speech',
          text: '',
          voice: defaultVoice,
          voiceSettings: defaultVoiceSettings,
        };
  
        devLog('Loading general template section:', newSection);
        sessionActions.reorderSections([newSection]);
        sessionActions.setNotification({
          type: 'success',
          message: 'General template loaded',
        });
      } else {
        const selectedTemplate = templates[templateName];
        if (selectedTemplate) {
          devLog('Original template sections:', selectedTemplate.sections);
          
          const templateSections = selectedTemplate.sections.map((section) => {
            // Make sure we explicitly preserve the section type
            const sectionType = section.type || 'text-to-speech';
            
            const normalizedSection = {
              ...section,
              id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              // Explicitly set the type to ensure it's preserved
              type: sectionType
            };
            
            // Handle each section type appropriately
            if (sectionType === 'text-to-speech') {
              normalizedSection.voice = section.voice || defaultVoice;
              normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
            } else if (sectionType === 'audio-only') {
              // For audio-only, make sure to explicitly remove voice-related properties
              normalizedSection.voice = undefined;
              normalizedSection.voiceSettings = undefined;
              // Preserve audio properties
              normalizedSection.audioId = section.audioId;
              normalizedSection.audioSource = section.audioSource || 'library';
            }
            
            devLog('Processed template section:', normalizedSection);
            return normalizedSection;
          });
  
          devLog('Loading template sections with types:', templateSections.map(s => s.type));
          sessionActions.reorderSections(templateSections);
  
          // Initialize generatedTTSAudios for audio-only sections
          templateSections.forEach((section) => {
            if (section.type === 'audio-only' && section.audioId) {
              const audio = state.AudioLibrary[section.audioId];
              if (audio && audio.url) {
                sessionActions.setGeneratedAudio(section.id, {
                  url: audio.url,
                  source: 'library',
                  name: audio.name,
                });
              } else {
                console.warn(`Audio with id ${section.audioId} not found in library`);
              }
            }
          });
  
          sessionActions.setNotification({
            type: 'success',
            message: `${selectedTemplate.name} template loaded`,
          });
        }
      }
    } catch (error) {
      sessionActions.setError('Error loading template');
      console.error('Template loading error:', error);
    } finally {
      sessionActions.setProcessing(false);
    }
  };

  /**
   * Loads demo content with pre-defined sections and content.
   * This is a convenience function for users to see a working example.
   */
  const loadDemoContent = useCallback(() => {
    sessionActions.loadDemoContent();
  }, [sessionActions]);

  /**
   * Resets all sections, clearing the current sections list.
   */
  const resetSections = useCallback(() => {
    sessionActions.reorderSections([]);
    sessionActions.setNotification({
      type: 'info',
      message: 'All sections have been reset',
    });
  }, [sessionActions]);

  return (
    <div
      id="template-selector-container"
      className="mb-6 p-4 rounded-lg relative"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 id="template-selector-title" className="text-lg font-medium">Template Selection</h3>
        <button
          id="reset-sections-button"
          onClick={resetSections}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          title="Reset all sections"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      <div id="template-selector-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div id="template-selector-dropdown-container" className="md:col-span-2">
          <label 
            id="template-selector-label"
            htmlFor="template-selector-dropdown"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Choose a template
          </label>
          <select
            id="template-selector-dropdown"
            value={currentTemplate}
            onChange={(e) => loadTemplate(e.target.value)}
            className="select-field"
          >
            <option value="general">General Template</option>
            {Object.values(templates || {}).map(
              (template) =>
                template.id !== 'general' && (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                )
            )}
          </select>
        </div>

        <div id="demo-content-container" className="flex items-end">
          <button
            id="load-demo-content-button"
            onClick={loadDemoContent}
            className="btn btn-primary w-full text-sm py-2"
          >
            Demo Content
          </button>
        </div>
      </div>

      <div id="template-description" className="mt-4 text-sm text-gray-600">
        {currentTemplate === 'general' ? (
          <p id="general-template-description">
            <strong>General Template:</strong> A flexible template with one section where you can add your content.
          </p>
        ) : (
          <p id="custom-template-description">
            <strong>
              {templates[currentTemplate]?.name || 'Custom Template'}:
            </strong>{' '}
            {templates[currentTemplate]?.description ||
              'Pre-defined sections for your custom template.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default TemplateSelector;