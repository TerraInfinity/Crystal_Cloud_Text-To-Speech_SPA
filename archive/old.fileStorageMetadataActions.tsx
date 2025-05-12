// context/fileStorageMetadataActions.tsx
import { saveToStorage, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';
import { AudioFileMetaDataEntry } from './types/types';

// Define action payload types
export type MetadataAction =
  | { type: 'append'; payload: AudioFileMetaDataEntry }
  | { type: 'remove'; payload: { id: string } }
  | { type: 'update'; payload: { id: string; field_property: Partial<AudioFileMetaDataEntry> } };

export async function loadCurrentMetadata(serverUrl: string = 'http://localhost:5000'): Promise<AudioFileMetaDataEntry[]> {
  try {
    const result = await loadFromStorage('audio_metadata.json', false, 'fileStorage');
    if (result instanceof Blob) {
      const text = await result.text();
      const metadata = JSON.parse(text);
      if (Array.isArray(metadata)) {
        devLog(`Loaded ${metadata.length} metadata entries from server`);
        const normalizedMetadata = metadata.map(entry => ({
          ...entry,
          audio_url: entry.audio_url || entry.audiourl || entry.url || '',
          config_url: entry.config_url || null,
          audiourl: undefined,
          url: undefined,
        }));
        sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(normalizedMetadata));
        return normalizedMetadata;
      }
    }
    devLog('No valid metadata found, returning empty array');
    return [];
  } catch (error) {
    devLog('Error loading current metadata:', error);
    return [];
  }
}

