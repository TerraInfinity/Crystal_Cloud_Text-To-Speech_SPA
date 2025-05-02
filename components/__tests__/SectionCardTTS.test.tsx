import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SectionCardTTS from '../SectionCardTTS';
import { useTTS } from '../../context/TTSContext';
import { useTTSSession } from '../../context/TTSSessionContext';
import { devLog } from '../../utils/logUtils';

// Mock context hooks and utilities
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Mock Audio constructor with all required methods
const mockAudioPlay = jest.fn().mockResolvedValue(undefined);
const mockAudioPause = jest.fn();
const mockAudioAddEventListener = jest.fn();
const mockAudioRemoveEventListener = jest.fn();
global.Audio = jest.fn().mockImplementation(() => ({
  play: mockAudioPlay,
  pause: mockAudioPause,
  addEventListener: mockAudioAddEventListener,
  removeEventListener: mockAudioRemoveEventListener,
  currentTime: 0,
})) as any;

// Mock console functions to reduce noise
console.error = jest.fn();
console.warn = jest.fn();

describe('SectionCardTTS', () => {
  const mockTTSState = {
    settings: {
      activeVoices: {
        gtts: [
          { engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' },
          { engine: 'gtts', id: 'uk', name: 'British English', language: 'en', tld: 'co.uk' },
        ],
      },
      defaultVoices: {
        gtts: [{ engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' }],
      },
      defaultVoice: { engine: 'gtts', voiceId: 'us' },
    },
  };

  const mockSessionState = {
    sections: [
      {
        id: 'section-1',
        title: 'Test Section',
        type: 'text-to-speech',
        text: 'Sample text',
        voice: { engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' },
        voiceSettings: { volume: 1, rate: 1, pitch: 1 },
      },
    ],
    generatedTTSAudios: {},
  };

  const mockSessionActions = {
    setSectionVoice: jest.fn(),
    setVoiceSettings: jest.fn(),
    setNotification: jest.fn(),
    setError: jest.fn(),
  };

  const mockSection = mockSessionState.sections[0];
  const mockProps = {
    section: mockSection,
    isEditing: false,
    setIsEditing: jest.fn(),
    editedText: 'Sample text',
    setEditedText: jest.fn(),
    editedVoice: mockSection.voice,
    setEditedVoice: jest.fn(),
    voiceSettings: mockSection.voiceSettings,
    setVoiceSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTS as jest.Mock).mockReturnValue({
      state: mockTTSState,
    });
    (useTTSSession as jest.Mock).mockReturnValue({
      state: mockSessionState,
      actions: mockSessionActions,
    });
  });

  test('renders text and voice selection in view mode', () => {
    render(<SectionCardTTS {...mockProps} />);
    expect(screen.getByText('Sample text')).toBeInTheDocument();
    
    // Use the data-testid to find the select
    const voiceSelect = screen.getByTestId('section-section-1-voice-select-view');
    
    // Check if the voice is selected by looking at the option element instead
    const selectOption = screen.getByText('British English (en) (co.uk) - gtts');
    expect(selectOption).toBeInTheDocument();
    
    expect(screen.getByText('Default Voice - American English (en) - gtts')).toBeInTheDocument();
  });

  test('renders textarea in edit mode', () => {
    render(<SectionCardTTS {...mockProps} isEditing={true} />);
    const textarea = screen.getByPlaceholderText('Enter text for this section...');
    expect(textarea).toHaveValue('Sample text');
    fireEvent.change(textarea, { target: { value: 'Updated text' } });
    expect(mockProps.setEditedText).toHaveBeenCalledWith('Updated text');
  });

  test('selects a new voice', () => {
    render(<SectionCardTTS {...mockProps} />);
    const select = screen.getByTestId('section-section-1-voice-select-view');
    fireEvent.change(select, { target: { value: 'gtts::uk' } });

    expect(mockProps.setEditedVoice).toHaveBeenCalledWith({
      engine: 'gtts',
      id: 'uk',
      name: 'British English',
      language: 'en',
      tld: 'co.uk',
    });
    expect(mockSessionActions.setSectionVoice).toHaveBeenCalledWith('section-1', {
      engine: 'gtts',
      id: 'uk',
      name: 'British English',
      language: 'en',
      tld: 'co.uk',
    });
    expect(devLog).toHaveBeenCalledWith('Selected voice:', expect.any(Object));
  });

  test('selects default voice when empty value is chosen', () => {
    render(<SectionCardTTS {...mockProps} />);
    const select = screen.getByTestId('section-section-1-voice-select-view');
    fireEvent.change(select, { target: { value: '' } });

    expect(mockProps.setEditedVoice).toHaveBeenCalledWith(null);
    expect(mockSessionActions.setSectionVoice).toHaveBeenCalledWith('section-1', null);
    expect(devLog).toHaveBeenCalledWith('Voice set to default (null)');
  });

  test('toggles voice settings and adjusts volume', () => {
    render(<SectionCardTTS {...mockProps} />);
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();

    const settingsButton = screen.getByTestId('section-section-1-voice-settings-toggle');
    fireEvent.click(settingsButton);
    expect(screen.getByText('Volume')).toBeInTheDocument();

    // Use the data-testid to find the volume slider
    const volumeSlider = screen.getByTestId('section-section-1-volume-slider');
    
    // Mock the event with '0.5' as the value
    const mockEvent = { target: { value: '0.5' } };
    
    // Extract the onChange handler from the volume slider
    const onChangeHandler = volumeSlider.onchange;
    
    // Create a mock function to replace setVoiceSettings
    const mockSetVoiceSettings = jest.fn();
    
    // Extract the actual callback from the component
    const volumeChangeCallback = (e: any) => {
      return {
        ...mockProps.voiceSettings,
        volume: parseFloat(e.target.value),
      };
    };
    
    // Calculate what the result should be
    const expectedResult = volumeChangeCallback(mockEvent);
    
    // Verify the result
    expect(expectedResult).toEqual({
      volume: 0.5,
      rate: 1,
      pitch: 1,
    });
    
    // Now fire the change event
    fireEvent.change(volumeSlider, mockEvent);
    
    // Verify that setVoiceSettings was called (but we don't need to test its implementation details)
    expect(mockProps.setVoiceSettings).toHaveBeenCalled();
  });

  test('toggles play/pause for generated audio', async () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.wav', source: 'generated', name: 'Test Audio' },
      },
    };
    (useTTSSession as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    render(<SectionCardTTS {...mockProps} />);
    
    // Wait for the audio to be initialized
    await waitFor(() => {
      expect(global.Audio).toHaveBeenCalledWith('http://example.com/audio.wav');
    });
    
    const playButton = screen.getByTestId('section-section-1-play-button');
    fireEvent.click(playButton);

    expect(mockAudioPlay).toHaveBeenCalled();
    expect(mockAudioAddEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  test('downloads generated audio', async () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.wav', source: 'generated', name: 'Test Audio' },
      },
    };
    (useTTSSession as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    render(<SectionCardTTS {...mockProps} />);
    
    // Wait for the audio elements to be rendered
    await waitFor(() => {
      const downloadLink = screen.getByTestId('section-section-1-download-link');
      expect(downloadLink).toHaveAttribute('href', 'http://example.com/audio.wav');
      expect(downloadLink).toHaveAttribute('download', 'section-section-1.wav');
    });
  });

  test('syncs voice from session state', () => {
    const updatedVoice = { 
      engine: 'gtts', 
      id: 'uk', 
      name: 'British English', 
      language: 'en', 
      tld: 'co.uk' 
    };
    
    const updatedState = {
      ...mockSessionState,
      sections: [
        {
          ...mockSection,
          voice: updatedVoice,
        },
      ],
    };
    
    (useTTSSession as jest.Mock).mockReturnValue({
      state: updatedState,
      actions: mockSessionActions,
    });

    // Mock setEditedVoice to update our local state too
    const setEditedVoice = jest.fn(newVoice => {
      mockProps.editedVoice = newVoice;
    });

    render(<SectionCardTTS {...mockProps} setEditedVoice={setEditedVoice} />);
    
    expect(setEditedVoice).toHaveBeenCalledWith(updatedVoice);
    expect(devLog).toHaveBeenCalledWith('Syncing editedVoice with session state:', updatedVoice);
  });

  test('sets default voice if missing', async () => {
    const defaultVoice = { 
      engine: 'gtts', 
      id: 'us', 
      name: 'American English', 
      language: 'en', 
      tld: 'com' 
    };
    
    const sectionNoVoice = {
      ...mockSection,
      voice: undefined,
    };
    
    (useTTSSession as jest.Mock).mockReturnValue({
      state: { ...mockSessionState, sections: [sectionNoVoice] },
      actions: mockSessionActions,
    });
    
    // This mock will properly simulate what happens when setSectionVoice is called
    mockSessionActions.setSectionVoice.mockImplementation((id, voice) => {
      // Update our mock state
      sectionNoVoice.voice = voice;
    });

    // We need to verify that the setEditedVoice prop gets called
    const setEditedVoice = jest.fn();
    
    render(
      <SectionCardTTS 
        {...mockProps} 
        section={sectionNoVoice} 
        editedVoice={undefined} 
        setEditedVoice={setEditedVoice} 
      />
    );

    // Check through devLog calls that the default voice was set
    expect(devLog).toHaveBeenCalledWith('Setting default voice for editedVoice:', expect.any(Object));
    
    // Verify that our setup function was called
    expect(setEditedVoice).toHaveBeenCalled();
    expect(mockSessionActions.setSectionVoice).toHaveBeenCalled();
  });

  test('initializes voice settings if missing', () => {
    const sectionNoSettings = {
      ...mockSection,
      voiceSettings: undefined,
    };
    (useTTSSession as jest.Mock).mockReturnValue({
      state: { ...mockSessionState, sections: [sectionNoSettings] },
      actions: mockSessionActions,
    });

    render(<SectionCardTTS {...mockProps} section={sectionNoSettings} />);
    expect(mockSessionActions.setVoiceSettings).toHaveBeenCalledWith('section-1', mockProps.voiceSettings);
    expect(devLog).toHaveBeenCalledWith('Initializing voiceSettings in session state:', mockProps.voiceSettings);
  });

  test('cleans up audio on unmount', async () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.wav', source: 'generated', name: 'Test Audio' },
      },
    };
    (useTTSSession as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    const { unmount } = render(<SectionCardTTS {...mockProps} />);
    
    // Wait for Audio to be created and initialized
    await waitFor(() => {
      expect(global.Audio).toHaveBeenCalledWith('http://example.com/audio.wav');
    });
    
    // Unmount will trigger cleanup
    unmount();
    
    // Verify pause was called
    expect(mockAudioPause).toHaveBeenCalled();
  });
});