#!/usr/bin/env python3
"""
Simple Audio File Storage Module

This module provides Flask routes for storing and serving audio and config files:
1. POST /upload: Store audio files in Uploads/
2. POST /configs: Store config JSON files in Uploads/configs/
3. GET /audio/<filename>: Serve audio files
4. GET /configs/<filename>: Serve config files
5. DELETE /audio/<filename>: Delete audio files
6. DELETE /configs/<filename>: Delete config files

No metadata or JSON processing occurs. All metadata is handled by the frontend.
Routes are exported via setup_routes for integration with other Flask apps.
"""

import os
import logging
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

# Define paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(SCRIPT_DIR, "Uploads")
CONFIGS_DIR = os.path.join(UPLOAD_DIR, "configs")

# Create directories
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)

def get_unique_filename(base_name, extension, directory):
    """
    Generate a unique filename by appending a UUID if the base name exists.

    Args:
        base_name (str): The desired base name (e.g., "merged-audio").
        extension (str): The file extension (e.g., ".wav").
        directory (str): The directory to check for existing files.

    Returns:
        str: A unique filename.
    """
    base_name = base_name.replace('.', '')
    if extension.startswith('.'):
        extension = extension[1:]
    filename = secure_filename(f"{base_name}.{extension}" if extension else base_name)
    file_path = os.path.join(directory, filename)

    if not os.path.exists(file_path):
        return filename

    while True:
        unique_suffix = uuid.uuid4().hex[:8]
        new_filename = secure_filename(f"{base_name}_{unique_suffix}.{extension}" if extension else f"{base_name}_{unique_suffix}")
        new_file_path = os.path.join(directory, new_filename)
        if not os.path.exists(new_file_path):
            return new_filename

def upload_audio():
    """
    Store an audio file in the Uploads/ directory.

    Request:
        - audio: The audio file (multipart/form-data).

    Returns:
        JSON with the file URL (e.g., {'url': '/audio/filename.wav'}).
    """
    try:
        if 'audio' not in request.files:
            logging.error("No audio file provided in request")
            return jsonify({'error': 'No audio file provided'}), 400
        file = request.files['audio']
        if file.filename == '':
            logging.error("No filename provided for audio file")
            return jsonify({'error': 'No file selected'}), 400

        # Get filename and extension
        base_name, extension = os.path.splitext(file.filename)
        if not extension:
            extension = '.wav'  # Default to WAV
        base_name = base_name.lower().replace(' ', '-')
        filename = get_unique_filename(base_name, extension, UPLOAD_DIR)
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save file
        file.save(file_path)
        if not os.path.exists(file_path):
            logging.error(f"Failed to save file: {file_path}")
            return jsonify({'error': 'Failed to save file'}), 500
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            os.remove(file_path)
            logging.error("Uploaded file is empty")
            return jsonify({'error': 'Uploaded file is empty'}), 400

        logging.info(f"File uploaded successfully: /audio/{filename}")
        return jsonify({'url': f'/audio/{filename}'}), 200
    except Exception as e:
        logging.error(f"Error in upload_audio: {str(e)}")
        return jsonify({'error': f'Failed to upload audio: {str(e)}'}), 500

def save_config():
    """
    Store a config JSON file in the Uploads/configs/ directory.

    Request:
        - file: The JSON config file (multipart/form-data).
        - overwrite (optional): If 'true', overwrite existing audio_metadata.json.

    Returns:
        JSON with the config file URL (e.g., {'config_url': '/configs/filename.json'}).
    """
    try:
        if 'file' not in request.files:
            logging.error("No file provided in config save request")
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            logging.error("No filename provided for config file")
            return jsonify({'error': 'No file selected'}), 400

        # Check for overwrite flag for audio_metadata.json
        overwrite = request.form.get('overwrite', 'false').lower() == 'true'
        if file.filename == 'audio_metadata.json' and overwrite:
            filename = 'audio_metadata.json'
        else:
            # Ensure JSON extension
            base_name, extension = os.path.splitext(file.filename)
            if not extension.lower() == '.json':
                extension = '.json'
            base_name = base_name.lower().replace(' ', '-')
            filename = get_unique_filename(base_name, extension, CONFIGS_DIR)

        config_path = os.path.join(CONFIGS_DIR, filename)
        file.save(config_path)
        if not os.path.exists(config_path):
            logging.error(f"Failed to save config file: {config_path}")
            return jsonify({'error': 'Failed to save config file'}), 500

        logging.info(f"Config file saved to: /configs/{filename}")
        return jsonify({'config_url': f'/configs/{filename}'}), 200
    except Exception as e:
        logging.error(f"Error saving config file: {str(e)}")
        return jsonify({'error': f'Failed to save config file: {str(e)}'}), 500

