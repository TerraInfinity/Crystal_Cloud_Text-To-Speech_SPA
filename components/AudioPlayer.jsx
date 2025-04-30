import React, { useState, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';
import { useTTSSession } from '../context/TTSSessionContext';
import { generateAllAudio, mergeAllAudio, downloadAudio } from '../utils/AudioProcessor';

const AudioPlayer = () => {
  const { state: persistentState } = useTTS();
  const { state: sessionState, actions: sessionActions } = useTTSSession();

  const sections = sessionState?.sections || [];
  const generatedAudios = sessionState?.generatedTTSAudios || {};
  const mergedAudio = sessionState?.mergedAudio || null;
  const isProcessing = sessionState?.isProcessing || false;
  const speechEngine = persistentState?.settings?.speechEngine || 'googlecloud';

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioElement, setAudioElement] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioGenerated, setIsAudioGenerated] = useState(false);
  const [isAudioMerged, setIsAudioMerged] = useState(false);
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);

  const validSections = sections.filter(
    (section) => section.type === 'text-to-audio' && section.text?.trim()
  );
  const allSectionsHaveAudio =
    validSections.length > 0 &&
    validSections.every(
      (section) =>
        section.id in generatedAudios &&
        generatedAudios[section.id] &&
        typeof generatedAudios[section.id].url === 'string'
    );

  const playAudio = () => {
    if (!mergedAudio) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(mergedAudio);
      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(progress);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setAudioProgress(0);
      });
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  return (
    <div
      className="rounded-lg p-6 font-sans"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <h2 className="text-lg font-semibold mb-4">Preview and Download</h2>
      <div className="flex items-center justify-center space-x-4">
        <div className="relative">
          <button
            onClick={() =>
              generateAllAudio({
                validSections,
                speechEngine,
                persistentState,
                sessionActions,
                setIsGenerating,
                setIsAudioGenerated,
              })
            }
            className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
              isProcessing || validSections.length === 0 || isAudioGenerated
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={isProcessing || validSections.length === 0 || isAudioGenerated}
          >
            Generate Audio
          </button>
          <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            {isGenerating ? (
              <div className="h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center animate-spin">
                <svg
                  className="h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l5 5-5 5v4a8 8 0 01-8-8z"
                  ></path>
                </svg>
              </div>
            ) : isAudioGenerated ? (
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                <svg
                  className="h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        </div>

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            isAudioGenerated ? 'text-black opacity-100' : 'text-gray-300 opacity-50'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <div className="relative">
          <button
            onClick={() =>
              mergeAllAudio({
                validSections,
                generatedAudios,
                sessionActions,
                setIsMerging,
                setIsAudioMerged,
              })
            }
            className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
              isProcessing || !allSectionsHaveAudio || isAudioMerged
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={isProcessing || !allSectionsHaveAudio || isAudioMerged}
          >
            Merge Audio
          </button>
          <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            {isMerging ? (
              <div className="h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center animate-spin">
                <svg
                  className="h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l5 5-5 5v4a8 8 0 01-8-8z"
                  ></path>
                </svg>
              </div>
            ) : isAudioMerged ? (
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                <svg
                  className="h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        </div>

        <svg
          className={`h-6 w-6 transition-opacity duration-300 ${
            isAudioMerged ? 'text-black opacity-100' : 'text-gray-300 opacity-50'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <div className="relative">
          <button
            onClick={() => downloadAudio({ mergedAudio, setIsDownloading, setIsAudioDownloaded })}
            className={`button-gradient px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center ${
              isProcessing || !mergedAudio ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isProcessing || !mergedAudio}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Download Audio
          </button>
          <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            {isDownloading ? (
              <div className="h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center animate-spin">
                <svg
                  className="h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l5 5-5 5v4a8 8 0 01-8-8z"
                  ></path>
                </svg>
              </div>
            ) : isAudioDownloaded ? (
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                <svg
                  className="h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mergedAudio && (
        <div className="mt-6">
          <div className="flex items-center mb-2">
            <button
              onClick={playAudio}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-300"
              disabled={isProcessing}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden ml-4">
              <div
                className="bg-indigo-600 h-2 transition-all duration-300"
                style={{ width: `${audioProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {!mergedAudio && (
        <p className="text-gray-600 text-center mt-4">
          {validSections.length === 0
            ? 'Create text-to-audio sections with text to generate audio'
            : allSectionsHaveAudio
            ? 'All sections have audio. Click "Merge Audio" to merge them.'
            : 'Generate audio for your sections to proceed.'}
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;