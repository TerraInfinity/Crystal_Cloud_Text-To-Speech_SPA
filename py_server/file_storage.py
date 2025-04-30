import os
import json
import uuid
import time
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime
import logging

app = Flask(__name__)
from flask_cors import CORS
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

# Define paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(SCRIPT_DIR, "Uploads")
METADATA_FILE = os.path.join(SCRIPT_DIR, "audio_metadata.json")

# Create uploads directory
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_metadata(metadata_list):
    try:
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata_list, f, indent=2)
        logging.info(f"Metadata saved to {METADATA_FILE}")
    except Exception as e:
        logging.error(f"Failed to save metadata: {str(e)}")
        raise

def load_metadata():
    try:
        if not os.path.exists(METADATA_FILE):
            logging.info(f"Metadata file {METADATA_FILE} does not exist. Initializing empty list.")
            with open(METADATA_FILE, 'w') as f:
                json.dump([], f)
            return []

        with open(METADATA_FILE, 'r') as f:
            content = f.read().strip()
            if not content:
                logging.info(f"Metadata file {METADATA_FILE} is empty. Initializing empty list.")
                with open(METADATA_FILE, 'w') as f:
                    json.dump([], f)
                return []

            f.seek(0)
            metadata_list = json.load(f)

        if not isinstance(metadata_list, list):
            logging.error(f"Metadata file {METADATA_FILE} does not contain a list. Found: {type(metadata_list)}")
            raise ValueError("Metadata file must contain a list")

        for metadata in metadata_list:
            if not isinstance(metadata, dict):
                logging.warning(f"Skipping invalid metadata entry: {metadata}")
                continue
            if 'source' not in metadata:
                metadata['source'] = {'type': 'unknown'}
            if 'date' not in metadata:
                metadata['date'] = 'Unknown'
            if 'volume' not in metadata:
                metadata['volume'] = 1
            if 'placeholder' not in metadata:
                metadata['placeholder'] = metadata.get('name', 'Unknown')
            if 'category' not in metadata:
                metadata['category'] = 'unknown'
            if metadata['source']['type'] == 'local' and 'metadata' not in metadata['source']:
                metadata['source']['metadata'] = {
                    'name': metadata.get('name', 'Unknown'),
                    'type': metadata.get('type', 'Unknown'),
                    'size': metadata.get('size', 'Unknown')
                }
        logging.info(f"Loaded {len(metadata_list)} metadata entries")
        return metadata_list
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON in metadata file {METADATA_FILE}: {str(e)}")
        raise
    except Exception as e:
        logging.error(f"Failed to load metadata: {str(e)}")
        raise

def get_unique_filename(base_name, extension, directory):
    """
    Generate a unique filename by appending a numeric suffix or timestamp if the base name exists.
    
    Args:
        base_name (str): The desired base name (e.g., "bird").
        extension (str): The file extension (e.g., "wav").
        directory (str): The directory to check for existing files (e.g., UPLOAD_DIR).
    
    Returns:
        str: A unique filename (e.g., "bird.wav", "bird_1.wav", or "bird_1634567890.wav").
    """
    filename = secure_filename(f"{base_name}.{extension}" if extension else base_name)
    file_path = os.path.join(directory, filename)
    
    if not os.path.exists(file_path):
        return filename
    
    counter = 1
    while True:
        new_filename = secure_filename(f"{base_name}_{counter}.{extension}" if extension else f"{base_name}_{counter}")
        new_file_path = os.path.join(directory, new_filename)
        if not os.path.exists(new_file_path):
            return new_filename
        counter += 1
        if counter > 1000:
            timestamp = int(time.time())
            new_filename = secure_filename(f"{base_name}_{timestamp}.{extension}" if extension else f"{base_name}_{timestamp}")
            new_file_path = os.path.join(directory, new_filename)
            if not os.path.exists(new_file_path):
                return new_filename
            logging.error(f"Cannot generate unique filename for {base_name}.{extension}")
            raise OSError(f"Cannot generate unique filename for {base_name}.{extension}")

