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

from matplotlib import colors
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
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'


app = Flask(__name__)
CORS(app)

# Define directories and files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(SCRIPT_DIR, "Uploads")
METADATA_FILE = os.path.join(SCRIPT_DIR, "audio_metadata.json")

# Create the uploads directory if it doesn't exist
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Consolidated list of supported voices
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
# Register file_storage routes
setup_routes(app)

# Routes
@app.route('/')
def index_page():
    return render_template('index.html')

@app.route('/gtts', methods=['POST'])
def text_to_speech():
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

        # Convert text to speech
        tts = gTTS(text=text, lang=lang, tld=tld)
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)

        temp_mp3_path = None
        temp_wav_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_mp3:
                temp_mp3.write(audio_fp.read())
                temp_mp3.flush()
                temp_mp3_path = temp_mp3.name

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
                temp_wav_path = temp_wav.name

            # Run FFmpeg silently by redirecting stdout and stderr to DEVNULL
            subprocess.run([
                "ffmpeg", "-y", "-i", temp_mp3_path, "-vn", "-ac", "1", "-ar", "44100", temp_wav_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            with wave.open(temp_wav_path, 'rb') as wav_file:
                sample_rate = wav_file.getframerate()
                frames = wav_file.getnframes()
                duration = frames / float(sample_rate)

            with open(temp_wav_path, "rb") as f:
                audio_base64 = base64.b64encode(f.read()).decode('utf-8')

        finally:
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
    try:
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        with open(METADATA_FILE, 'w') as f:
            pass  # Truncates the file
        logging.info("All files purged successfully.")
        return jsonify({'message': 'All files purged successfully'}), 200
    except Exception as e:
        logging.error(f"Error purging files: {str(e)}")
        return jsonify({'error': 'Failed to purge files'}), 500

if __name__ == '__main__':
    logging.info("\n=== Starting Flask server on http://127.0.0.1:5000 ===")
    app.run(host='0.0.0.0', port=5000)