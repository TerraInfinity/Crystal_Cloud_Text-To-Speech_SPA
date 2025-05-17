import requests
import argparse
import os
from typing import Optional

# Configuration JSON for the ElevenLabs API call
API_CONFIG = {
    "url": "https://api.elevenlabs.io/v1/text-to-speech",
    "method": "POST",
    "engine": "elevenlabs",
    "voice": {
        "id": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel",
        "language": "en"
    },
    "textLength": 3,
    "stability": 0.75,
    "similarity_boost": 0.75
}

# API Key Configuration (Edit this or use environment variable/command-line)
STATIC_API_KEY = "fc822fa0fa220c47fd573140133c832a"  # Replace with your ElevenLabs API key

def get_api_key() -> str:
    """Retrieve API key from command-line, environment variable, or static default."""
    parser = argparse.ArgumentParser(description="ElevenLabs Text-to-Speech API Client")
    parser.add_argument("--api-key", type=str, help="ElevenLabs API key")
    args = parser.parse_args()

    # Priority: command-line > environment variable > static key
    return (
        args.api_key
        or os.environ.get("ELEVENLABS_API_KEY")
        or STATIC_API_KEY
    )

def text_to_speech(api_key: str, config: dict, text: str, output_file: str = "output.mp3") -> bool:
    """
    Make a POST request to ElevenLabs Text-to-Speech API and save the audio output.
    
    Args:
        api_key: ElevenLabs API key
        config: API configuration dictionary
        text: Text to convert to speech
        output_file: Name of the output audio file
    
    Returns:
        bool: True if successful, False otherwise
    """
    url = f"{config['url']}/{config['voice']['id']}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    payload = {
        "text": text,
        "voice_settings": {
            "stability": config["stability"],
            "similarity_boost": config["similarity_boost"]
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        # Check for successful response
        if response.status_code == 200:
            with open(output_file, "wb") as f:
                f.write(response.content)
            print(f"Audio file saved as {output_file}")
            return True
        else:
            print(f"Error: API request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to make API request: {str(e)}")
        return False
    except IOError as e:
        print(f"Error: Failed to save audio file: {str(e)}")
        return False

def main():
    # Get API key
    api_key = get_api_key()
    
    if not api_key or api_key == "your_static_api_key_here":
        print("Error: No valid API key provided. Set STATIC_API_KEY, use ELEVENLABS_API_KEY env var, or provide via --api-key.")
        return
    
    # Use a short text (based on textLength=3 in config)
    text = "Hi!"  # Modify this to change the text to be converted
    
    # Make API call
    output_file = "output.mp3"
    success = text_to_speech(api_key, API_CONFIG, text, output_file)
    
    if success:
        print("Text-to-speech conversion completed successfully.")
    else:
        print("Text-to-speech conversion failed.")

if __name__ == "__main__":
    main()