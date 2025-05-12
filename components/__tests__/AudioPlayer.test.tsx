import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioPlayer from '../AudioPlayer';
import {useTTSContext} from '../../context/TTSContext';
import { useTTSSessionContext  } from '../../context/TTSSessionContext';
import { generateAllAudio, mergeAllAudio, downloadAudio } from '../../utils/AudioProcessor';

// Mock the context hooks
jest.mock('../../context/TTSContext', () => ({
  useTTSContext: jest.fn(),
}));
jest.mock('../../context/TTSSessionContext', () => ({
  useTTSSessionContext : jest.fn(),
}));

// Mock the utility functions
jest.mock('../../utils/AudioProcessor', () => ({
  generateAllAudio: jest.fn(),
  mergeAllAudio: jest.fn(),
  downloadAudio: jest.fn(),
}));

describe('AudioPlayer Component', () => {
  // Mock context values
  const mockTTS = {
    state: {
      settings: {
        speechEngine: 'googlecloud',
      },
    },
  };

  const mockTTSSession = {
    state: {
      sections: [
        { id: 'section-1', type: 'text-to-speech', text: 'Hello world' },
        { id: 'section-2', type: 'text-to-speech', text: 'Test audio' },
      ],
      generatedTTSAudios: {
        'section-1': { url: 'http://localhost/audio1.mp3' },
        'section-2': { url: 'http://localhost/audio2.mp3' },
      },
      mergedAudio: 'http://localhost/merged.mp3',
      isProcessing: false,
    },
    actions: {
      setNotification: jest.fn(),
    },
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue(mockTTS);
    (useTTSSessionContext  as jest.Mock).mockReturnValue(mockTTSSession);
    // Mock Audio constructor
    global.Audio = jest.fn().mockImplementation(() => ({
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      currentTime: 0,
      duration: 100,
      src: '',
    }));
  });

  test('renders AudioPlayer component', () => {
    render(<AudioPlayer />);
    expect(screen.getByText('Preview and Download')).toBeInTheDocument();
    expect(screen.getByText('Generate Audio')).toBeInTheDocument();
    expect(screen.getByText('Merge Audio')).toBeInTheDocument();
    expect(screen.getByText('Download Audio')).toBeInTheDocument();
    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  test('displays message when no valid sections exist', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      ...mockTTSSession,
      state: { ...mockTTSSession.state, sections: [], mergedAudio: null },
    });
    render(<AudioPlayer />);
    expect(
      screen.getByText('Create text-to-speech sections with text to generate audio')
    ).toBeInTheDocument();
  });

  test('displays message when audio is generated but not merged', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      ...mockTTSSession,
      state: { ...mockTTSSession.state, mergedAudio: null },
    });
    render(<AudioPlayer />);
    expect(
      screen.getByText('All sections have audio. Click "Merge Audio" to merge them.')
    ).toBeInTheDocument();
  });

  test('generates audio when Generate Audio button is clicked', async () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      ...mockTTSSession,
      state: {
        ...mockTTSSession.state,
        generatedTTSAudios: {},
        mergedAudio: null,
      },
    });
    (generateAllAudio as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AudioPlayer />);

    const generateButton = screen.getByText('Generate Audio');
    await user.click(generateButton);

    await waitFor(() => {
      expect(generateAllAudio).toHaveBeenCalledWith({
        validSections: mockTTSSession.state.sections,
        speechEngine: 'googlecloud',
        persistentState: mockTTS.state,
        sessionActions: mockTTSSession.actions,
        setIsGenerating: expect.any(Function),
        setIsAudioGenerated: expect.any(Function),
      });
    });
  });

  test('merges audio when Merge Audio button is clicked', async () => {
    (mergeAllAudio as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AudioPlayer />);

    const mergeButton = screen.getByText('Merge Audio');
    await user.click(mergeButton);

    await waitFor(() => {
      expect(mergeAllAudio).toHaveBeenCalledWith({
        validSections: mockTTSSession.state.sections,
        generatedAudios: mockTTSSession.state.generatedTTSAudios,
        sessionActions: mockTTSSession.actions,
        setIsMerging: expect.any(Function),
        setIsAudioMerged: expect.any(Function),
      });
    });
  });

  test('downloads audio when Download Audio button is clicked', async () => {
    (downloadAudio as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AudioPlayer />);

    const downloadButton = screen.getByText('Download Audio');
    await user.click(downloadButton);

    await waitFor(() => {
      expect(downloadAudio).toHaveBeenCalledWith({
        mergedAudio: 'http://localhost/merged.mp3',
        setIsDownloading: expect.any(Function),
        setIsAudioDownloaded: expect.any(Function),
      });
    });
  });

  test('plays and pauses audio when Play/Pause button is clicked', async () => {
    const user = userEvent.setup();
    render(<AudioPlayer />);

    const playButton = screen.getByText('Play');
    await user.click(playButton);

    await waitFor(() => {
      expect(global.Audio).toHaveBeenCalledWith('http://localhost/merged.mp3');
      const audioInstance = (global.Audio as jest.Mock).mock.results[0].value;
      expect(audioInstance.play).toHaveBeenCalled();
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Pause'));

    await waitFor(() => {
      const audioInstance = (global.Audio as jest.Mock).mock.results[0].value;
      expect(audioInstance.pause).toHaveBeenCalled();
      expect(screen.getByText('Play')).toBeInTheDocument();
    });
  });

  test('updates audio progress during playback', async () => {
    const user = userEvent.setup();
    const { container } = render(<AudioPlayer />);

    const playButton = screen.getByText('Play');
    await user.click(playButton);

    const audioInstance = (global.Audio as jest.Mock).mock.results[0].value;
    // Simulate timeupdate event
    await act(async () => {
      audioInstance.currentTime = 50;
      const timeupdateCallback = audioInstance.addEventListener.mock.calls.find(
        ([event]) => event === 'timeupdate'
      )[1];
      timeupdateCallback();
    });

    await waitFor(() => {
      const progressBar = container.querySelector('#audio-progress-bar');
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('width: 50%'));
    }, { timeout: 3000 });
  });

  test('resets state when audio ends', async () => {
    const user = userEvent.setup();
    const { container } = render(<AudioPlayer />);

    const playButton = screen.getByText('Play');
    await user.click(playButton);

    const audioInstance = (global.Audio as jest.Mock).mock.results[0].value;
    // Simulate ended event
    await act(async () => {
      const endedCallback = audioInstance.addEventListener.mock.calls.find(
        ([event]) => event === 'ended'
      )[1];
      endedCallback();
    });

    await waitFor(() => {
      expect(screen.getByText('Play')).toBeInTheDocument();
      const progressBar = container.querySelector('#audio-progress-bar');
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('width: 0%'));
    }, { timeout: 3000 });
  });

  test('cleans up audio element on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AudioPlayer />);

    // Simulate playing audio to create Audio instance
    const playButton = screen.getByText('Play');
    await user.click(playButton);

    await waitFor(() => {
      expect(global.Audio).toHaveBeenCalledWith('http://localhost/merged.mp3');
    });

    const audioInstance = (global.Audio as jest.Mock).mock.results[0].value;

    unmount();

    expect(audioInstance.pause).toHaveBeenCalled();
    expect(audioInstance.src).toBe('');
  });

  test('disables buttons when processing or conditions not met', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      ...mockTTSSession,
      state: {
        ...mockTTSSession.state,
        isProcessing: true,
        generatedTTSAudios: {},
        mergedAudio: null,
      },
    });
    render(<AudioPlayer />);

    expect(screen.getByText('Generate Audio')).toBeDisabled();
    expect(screen.getByText('Merge Audio')).toBeDisabled();
    expect(screen.getByText('Download Audio')).toBeDisabled();
  });
});