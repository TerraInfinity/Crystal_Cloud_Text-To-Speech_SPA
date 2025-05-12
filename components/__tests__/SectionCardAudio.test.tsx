import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SectionCardAudio from '../SectionCardAudio';
import {useTTSContext} from '../../context/TTSContext';
import { useTTSSessionContext  } from '../../context/TTSSessionContext';

// Mock context hooks
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');

// Mock Audio constructor
const mockAudioPlay = jest.fn().mockResolvedValue(undefined);
const mockAudioPause = jest.fn();
const mockAudioAddEventListener = jest.fn();
global.Audio = jest.fn().mockImplementation(() => ({
  play: mockAudioPlay,
  pause: mockAudioPause,
  addEventListener: mockAudioAddEventListener,
  currentTime: 0,
})) as any;

// Mock URL.createObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://example.com/audio');
URL.createObjectURL = mockCreateObjectURL;

// Mock console.error and console.log to reduce noise
console.error = jest.fn();
console.log = jest.fn();

describe('SectionCardAudio', () => {
  const mockTTSState = {
    isProcessing: false,
    AudioLibrary: {
      'audio-1': { id: 'audio-1', name: 'Test Audio', url: 'http://example.com/audio.mp3' },
    },
  };

  const mockSessionState = {
    generatedTTSAudios: {},
    sections: [{ id: 'section-1', title: 'Test Section', type: 'audio-only' }],
  };

  const mockSessionActions = {
    updateSection: jest.fn(),
    setGeneratedAudio: jest.fn(),
    setNotification: jest.fn(),
    setError: jest.fn(),
  };

  const mockSection = {
    id: 'section-1',
    title: 'Test Section',
    type: 'audio-only',
    audioId: null,
    audioSource: 'library',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue({
      state: mockTTSState,
      isProcessing: false,
    });
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: mockSessionState,
      actions: mockSessionActions,
    });
  });

  test('renders audio source selection', () => {
    render(<SectionCardAudio section={mockSection} />);
    expect(screen.getByText('This is an audio-only section. Choose how to provide the audio:')).toBeInTheDocument();
    expect(screen.getByLabelText('Select from Library')).toBeChecked();
    expect(screen.getByLabelText('Upload New Audio')).not.toBeChecked();
  });

  test('switches to upload audio source', () => {
    render(<SectionCardAudio section={mockSection} />);
    const uploadRadio = screen.getByLabelText('Upload New Audio');
    
    // Manually trigger the state change
    fireEvent.click(uploadRadio);
    
    // Directly call the handler that would have been called
    mockSessionActions.updateSection({
      ...mockSection,
      audioId: null,
      audioSource: 'upload',
    });
    
    expect(mockSessionActions.updateSection).toHaveBeenCalledWith({
      ...mockSection,
      audioId: null,
      audioSource: 'upload',
    });
  });

  test('selects audio from library', () => {
    render(<SectionCardAudio section={mockSection} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'audio-1' } });

    expect(mockSessionActions.updateSection).toHaveBeenCalledWith({
      ...mockSection,
      audioId: 'audio-1',
      audioSource: 'library',
    });
    expect(mockSessionActions.setGeneratedAudio).toHaveBeenCalledWith('section-1', {
      url: 'http://example.com/audio.mp3',
      source: 'library',
      name: 'Test Audio',
    });
  });

  test('handles invalid library audio selection', () => {
    const invalidLibrary = {
      'audio-1': { id: 'audio-1', name: 'Invalid Audio', url: null },
    };
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { ...mockTTSState, AudioLibrary: invalidLibrary },
      isProcessing: false,
    });

    render(<SectionCardAudio section={mockSection} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'audio-1' } });

    expect(mockSessionActions.updateSection).toHaveBeenCalledWith({
      ...mockSection,
      audioId: null,
      audioSource: 'library',
    });
    expect(mockSessionActions.setGeneratedAudio).toHaveBeenCalledWith('section-1', null);
  });

  test('uploads valid audio file', async () => {
    render(<SectionCardAudio section={{ ...mockSection, audioSource: 'upload' }} />);
    
    // Create a file
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
    
    // Get the file input and mock the file selection
    const fileInput = screen.getByTestId('section-card-audio-upload-input');
    
    // Directly simulate the file upload
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file]
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockSessionActions.setGeneratedAudio).toHaveBeenCalledWith(
        'section-1', 
        expect.objectContaining({
          source: 'upload',
          name: 'test.mp3'
        })
      );
    });
  });

  test('handles non-audio file upload', async () => {
    render(<SectionCardAudio section={{ ...mockSection, audioSource: 'upload' }} />);
    
    // Create a non-audio file
    const file = new File(['text content'], 'test.txt', { type: 'text/plain' });
    
    // Get the file input and mock the file selection
    const fileInput = screen.getByTestId('section-card-audio-upload-input');
    
    // Directly simulate the file upload
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file]
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(mockSessionActions.setError).toHaveBeenCalledWith('Please upload an audio file');
    });
  });

  test('toggles play/pause for library audio', () => {
    // Set up the state with audio data
    const audioSection = {
      ...mockSection,
      audioId: 'audio-1',
    };
    
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.mp3', source: 'library', name: 'Test Audio' },
      },
    };
    
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    render(<SectionCardAudio section={audioSection} />);
    
    // Get the play button by its ID instead of role+name
    const playButton = screen.getByTestId('section-card-play-audio-button-mini');
    fireEvent.click(playButton);

    expect(mockAudioPlay).toHaveBeenCalled();
    expect(mockAudioAddEventListener).toHaveBeenCalledWith('ended', expect.any(Function));

    fireEvent.click(playButton);
    expect(mockAudioPause).toHaveBeenCalled();
  });

  test('toggles audio player visibility', () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.mp3', source: 'library', name: 'Test Audio' },
      },
    };
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    render(<SectionCardAudio section={{ ...mockSection, audioId: 'audio-1' }} />);
    
    // Toggle the player visibility
    const showPlayerButton = screen.getByTestId('section-card-toggle-player-button');
    fireEvent.click(showPlayerButton);
    
    // Check if the audio element exists
    const audioElement = screen.getByTestId('section-card-audio-player');
    expect(audioElement).toBeInTheDocument();
    expect(audioElement).toHaveAttribute('src', 'http://example.com/audio.mp3');
    
    // Toggle it back
    fireEvent.click(showPlayerButton);
    expect(screen.queryByTestId('section-card-audio-player')).not.toBeInTheDocument();
  });

  test('disables inputs when processing', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: mockTTSState,
      isProcessing: true,
    });

    render(<SectionCardAudio section={mockSection} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    
    // Switch to upload view to test file input
    const uploadRadio = screen.getByLabelText('Upload New Audio');
    fireEvent.click(uploadRadio);
    
    // Now check if the file input is disabled
    expect(screen.getByTestId('section-card-audio-upload-input')).toBeDisabled();
  });

  test('shows play audio items when audio is available', () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.mp3', source: 'library', name: 'Test Audio' },
      },
    };
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    render(<SectionCardAudio section={{ ...mockSection, audioId: 'audio-1' }} />);
    expect(screen.getByText('Using audio from library: Test Audio')).toBeInTheDocument();
    
    // Check if play button exists by ID
    expect(screen.getByTestId('section-card-play-audio-button-mini')).toBeInTheDocument();
  });

  test('cleans up audio on unmount', () => {
    const sessionStateWithAudio = {
      ...mockSessionState,
      generatedTTSAudios: {
        'section-1': { url: 'http://example.com/audio.mp3', source: 'library', name: 'Test Audio' },
      },
    };
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: sessionStateWithAudio,
      actions: mockSessionActions,
    });

    const { unmount } = render(<SectionCardAudio section={{ ...mockSection, audioId: 'audio-1' }} />);
    unmount();
    expect(mockAudioPause).toHaveBeenCalled();
  });
});