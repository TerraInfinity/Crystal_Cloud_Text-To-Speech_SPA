import React, { useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import TextInput from './TextInput';
import TemplateSelector from './TemplateSelector';
import SectionsList from './SectionsList';
import ToolsTab from './ToolsTab';
import SettingsTab from './SettingsTab';
import AudioLibrary from './AudioLibrary';
import TemplatesTab from './TemplatesTab';
import AudioPlayer from './AudioPlayer';
import FileHistory from './FileHistory';

export const TTSApp = ({ initialText = '', initialTemplate = 'general' }) => {
  // Access persistent state from TTSContext
  const { state: persistentState } = useTTS();
  // Access session-specific state and actions from TTSSessionContext
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  // Destructure session-specific state
  const { activeTab, notification, errorMessage, isProcessing } = sessionState || {};

  // Destructure persistent state (assuming fileHistory is persistent)
  const { fileHistory } = persistentState || {};

  // Set initial values using session actions on first render
  useEffect(() => {
    if (initialText) {
      sessionActions.setInputText(initialText);
    }
    if (initialTemplate) {
      sessionActions.setTemplate(initialTemplate);
    }
  }, [sessionActions, initialText, initialTemplate]);

  // Handle tab switching with session action
  const handleTabChange = (tab) => {
    sessionActions.setActiveTab(tab);
  };

  return (
    <div
      className="rounded-lg shadow-lg p-6 max-w-6xl mx-auto"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      {/* Notification */}
      {notification && (
        <div
          className={`p-4 mb-4 rounded-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {notification.message}
          <button className="float-right" onClick={() => sessionActions.setNotification(null)}>
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
          <button className="float-right" onClick={() => sessionActions.setError(null)}>
            ×
          </button>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-lg">Processing...</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => handleTabChange('main')}
            className={`py-4 px-1 ${activeTab === 'main' ? 'tab-active' : 'tab-inactive'}`}
          >
            Main
          </button>
          <button
            onClick={() => handleTabChange('templates')}
            className={`py-4 px-1 ${activeTab === 'templates' ? 'tab-active' : 'tab-inactive'}`}
          >
            Templates
          </button>
          <button
            onClick={() => handleTabChange('fileHistory')}
            className={`py-4 px-1 ${activeTab === 'fileHistory' ? 'tab-active' : 'tab-inactive'}`}
          >
            File History
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

      {/* Tab Content */}
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
            <AudioPlayer />
          </div>
        </div>
      )}

      {activeTab === 'fileHistory' && <FileHistory fileHistory={fileHistory} actions={sessionActions} />}
      {activeTab === 'audio' && <AudioLibrary />}
      {activeTab === 'tools' && <ToolsTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'templates' && <TemplatesTab />}
    </div>
  );
};

export default TTSApp;