/**
 * @fileoverview File History component for the Text-to-Speech application.
 * Displays a history of previously generated TTS files and allows loading previous configurations
 * or downloading generated audio files.
 * 
 * @requires React
 * @requires ../context/TTSContext
 */

import React from 'react';
import { useTTS } from '../context/TTSContext';

/**
 * FileHistory component for displaying and managing TTS file history.
 * Shows previously generated TTS configurations and audio files, with options
 * to load configurations, download audio files, or delete history entries.
 * 
 * @component
 * @returns {JSX.Element} The rendered FileHistory component
 */
const FileHistory = () => {
  const { state, actions, isProcessing } = useTTS(); // Destructure state instead of fileHistory directly
  const fileHistory = state?.fileHistory || []; // Safely access fileHistory with a fallback

  /**
   * Loads a previous TTS configuration from the history.
   * 
   * @param {Object} historyEntry - The history entry to load
   */
  const handleLoadConfig = (historyEntry) => {
    actions.loadHistoryEntry(historyEntry);
    sessionActions.setActiveTab('main');
  };

  /**
   * Deletes a history entry.
   * 
   * @param {string} historyId - The ID of the history entry to delete
   */
  const handleDelete = (historyId) => {
    actions.deleteHistoryEntry(historyId);
  };

  return (
   // ... existing code ...
   <div className="space-y-4" id="file-history-container">
   <h2 className="text-xl font-semibold mb-4" id="file-history-title">File History</h2>
   {fileHistory.length === 0 ? (
     <p className="text-gray-500 italic" id="no-files-message">No files generated yet</p>
   ) : (
     fileHistory.map((entry) => (
       <div key={entry.id} className="bg-white rounded-lg shadow p-4" id={`history-entry-${entry.id}`}>
         <div className="flex justify-between items-start mb-2" id={`history-entry-header-${entry.id}`}>
           <div>
             <h3 className="font-medium" id={`history-entry-date-${entry.id}`}>{new Date(entry.date).toLocaleString()}</h3>
             <p className="text-sm text-gray-600" id={`history-entry-template-${entry.id}`}>Template: {entry.template}</p>
           </div>
           <div className="space-x-2" id={`history-entry-actions-${entry.id}`}>
             <button
               onClick={() => handleLoadConfig(entry)}
               className="btn btn-secondary btn-sm"
               disabled={isProcessing}
               id={`load-config-btn-${entry.id}`}
             >
               Load Configuration
             </button>
             {entry.audioUrl && (
               <a
                 href={entry.audioUrl}
                 download={`tts-${entry.id}.wav`}
                 className="btn btn-primary btn-sm"
                 id={`download-audio-btn-${entry.id}`}
               >
                 Download Audio
               </a>
             )}
             <button
               onClick={() => handleDelete(entry.id)}
               className="btn btn-danger btn-sm"
               disabled={isProcessing}
               id={`delete-btn-${entry.id}`}
             >
               Delete
             </button>
           </div>
         </div>
         {entry.audioUrl && (
           <audio 
             controls 
             className="w-full mt-2" 
             id={`audio-player-${entry.id}`}
             data-testid={`audio-player-${entry.id}`}
           >
             <source src={entry.audioUrl} type="audio/wav" id={`audio-source-${entry.id}`} />
             Your browser does not support the audio element.
           </audio>
         )}
       </div>
     ))
   )}
 </div>
  );
};

export default FileHistory;