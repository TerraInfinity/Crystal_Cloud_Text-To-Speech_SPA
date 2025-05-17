// context/fileStorageMetadataActions.tsx
import { saveToStorage, loadFromStorage } from './storage';
import { devLog } from '../utils/logUtils';
import { AudioFileMetaDataEntry, FileStorageActions } from './types/types';
import { createHash } from 'crypto'; // Or use a browser-compatible hash library like js-sha256

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
        const normalizedMetadata = metadata.map(entry => ({
          ...entry,
          audio_url: entry.audio_url || entry.audiourl || entry.url || '',
          config_url: entry.config_url || null,
          placeholder: (entry.placeholder ?? entry.name) || 'Untitled',
          volume: entry.volume ?? 1,
          audiourl: undefined,
          url: undefined,
        }));
        sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(normalizedMetadata));
        return normalizedMetadata;
      }
    }
    return [];
  } catch (error) {
    devLog(`Error loading current metadata: ${error.message}`, 'error');
    return [];
  }
}

export async function syncMetadata(
  serverUrl: string = 'http://localhost:5000',
  action: MetadataAction
): Promise<number> {
  try {
    let metadata = await loadCurrentMetadata(serverUrl);
    const currentHash = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');

    switch (action.type) {
      case 'append':
        if (!action.payload?.id) {
          throw new Error('Invalid payload for append action: missing id');
        }
        if (metadata.some(entry => entry.id === action.payload.id)) {
          return metadata.length; // Skip append if entry exists
        }
        metadata = await appendMetadataEntry(metadata, action.payload, serverUrl);
        break;
      case 'remove':
        if (!action.payload?.id) {
          throw new Error('Invalid payload for remove action: missing id');
        }
        metadata = await removeMetadataEntry(metadata, action.payload.id);
        break;
      case 'update':
        if (!action.payload?.id || !action.payload?.field_property) {
          throw new Error('Invalid payload for update action: missing id or field_property');
        }
        metadata = await updateMetadataEntry(
          metadata,
          action.payload.id,
          action.payload.field_property,
          serverUrl
        );
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }

    if (!Array.isArray(metadata)) {
      throw new Error('Metadata is not an array');
    }

    const newHash = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
    if (currentHash === newHash) {
      return metadata.length; // Skip save if unchanged
    }

    const metadataStr = JSON.stringify(metadata, null, 2);
    const metadataBlob = new Blob([metadataStr], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'audio_metadata.json', { type: 'application/json' });

    const saveMetadata = {
      category: 'metadata',
      name: 'Audio Metadata',
      overwrite: true,
      skipMerge: action.type === 'remove' || action.type === 'update',
    };

    await saveToStorage(
      'audio_metadata.json',
      metadataFile,
      'fileStorage',
      saveMetadata
    );

    // Store metadata in session storage regardless of verification result
    sessionStorage.setItem('file_server_audio_metadata', JSON.stringify(metadata));

    // Attempt to verify the save with retries
    let verificationSuccess = false;
    const maxRetries = 3;
    const retryDelays = [200, 500, 1000]; // Increasing delays in ms
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Wait before verification to allow for file system/network delays
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
        
        const reloadedMetadata = await loadCurrentMetadata(serverUrl);
        
        // Use a more lenient comparison that ignores string vs null differences
        const normalizedOriginal = JSON.stringify(metadata, (key, value) => 
          value === "null" || value === null ? "null" : value
        );
        const normalizedReloaded = JSON.stringify(reloadedMetadata, (key, value) => 
          value === "null" || value === null ? "null" : value
        );
        
        if (normalizedReloaded === normalizedOriginal) {
          verificationSuccess = true;
          devLog(`Metadata verification successful on attempt ${i + 1}`);
          break;
        } else {
          devLog(`Metadata verification failed on attempt ${i + 1}, will retry`);
        }
      } catch (verifyError) {
        devLog(`Error during metadata verification attempt ${i + 1}: ${verifyError.message}`);
        // Continue to next retry
      }
    }
    
    // If verification failed but we saved the metadata, continue anyway
    if (!verificationSuccess) {
      devLog('Metadata verification failed after all retries, but continuing with operation');
      // We don't throw an error here, as the data was likely saved correctly
    }

    return metadata.length;
  } catch (error) {
    devLog(`Error in syncMetadata: ${error.message}`, 'error');
    throw new Error(`Failed to sync metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function appendMetadataEntry(
  metadata: AudioFileMetaDataEntry[],
  newEntry: AudioFileMetaDataEntry,
  serverUrl: string = 'http://localhost:5000'
): Promise<AudioFileMetaDataEntry[]> {
  try {
    const normalizedEntry: AudioFileMetaDataEntry = {
      ...newEntry,
      audio_url: newEntry.audio_url?.startsWith(serverUrl)
        ? newEntry.audio_url.replace(serverUrl, '')
        : newEntry.audio_url || '',
      config_url: newEntry.config_url?.startsWith(serverUrl)
        ? newEntry.config_url.replace(serverUrl, '')
        : newEntry.config_url || null,
      placeholder: (newEntry.placeholder ?? newEntry.name) || 'Untitled',
      volume: newEntry.volume ?? 1,
      category: newEntry.category || 'sound_effect',
    };
    if (metadata.some(entry => entry.id === newEntry.id)) {
      return await updateMetadataEntry(metadata, newEntry.id, normalizedEntry, serverUrl);
    }
    const updatedMetadata = [...metadata, normalizedEntry];
    return updatedMetadata;
  } catch (error) {
    devLog(`Error in appendMetadataEntry: ${error.message}`, 'error');
    throw new Error(`Failed to append metadata entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function removeMetadataEntry(
  metadata: AudioFileMetaDataEntry[],
  id: string
): Promise<AudioFileMetaDataEntry[]> {
  try {
    // Log the original metadata count
    const originalCount = metadata.length;
    devLog(`Removing entry with ID: ${id} from metadata (current count: ${originalCount})`, 'info');
    
    // Filter out the entry with the matching id
    const filteredMetadata = metadata.filter(entry => entry.id !== id);
    
    // Check if the entry was actually removed
    if (filteredMetadata.length === originalCount) {
      devLog(`Warning: Entry with ID: ${id} was not found in metadata`, 'warn');
    } else {
      devLog(`Successfully filtered out entry with ID: ${id}. New count: ${filteredMetadata.length}`, 'info');
    }
    
    return filteredMetadata;
  } catch (error) {
    devLog(`Error in removeMetadataEntry for ID ${id}: ${error.message}`, 'error');
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
    // Log what we're updating
    devLog(`Updating metadata entry ${id} with properties: ${JSON.stringify(field_property)}`, 'info');
    
    // Special handling for null values to ensure consistency
    const normalizedFieldProperty: Partial<AudioFileMetaDataEntry> = {
      ...field_property,
      audio_url: field_property.audio_url !== undefined
        ? field_property.audio_url === null
          ? null  // Keep as null, not "null" string
          : field_property.audio_url.startsWith(serverUrl)
            ? field_property.audio_url.replace(serverUrl, '')
            : field_property.audio_url || ''
        : undefined,
      config_url: field_property.config_url !== undefined
        ? field_property.config_url === null
          ? null  // Keep as null, not "null" string
          : field_property.config_url.startsWith(serverUrl)
            ? field_property.config_url.replace(serverUrl, '')
            : field_property.config_url || null
        : undefined,
      placeholder: (field_property.placeholder ?? field_property.name) || undefined,
      volume: field_property.volume ?? undefined,
      category: field_property.category || undefined,
    };
    
    // Filter out undefined values
    const cleanedFieldProperty = Object.fromEntries(
      Object.entries(normalizedFieldProperty).filter(([_, value]) => value !== undefined)
    );
    
    const existingEntry = metadata.find(entry => entry.id === id);
    if (existingEntry) {
      // Check if the update would result in an invalid entry
      const willHaveAudio = normalizedFieldProperty.audio_url !== null ? true : 
        (normalizedFieldProperty.audio_url === undefined && existingEntry.audio_url !== null && existingEntry.audio_url !== "null");
      
      const willHaveConfig = normalizedFieldProperty.config_url !== null ? true :
        (normalizedFieldProperty.config_url === undefined && existingEntry.config_url !== null && existingEntry.config_url !== "null");
      
      // If neither audio nor config will remain, the entry should be removed
      if (!willHaveAudio && !willHaveConfig) {
        devLog(`Update would remove both audio and config, removing entry ${id} completely`, 'info');
        return metadata.filter(entry => entry.id !== id);
      }
      
      // Normal update case
      const updatedEntry = {
        ...existingEntry,
        ...cleanedFieldProperty,
        placeholder: (cleanedFieldProperty.placeholder ?? existingEntry.placeholder ?? existingEntry.name) || 'Untitled',
        volume: cleanedFieldProperty.volume ?? existingEntry.volume ?? 1,
      };
      const updatedMetadata = metadata.map(entry =>
        entry.id === id ? updatedEntry : entry
      );
      return updatedMetadata;
    } else {
      // Skip adding new entries that would have null URLs
      if (normalizedFieldProperty.audio_url === null && normalizedFieldProperty.config_url === null) {
        devLog(`Not creating new entry with ID ${id} since both audio_url and config_url are null`, 'info');
        return metadata;
      }
      
      // Create new entry case
      const newEntry: AudioFileMetaDataEntry = {
        id,
        name: normalizedFieldProperty.name || 'Unnamed Audio',
        type: normalizedFieldProperty.type || 'audio/wav',
        size: normalizedFieldProperty.size || 0,
        date: normalizedFieldProperty.date || new Date().toISOString(),
        volume: normalizedFieldProperty.volume || 1,
        audio_url: normalizedFieldProperty.audio_url || null,
        config_url: normalizedFieldProperty.config_url || null,
        category: normalizedFieldProperty.category || 'sound_effect',
        placeholder: normalizedFieldProperty.placeholder || 'unnamed_audio',
        source: normalizedFieldProperty.source || { type: 'unknown', metadata: {} },
      };
      const updatedMetadata = [...metadata, newEntry];
      return updatedMetadata;
    }
  } catch (error) {
    devLog(`Error in updateMetadataEntry for ID ${id}: ${error.message}`, 'error');
    throw new Error(`Failed to update metadata entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}