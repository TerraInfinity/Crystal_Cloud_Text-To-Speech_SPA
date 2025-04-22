import React, { useCallback } from 'react';
import { useTTS } from '../context/TTSContext';

const TemplateSelector = () => {
  const { currentTemplate, templates, actions } = useTTS();
  
  // Load template content
  const loadTemplate = async (templateName) => {
    actions.setTemplate(templateName);
    actions.setProcessing(true);
    
    try {
      if (templateName === 'general') {
        // General template just has one empty section
        const newSection = {
          id: `section-${Date.now()}`,
          title: 'Main Section',
          type: 'text-to-audio',
          text: '',
          voice: null,
        };
        
        actions.reorderSections([newSection]);
        actions.setNotification({
          type: 'success',
          message: 'General template loaded'
        });
      } else {
        // Load sections from the selected template
        const selectedTemplate = templates[templateName];
        if (selectedTemplate) {
          // Create new sections with fresh IDs but keep other properties
          const templateSections = selectedTemplate.sections.map(section => ({
            ...section,
            id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }));
          
          actions.reorderSections(templateSections);
          actions.setNotification({
            type: 'success',
            message: `${selectedTemplate.name} template loaded`
          });
        }
      }
    } catch (error) {
      actions.setError('Error loading template');
      console.error('Template loading error:', error);
    } finally {
      actions.setProcessing(false);
    }
  };
  
  // Load demo content
  const loadDemoContent = useCallback(() => {
    actions.loadDemoContent();
  }, [actions]);
  
  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium mb-3">Template Selection</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Choose a template</label>
          <select
            value={currentTemplate}
            onChange={(e) => loadTemplate(e.target.value)}
            className="select-field"
          >
            <option value="general">General Template</option>
            {Object.values(templates || {}).map(template => (
              template.id !== 'general' && (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              )
            ))}
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
            <strong>Yoga Kriya Template:</strong> Pre-defined sections for Yoga practice with Tuning In, Warm-Up, Kriya Sequence, Relaxation, Meditation, and Closing sections.
          </p>
        )}
      </div>
    </div>
  );
};

export default TemplateSelector;
