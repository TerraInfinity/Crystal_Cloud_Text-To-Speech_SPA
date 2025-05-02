import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioLibrary from '../AudioLibrary';
import { useTTS } from '../../context/TTSContext';
import { useTTSSession } from '../../context/TTSSessionContext';
import { configure } from '@testing-library/react';

// Configure Testing Library to use 'id' as testIdAttribute
configure({ testIdAttribute: 'id' });

// Mock the context hooks
jest.mock('../../context/TTSContext', () => ({
  useTTS: jest.fn(),
}));
jest.mock('../../context/TTSSessionContext', () => ({
  useTTSSession: jest.fn(),
}));

// Mock URL.createObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/test-audio');

describe('AudioLibrary Component', () => {
  // Mock context values
  const mockTTS = {
    state: {
      AudioLibrary: {
        'audio-1': {
          id: 'audio-1',
          name: 'Test Audio',
          type: 'audio/mp3',
          size: 1024,
          source: { type: 'remote', metadata: {} },
          date: '2023-10-01T00:00:00Z',
          placeholder: 'test_audio',
          volume: 1,
          url: 'http://localhost:5000/audio/test.mp3',
          category: 'sound_effect',
        },
      },
    },
    actions: {
      listFromStorage: jest.fn().mockResolvedValue([
        {
          id: 'audio-1',
          name: 'Test Audio',
          type: 'audio/mp3',
          size: 1024,
          source: { type: 'remote', metadata: {} },
          date: '2023-10-01T00:00:00Z',
          placeholder: 'test_audio',
          volume: 1,
          url: '/audio/test.mp3',
        },
      ]),
      loadAudioLibrary: jest.fn(),
      uploadAudio: jest.fn().mockResolvedValue(undefined),
      updateAudio: jest.fn().mockResolvedValue(undefined),
      deleteAudioFromStorage: jest.fn().mockResolvedValue(undefined),
      deleteAudio: jest.fn(),
    },
  };

  const mockTTSSession = {
    state: { notification: null },
    actions: {
      setNotification: jest.fn(),
      setProcessing: jest.fn(),
    },
    isProcessing: false,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (useTTS as jest.Mock).mockReturnValue(mockTTS);
    (useTTSSession as jest.Mock).mockReturnValue(mockTTSSession);
    global.URL.createObjectURL = mockCreateObjectURL;

    // Mock window.confirm
    Object.defineProperty(window, 'confirm', {
      value: jest.fn().mockImplementation(() => true),
      writable: true,
    });

    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: { pathname: '/audio' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('renders AudioLibrary component', async () => {
    render(<AudioLibrary />);
    await waitFor(() => {
      expect(screen.getByText('Sound Effects Library')).toBeInTheDocument();
      expect(screen.getByText('Upload New Sound Effect')).toBeInTheDocument();
      expect(screen.getByText('Your Sound Effects')).toBeInTheDocument();
      expect(screen.getByText('Test Audio')).toBeInTheDocument();
      expect(screen.getByText('[test_audio]')).toBeInTheDocument();
    });
  });

  test('handles audio upload', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    // Show settings to access inputs
    const settingsButton = screen.getByText('Show Settings');
    await user.click(settingsButton);

    const fileInput = screen.getByTestId('audio-upload-input');
    const nameInput = screen.getByTestId('audio-name-input');
    const placeholderInput = screen.getByTestId('audio-placeholder-input');
    const file = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });

    // Set inputs
    await user.type(nameInput, 'New Audio');
    await user.type(placeholderInput, 'new_audio');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockTTSSession.actions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockTTS.actions.uploadAudio).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          id: expect.any(String),
          name: 'New Audio',
          type: 'audio/mp3',
          size: file.size,
          placeholder: 'new_audio',
          volume: 1,
          category: 'sound_effect',
        })
      );
      expect(mockTTSSession.actions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('displays error for invalid file type', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    const fileInput = screen.getByTestId('audio-upload-input');
    const file = new File(['text'], 'test.txt', { type: 'text/plain' });

    // Simulate file upload
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockTTSSession.actions.setNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Please upload an audio file',
      });
    }, { timeout: 1000 });
  });

  test('plays audio when play button is clicked', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    const playButton = screen.getByTestId('play-audio-btn-audio-1');
    await user.click(playButton);

    await waitFor(() => {
      const audioElement = screen.getByTestId('now-playing-audio') as HTMLAudioElement;
      expect(audioElement.src).toContain('http://localhost:5000/audio/test.mp3');
      expect(screen.getByText('Now Playing: Test Audio')).toBeInTheDocument();
    });
  });

  test('deletes an audio file', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    const deleteButton = screen.getByTestId('delete-audio-btn-audio-1');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this sound effect?');
      expect(mockTTS.actions.deleteAudioFromStorage).toHaveBeenCalledWith('audio-1', 'test.mp3');
      expect(mockTTSSession.actions.setNotification).toHaveBeenCalledWith({
        type: 'info',
        message: 'Sound effect deleted successfully.',
      });
    });
  });

  test('updates audio placeholder', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    const editButton = screen.getByTestId('edit-audio-btn-audio-1');
    await user.click(editButton);

    const placeholderInput = screen.getByTestId('edit-placeholder-input-audio-1');
    await user.clear(placeholderInput);
    await user.type(placeholderInput, 'updated_audio');

    const saveButton = screen.getByTestId('save-edit-btn-audio-1');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockTTS.actions.updateAudio).toHaveBeenCalledWith(
        'audio-1',
        expect.objectContaining({
          placeholder: 'updated_audio',
        })
      );
      expect(mockTTSSession.actions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Sound effect updated successfully.',
      });
    });
  });

  test('updates audio volume', async () => {
    const user = userEvent.setup();
    render(<AudioLibrary />);

    const volumeSlider = screen.getByTestId('audio-volume-range-audio-1');
    fireEvent.change(volumeSlider, { target: { value: '0.5' } });

    await waitFor(() => {
      expect(mockTTS.actions.updateAudio).toHaveBeenCalledWith(
        'audio-1',
        expect.objectContaining({
          volume: 0.5,
        })
      );
    });
  });

  test('handles audio player cleanup on unmount', async () => {
    const user = userEvent.setup();

    // Mock audio element
    const mockAudio = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      src: '',
      volume: 1,
    };

    // Mock useRef for audioPlayerRef (second useRef call)
    let useRefCallCount = 0;
    jest.spyOn(React, 'useRef').mockImplementation(() => {
      useRefCallCount++;
      // First useRef is fileInputRef, second is audioPlayerRef
      return useRefCallCount === 2 ? { current: mockAudio } : { current: null };
    });

    // Render the component
    const { unmount } = render(<AudioLibrary />);

    // Simulate playing audio to set selectedAudio
    const playButton = screen.getByTestId('play-audio-btn-audio-1');
    await user.click(playButton);

    await waitFor(() => {
      expect(mockAudio.src).toContain('http://localhost:5000/audio/test.mp3');
      expect(screen.getByText('Now Playing: Test Audio')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Unmount the component
    unmount();

    await waitFor(() => {
      expect(mockAudio.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    }, { timeout: 2000 });
  });

  test('displays no audio message when savedAudios is empty', () => {
    (useTTS as jest.Mock).mockReturnValue({
      ...mockTTS,
      state: { AudioLibrary: {} },
    });
    render(<AudioLibrary />);
    expect(screen.getByText('No sound effects in your library yet.')).toBeInTheDocument();
  });
});