@app.route('/upload', methods=['POST'])
def upload_audio():
    try:
        uploaded_metadata = []
        category = request.form.get('category', 'other')
        custom_name = request.form.get('name')
        placeholder = request.form.get('placeholder')
        volume_str = request.form.get('volume', '1')

        valid_categories = ['sound_effect', 'voice', 'song', 'text', 'json', 'other']
        if category not in valid_categories:
            logging.warning(f"Invalid category provided: {category}. Defaulting to 'other'.")
            category = 'other'

        try:
            volume = float(volume_str)
            if volume < 0 or volume > 1:
                logging.warning(f"Invalid volume provided: {volume}. Defaulting to 1.")
                volume = 1.0
        except ValueError:
            logging.warning(f"Invalid volume format: {volume_str}. Defaulting to 1.")
            volume = 1.0

        if 'audio' in request.files:
            file = request.files['audio']
            if file.filename == '':
                return jsonify({'error': 'No selected file'}), 400

            original_filename = secure_filename(file.filename)
            extension = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else ''
            base_name = custom_name if custom_name else original_filename.rsplit('.', 1)[0]
            filename = get_unique_filename(base_name, extension, UPLOAD_DIR)
            file_path = os.path.join(UPLOAD_DIR, filename)
            file.save(file_path)

            current_time = datetime.now().isoformat()
            name = base_name
            placeholder_value = placeholder if placeholder else name.lower().replace(' ', '_')

            metadata = {
                'id': str(uuid.uuid4()),
                'name': name,
                'type': file.content_type,
                'size': os.path.getsize(file_path),
                'category': category,
                'source': {
                    'type': 'local',
                    'metadata': {
                        'name': filename,
                        'type': file.content_type,
                        'size': os.path.getsize(file_path)
                    }
                },
                'date': current_time,
                'volume': volume,
                'placeholder': placeholder_value,
                'url': f'/audio/{filename}'
            }
            metadata_list = load_metadata()
            metadata_list.append(metadata)
            save_metadata(metadata_list)
            logging.info(f"Uploaded single file: {filename} with name: {name}, placeholder: {placeholder_value}, volume: {volume}")
            return jsonify({'url': metadata['url']}), 200

        if 'files' in request.files:
            files = request.files.getlist('files')
            if not files or all(file.filename == '' for file in files):
                return jsonify({'error': 'No selected files'}), 400

            metadata_list = load_metadata()
            for file in files:
                if file.filename == '':
                    continue
                original_filename = secure_filename(file.filename)
                extension = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else ''
                base_name = custom_name if custom_name else original_filename.rsplit('.', 1)[0]
                filename = get_unique_filename(base_name, extension, UPLOAD_DIR)
                file_path = os.path.join(UPLOAD_DIR, filename)
                file.save(file_path)

                current_time = datetime.now().isoformat()
                name = base_name
                placeholder_value = placeholder if placeholder else name.lower().replace(' ', '_')

                metadata = {
                    'id': str(uuid.uuid4()),
                    'name': name,
                    'type': file.content_type,
                    'size': os.path.getsize(file_path),
                    'category': category,
                    'source': {
                        'type': 'local',
                        'metadata': {
                            'name': filename,
                            'type': file.content_type,
                            'size': os.path.getsize(file_path)
                        }
                    },
                    'date': current_time,
                    'volume': volume,
                    'placeholder': placeholder_value,
                    'url': f'/audio/{filename}'
                }
                metadata_list.append(metadata)
                uploaded_metadata.append(metadata)
            save_metadata(metadata_list)
            logging.info(f"Uploaded {len(uploaded_metadata)} files")
            if not uploaded_metadata:
                return jsonify({'error': 'No valid files uploaded'}), 400
            return jsonify(uploaded_metadata), 200

        return jsonify({'error': 'No files provided'}), 400
    except Exception as e:
        logging.error(f"Error in upload: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<audio_id>', methods=['PATCH'])
def update_audio_metadata(audio_id):
    try:
        data = request.get_json()
        if not data:
            logging.error("No JSON data provided in PATCH request")
            return jsonify({'error': 'No data provided'}), 400

        metadata_list = load_metadata()
        audio_metadata = next((meta for meta in metadata_list if meta['id'] == audio_id), None)
        if not audio_metadata:
            logging.warning(f"Audio not found for ID: {audio_id}")
            return jsonify({'error': 'Audio not found'}), 404

        current_filename = audio_metadata['url'].split('/')[-1]
        current_file_path = os.path.join(UPLOAD_DIR, current_filename)

        old_name = audio_metadata['name']
        if 'name' in data:
            audio_metadata['name'] = data['name']
        if 'placeholder' in data:
            audio_metadata['placeholder'] = data['placeholder']
        if 'volume' in data:
            audio_metadata['volume'] = float(data['volume'])

        if 'name' in data and data['name'] != old_name:
            extension = current_filename.rsplit('.', 1)[-1] if '.' in current_filename else ''
            new_filename = get_unique_filename(data['name'], extension, UPLOAD_DIR)
            new_file_path = os.path.join(UPLOAD_DIR, new_filename)

            if os.path.exists(current_file_path):
                os.rename(current_file_path, new_file_path)
                logging.info(f"Renamed file from {current_filename} to {new_filename}")
            else:
                logging.warning(f"File {current_filename} not found for renaming")

            audio_metadata['url'] = f'/audio/{new_filename}'
            audio_metadata['source']['metadata']['name'] = new_filename

        save_metadata(metadata_list)
        logging.info(f"Updated metadata for audio ID: {audio_id}")
        return jsonify(audio_metadata), 200
    except Exception as e:
        logging.error(f"Error updating audio metadata for ID {audio_id}: {str(e)}")
        return jsonify({'error': 'Failed to update audio metadata'}), 500

@app.route('/audio/list', methods=['GET'])
def list_audio():
    try:
        metadata_list = load_metadata()
        logging.info(f"Returning {len(metadata_list)} files from /audio/list")
        return jsonify(metadata_list)
    except Exception as e:
        logging.error(f"Error in /audio/list: {str(e)}")
        return jsonify({'error': 'Failed to fetch file list'}), 500

@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    try:
        logging.info(f"Serving file: {filename}")
        return send_from_directory(UPLOAD_DIR, filename)
    except Exception as e:
        logging.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/audio/<filename>', methods=['DELETE'])
def delete_audio(filename):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            logging.warning(f"File not found for deletion: {filename}")
            return jsonify({'error': 'File not found'}), 404

        metadata_list = load_metadata()
        metadata_list = [meta for meta in metadata_list if meta['url'] != f'/audio/{filename}']
        save_metadata(metadata_list)
        os.remove(file_path)
        logging.info(f"Deleted file: {filename}")
        return jsonify({'message': 'File deleted'}), 200
    except Exception as e:
        logging.error(f"Error deleting file {filename}: {str(e)}")
        return jsonify({'error': 'Failed to delete file'}), 500

@app.route('/audio/<filename>', methods=['PUT'])
def replace_audio(filename):
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            logging.warning(f"File not found for replacement: {filename}")
            return jsonify({'error': 'File not found'}), 404

        file.save(file_path)
        category = request.form.get('category', 'other')
        current_time = datetime.now().isoformat()

        metadata_list = load_metadata()
        for meta in metadata_list:
            if meta['url'] == f'/audio/{filename}':
                meta.update({
                    'type': file.content_type,
                    'size': os.path.getsize(file_path),
                    'category': category,
                    'source': {
                        'type': 'local',
                        'metadata': {
                            'name': filename,
                            'type': file.content_type,
                            'size': os.path.getsize(file_path)
                        }
                    },
                    'date': current_time
                })
                break
        save_metadata(metadata_list)
        logging.info(f"Replaced file: {filename}")
        return jsonify({'url': f'/audio/{filename}'}), 200
    except Exception as e:
        logging.error(f"Error replacing file {filename}: {str(e)}")
        return jsonify({'error': 'Failed to replace file'}), 500

def setup_routes(flask_app):
    flask_app.route('/upload', methods=['POST'])(upload_audio)
    flask_app.route('/audio/list', methods=['GET'])(list_audio)
    flask_app.route('/audio/<filename>', methods=['GET'])(serve_audio)
    flask_app.route('/audio/<filename>', methods=['DELETE'])(delete_audio)
    flask_app.route('/audio/<filename>', methods=['PUT'])(replace_audio)
    flask_app.route('/audio/<audio_id>', methods=['PATCH'])(update_audio_metadata)

if __name__ == '__main__':
    logging.info("Starting file storage server on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000)