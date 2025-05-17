/**
 * @fileoverview File History Buttons component for the Text-to-Speech application.
 * Provides "Save as Template" and "Load Configuration" buttons for file history entries
 * with configuration data.
 * 
 * @requires React
 * @requires react-icons/fa
 * @requires ../context/TTSContext
 * @requires ../context/TTSSessionContext
 * @requires ../context/notificationContext
 */

import React, { useState } from 'react';
import { FaSave, FaFileImport, FaTimes } from 'react-icons/fa';
import { useTTSContext } from '../context/TTSContext';
import { useTTSSessionContext } from '../context/TTSSessionContext';
import { useNotification } from '../context/notificationContext';
import { devLog } from '../utils/logUtils';

/**
 * FileHistoryButtons component for providing actions to work with config files in the
 * file history, including saving as template and loading configuration.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.entry - The file history entry
 * @returns {JSX.Element} The rendered FileHistoryButtons component
 */
const FileHistoryButtons = ({ entry, configUrl }) => {
  const { actions: ttsActions } = useTTSContext();
  const { actions: sessionActions } = useTTSSessionContext();
  const { addNotification } = useNotification();

  // State for modal visibility and form fields
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetches config data from the server
   * @returns {Promise<Object>} The config data
   */
  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const serverUrl = entry.config_url.startsWith('http') 
        ? entry.config_url 
        : `${configUrl}${entry.config_url}`;
      
      devLog('Fetching config from:', serverUrl);
      const response = await fetch(serverUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }
      
      const config = await response.json();
      return config;
    } catch (error) {
      console.error('Error fetching config:', error);
      addNotification({
        type: 'error', 
        message: `Failed to fetch config: ${error.message}`
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Opens the save template modal after validating config exists
   */
  const openSaveTemplateModal = async () => {
    try {
      const config = await fetchConfig();
      
      if (!config || !config.sections || !Array.isArray(config.sections)) {
        addNotification({
          type: 'error',
          message: 'Invalid configuration data. Missing sections array.',
        });
        return;
      }
      
      // Populate the form with data from config if available
      if (config.title) {
        setTemplateName(config.title);
      }
      if (config.description) {
        setTemplateDescription(config.description);
      }
      
      setShowModal(true);
    } catch (error) {
      // Error already handled in fetchConfig
    }
  };

  /**
   * Saves the config data as a new template
   */
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      addNotification({
        type: 'error',
        message: 'Please provide a template name.',
      });
      return;
    }

    try {
      const config = await fetchConfig();
      
      if (!config || !config.sections || !Array.isArray(config.sections)) {
        addNotification({
          type: 'error',
          message: 'Invalid configuration data. Missing sections array.',
        });
        return;
      }

      // Create new template object
      const newTemplate = {
        id: `template-${Date.now()}`,
        name: templateName,
        description: templateDescription,
        sections: config.sections.map(section => ({
          ...section,
          id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        })),
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
    } catch (error) {
      // Error already handled in fetchConfig
    }
  };

  /**
   * Loads the configuration and switches to main tab
   */
  const loadConfiguration = async () => {
    try {
      const config = await fetchConfig();
      
      if (!config || !config.sections || !Array.isArray(config.sections)) {
        addNotification({
          type: 'error',
          message: 'Invalid configuration data. Missing sections array.',
        });
        return;
      }
      
      // Reset the session first - this should be available in all TTSSessionContext implementations
      if (sessionActions.resetSession) {
        sessionActions.resetSession();
      } else {
        // Fallback - dispatch directly through window if available
        if (window.ttsSessionDispatch) {
          window.ttsSessionDispatch({ type: 'RESET_SESSION' });
        } else {
          devLog('No resetSession action or ttsSessionDispatch available');
        }
      }
      
      // Load the sections - should be available but have a fallback
      if (sessionActions.reorderSections) {
        sessionActions.reorderSections(config.sections);
      } else if (sessionActions.setSections) {
        sessionActions.setSections(config.sections);
      } else if (window.ttsSessionDispatch) {
        window.ttsSessionDispatch({ type: 'SET_SECTIONS', payload: config.sections });
      }
      
      // Set title if available - may not be directly exposed in actions
      if (config.title) {
        if (sessionActions.setTitle) {
          sessionActions.setTitle(config.title);
        } else if (window.ttsSessionDispatch) {
          window.ttsSessionDispatch({ type: 'SET_TITLE', payload: config.title });
        }
      }
      
      // Set description if available - may not be directly exposed in actions
      if (config.description) {
        if (sessionActions.setDescription) {
          sessionActions.setDescription(config.description);
        } else if (window.ttsSessionDispatch) {
          window.ttsSessionDispatch({ type: 'SET_DESCRIPTION', payload: config.description });
        }
      }
      
      // Switch to main tab - this should be available in all implementations
      if (sessionActions.setActiveTab) {
        sessionActions.setActiveTab('main');
      } else if (window.ttsSessionDispatch) {
        window.ttsSessionDispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' });
      }
      
      // Notify user
      addNotification({
        type: 'success',
        message: 'Configuration loaded successfully.',
      });
      
      // Dispatch an event as a fallback mechanism
      const event = new CustomEvent('load-tts-config', { detail: { config } });
      window.dispatchEvent(event);
    } catch (error) {
      // Error already handled in fetchConfig
    }
  };

  return (
    <>
      {/* File History Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={openSaveTemplateModal}
          className="p-2 rounded hover:bg-gray-700"
          title="Save as Template"
          disabled={isLoading}
        >
          <FaSave className="h-6 w-6 text-green-400" />
        </button>
        <button
          onClick={loadConfiguration}
          className="p-2 rounded hover:bg-gray-700"
          title="Load Configuration"
          disabled={isLoading}
        >
          <FaFileImport className="h-6 w-6 text-yellow-300" />
        </button>
      </div>

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
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTemplate} 
                className="btn btn-primary px-4 py-2 flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaSave /> Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileHistoryButtons; 