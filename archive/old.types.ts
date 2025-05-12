// context/types/types.ts
export interface AudioFileMetaDataEntry {
    id: string;
    name: string;
    type: string;
    size?: number;
    source?: any;
    date: string;
    placeholder?: string; // Authoritative source for placeholder
    volume: number; // Authoritative source for volume
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
      placeholder?: string; // Mirrors AudioFileMetaDataEntry.placeholder
      volume?: number; // Mirrors AudioFileMetaDataEntry.volume
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
    addToAudioLibrary: (file: File, audioData: Partial<AudioLibraryItem>) => Promise<void>;
    removeFromAudioLibrary: (audioId: string, options?: { category?: string }) => Promise<void>;
    addToFileHistory: (entry: FileHistoryItem) => Promise<void>;
    updateHistoryEntry: (entry: FileHistoryItem) => void;
    setFileHistory: (history: FileHistoryItem[]) => void;
    refreshFileHistory: () => Promise<void>;
    resetFileHistory: () => void;
  }