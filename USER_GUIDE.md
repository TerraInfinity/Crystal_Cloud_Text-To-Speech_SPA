# User Guide: Crystal Cloud Text-to-Speech SPA

## Introduction

Crystal Cloud Text-to-Speech SPA is a multi-dimensional tool designed to simplify the creation of audio content by combining text-to-speech (TTS) with integrated sound effects and audio files. Whether you’re producing podcasts, narrating videos, or crafting educational materials, this app streamlines your workflow by allowing you to manage text, voices, and audio effects in one centralized platform.

## Getting Started

To begin, navigate to [app URL] in your web browser—no installation is required. For first-time users, visit the **Settings Tab** to configure API keys, storage options, and default voices.

## Main Features

### Text Input with Placeholders
- Input text directly into **Section Cards** and add placeholders (e.g., `[sound:effect1]`) to insert audio effects or files at specific points.
- Link placeholders to audio files from the **Audio Library** for seamless integration into your TTS audio.

### Template Selection and Creation
- On the **Templates Tab**, select pre-generated templates or create your own for reusable project setups.
- Templates can predefine **Section Cards** with text or audio, which populate automatically when selected on the **Main Tab**.

### Section Cards
- Organize your content into **Section Cards** within the **Section List** on the **Main Tab**.
- Choose between two types:
  - **Text-to-Speech**: Enter text and select a voice.
  - **Audio-Only**: Import an audio file from the **Audio Library**.
- Rearrange, add, or delete cards to structure your narrative.

### Voice Selection
- For **Text-to-Speech Section Cards**, pick a voice from providers like Eleven Labs, AWS Polly, IBM Watson, Google Cloud, or local gTTS.
- Customize voices per section (e.g., Eleven Labs’ Adam for one, AWS Polly’s Sali for another).
- Manage available voices and set a default in the **Settings Tab**.

### Audio Generation and Merging
- Click **Generate Audio** to create audio for each **Section Card** based on its type and settings.
- Press **Merge** to combine all section audios into a single file, preserving their order.
- Use the **Download** button to save the final audio file.

### Settings Tab
- Add API keys for TTS services (e.g., Eleven Labs, AWS Polly, IBM Watson, Google Cloud).
- Include multiple keys per service as fallbacks for errors (e.g., authentication issues, token limits).
- Configure storage for audio files: local (via Python server), remote server, or cloud (e.g., S3, Google Drive).
- Define active voices and set a default voice.

### Audio Library
- Upload audio files to the **Audio Library** for use as placeholders in text or as **Audio-Only Section Cards**.
- Access and manage your uploaded files for future projects.

### File History Tab
- View and retrieve previously generated or merged audio files.
- Storage aligns with your **Settings Tab** configuration (local, remote, or cloud).

### Templates Tab
- Create and save custom templates with predefined **Section Cards** (text or audio).
- Templates are stored in local session storage or a database, depending on settings.

### Tools Tab
- Use additional tools to enhance text preparation:
  - **Chat AI**: Format text or get styling suggestions.
  - **Web Import**: Import text from web pages.
  - **HTML Parser**: Remove HTML tags from text.
  - **Grammar/Punctuation Checks**: Refine your text before conversion.

## Usage Scenarios
- **Podcast Production**: Write a script, add sound effects via placeholders, and merge into a polished episode.
- **Video Narration**: Generate narration with varied voices and download for editing software.
- **Educational Audio**: Build lessons with embedded examples or effects.

## Troubleshooting
- **API Key Errors**: Verify keys in the **Settings Tab**; ensure fallbacks are set.
- **Generation Fails**: Check voice provider status and token availability.
- **Storage Issues**: Confirm storage settings and accessibility (local, remote, or cloud).
- **Template Problems**: Recreate templates if they fail to load correctly.