import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TTSSessionProvider, useTTSSessionContext  } from '../TTSSessionContext';
import { initialSessionState } from '../ttsDefaults';
import { saveToStorage, loadFromStorage } from '../storage';
import { ttsSessionReducer } from '../ttsSessionReducer';
import { createSessionActions } from '../ttsSessionActions';
import { devLog } from '../../utils/logUtils';
import { loadDemoContent } from '../demoContentLoader';

// Mock dependencies
jest.mock('../storage');
jest.mock('../ttsSessionReducer');
jest.mock('../ttsSessionActions');
jest.mock('../demoContentLoader');
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Mock storage functions
const mockedSaveToStorage = saveToStorage as unknown as jest.Mock<Promise<string>>;
const mockedLoadFromStorage = loadFromStorage as unknown as jest.Mock<Promise<any>>;

// Mock ttsSessionReducer and createSessionActions
const mockDispatch = jest.fn();
const mockActions = {
  setInputText: jest.fn(),
  setNotification: jest.fn(),
};

// Setup useReducer mock
const mockUseReducer = jest.spyOn(React, 'useReducer');
const mockUseEffect = jest.spyOn(React, 'useEffect');

describe('TTSSessionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSaveToStorage.mockResolvedValue('');
    mockedLoadFromStorage.mockResolvedValue(null);
    mockDispatch.mockClear();
    mockActions.setInputText.mockClear();
    mockActions.setNotification.mockClear();
    
    // Setup useReducer mock to return the mock dispatch
    mockUseReducer.mockImplementation((reducer, initialState) => [initialState, mockDispatch]);
    
    // Setup createSessionActions mock
    (createSessionActions as jest.Mock).mockReturnValue(mockActions);
  });

  test('renders children when not loading', async () => {
    render(
      <TTSSessionProvider>
        <div id="child">Test Child</div>
      </TTSSessionProvider>
    );

    expect(screen.getByText('Loading session state...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading session state...')).not.toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });
  });

  test('loads session state from sessionStorage', async () => {
    const savedState = {
      ...initialSessionState,
      inputText: 'Test input',
    };
    mockedLoadFromStorage.mockResolvedValue(savedState);

    // Mock useReducer to use the saved state
    mockUseReducer.mockImplementationOnce(() => [savedState, mockDispatch]);

    render(
      <TTSSessionProvider>
        <div>Test Child</div>
      </TTSSessionProvider>
    );

    await waitFor(() => {
      expect(mockedLoadFromStorage).toHaveBeenCalledWith('tts_session_state', false, 'sessionStorage');
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'LOAD_SESSION_STATE',
        payload: savedState,
      });
    });
  });

  test('saves session state to sessionStorage when state changes', async () => {
    render(
      <TTSSessionProvider>
        <div>Test Child</div>
      </TTSSessionProvider>
    );

    await waitFor(() => {
      expect(mockedSaveToStorage).toHaveBeenCalledWith(
        'tts_session_state',
        expect.objectContaining({ inputText: '' }),
        'sessionStorage'
      );
    });
  });

  test('clears notification after 5 seconds', async () => {
    jest.useFakeTimers();
    
    // Setup state with notification
    const stateWithNotification = {
      ...initialSessionState,
      notification: 'Test notification',
    };
    
    // Mock useReducer to return state with notification
    mockUseReducer.mockImplementationOnce(() => [stateWithNotification, mockDispatch]);
    
    // Mock the notification clearing effect
    let effectCallback: Function | null = null;
    mockUseEffect.mockImplementation((cb, deps) => {
      if (deps && deps.length === 1 && deps[0] === stateWithNotification.notification) {
        effectCallback = cb as Function;
      }
    });
    
    render(
      <TTSSessionProvider>
        <div>Test Child</div>
      </TTSSessionProvider>
    );
    
    // Simulate the effect running
    if (effectCallback) {
      effectCallback();
    }
    
    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    // Verify notification was cleared
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_NOTIFICATION',
      payload: null,
    });
    
    jest.useRealTimers();
  });

  test('useTTSSessionContext  throws error outside provider', () => {
    const TestComponent = () => {
      useTTSSessionContext ();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrow('useTTSSessionContext  must be used within a TTSSessionProvider');
  });

  test('provides correct context value', async () => {
    // Create a mock state that will be used by the provider
    const mockState = { ...initialSessionState };
    
    // Mock useState to control isLoading state
    const mockUseState = jest.spyOn(React, 'useState');
    mockUseState.mockImplementationOnce(() => [false, jest.fn()]); // Mock isLoading as false
    
    // Mock useReducer to return the mock state
    mockUseReducer.mockImplementationOnce(() => [mockState, mockDispatch]);
    
    const TestComponent = () => {
      const { state, actions } = useTTSSessionContext();
      return (
        <div>
          <div id="inputText">{state.inputText}</div>
          <button onClick={() => actions.setInputText('New Text')} id="setInputText">
            Set Text
          </button>
        </div>
      );
    };

    render(
      <TTSSessionProvider>
        <TestComponent />
      </TTSSessionProvider>
    );

    // Wait for the button to be available
    const button = await screen.findByRole('button', { name: 'Set Text' });
    expect(button).toBeInTheDocument();
    
    // Click the button
    button.click();
    
    // Verify the action was called
    expect(mockActions.setInputText).toHaveBeenCalledWith('New Text');
  });
});