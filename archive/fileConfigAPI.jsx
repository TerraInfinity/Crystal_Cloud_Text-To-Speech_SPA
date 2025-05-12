import axios from 'axios';
import { StorageServiceAPI } from './storageServiceAPI';
import { devLog, devError, devDebug } from '../../utils/logUtils';

/**
 * API handler for configuration retrieval
 * Fetches configurations for file history entries from storage
 * @param {Object} req - The Next.js request object
 * @param {Object} res - The Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  try {
    const { method } = req;
    const path = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    
    // Only handle GET requests to /api/config/:fileId
    if (method !== 'GET' || path.length < 2) {
      return res.status(405).json({ error: 'Method not allowed or incomplete path' });
    }
    
    const fileId = path[1];
    devLog(`Handling config request for file ID: ${fileId}`);
    
    // Try different approaches to get the configuration
    let config = null;
    let error = null;
    
    // 1. Try the direct Python server endpoint first
    try {
      const pythonServerUrl = process.env.SERVER_URL || 'http://localhost:5000';
      devDebug(`Attempting to fetch config directly from Python server API for file ID: ${fileId}`);
      const response = await axios.get(`${pythonServerUrl}/api/file-config/${fileId}`);
      
      if (response.status === 200 && response.data) {
        config = response.data;
        devLog('Successfully fetched config from Python server API');
      }
    } catch (directApiError) {
      devError('Error from direct Python API endpoint:', directApiError.message);
      error = directApiError;
      // Fall through to the next approach
    }
    
    // 2. If that fails, try to get the metadata list and find the file
    if (!config) {
      try {
        // Initialize the storage service
        const storageService = new StorageServiceAPI({
          fileStorageBackend: process.env.FILE_STORAGE_BACKEND || 'remote',
          serverUrl: process.env.SERVER_URL || 'http://localhost:5000'
        });
        
        // Try to fetch file metadata from the file list
        devDebug('Fetching file list to find config...');
        const files = await storageService.listFiles();
        const targetFile = files.find(file => file.id === fileId);
        
        if (!targetFile) {
          devError(`No file found with ID ${fileId}`);
          return res.status(404).json({ error: 'File not found' });
        }
        
        devLog(`Found file in list: ${targetFile.name}`);
        
        // Several places to check for config data
        
        // Check for config_path
        if (targetFile.config_path) {
          devDebug(`File has config_path: ${targetFile.config_path}`);
          try {
            // Extract just the filename from the path
            const configFilename = targetFile.config_path.split('/').pop();
            const configResponse = await axios.get(`${process.env.SERVER_URL || 'http://localhost:5000'}/configs/${configFilename}`);
            if (configResponse.data) {
              config = configResponse.data;
              devLog('Successfully loaded config from config_path');
            }
          } catch (configPathError) {
            devError('Error loading from config_path:', configPathError.message);
          }
        }
        
        // If still no config, check metadata
        if (!config && targetFile.metadata) {
          if (targetFile.metadata.config) {
            try {
              config = typeof targetFile.metadata.config === 'string' 
                ? JSON.parse(targetFile.metadata.config) 
                : targetFile.metadata.config;
              devLog('Found config in metadata.config');
            } catch (parseError) {
              devError('Error parsing config from metadata:', parseError);
            }
          }
        }
        
        // Check if config was directly embedded in the targetFile object
        if (!config && targetFile.config) {
          config = typeof targetFile.config === 'string'
            ? JSON.parse(targetFile.config)
            : targetFile.config;
          devLog('Found config directly in file object');
        }
      } catch (metadataError) {
        devError('Error fetching file metadata:', metadataError.message);
        error = error || metadataError;
      }
    }
    
    // Return the config if found
    if (config) {
      // Ensure config has at least an empty sections array if it doesn't already
      if (!config.sections) {
        config.sections = [];
      }
      
      return res.status(200).json(config);
    }
    
    // No config found in any source
    devError('No configuration found after all attempts');
    return res.status(404).json({ 
      error: 'Configuration not found for file',
      message: error ? error.message : 'No configuration data available'
    });
  } catch (error) {
    devError('Error retrieving file configuration:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve file configuration',
      message: error.message
    });
  }
} 