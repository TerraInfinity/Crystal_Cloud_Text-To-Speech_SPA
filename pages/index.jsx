import Head from 'next/head';
import Link from 'next/link';
import { TTSApp } from '../components/TTSApp';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Home Page Component
 * 
 * This is the main landing page of the Text-to-Speech application.
 * It includes the core TTS functionality via the TTSApp component,
 * as well as navigation to the Audio Library page and theme toggling.
 * 
 * The page uses a responsive layout with Tailwind CSS styling and
 * supports theme customization through CSS variables.
 * 
 * @returns {JSX.Element} The rendered Home page
 */
export default function Home() {
  return (
    <div id="app-container" className="min-h-screen" style={{ backgroundColor: 'var(--bg-color)' }}>
      <Head>
        <title>Text-to-Speech Application</title>
        <meta name="description" content="Convert text to speech with customizable templates" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
        <main id="main-content" className="container mx-auto px-4 py-8">
          <header id="app-header" className="flex justify-between items-center mb-8">
            <h1 id="app-title" className="text-3xl font-bold text-indigo-700">
              Text-to-Speech Converter
            </h1>
            <div id="header-controls" className="flex items-center space-x-4">
              <ThemeToggle />
              <Link id="audio-library-link" href="/audio" className="btn btn-secondary flex items-center">
                <svg
                  id="audio-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                </svg>
                Audio Library
              </Link>
            </div>
          </header>
          
          
            <TTSApp />
          
        </main>

      <footer id="app-footer" className="mt-12 py-6 text-center text-gray-500 text-sm">
        <p id="copyright-text">Text-to-Speech Web Application © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