def serve_audio(filename):
    """
    Serve an audio file from the Uploads/ directory.

    Args:
        filename (str): Name of the audio file.

    Returns:
        The file or a 404 error if not found.
    """
    try:
        file_path = os.path.join(UPLOAD_DIR, secure_filename(filename))
        if not os.path.exists(file_path):
            logging.warning(f"Audio file not found: {filename}")
            return jsonify({'error': 'File not found'}), 404
        return send_from_directory(UPLOAD_DIR, filename)
    except Exception as e:
        logging.error(f"Error serving audio file {filename}: {str(e)}")
        return jsonify({'error': f'Failed to serve audio file: {str(e)}'}), 500

def serve_config(filename):
    """
    Serve a config file from the Uploads/configs/ directory.

    Args:
        filename (str): Name of the config file.

    Returns:
        The file or a 404 error if not found.
    """
    try:
        file_path = os.path.join(CONFIGS_DIR, secure_filename(filename))
        if not os.path.exists(file_path):
            logging.warning(f"Config file not found: {filename}")
            return jsonify({'error': 'Config file not found'}), 404
        return send_from_directory(CONFIGS_DIR, filename)
    except Exception as e:
        logging.error(f"Error serving config file {filename}: {str(e)}")
        return jsonify({'error': f'Failed to serve config file: {str(e)}'}), 500

def delete_audio(filename):
    """
    Delete an audio file from the Uploads/ directory.

    Args:
        filename (str): Name of the audio file.

    Query Parameters:
        delete_config (bool): Whether to delete the associated config file (default: false).

    Returns:
        JSON confirmation or a 404 error if not found.
    """
    try:
        file_path = os.path.join(UPLOAD_DIR, secure_filename(filename))
        if not os.path.exists(file_path):
            logging.warning(f"Audio file not found for deletion: {filename}")
            return jsonify({'error': 'File not found'}), 404
        
        # Check if we should delete the associated config file
        delete_config = request.args.get('delete_config', 'false').lower() == 'true'
        deleted_config = False
        config_filename = None
        
        # If delete_config is true, try to find and delete the associated config file
        if delete_config:
            # Try to extract the base name without extension
            base_name, _ = os.path.splitext(filename)
            
            # Look for config files with the same base name
            potential_config_filename = f"{base_name}.json"
            config_path = os.path.join(CONFIGS_DIR, potential_config_filename)
            
            if os.path.exists(config_path):
                try:
                    os.remove(config_path)
                    deleted_config = True
                    config_filename = potential_config_filename
                    logging.info(f"Deleted associated config file: {potential_config_filename}")
                except Exception as config_error:
                    logging.error(f"Error deleting config file {potential_config_filename}: {str(config_error)}")
        
        # Delete the audio file
        os.remove(file_path)
        logging.info(f"Deleted audio file: {filename}")
        
        return jsonify({
            'message': 'File deleted', 
            'deleted_config': deleted_config, 
            'config_filename': config_filename
        }), 200
    except Exception as e:
        logging.error(f"Error deleting audio file {filename}: {str(e)}")
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

def delete_config(filename):
    """
    Delete a config file from the Uploads/configs/ directory.

    Args:
        filename (str): Name of the config file.

    Returns:
        JSON confirmation or a 404 error if not found.
    """
    try:
        file_path = os.path.join(CONFIGS_DIR, secure_filename(filename))
        if not os.path.exists(file_path):
            logging.warning(f"Config file not found for deletion: {filename}")
            return jsonify({'error': 'Config file not found'}), 404
        os.remove(file_path)
        logging.info(f"Deleted config file: {filename}")
        return jsonify({'message': 'Config file deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting config file {filename}: {str(e)}")
        return jsonify({'error': f'Failed to delete config file: {str(e)}'}), 500

def setup_routes(flask_app):
    """
    Register file storage routes to the provided Flask application.

    Args:
        flask_app (Flask): The Flask application to register routes with.
    """
    flask_app.route('/upload', methods=['POST'])(upload_audio)
    flask_app.route('/configs', methods=['POST'])(save_config)
    flask_app.route('/audio/<filename>', methods=['GET'])(serve_audio)
    flask_app.route('/configs/<filename>', methods=['GET'])(serve_config)
    flask_app.route('/audio/<filename>', methods=['DELETE'])(delete_audio)
    flask_app.route('/configs/<filename>', methods=['DELETE'])(delete_config)