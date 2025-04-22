import Head from 'next/head';
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
        <h1 className="text-3xl font-bold text-center mb-8 text-indigo-700">
          Text-to-Speech Converter
        </h1>
        
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
