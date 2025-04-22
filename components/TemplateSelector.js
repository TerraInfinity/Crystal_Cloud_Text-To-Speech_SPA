import React, { useCallback } from 'react';
import { useTTS } from '../context/TTSContext';

const TemplateSelector = () => {
  const { currentTemplate, actions } = useTTS();
  
  // Load template content
  const loadTemplate = async (templateName) => {
    actions.setTemplate(templateName);
    
    if (templateName === 'general') {
      // General template just has one empty section
      actions.setNotification({
        type: 'success',
        message: 'General template loaded'
      });
      
      // Clear existing sections if any
      actions.setProcessing(true);
      
      // Create a default empty section
      const newSection = {
        id: `section-${Date.now()}`,
        title: 'Main Section',
        type: 'text-to-audio',
        text: '',
        voice: null,
      };
      
      // Set the sections
      actions.setSections([newSection]);
      actions.setProcessing(false);
      
    } else if (templateName === 'yogaKriya') {
      // Yoga Kriya template has predefined sections
      actions.setProcessing(true);
      
      // Define the Yoga Kriya sections
      const yogaKriyaSections = [
        {
          id: `section-tuning-${Date.now()}`,
          title: 'Tuning In (Intro)',
          type: 'audio-only',
          text: '',
          voice: null,
        },
        {
          id: `section-warmup-${Date.now()}`,
          title: 'Warm-Up',
          type: 'text-to-audio',
          text: '',
          voice: null,
        },
        {
          id: `section-kriya-${Date.now()}`,
          title: 'Kriya Sequence',
          type: 'text-to-audio',
          text: '',
          voice: null,
        },
        {
          id: `section-relaxation-${Date.now()}`,
          title: 'Relaxation',
          type: 'text-to-audio',
          text: '',
          voice: null,
        },
        {
          id: `section-meditation-${Date.now()}`,
          title: 'Meditation',
          type: 'text-to-audio',
          text: '',
          voice: null,
        },
        {
          id: `section-closing-${Date.now()}`,
          title: 'Closing',
          type: 'audio-only',
          text: '',
          voice: null,
        }
      ];
      
      // Set the sections
      actions.setSections(yogaKriyaSections);
      
      actions.setNotification({
        type: 'success',
        message: 'Yoga Kriya template loaded'
      });
      
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
            <option value="yogaKriya">Yoga Kriya Template</option>
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
