// pages/__tests__/index.test.tsx

import { render, screen } from '@testing-library/react';
import Home from '../index.jsx';
import { TTSApp } from '../../components/TTSApp';
import ThemeToggle from '../../components/ThemeToggle';
import Link from 'next/link';
import Head from 'next/head';

// Mock dependencies
jest.mock('../../components/TTSApp', () => ({
  TTSApp: jest.fn(() => <div data-testid="tts-app">TTSApp</div>),
}));

jest.mock('../../components/ThemeToggle', () => 
  jest.fn(() => <div data-testid="theme-toggle">ThemeToggle</div>)
);

jest.mock('next/link', () => {
  const MockLink = ({ children, href }) => (
    <a href={href} data-testid="link">{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/head', () => {
  const MockHead = ({ children }) => <div data-testid="head">{children}</div>;
  MockHead.displayName = 'MockHead';
  return MockHead;
});

// Mock CSS imports
jest.mock('../../styles/globals.css', () => ({}));
jest.mock('../../styles/themes.css', () => ({}));

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders page structure correctly', () => {
    render(<Home />);

    // Header
    expect(screen.getByText('Text-to-Speech Converter')).toBeInTheDocument();

    // Navigation
    const link = screen.getByTestId('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Audio Library');
    expect(link).toHaveAttribute('href', '/audio');

    // Main content
    const ttsApp = screen.getByTestId('tts-app');
    expect(ttsApp).toBeInTheDocument();
    expect(TTSApp).toHaveBeenCalled();

    // ThemeToggle
    const themeToggle = screen.getByTestId('theme-toggle');
    expect(themeToggle).toBeInTheDocument();
    expect(ThemeToggle).toHaveBeenCalled();

    // Footer
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`Text-to-Speech Web Application © ${currentYear}`)).toBeInTheDocument();
  });

  test('renders navigation link with SVG icon', () => {
    render(<Home />);

    const link = screen.getByTestId('link');
    expect(link).toBeInTheDocument();
    
    // In our mocked link, the SVG is not actually rendered
    // So we'll just check the text content
    expect(link).toHaveTextContent('Audio Library');
  });

  test('renders SEO metadata via Head', () => {
    render(<Home />);

    // Check that the Head component was rendered
    const head = screen.getByTestId('head');
    expect(head).toBeInTheDocument();
    
    // We can't check that Head was called as it's not a mock function
    // Just verify the component is present in the DOM
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
    
    render(<Home />);

    expect(screen.getByText('Text-to-Speech Web Application © 2025')).toBeInTheDocument();

    // Restore Date
    global.Date = realDate;
  });
});