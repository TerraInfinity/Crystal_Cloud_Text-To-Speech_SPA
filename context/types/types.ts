import { Voice } from '../../utils/voiceUtils';

export interface AudioFileMetaDataEntry {
  id: string;
  name: string;
  type: string;
  size?: number;
  source?: any;
  date: string;
  placeholder?: string;
  volume: number;
  audio_url: string;
  config_url?: string | null;
  category: string;
}

export interface FileHistoryItem {
  id: string;
  name: string;
  audio_url: string;
  config_url?: string | null;
  type: string;
  date: string;
  category: string;
  template?: string;
}

export interface AudioLibraryItem extends FileHistoryItem {
  audioMetadata?: {
    duration: number;
    format: string;
    placeholder?: string;
    volume?: number;
    [key: string]: any;
  };
}

export interface FileStorageState {
  fileHistory: FileHistoryItem[];
  audioLibrary: AudioLibraryItem[];
  settings?: {
    storageConfig?: {
      serverUrl?: string;
      type?: string;
      serviceType?: string | null;
    };
  };
}

export interface TTSState {
  theme: string;
  settings: {
    speechEngine: string;
    availableVoices: Record<string, Voice[]>;
    customVoices: Record<string, Voice[]>;
    activeVoices: Voice[];
    defaultVoice: Voice | null;
    mode: string;
    storageConfig: { type: string; serverUrl: string; serviceType: string | null };
  };
  templates: Record<string, any>;
}

export type TTSAction =
  | { type: 'LOAD_PERSISTENT_STATE'; payload: TTSState }
  | { type: 'SET_THEME'; payload: string }
  | { type: 'SET_SPEECH_ENGINE'; payload: string }
  | { type: 'ADD_CUSTOM_VOICE'; payload: { engine: string; voice: Voice } }
  | { type: 'REMOVE_CUSTOM_VOICE'; payload: { engine: string; voiceId: string } }
  | { type: 'ADD_ACTIVE_VOICE'; payload: Voice }
  | { type: 'REMOVE_ACTIVE_VOICE'; payload: { engine: string; voiceId: string } }
  | { type: 'SET_MODE'; payload: string }
  | { type: 'SAVE_TEMPLATE'; payload: { id: string; [key: string]: any } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'LOAD_TEMPLATES'; payload: Record<string, any> }
  | { type: 'SET_DEFAULT_VOICE'; payload: Voice }
  | { type: 'LOAD_ACTIVE_VOICES'; payload: Voice[] }
  | { type: 'LOAD_CUSTOM_VOICES'; payload: Record<string, Voice[]> }
  | { type: 'LOAD_AVAILABLE_VOICES'; payload: Record<string, Voice[]> }
  | { type: 'RESET_STATE' }
  | { type: 'SET_STORAGE_CONFIG'; payload: { type: string; serverUrl: string; serviceType: string | null } };

export type FileStorageAction =
  | { type: 'SET_FILE_HISTORY'; payload: FileHistoryItem[] }
  | { type: 'SET_AUDIO_LIBRARY'; payload: AudioLibraryItem[] };

export interface FileStorageActions {
  updateCurrentState: (state: Partial<FileStorageState>) => void;
  fetchAudioLibrary: () => Promise<any>;
  uploadAudio: (file: File, audioData: Partial<AudioLibraryItem>) => Promise<void>;
  mergeAndUploadAudio: (
    audio_urls: string[],
    audioData?: Partial<AudioLibraryItem>,
    config?: any
  ) => Promise<{ mergedAudioUrl: string; uploadedAudioUrl: string }>;
  deleteHistoryEntry: (
    entry: FileHistoryItem,
    options?: { deleteOption?: string }
  ) => Promise<{ success: boolean }>;
  updateAudio: (audioId: string, updatedAudioData: Partial<AudioLibraryItem>) => Promise<void>;
  loadAudioLibrary: (audioLibrary: AudioLibraryItem[]) => void;
  addToAudioLibrary: (file: File, audioData: Partial<AudioLibraryItem>) => Promise<AudioLibraryItem>;
  removeFromAudioLibrary: (audioId: string, options?: { category?: string }) => Promise<{ success: boolean }>;
  addToFileHistory: (entry: FileHistoryItem) => Promise<void>;
  updateHistoryEntry: (entry: FileHistoryItem) => void;
  setFileHistory: (history: FileHistoryItem[]) => void;
  refreshFileHistory: () => Promise<void>;
  resetFileHistory: () => void;
}