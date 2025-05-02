import React from 'react';
import { TTSProvider } from '../context/TTSContext';
import AudioLibrary from '../components/AudioLibrary';
import Link from 'next/link';

/**
 * Audio Library Page Component
 * 
 * This page provides an interface for users to manage their audio library.
 * Users can upload, organize, and select audio files for use in the TTS application.
 * The AudioLibrary component handles the core functionality of audio file management.
 * 
 * @returns {JSX.Element} The rendered Audio Library page
 */
export default function AudioPage() {
  return (
      <div id="audio-page-container" className="container mx-auto px-4 py-8">
        <header id="audio-page-header" className="mb-8">
          <nav id="audio-page-nav" className="flex justify-between items-center mb-6">
          <Link href="/" id="back-to-main-link" className="text-indigo-600 hover:text-indigo-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Main App
          </Link>
          </nav>
          <h1 id="audio-page-title" className="text-3xl font-bold text-gray-800">Audio Library Manager</h1>
          <p id="audio-page-description" className="text-gray-600 mt-2">
            Upload, manage, and use your audio files for sections.
          </p>
        </header>
        
        <main id="audio-page-main">
          <AudioLibrary />
        </main>
        
        <footer id="audio-page-footer" className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p id="audio-page-copyright">&copy; {new Date().getFullYear()} Text-to-Speech App</p>
        </footer>
      </div>
  );
}