#!/usr/bin/env python3
"""
Text-to-Speech Server based on Google TTS (gTTS)

This Flask application provides a RESTful API for:
1. Converting text to speech using Google's TTS engine
2. Retrieving available voice options
3. Audio file storage and management (via file_storage.py)

The server handles audio conversion, format transformation (MP3 to WAV),
and returns audio data in base64 format ready for client-side playback.

Dependencies:
- Flask, Flask-CORS: Web framework and Cross-Origin support
- gTTS: Google Text-to-Speech library
- ffmpeg: Audio conversion (must be installed on the system)
- file_storage.py: File management module (included in this project)

Usage:
- Run this file directly to start the server on port 5000
- Access the API endpoints as documented in README.md
"""
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from gtts import gTTS
import base64
import io
import logging
import subprocess
import tempfile
import os
from datetime import datetime
import wave
from file_storage import setup_routes  # Import file_storage routes

# Logging configuration
ADVANCED_LOGGING = False  # Set to True for detailed logs (client IP, raw JSON, etc.)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

# ANSI color codes for console
class Colors:
    """ANSI color codes for console output formatting"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for all routes

# Define directories
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(SCRIPT_DIR, "Uploads")  # Directory for storing audio files
CONFIGS_DIR = os.path.join(UPLOAD_DIR, "configs")  # Directory for config files

# Create directories if they don't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)

# Configure maximum file size (5GB)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024  # 5GB max file size

# Consolidated list of supported voices with their configurations
SUPPORTED_VOICES = {
    'us': {'lang': 'en', 'tld': 'com', 'name': 'American English'},
    'au': {'lang': 'en', 'tld': 'com.au', 'name': 'Australian English'},
    'uk': {'lang': 'en', 'tld': 'co.uk', 'name': 'British English'},
    'ca': {'lang': 'en', 'tld': 'ca', 'name': 'Canadian English'},
    'in': {'lang': 'en', 'tld': 'co.in', 'name': 'Indian English'},
    'de-de': {'lang': 'de', 'tld': 'de', 'name': 'German (Germany)'},
    'es-es': {'lang': 'es', 'tld': 'es', 'name': 'Spanish (Spain)'},
    'es-mx': {'lang': 'es', 'tld': 'com.mx', 'name': 'Spanish (Mexico)'},
    'fr-fr': {'lang': 'fr', 'tld': 'fr', 'name': 'French (France)'},
    'it-it': {'lang': 'it', 'tld': 'it', 'name': 'Italian (Italy)'},
    'ja': {'lang': 'ja', 'tld': 'co.jp', 'name': 'Japanese'},
    'pt-pt': {'lang': 'pt', 'tld': 'pt', 'name': 'Portuguese (Portugal)'},
    'pt-br': {'lang': 'pt', 'tld': 'com.br', 'name': 'Portuguese (Brazil)'},
}

# Register all routes from file_storage.py (audio file management)
setup_routes(app)

# Routes
@app.route('/')
def index_page():
    """
    Serve the main HTML demo page
    
    Returns:
        HTML: The index.html template with TTS demo interface
    """
    return render_template('index.html')

@app.route('/gtts', methods=['POST'])
def text_to_speech():
    """
    Convert text to speech using Google TTS
    
    Expects JSON with:
    - text: The text to convert to speech
    - voice: Voice ID from SUPPORTED_VOICES (optional, defaults to 'us')
    
    Returns:
        JSON with:
        - audioBase64: Base64-encoded WAV audio
        - duration: Audio duration in seconds
        - mimeType: MIME type ('audio/wav')
    """
    try:
        # Start of request (blue header)
        logging.info(f"{Colors.BLUE}=== /gtts Request ==={Colors.RESET}")
        
        data = request.get_json()
        
        # Advanced logging: client IP and raw JSON
        if ADVANCED_LOGGING:
            logging.info(f"Client IP: {request.remote_addr}")
            logging.info(f"Raw JSON: {data}")

        text = data.get('text') if data else None
        voice = data.get('voice')
        language = data.get('language')

        if not text:
            logging.error(f"{Colors.RED}Error: No text provided{Colors.RESET}")
            logging.error(f"{Colors.RED}=================={Colors.RESET}")
            return jsonify({'message': 'Text is required'}), 400

        # Default to US English if no voice or invalid
        voice_info = SUPPORTED_VOICES.get(voice, SUPPORTED_VOICES['us'])
        lang = voice_info['lang']
        tld = voice_info.get('tld', 'com')
        voice_name = voice_info['name']

        # Validate tld
        if not isinstance(tld, str) or tld.lower() in ['none', 'null', '']:
            if ADVANCED_LOGGING:
                logging.warning(f"{Colors.YELLOW}Invalid TLD '{tld}' for voice {voice}, defaulting to 'com'{Colors.RESET}")
            tld = 'com'

        # Log processing (compact)
        logging.info(f"Processing: Text='{text}', Voice={voice_name} (ID={voice or 'default'}, Lang={lang}, TLD={tld})")
        
        # Advanced logging: unexpected fields, ignored language
        if ADVANCED_LOGGING and language:
            logging.info(f"Ignored Language: {language} (using '{lang}')")
        if ADVANCED_LOGGING:
            expected_fields = {'text', 'voice', 'language'}
            unexpected_fields = [key for key in data.keys() if key not in expected_fields]
            if unexpected_fields:
                logging.warning(f"{Colors.YELLOW}Unexpected Fields: {unexpected_fields}{Colors.RESET}")

        # Convert text to speech using Google TTS
        tts = gTTS(text=text, lang=lang, tld=tld)
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)

        temp_mp3_path = None
        temp_wav_path = None
        try:
            # Save MP3 to temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_mp3:
                temp_mp3.write(audio_fp.read())
                temp_mp3.flush()
                temp_mp3_path = temp_mp3.name

            # Create temporary WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
                temp_wav_path = temp_wav.name

            # Convert MP3 to WAV using FFmpeg (redirecting output to prevent console spam)
            subprocess.run([
                "ffmpeg", "-y", "-i", temp_mp3_path, "-vn", "-ac", "1", "-ar", "44100", temp_wav_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # Read WAV file properties
            with wave.open(temp_wav_path, 'rb') as wav_file:
                sample_rate = wav_file.getframerate()
                frames = wav_file.getnframes()
                duration = frames / float(sample_rate)

            # Read and encode the WAV file as base64
            with open(temp_wav_path, "rb") as f:
                audio_base64 = base64.b64encode(f.read()).decode('utf-8')

        finally:
            # Clean up temporary files
            if temp_mp3_path and os.path.exists(temp_mp3_path):
                os.remove(temp_mp3_path)
            if temp_wav_path and os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)

        # Summary (green header)
        logging.info(f"{Colors.GREEN}=== Summary ==={Colors.RESET}")
        logging.info(f"Text: '{text}'")
        logging.info(f"Voice: {voice_name} (ID={voice or 'default'}, Lang={lang}, TLD={tld})")
        logging.info(f"Audio: WAV, {duration:.2f}s, {sample_rate}Hz")
        logging.info(f"Status: Sent as base64")
        logging.info(f"{Colors.GREEN}=================={Colors.RESET}")

        return jsonify({
            'audioBase64': audio_base64,
            'duration': duration,
            'mimeType': 'audio/wav'
        })
    except Exception as e:
        logging.error(f"{Colors.RED}!!! Error !!!{Colors.RESET}")
        logging.error(f"Exception: {str(e)}")
        logging.error(f"{Colors.RED}=================={Colors.RESET}")
        return jsonify({'message': str(e)}), 500

@app.route('/gtts/voices', methods=['GET'])
def get_voices():
    """
    Return a list of all supported voices
    
    Returns:
        JSON with:
        - voices: Array of voice objects with id, name, language, and tld
    """
    try:
        logging.info("\n--- [GET] /gtts/voices ---")
        voices = [
            {
                'id': voice_id,
                'name': voice_info['name'],
                'language': voice_info['lang'],
                'tld': voice_info.get('tld', 'com')  # Default to 'com'
            }
            for voice_id, voice_info in SUPPORTED_VOICES.items()
        ]
        logging.info(f"-> Returning voices: {voices}")
        return jsonify({'voices': voices})
    except Exception as e:
        logging.error("\n!!! Error in /gtts/voices endpoint !!!")
        logging.error(f"Exception: {str(e)}", exc_info=True)
        return jsonify({'message': str(e)}), 500

@app.route('/purge', methods=['POST'])
def purge_files():
    """
    Delete all audio and config files in Uploads/ and Uploads/configs/
    
    Returns:
        JSON with success or error message
    """
    try:
        # Delete all audio files in Uploads/
        for filename in os.listdir(UPLOAD_DIR):
            if filename != "configs":  # Skip the configs directory
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    logging.info(f"Deleted audio file: {filename}")

        # Delete all config files in Uploads/configs/
        for filename in os.listdir(CONFIGS_DIR):
            file_path = os.path.join(CONFIGS_DIR, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
                logging.info(f"Deleted config file: {filename}")

        logging.info("All files purged successfully.")
        return jsonify({'message': 'All files purged successfully'}), 200
    except Exception as e:
        logging.error(f"Error purging files: {str(e)}")
        return jsonify({'error': 'Failed to purge files'}), 500

if __name__ == '__main__':
    logging.info("\n=== Starting Flask server on http://127.0.0.1:5000 ===")
    app.run(host='0.0.0.0', port=5000, debug=True)