import Head from 'next/head';
import Link from 'next/link';
import { TTSApp } from '../components/TTSApp';
import { TTSProvider } from '../context/TTSContext';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Text-to-Speech Application</title>
        <meta name="description" content="Convert text to speech with customizable templates" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700">
            Text-to-Speech Converter
          </h1>
          <Link href="/audio" legacyBehavior>
            <a className="btn btn-secondary flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
              Audio Library
            </a>
          </Link>
        </header>
        
        <TTSProvider>
          <TTSApp />
        </TTSProvider>
      </main>

      <footer className="mt-12 py-6 text-center text-gray-500 text-sm">
        <p>Text-to-Speech Web Application © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
