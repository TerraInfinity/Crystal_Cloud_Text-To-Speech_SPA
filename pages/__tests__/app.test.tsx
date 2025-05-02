// pages/__tests__/app.test.tsx

import { render, screen } from '@testing-library/react';
import MyApp from '../_app';
import { TTSProvider } from '../../context/TTSContext';

// Mock the TTSProvider
jest.mock('../../context/TTSContext', () => ({
  TTSProvider: jest.fn(({ children }) => <div data-testid="tts-provider">{children}</div>),
}));

// Mock CSS imports to prevent Jest errors
jest.mock('../../styles/globals.css', () => {});
jest.mock('../../styles/themes.css', () => {});

describe('MyApp', () => {
  // Mock Component and pageProps
  const MockComponent = ({ text }) => <div data-testid="mock-component">{text}</div>;
  const pageProps = { text: 'Test Page' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders child component with page props', () => {
    render(<MyApp Component={MockComponent} pageProps={pageProps} />);

    const component = screen.getByTestId('mock-component');
    expect(component).toBeInTheDocument();
    expect(component).toHaveTextContent('Test Page');
  });

  test('wraps child component with TTSProvider', () => {
    render(<MyApp Component={MockComponent} pageProps={pageProps} />);

    // Check that TTSProvider was called
    expect(TTSProvider).toHaveBeenCalled();
    
    // Check that the provider renders and contains the component
    const provider = screen.getByTestId('tts-provider');
    const component = screen.getByTestId('mock-component');
    expect(provider).toBeInTheDocument();
    expect(provider).toContainElement(component);
  });

  test('passes pageProps to child component', () => {
    const complexPageProps = { text: 'Complex', number: 42, bool: true };
    render(<MyApp Component={MockComponent} pageProps={complexPageProps} />);

    const component = screen.getByTestId('mock-component');
    expect(component).toBeInTheDocument();
    // Since MockComponent only renders text, verify it received props indirectly
    expect(component).toHaveTextContent('Complex');
  });

  test('renders without pageProps', () => {
    render(<MyApp Component={MockComponent} pageProps={{}} />);

    const component = screen.getByTestId('mock-component');
    const provider = screen.getByTestId('tts-provider');
    expect(provider).toBeInTheDocument();
    expect(component).toBeInTheDocument();
    expect(component).toHaveTextContent('');
  });
});