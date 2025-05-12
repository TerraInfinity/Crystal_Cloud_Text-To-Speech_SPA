import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioFilesTab from '../AudioFilesTab';
import {useTTSContext} from '../../context/TTSContext';
import { configure } from '@testing-library/react';

// Configure Testing Library to use 'id' as testIdAttribute
configure({ testIdAttribute: 'id' });

// Mock theuseTTSContextcontext hook
jest.mock('../../context/TTSContext', () => ({
  useTTSContext: jest.fn(),
}));

// Mock sessionActions
const sessionActions = {
  setError: jest.fn(),
  setProcessing: jest.fn(),
};

// Mock URL.createObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/test-audio');

describe('AudioFilesTab Component', () => {
  // Mock context values
  const mockTTS = {
    state: {
      savedAudios: {
        'audio-1': {
          id: 'audio-1',
          name: 'Test Audio',
          url: 'blob:http://localhost/test-audio',
          type: 'audio/mp3',
          size: 1024,
          date: '2023-10-01T00:00:00Z',
          placeholder: 'test_audio',
          volume: 1,
        },
      },
    },
    actions: {
      saveAudio: jest.fn(),
      updateAudio: jest.fn(),
      deleteAudio: jest.fn(),
    },
    isProcessing: false,
    sessionActions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue(mockTTS);
    global.URL.createObjectURL = mockCreateObjectURL;
    // Mock window.confirm
    Object.defineProperty(window, 'confirm', {
      value: jest.fn().mockImplementation(() => true),
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('renders AudioFilesTab component', () => {
    render(<AudioFilesTab />);
    expect(screen.getByText('Audio Files')).toBeInTheDocument();
    expect(screen.getByText('Upload New Audio')).toBeInTheDocument();
    expect(screen.getByText('Your Audio Files')).toBeInTheDocument();
    expect(screen.getByText('Test Audio')).toBeInTheDocument();
    expect(screen.getByText('Use as: [sound:test_audio]')).toBeInTheDocument();
  });

  test('handles audio upload', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const fileInput = screen.getByTestId('audio-file');
    const nameInput = screen.getByTestId('audio-name');
    const placeholderInput = screen.getByTestId('placeholder-text');
    const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });

    await user.type(nameInput, 'New Audio');
    await user.type(placeholderInput, 'new_audio');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(sessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
      expect(mockTTS.actions.saveAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: 'New Audio',
          url: 'blob:http://localhost/test-audio',
          type: 'audio/mp3',
          size: file.size,
          placeholder: 'new_audio',
          volume: 1,
        })
      );
      expect(sessionActions.setProcessing).toHaveBeenCalledWith(false);
    }, { timeout: 2000 });
  });

  test('displays error for invalid file type', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const fileInput = screen.getByTestId('audio-file');
    const file = new File(['text'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(sessionActions.setError).toHaveBeenCalledWith('Please upload an audio file');
    }, { timeout: 2000 });
  });

  test('plays audio when play button is clicked', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const playButton = screen.getByTitle('Play');
    await user.click(playButton);

    await waitFor(() => {
      const audioElement = screen.getByTestId('audio-player') as HTMLAudioElement;
      expect(audioElement.src).toContain('blob:http://localhost/test-audio');
      expect(screen.getByText('Now Playing: Test Audio')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('deletes an audio file', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const deleteButton = screen.getByTitle('Delete');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this audio?');
      expect(mockTTS.actions.deleteAudio).toHaveBeenCalledWith('audio-1');
    }, { timeout: 2000 });
  });

  test('updates audio placeholder', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const placeholderInput = screen.getByTestId('placeholder-audio-1');
    fireEvent.change(placeholderInput, { target: { value: 'updated_audio' } });

    await waitFor(() => {
      expect(mockTTS.actions.updateAudio).toHaveBeenCalledWith(
        'audio-1',
        expect.objectContaining({
          placeholder: 'updated_audio',
        })
      );
    }, { timeout: 1000 });
  });

  test('updates audio volume', async () => {
    const user = userEvent.setup();
    render(<AudioFilesTab />);

    const volumeSlider = screen.getByTestId('volume-audio-1');
    fireEvent.change(volumeSlider, { target: { value: '0.5' } });

    await waitFor(() => {
      expect(mockTTS.actions.updateAudio).toHaveBeenCalledWith(
        'audio-1',
        expect.objectContaining({
          volume: 0.5,
        })
      );
    }, { timeout: 2000 });
  });

  test('handles audio player cleanup on unmount', async () => {
    const user = userEvent.setup();

    // Spy on HTMLMediaElement.prototype methods
    const addEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'removeEventListener');

    // Render the component
    const { unmount } = render(<AudioFilesTab />);

    // Simulate playing audio to render <audio>
    const playButton = screen.getByTitle('Play');
    await user.click(playButton);

    // Wait for the audio element to be rendered
    await waitFor(() => {
      const audioElement = screen.getByTestId('audio-player') as HTMLAudioElement;
      expect(audioElement.src).toContain('blob:http://localhost/test-audio');
      expect(screen.getByText('Now Playing: Test Audio')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Unmount the component
    unmount();

    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('ended', expect.any(Function));
    }, { timeout: 2000 });
  });

  test('displays no audio message when savedAudios is empty', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      ...mockTTS,
      state: { savedAudios: {} },
    });
    render(<AudioFilesTab />);
    expect(screen.getByText('No audio files in your library yet.')).toBeInTheDocument();
  });
});