import React, { useCallback } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import { devLog } from '../utils/logUtils';

const TemplateSelector = () => {
  const { state } = useTTS(); // Destructure state and actions
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const currentTemplate = sessionState.currentTemplate; // Access from state
  const templates = state.templates; // Access from state

  // Default voice to use when no voice is specified
  const defaultVoice = {
    engine: 'gtts',
    id: 'en-US-Standard-A',
    name: 'English (US) Standard A',
    language: 'en-US',
  };

  // Load template content
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
          type: 'text-to-audio',
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
          const templateSections = selectedTemplate.sections.map((section) => {
            const normalizedSection = {
              ...section,
              id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
            if (section.type === 'text-to-audio') {
              normalizedSection.voice = section.voice || defaultVoice;
              normalizedSection.voiceSettings = section.voiceSettings || defaultVoiceSettings;
            } else {
              normalizedSection.voice = undefined;
              normalizedSection.voiceSettings = undefined;
            }
            return normalizedSection;
          });
  
          devLog('Loading template sections:', templateSections);
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

  
  // Load demo content
  const loadDemoContent = useCallback(() => {
    sessionActions.loadDemoContent();
  }, [sessionActions]);

  return (
    <div
      className="mb-6 p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
      }}
    >
      <h3 className="text-lg font-medium mb-3">Template Selection</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Choose a template
          </label>
          <select
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

        <div className="flex items-end">
          <button
            onClick={loadDemoContent}
            className="btn btn-secondary w-full"
          >
            Load Demo Content
          </button>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        {currentTemplate === 'general' ? (
          <p>
            <strong>General Template:</strong> A flexible template with one section where you can add your content.
          </p>
        ) : (
          <p>
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