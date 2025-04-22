
import React, { useState } from 'react';
import { useTTS } from '../context/TTSContext';

const TemplatesTab = () => {
  const { templates, actions, availableVoices } = useTTS();
  const [templateName, setTemplateName] = useState('');
  const [sections, setSections] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const addSection = () => {
    setSections([...sections, {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: 'text-to-audio',
      text: '',
      voice: null,
      voiceSettings: {
        pitch: 1,
        rate: 1,
        volume: 1
      }
    }]);
  };

  const updateSection = (index, updates) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    setSections(newSections);
  };

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      actions.setError('Please enter a template name');
      return;
    }

    const template = {
      id: editingTemplate?.id || `template-${Date.now()}`,
      name: templateName,
      sections: sections
    };

    actions.saveTemplate(template);
    clearForm();
  };

  const clearForm = () => {
    setTemplateName('');
    setSections([]);
    setEditingTemplate(null);
  };

  const editTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setSections(template.sections);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">
          {editingTemplate ? 'Edit Template' : 'Create New Template'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="input-field"
              placeholder="Enter template name"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Sections</h3>
              <button onClick={addSection} className="btn btn-secondary">
                Add Section
              </button>
            </div>

            <div className="space-y-4">
              {sections.map((section, index) => (
                <div key={section.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      className="input-field w-1/2"
                      placeholder="Section title"
                    />
                    <button
                      onClick={() => removeSection(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section Type
                      </label>
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
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Voice
                          </label>
                          <select
                            value={section.voice || ''}
                            onChange={(e) => updateSection(index, { voice: e.target.value || null })}
                            className="select-field"
                          >
                            <option value="">Default Voice</option>
                            {availableVoices.map((voice, idx) => (
                              <option key={idx} value={voice.name}>
                                {voice.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Text
                          </label>
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button onClick={clearForm} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={saveTemplate} className="btn btn-primary">
              {editingTemplate ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Saved Templates</h2>
        <div className="space-y-3">
          {Object.values(templates || {}).map(template => (
            <div
              key={template.id}
              className="flex justify-between items-center p-3 border rounded-lg"
            >
              <span className="font-medium">{template.name}</span>
              <div className="space-x-2">
                <button
                  onClick={() => editTemplate(template)}
                  className="btn btn-secondary btn-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => actions.deleteTemplate(template.id)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatesTab;
