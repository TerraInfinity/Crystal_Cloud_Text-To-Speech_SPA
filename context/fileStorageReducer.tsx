// context/fileStorageReducer.tsx
import { devLog } from '../utils/logUtils';
import { FileHistoryItem, AudioLibraryItem, FileStorageState } from './types/types';

// Initial state with explicit type
export const initialFileStorageState: FileStorageState = {
  fileHistory: [],
  audioLibrary: [],
  settings: {
    storageConfig: {
      serverUrl: 'http://localhost:5000',
      type: 'local',
      serviceType: null,
    },
  },
};

interface FileStorageAction {
  type: string;
  payload?: any;
}

/**
 * Reducer function for the file storage state
 * Handles state updates related to file storage operations
 *
 * @param state - Current state object (defaults to initialFileStorageState)
 * @param action - Action object with type and payload
 * @returns The new state after applying the action
 */
export function fileStorageReducer(
  state: FileStorageState = initialFileStorageState,
  action: FileStorageAction
): FileStorageState {
  switch (action.type) {
    case 'SET_FILE_HISTORY':
      if (!Array.isArray(action.payload)) {
        devLog('Invalid payload for SET_FILE_HISTORY, expected array');
        return state;
      }
      return {
        ...state,
        fileHistory: action.payload as FileHistoryItem[],
      };

    case 'SET_AUDIO_LIBRARY':
      if (!Array.isArray(action.payload)) {
        devLog('Invalid payload for SET_AUDIO_LIBRARY, expected array');
        return state;
      }
      return {
        ...state,
        audioLibrary: action.payload as AudioLibraryItem[],
      };

    case 'ADD_TO_AUDIO_LIBRARY':
      if (!action.payload?.id) {
        devLog('Invalid payload for ADD_TO_AUDIO_LIBRARY, missing ID');
        return state;
      }
      const audioItem: AudioLibraryItem = {
        id: action.payload.id,
        name: action.payload.name || 'Unknown',
        audio_url: action.payload.audio_url || '',
        config_url: action.payload.config_url || null,
        type: action.payload.type || 'unknown',
        date: action.payload.date || new Date().toISOString(),
        category: action.payload.category || 'unknown',
        audioMetadata: {
          duration: action.payload.audioMetadata?.duration || 0,
          format: action.payload.audioMetadata?.format || action.payload.type?.split('/')[1] || 'unknown',
        },
      };
      return {
        ...state,
        audioLibrary: [...state.audioLibrary, audioItem],
        fileHistory: [
          ...state.fileHistory,
          {
            id: audioItem.id,
            name: audioItem.name,
            audio_url: audioItem.audio_url,
            config_url: audioItem.config_url,
            type: audioItem.type,
            date: audioItem.date,
            category: audioItem.category,
            template: action.payload.template || 'unknown',
          },
        ],
      };

    case 'REMOVE_FROM_AUDIO_LIBRARY':
      if (!action.payload) {
        devLog('Invalid payload for REMOVE_FROM_AUDIO_LIBRARY, missing ID');
        return state;
      }
      return {
        ...state,
        audioLibrary: state.audioLibrary.filter((item) => item.id !== action.payload),
        fileHistory: state.fileHistory.filter((item) => item.id !== action.payload),
      };

    case 'ADD_HISTORY_ENTRIES':
      if (!Array.isArray(action.payload) || action.payload.length === 0) {
        devLog('Invalid payload for ADD_HISTORY_ENTRIES, expected non-empty array');
        return state;
      }
      const existingIds = new Set(state.fileHistory.map((entry) => entry.id));
      const newEntries = (action.payload as FileHistoryItem[]).filter(
        (entry) => entry.id && !existingIds.has(entry.id)
      );
      if (newEntries.length === 0) {
        devLog('No new entries to add, all entries already exist');
        return state;
      }
      return {
        ...state,
        fileHistory: [...state.fileHistory, ...newEntries],
      };

    case 'UPDATE_HISTORY_ENTRY':
      if (!action.payload?.id) {
        devLog('Invalid payload for UPDATE_HISTORY_ENTRY, missing ID');
        return state;
      }
      return {
        ...state,
        fileHistory: state.fileHistory.map((entry) =>
          entry.id === action.payload.id ? { ...entry, ...action.payload } : entry
        ),
        audioLibrary: state.audioLibrary.map((entry) =>
          entry.id === action.payload.id
            ? { ...entry, ...action.payload, audioMetadata: entry.audioMetadata }
            : entry
        ),
      };

    case 'REMOVE_HISTORY_ENTRY':
      if (!action.payload) {
        devLog('Invalid payload for REMOVE_HISTORY_ENTRY, missing ID');
        return state;
      }
      return {
        ...state,
        fileHistory: state.fileHistory.filter((entry) => entry.id !== action.payload),
        audioLibrary: state.audioLibrary.filter((entry) => entry.id !== action.payload),
      };

    case 'RESET_FILE_HISTORY':
      return {
        ...state,
        fileHistory: [],
        audioLibrary: [],
      };

    default:
      devLog('Unhandled action type in fileStorageReducer:', action.type);
      return state;
  }
}