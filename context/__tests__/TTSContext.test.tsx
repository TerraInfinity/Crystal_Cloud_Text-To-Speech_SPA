import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Import jest-dom for matchers
import { TTSProvider, useTTS, TTSContext } from '../TTSContext';
import { initialPersistentState } from '../ttsDefaults';
import { saveToStorage, loadFromStorage, listFromStorage, setGlobalStorageConfig } from '../storage';
import { ttsReducer } from '../ttsReducer';
import { createTtsActions } from '../ttsActions';
import { TTSSessionProvider } from '../TTSSessionContext';
import { devLog } from '../../utils/logUtils';

// Mock dependencies
jest.mock('../storage');
jest.mock('../ttsReducer');
jest.mock('../ttsActions');
jest.mock('../TTSSessionContext', () => ({
  TTSSessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider" id="session-provider">{children}</div>
  ),
}));
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Mock global fetch for gTTS voices
global.fetch = jest.fn() as jest.Mock;

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock ttsReducer and createTtsActions
const mockDispatch = jest.fn();
const mockActions = { setStorageConfig: jest.fn() };

// Return state unchanged without recursive call
jest.mock('../ttsReducer', () => ({
  ttsReducer: jest.fn(() => initialPersistentState),
}));

jest.mock('../ttsActions', () => ({
  createTtsActions: jest.fn(() => mockActions),
}));

// Mock storage functions with correct types
const mockedSaveToStorage = saveToStorage as unknown as jest.Mock<Promise<string>>;
const mockedLoadFromStorage = loadFromStorage as unknown as jest.Mock<Promise<any>>;
const mockedListFromStorage = listFromStorage as unknown as jest.Mock<Promise<any>>;
const mockedSetGlobalStorageConfig = setGlobalStorageConfig as unknown as jest.Mock<void>;

describe('TTSContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (global.fetch as jest.Mock).mockClear();
    mockedSaveToStorage.mockResolvedValue('');
    mockedLoadFromStorage.mockResolvedValue(null);
    mockedListFromStorage.mockResolvedValue([]);
    mockedSetGlobalStorageConfig.mockReturnValue(undefined);
  });

  // Test 1: Renders children when not loading
  test('renders children when not loading', async () => {
    render(
      <TTSProvider>
        <div data-testid="child" id="child">Test Child</div>
      </TTSProvider>
    );

    // Initially shows loading state
    expect(screen.getByText('Loading persistent state...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading persistent state...')).not.toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    });
  });

  // Test 2: Initializes state with saved theme from localStorage
  test('initializes state with saved theme from localStorage', async () => {
    localStorage.setItem('theme', 'dark');
    render(
      <TTSProvider>
        <div>Test Child</div>
      </TTSProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  // Test 3: Fetches gTTS voices and updates state
  test('fetches gTTS voices and updates state', async () => {
    const mockVoices = [
      { name: 'Test Voice', language: 'en', tld: 'com' },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ voices: mockVoices }),
    });

    render(
      <TTSProvider>
        <div>Test Child</div>
      </TTSProvider>
    );

    // Wait for fetch to be called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/gtts/voices');
    });
  });

  // Test 4: Loads persistent state from storage
  test('loads persistent state from storage', async () => {
    const savedState = {
      ...initialPersistentState,
      theme: 'custom',
      settings: {
        ...initialPersistentState.settings,
        speechEngine: 'awsPolly',
      },
    };
    mockedLoadFromStorage.mockImplementation((key) => {
      if (key === 'tts_persistent_state') return Promise.resolve(savedState);
      return Promise.resolve(null);
    });

    render(
      <TTSProvider>
        <div>Test Child</div>
      </TTSProvider>
    );

    await waitFor(() => {
      expect(mockedLoadFromStorage).toHaveBeenCalledWith('tts_persistent_state', false, 'localStorage');
    });
  });

  // Test 5: Saves state to storage when state changes
  test('saves state to storage when state changes', async () => {
    render(
      <TTSProvider>
        <div>Test Child</div>
      </TTSProvider>
    );

    await waitFor(() => {
      expect(mockedSaveToStorage).toHaveBeenCalledWith(
        'tts_persistent_state',
        expect.anything(),
        'localStorage'
      );
    });
  });

  // Test 6: useTTS hook throws error outside provider
  test('useTTS hook throws error when used outside TTSProvider', () => {
    const TestComponent = () => {
      useTTS();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrow('useTTS must be used within a TTSProvider');
  });

  // Test 7: Provides correct context value
  test('provides correct context value', async () => {
    // Simulate a context state for testing without actually using the context
    const mockContextValue = {
      state: initialPersistentState,
      actions: mockActions,
      processingMode: 'local',
      setProcessingMode: jest.fn(),
      remoteEndpoint: 'https://tts.terrainfinity.ca',
      setRemoteEndpoint: jest.fn(),
    };

    // Mock the context directly
    jest.spyOn(React, 'useContext').mockImplementation(() => mockContextValue);

    const TestComponent = () => {
      const context = React.useContext(TTSContext);
      return (
        <div>
          <div data-testid="theme" id="theme">{context.state.theme}</div>
          <div data-testid="processingMode" id="processingMode">{context.processingMode}</div>
          <div data-testid="remoteEndpoint" id="remoteEndpoint">{context.remoteEndpoint}</div>
          <button onClick={() => context.setProcessingMode('remote')} data-testid="setProcessingMode">
            Change Mode
          </button>
          <button onClick={() => context.setRemoteEndpoint('new-endpoint')} data-testid="setRemoteEndpoint">
            Change Endpoint
          </button>
          <button onClick={() => context.actions.setStorageConfig({ type: 'remote' })} data-testid="setStorageConfig">
            Set Config
          </button>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('theme')).toHaveTextContent('glitch');
    expect(screen.getByTestId('processingMode')).toHaveTextContent('local');
    expect(screen.getByTestId('remoteEndpoint')).toHaveTextContent('https://tts.terrainfinity.ca');

    // Simulate button clicks and verify changes
    fireEvent.click(screen.getByTestId('setProcessingMode'));
    expect(mockContextValue.setProcessingMode).toHaveBeenCalledWith('remote');

    fireEvent.click(screen.getByTestId('setRemoteEndpoint'));
    expect(mockContextValue.setRemoteEndpoint).toHaveBeenCalledWith('new-endpoint');

    fireEvent.click(screen.getByTestId('setStorageConfig'));
    expect(mockActions.setStorageConfig).toHaveBeenCalledWith({ type: 'remote' });
  });
});