// context/TTSSessionContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useMemo, useState } from 'react';
import { initialSessionState } from './ttsDefaults';
import { saveToStorage, loadFromStorage } from './storage';
import { ttsSessionReducer } from './ttsSessionReducer';
import { createSessionActions } from './ttsSessionActions';
import { devLog } from '../utils/logUtils';
import { loadDemoContent } from './demoContentLoader';

const TTSSessionContext = createContext();

export const TTSSessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(ttsSessionReducer, initialSessionState);
  const [isLoading, setIsLoading] = useState(true);
  const actions = useMemo(() => createSessionActions(dispatch, loadDemoContent), [dispatch]);

  // Load session state from sessionStorage on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await loadFromStorage('tts_session_state', false, 'sessionStorage');
        devLog('Loaded session state:', savedState);
        if (savedState) {
          dispatch({ type: 'LOAD_SESSION_STATE', payload: savedState });
        } else {
          devLog('No saved session state found, using initialSessionState');
        }
      } catch (error) {
        console.error('Error loading session state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, []);

  // Save session state to sessionStorage when it changes
  useEffect(() => {
    if (!isLoading) {
      devLog('Saving state to sessionStorage:', state);
      saveToStorage('tts_session_state', state, 'sessionStorage')
        .then(() => devLog('Saved session state to sessionStorage'))
        .catch((error) => console.error('Error saving session state:', error));
    }
  }, [state, isLoading]);

  // Clear notifications after 5 seconds
  useEffect(() => {
    if (state.notification) {
      devLog('Setting notification timeout');
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: null });
        devLog('Notification cleared');
      }, 5000);
      return () => {
        devLog('Cleaning up notification timeout');
        clearTimeout(timer);
      };
    }
  }, [state.notification]);

  if (isLoading) {
    return <div id="tts-loading-session-state">Loading session state...</div>;
  }

  return (
    <TTSSessionContext.Provider value={{ state, actions }}>
      {children}
    </TTSSessionContext.Provider>
  );
};

export const useTTSSession = () => {
  const context = useContext(TTSSessionContext);
  if (!context) {
    throw new Error('useTTSSession must be used within a TTSSessionProvider');
  }
  return context;
};