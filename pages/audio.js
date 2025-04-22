import React from 'react';
import { TTSProvider } from '../context/TTSContext';
import AudioLibrary from '../components/AudioLibrary';
import Link from 'next/link';

export default function AudioPage() {
  return (
    <TTSProvider>
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <nav className="flex justify-between items-center mb-6">
            <Link href="/" legacyBehavior>
              <a className="text-indigo-600 hover:text-indigo-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Main App
              </a>
            </Link>
          </nav>
          <h1 className="text-3xl font-bold text-gray-800">Audio Library Manager</h1>
          <p className="text-gray-600 mt-2">
            Upload, manage, and use your audio files for sections.
          </p>
        </header>
        
        <main>
          <AudioLibrary />
        </main>
        
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Text-to-Speech App</p>
        </footer>
      </div>
    </TTSProvider>
  );
}