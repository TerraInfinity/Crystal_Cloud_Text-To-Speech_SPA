import React, { useState, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import TextInput from './TextInput';
import TemplateSelector from './TemplateSelector';
import SectionsList from './SectionsList';
import ToolsTab from './ToolsTab';
import SettingsTab from './SettingsTab';
import AudioFilesTab from './AudioFilesTab';
import AudioPlayer from './AudioPlayer';

export const TTSApp = ({ initialText = '', initialTemplate = 'general' }) => {
  const {
    activeTab,
    notification,
    errorMessage,
    isProcessing,
    actions
  } = useTTS();

  // Set initial values if provided as props (only on first render)
  useEffect(() => {
    if (initialText) {
      actions.setInputText(initialText);
    }
    if (initialTemplate) {
      actions.setTemplate(initialTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab switching
  const handleTabChange = (tab) => {
    actions.setActiveTab(tab);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      {/* Notification area */}
      {notification && (
        <div className={`p-4 mb-4 rounded-md ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {notification.message}
          <button className="float-right" onClick={() => actions.setNotification(null)}>×</button>
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <div className="p-4 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
          <button className="float-right" onClick={() => actions.setError(null)}>×</button>
        </div>
      )}

      {/* Progress indicator */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-lg">Processing...</p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => handleTabChange('main')}
            className={`py-4 px-1 ${activeTab === 'main' ? 'tab-active' : 'tab-inactive'}`}
          >
            Main
          </button>
          <button
            onClick={() => handleTabChange('audio')}
            className={`py-4 px-1 ${activeTab === 'audio' ? 'tab-active' : 'tab-inactive'}`}
          >
            Audio Files
          </button>
          <button
            onClick={() => handleTabChange('tools')}
            className={`py-4 px-1 ${activeTab === 'tools' ? 'tab-active' : 'tab-inactive'}`}
          >
            Tools
          </button>
          <button
            onClick={() => handleTabChange('settings')}
            className={`py-4 px-1 ${activeTab === 'settings' ? 'tab-active' : 'tab-inactive'}`}
          >
            Settings
          </button>
        </nav>
      </div>

      {/* Main tab content */}
      {activeTab === 'main' && (
        <div>
          <div className="mb-6">
            <TemplateSelector />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Input Text</h3>
              <TextInput />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Sections</h3>
              <SectionsList />
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-3">Preview and Download</h3>
            <AudioPlayer />
          </div>
        </div>
      )}

      {/* Audio Files tab content */}
      {activeTab === 'audio' && <AudioFilesTab />}
      
      {/* Tools tab content */}
      {activeTab === 'tools' && <ToolsTab />}

      {/* Settings tab content */}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
};

export default TTSApp;
