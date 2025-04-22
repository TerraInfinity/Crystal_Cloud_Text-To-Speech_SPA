
import React from 'react';
import { useTTS } from '../context/TTSContext';

const FileHistory = () => {
  const { fileHistory, actions, isProcessing } = useTTS();

  const handleLoadConfig = (historyEntry) => {
    actions.loadHistoryEntry(historyEntry);
    actions.setActiveTab('main');
  };

  const handleDelete = (historyId) => {
    actions.deleteHistoryEntry(historyId);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">File History</h2>
      {fileHistory.length === 0 ? (
        <p className="text-gray-500 italic">No files generated yet</p>
      ) : (
        fileHistory.map((entry) => (
          <div key={entry.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium">{new Date(entry.date).toLocaleString()}</h3>
                <p className="text-sm text-gray-600">Template: {entry.template}</p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleLoadConfig(entry)}
                  className="btn btn-secondary btn-sm"
                  disabled={isProcessing}
                >
                  Load Configuration
                </button>
                {entry.audioUrl && (
                  <a
                    href={entry.audioUrl}
                    download={`tts-${entry.id}.wav`}
                    className="btn btn-primary btn-sm"
                  >
                    Download Audio
                  </a>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="btn btn-danger btn-sm"
                  disabled={isProcessing}
                >
                  Delete
                </button>
              </div>
            </div>
            {entry.audioUrl && (
              <audio controls className="w-full mt-2">
                <source src={entry.audioUrl} type="audio/wav" />
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
