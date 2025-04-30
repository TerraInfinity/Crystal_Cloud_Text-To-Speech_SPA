import React, { useState, useEffect, useMemo } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import { FaPlus, FaTrash, FaSave, FaRedo, FaEdit, FaTimes, FaChevronUp, FaChevronDown } from 'react-icons/fa';

const TemplatesTab = () => {
  const { state, actions } = useTTS();
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const templates = state.templates;
  const audioLibrary = state?.AudioLibrary || {};
  const activeVoices = useMemo(() => {
    const voices = Object.values(state.settings.activeVoices || {}).flat();
    return voices.length > 0 ? voices : (state?.settings?.defaultVoices?.gtts || []);
  }, [state.settings.activeVoices, state?.settings?.defaultVoices]);

  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Use templateCreation state from TTSSessionContext
  const { templateName, templateDescription, sections, editingTemplate } = sessionState.templateCreation;

  // Debug state updates
  useEffect(() => {
    console.log('Templates updated:', templates);
  }, [templates]);

  // Check if voices are loaded
  useEffect(() => {
    console.log('state.settings.activeVoices:', state.settings.activeVoices);
    console.log('activeVoices:', activeVoices);
    if (activeVoices.length > 0) {
      setVoicesLoaded(true);
      console.log('Voices loaded, rendering dropdown');
    } else {
      console.log('No voices loaded yet');
    }
  }, [state.settings.activeVoices, activeVoices]);

  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-audio',
      text: '',
      voice: null,
      voiceSettings: { pitch: 1, rate: 1, volume: 1 },
    };
    sessionActions.addTemplateCreationSection(newSection);
  };

  const updateSection = (index, updates) => {
    console.log('Updating section at index:', index, 'with updates:', updates);
    sessionActions.updateTemplateCreationSection(index, updates);
    setTimeout(() => {
      console.log('Updated templateCreation state after updateSection:', sessionState.templateCreation);
    }, 0);
  };

  const removeSection = (index) => {
    if (sections.length === 1) {
      sessionActions.setNotification({ type: 'warning', message: 'At least one section is required!' });
      return;
    }
    sessionActions.removeTemplateCreationSection(index);
  };

  const moveSectionUp = (index) => {
    sessionActions.moveTemplateCreationSectionUp(index);
  };

  const moveSectionDown = (index) => {
    sessionActions.moveTemplateCreationSectionDown(index);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      sessionActions.setError('Please enter a template name');
      return;
    }
    const template = {
      id: editingTemplate?.id || `template-${Date.now()}`,
      name: templateName,
      description: templateDescription,
      sections,
    };
    actions.saveTemplate(template);
    console.log('Saved template:', template);
    sessionActions.clearTemplateCreationForm();
    sessionActions.setNotification({ type: 'success', message: 'Template saved successfully!' });
  };

  const editTemplate = (template) => {
    if (template.id === 'general') return;
    sessionActions.setEditingTemplate(template);
    sessionActions.setTemplateName(template.name);
    sessionActions.setTemplateDescription(template.description || '');
    sessionActions.setTemplateCreationSections(template.sections);
  };

  console.log('Rendering saved templates:', Object.values(templates || {}));

  return (
    <div className="templates-tab p-4">
      {/* Template Creation/Editing Section */}
      <div className="section-card">
        <div className="header-section flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h2>
          <button onClick={sessionActions.clearTemplateCreationForm} className="btn btn-secondary p-2" title="Start Over">
            <FaRedo className="text-lg" />
          </button>
        </div>

        <div className="form-container flex flex-col gap-4">
          <div className="form-group flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Template Name</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => sessionActions.setTemplateName(e.target.value)}
              className="input-field"
              placeholder="Enter template name"
            />
          </div>

          <div className="form-group flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Template Description (optional)</label>
            <textarea
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
                        value={section.type}
                        onChange={(e) => updateSection(index, { type: e.target.value })}
                        className="select-field"
                      >
                        <option value="text-to-audio">Text to Audio</option>
                        <option value="audio-only">Audio Only</option>
                      </select>
                    </div>

                    {section.type === 'text-to-audio' && (
                      <>
                        <div className="form-group flex flex-col gap-2">
                          <label className="text-sm font-medium text-[var(--text-secondary)]">Voice</label>
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
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Select Audio</label>
                        <select
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
            <button onClick={saveTemplate} className="btn btn-primary button-gradient p-2" title="Save Template">
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
                      onClick={() => editTemplate(template)}
                      className="btn btn-secondary p-2"
                      title="Edit Template"
                    >
                      <FaEdit className="text-lg" />
                    </button>
                    <button
                      onClick={() => {
                        actions.deleteTemplate(template.id);
                        if (editingTemplate?.id === template.id) sessionActions.clearTemplateCreationForm();
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