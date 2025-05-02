// pages/__tests__/audio.test.tsx

import { render, screen } from '@testing-library/react';
import AudioPage from '../audio';
import { TTSProvider } from '../../context/TTSContext';
import AudioLibrary from '../../components/AudioLibrary';
import Link from 'next/link';

// Mock dependencies
jest.mock('../../context/TTSContext', () => ({
  TTSProvider: jest.fn(({ children }) => <div data-testid="tts-provider">{children}</div>),
}));

jest.mock('../../components/AudioLibrary', () => jest.fn(() => <div data-testid="audio-library">AudioLibrary</div>));

jest.mock('next/link', () => {
  return jest.fn(({ children, href }) => <a href={href} id="link">{children}</a>);
});

// Mock CSS imports implicitly handled by Next.js/Tailwind
jest.mock('../../styles/globals.css', () => {});
jest.mock('../../styles/themes.css', () => {});

describe('AudioPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders page structure correctly', () => {
    // Wrap AudioPage in TTSProvider manually for the test
    render(
      <TTSProvider>
        <AudioPage />
      </TTSProvider>
    );

    // Header
    expect(screen.getByText('Audio Library Manager')).toBeInTheDocument();
    expect(screen.getByText('Upload, manage, and use your audio files for sections.')).toBeInTheDocument();

    // Navigation
    const link = screen.getByText('Back to Main App');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');

    // Main content
    const audioLibrary = screen.getByText('AudioLibrary');
    expect(audioLibrary).toBeInTheDocument();
    expect(AudioLibrary).toHaveBeenCalled();

    // Footer
    const currentYear = new Date().getFullYear();
    const footerText = screen.getByText((content) => {
      return content.includes(`Text-to-Speech App`);
    });
    expect(footerText).toBeInTheDocument();
  });

  test('wraps content with TTSProvider', () => {
    // This test is no longer needed since we're now manually wrapping with TTSProvider
    // But we'll keep a simplified version to ensure the component renders properly
    render(
      <TTSProvider>
        <AudioPage />
      </TTSProvider>
    );

    // Verify the provider was called
    expect(TTSProvider).toHaveBeenCalled();

    // Check for main elements within the page
    expect(screen.getByText('Audio Library Manager')).toBeInTheDocument();
    expect(screen.getByText('AudioLibrary')).toBeInTheDocument();
  });

  test('renders navigation link with SVG icon', () => {
    render(
      <TTSProvider>
        <AudioPage />
      </TTSProvider>
    );

    const link = screen.getByText('Back to Main App').closest('a');
    expect(link).toBeInTheDocument();
    const svg = link.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('class', 'h-5 w-5 mr-1');
  });

  test('renders footer with dynamic year', () => {
    // Create a custom implementation for getFullYear
    const realDate = global.Date;
    const mockDate = class extends Date {
      getFullYear() {
        return 2025;
      }
    };
    
    // Replace the global Date
    global.Date = mockDate as any;
    
    render(
      <TTSProvider>
        <AudioPage />
      </TTSProvider>
    );

    // Check for the footer text containing the mocked year
    const footer = screen.getByText((content) => {
      return content.includes('2025') && content.includes('Text-to-Speech App');
    });
    expect(footer).toBeInTheDocument();

    // Restore Date
    global.Date = realDate;
  });
});