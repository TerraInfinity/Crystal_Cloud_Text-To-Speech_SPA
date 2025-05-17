import { devLog, devWarn } from './logUtils';
import { getDefaultVoices as getDefaultVoicesFromDefaults } from '../context/ttsDefaults';

export interface Voice {
    id: string;
    name: string;
    language: string;
    engine: string;
    tld?: string;
  }

// Re-export getDefaultVoices with proper typing
export const getDefaultVoices = (): Record<string, Voice[]> => {
  return getDefaultVoicesFromDefaults();
};

export const validateVoice = (
    voice: Voice | null | undefined,
    activeVoices: Voice[],
    defaultVoice: Voice | null,
    shouldLog: boolean = true
  ): Voice | null => {
    if (shouldLog) {
      devLog('validateVoice called with:', {
        voice: voice ? { id: voice.id, name: voice.name, engine: voice.engine } : 'null/undefined',
        activeVoicesCount: activeVoices?.length || 0,
        defaultVoice: defaultVoice ? { id: defaultVoice.id, name: defaultVoice.name, engine: defaultVoice.engine } : 'null'
      });
    }
    
    // If no voice is provided, return the default voice
    // This only happens when there is explicitly NO voice
    if (!voice) {
      if (shouldLog) {
        devWarn('No voice provided, using default voice');
      }
      return defaultVoice;
    }
    
    // If voice is missing critical fields, attempt to repair it first
    if (!voice.id || !voice.name || !voice.language || !voice.engine) {
      if (shouldLog) {
        devWarn('Voice has missing required fields, attempting to repair:', voice);
      }
      
      // Try to fix partial voice objects by filling in missing fields
      const partiallyFixedVoice: Voice = {
        id: voice.id || (defaultVoice?.id || 'en-US-Standard-A'),
        name: voice.name || (defaultVoice?.name || 'Default Voice'),
        language: voice.language || (defaultVoice?.language || 'en-US'),
        engine: voice.engine || (defaultVoice?.engine || 'gtts'),
        tld: voice.tld || defaultVoice?.tld
      };
      
      // Only use default as last resort if repair isn't possible
      if (!partiallyFixedVoice.id || !partiallyFixedVoice.engine) {
        if (shouldLog) {
          devWarn('Could not repair voice, using default:', defaultVoice);
        }
        return defaultVoice;
      }
      
      voice = partiallyFixedVoice;
    }
    
    // Look for the voice in activeVoices
    const activeVoice = activeVoices?.find(
      (v) => v.id === voice.id && v.engine === voice.engine
    );
    
    if (activeVoice) {
      // If the voice is in activeVoices, use that complete object
      if (shouldLog) {
        devLog('Found matching voice in activeVoices:', activeVoice);
      }
      return activeVoice;
    } else {
      // IMPORTANT: Return the original voice even if not in activeVoices
      // This allows user-selected voices to be preserved
      if (shouldLog) {
        devLog('Voice not in active voices, preserving original voice:', voice);
      }
      
      // Ensure the voice has all required fields
      const validatedVoice: Voice = {
        id: voice.id,
        name: voice.name,
        language: voice.language || 'en',
        engine: voice.engine,
        tld: voice.tld
      };
      
      return validatedVoice;
    }
  };
  
  export const validateVoiceObject = (voice: Voice | null | undefined): Voice => {
    if (!voice) {
      const defaultVoices = getDefaultVoices();
      const fallbackVoice: Voice = defaultVoices.gtts[0] || {
        id: 'en-com',
        name: 'American English',
        language: 'en',
        engine: 'gtts',
        tld: 'com',
      };
      devWarn('Invalid voice, using fallback:', { input: voice, fallback: fallbackVoice });
      return fallbackVoice;
    }
    
    // Handle partial voice objects by supplying default values for missing properties
    // This helps preserve template-defined voices even if they have some missing fields
    const validVoice: Voice = {
      id: voice.id || 'en-com',
      name: voice.name || 'Default Voice',
      language: voice.language || 'en',
      engine: voice.engine || 'gtts',
      tld: voice.tld || undefined,
    };
    
    // If essential properties are missing, log a warning but still return the fixed voice
    if (!voice.id || !voice.name || !voice.language || !voice.engine) {
      devWarn('Partial voice object fixed with default values:', 
        { input: voice, fixed: validVoice });
    }
    
    return validVoice;
  };

export const ensureDefaultVoiceIsActive = (
  defaultVoice: Voice | null,
  activeVoices: Voice[],
  setDefaultVoice: (voice: Voice) => void
): void => {
  if (!defaultVoice || activeVoices.length === 0) {
    return;
  }
  const isDefaultActive = activeVoices.some(
    (v) => v.id === defaultVoice.id && v.engine === defaultVoice.engine
  );
  if (!isDefaultActive && activeVoices.length > 0) {
    const newDefault = activeVoices[0];
    setDefaultVoice(newDefault);
    devLog('Default voice updated to:', newDefault);
  }
};