export async function syncMetadata(
  serverUrl: string = 'http://localhost:5000',
  action: MetadataAction
): Promise<number> {
  try {
    devLog(`[${new Date().toISOString()}] Processing syncMetadata action: ${action.type} for ID: ${action.payload?.id || 'unknown'}`);
    devLog('Action payload:', JSON.stringify(action.payload, null, 2));
    let metadata = await loadCurrentMetadata(serverUrl);
    devLog('Loaded metadata with entries:', metadata.length, JSON.stringify(metadata, null, 2));

    switch (action.type) {
      case 'append':
        if (!action.payload?.id) {
          throw new Error('Invalid payload for append action: missing id');
        }
        metadata = await appendMetadataEntry(metadata, action.payload, serverUrl);
        break;
      case 'remove':
        if (!action.payload?.id) {
          throw new Error('Invalid payload for remove action: missing id');
        }
        devLog('Before removal, metadata entries:', metadata.length);
        metadata = await removeMetadataEntry(metadata, action.payload.id);
        devLog('After removal, metadata entries:', metadata.length);
        break;
      case 'update':
        if (!action.payload?.id || !action.payload?.field_property) {
          throw new Error('Invalid payload for update action: missing id or field_property');
        }
        devLog('Before update, metadata entries:', metadata.length);
        metadata = await updateMetadataEntry(
          metadata,
          action.payload.id,
          action.payload.field_property,
          serverUrl
        );
        devLog('After update, metadata entries:', metadata.length);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }

    devLog('Updated metadata before saving:', JSON.stringify(metadata, null, 2));
    if (!Array.isArray(metadata)) {
      throw new Error('Metadata is not an array');
    }
    if (metadata.length === 0) {
      devLog('Warning: Metadata array is empty before saving');
    }

    const metadataStr = JSON.stringify(metadata, null, 2);
    const metadataBlob = new Blob([metadataStr], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'audio_metadata.json', { type: 'application/json' });
    devLog('Saving metadata to storage, content length:', metadataStr.length);

    // Add skipMerge for remove and update actions
    const saveMetadata = {
      category: 'metadata',
      name: 'Audio Metadata',
      overwrite: true,
      skipMerge: action.type === 'remove' || action.type === 'update' // Skip merge for remove and update
    };

    const saveResult = await saveToStorage(
      'audio_metadata.json',
      metadataFile,
      'fileStorage',
      saveMetadata
    );
    devLog('Metadata saved to storage, result:', saveResult);

    // Verify the save by reloading the metadata
    const reloadedMetadata = await loadCurrentMetadata(serverUrl);
    devLog('Reloaded metadata for verification:', JSON.stringify(reloadedMetadata, null, 2));
    // Custom JSON serializer to handle "null" strings consistently
    const replacer = (key, value) => (value === "null" ? "null" : value);
    if (JSON.stringify(reloadedMetadata, replacer) !== JSON.stringify(metadata, replacer)) {
      devLog('Verification failed: Saved metadata does not match expected metadata');
      throw new Error('Failed to verify metadata save');
    }

    devLog('Updating sessionStorage with metadata:', JSON.stringify(metadata, null, 2));
    sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(metadata));
    devLog(`Successfully synced ${metadata.length} entries to audio_metadata.json`);
    return metadata.length;
  } catch (error) {
    devLog('Error in syncMetadata:', error);
    throw new Error(`Failed to sync metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function appendMetadataEntry(
  metadata: AudioFileMetaDataEntry[],
  newEntry: AudioFileMetaDataEntry,
  serverUrl: string = 'http://localhost:5000'
): Promise<AudioFileMetaDataEntry[]> {
  try {
    devLog('Appending metadata entry:', newEntry.id);
    const normalizedEntry: AudioFileMetaDataEntry = {
      ...newEntry,
      audio_url: newEntry.audio_url?.startsWith(serverUrl)
        ? newEntry.audio_url.replace(serverUrl, '')
        : newEntry.audio_url || '',
      config_url: newEntry.config_url?.startsWith(serverUrl)
        ? newEntry.config_url.replace(serverUrl, '')
        : newEntry.config_url || null,
    };
    if (metadata.some(entry => entry.id === newEntry.id)) {
      devLog(`Entry ${newEntry.id} already exists, updating instead`);
      return metadata.map(entry =>
        entry.id === newEntry.id ? { ...entry, ...normalizedEntry } : entry
      );
    }
    return [...metadata, normalizedEntry];
  } catch (error) {
    devLog('Error in appendMetadataEntry:', error);
    throw new Error(`Failed to append metadata entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function removeMetadataEntry(
  metadata: AudioFileMetaDataEntry[],
  id: string
): Promise<AudioFileMetaDataEntry[]> {
  try {
    devLog('Removing metadata entry:', id);
    const filteredMetadata = metadata.filter(entry => entry.id !== id);
    devLog('Filtered metadata:', JSON.stringify(filteredMetadata, null, 2));
    return filteredMetadata;
  } catch (error) {
    devLog('Error in removeMetadataEntry:', error);
    throw new Error(`Failed to remove metadata entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateMetadataEntry(
  metadata: AudioFileMetaDataEntry[],
  id: string,
  field_property: Partial<AudioFileMetaDataEntry>,
  serverUrl: string = 'http://localhost:5000'
): Promise<AudioFileMetaDataEntry[]> {
  try {
    devLog(`[${new Date().toISOString()}] Updating metadata entry:`, id, 'with properties:', JSON.stringify(field_property, null, 2));
    const normalizedFieldProperty: Partial<AudioFileMetaDataEntry> = {
      ...field_property,
      // Only normalize audio_url if explicitly provided
      audio_url: field_property.audio_url !== undefined
        ? field_property.audio_url === null
          ? "null" // Set string "null"
          : field_property.audio_url.startsWith(serverUrl)
            ? field_property.audio_url.replace(serverUrl, '')
            : field_property.audio_url || ''
        : undefined,
      // Only normalize config_url if explicitly provided
      config_url: field_property.config_url !== undefined
        ? field_property.config_url === null
          ? "null" // Set string "null"
          : field_property.config_url.startsWith(serverUrl)
            ? field_property.config_url.replace(serverUrl, '')
            : field_property.config_url || null
        : undefined,
    };
    // Remove undefined fields to avoid overwriting existing values
    const cleanedFieldProperty = Object.fromEntries(
      Object.entries(normalizedFieldProperty).filter(([_, value]) => value !== undefined)
    );
    devLog('Normalized field_property:', JSON.stringify(cleanedFieldProperty, null, 2));
    const existingEntry = metadata.find(entry => entry.id === id);
    if (existingEntry) {
      const updatedEntry = { ...existingEntry, ...cleanedFieldProperty };
      devLog('Updated entry:', JSON.stringify(updatedEntry, null, 2));
      const updatedMetadata = metadata.map(entry =>
        entry.id === id ? updatedEntry : entry
      );
      devLog('Updated metadata array:', JSON.stringify(updatedMetadata, null, 2));
      return updatedMetadata;
    } else {
      const newEntry: AudioFileMetaDataEntry = {
        id,
        name: normalizedFieldProperty.name || 'Unnamed Audio',
        type: normalizedFieldProperty.type || 'audio/wav',
        size: normalizedFieldProperty.size || 0,
        date: normalizedFieldProperty.date || new Date().toISOString(),
        volume: normalizedFieldProperty.volume || 1,
        audio_url: normalizedFieldProperty.audio_url || "null",
        config_url: normalizedFieldProperty.config_url || "null",
        category: normalizedFieldProperty.category || 'unknown',
        placeholder: normalizedFieldProperty.placeholder || 'unnamed_audio',
        source: normalizedFieldProperty.source || { type: 'unknown', metadata: {} },
      };
      const updatedMetadata = [...metadata, newEntry];
      devLog('Appended new metadata entry:', JSON.stringify(updatedMetadata, null, 2));
      return updatedMetadata;
    }
  } catch (error) {
    devLog('Error in updateMetadataEntry:', error);
    throw new Error(`Failed to update metadata entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}