// components/__tests__/FileHistory.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileHistory from '../FileHistory';
import { useTTS } from '../../context/TTSContext';

// Mock the useTTS context hook
jest.mock('../../context/TTSContext', () => ({
  useTTS: jest.fn(),
}));

// Mock sessionActions (since it is referenced but not defined in the component)
const mockSessionActions = {
  setActiveTab: jest.fn(),
};

describe('FileHistory Component', () => {
  // Mock context values
  const mockTTS = {
    state: {
      fileHistory: [
        {
          id: 'history-1',
          date: '2023-10-01T12:00:00Z',
          template: 'Default Template',
          audioUrl: 'http://localhost/audio/history-1.wav',
        },
        {
          id: 'history-2',
          date: '2023-10-02T12:00:00Z',
          template: 'Custom Template',
          audioUrl: null,
        },
      ],
    },
    actions: {
      loadHistoryEntry: jest.fn(),
      deleteHistoryEntry: jest.fn(),
    },
    isProcessing: false,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (useTTS as jest.Mock).mockReturnValue(mockTTS);
    // Mock sessionActions globally as it is used in handleLoadConfig
    (global as any).sessionActions = mockSessionActions;
  });

  afterEach(() => {
    // Clean up global mock
    delete (global as any).sessionActions;
  });

  test('renders FileHistory component with history entries', () => {
    render(<FileHistory />);
    expect(screen.getByText('File History')).toBeInTheDocument();
    expect(screen.getByText(new Date('2023-10-01T12:00:00Z').toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('Template: Default Template')).toBeInTheDocument();
    expect(screen.getByText('Template: Custom Template')).toBeInTheDocument();
    expect(screen.getAllByText('Load Configuration')).toHaveLength(2);
    expect(screen.getByText('Download Audio')).toBeInTheDocument();
    expect(screen.getAllByText('Delete')).toHaveLength(2);
  });

  test('displays no history message when fileHistory is empty', () => {
    (useTTS as jest.Mock).mockReturnValue({
      ...mockTTS,
      state: { fileHistory: [] },
    });
    render(<FileHistory />);
    expect(screen.getByText('No files generated yet')).toBeInTheDocument();
  });

  test('loads configuration when Load Configuration button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileHistory />);

    const loadButtons = screen.getAllByText('Load Configuration');
    await user.click(loadButtons[0]);

    await waitFor(() => {
      expect(mockTTS.actions.loadHistoryEntry).toHaveBeenCalledWith(mockTTS.state.fileHistory[0]);
      expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('main');
    });
  });

  test('deletes history entry when Delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileHistory />);

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockTTS.actions.deleteHistoryEntry).toHaveBeenCalledWith('history-1');
    });
  });

  test('renders audio player for entries with audioUrl', () => {
    render(<FileHistory />);
    const audioElements = screen.getAllByTestId(/audio-player/);
    expect(audioElements).toHaveLength(1);
    expect(audioElements[0].querySelector('source')).toHaveAttribute('src', 'http://localhost/audio/history-1.wav');
  });

  test('does not render audio player for entries without audioUrl', () => {
    render(<FileHistory />);
    const historyEntries = screen.getAllByText(/Template:/);
    // Second entry has no audioUrl
    const secondEntry = historyEntries[1].closest('div');
    expect(secondEntry.querySelector('audio')).toBeNull();
  });

  test('download link has correct attributes', () => {
    render(<FileHistory />);
    const downloadLink = screen.getByText('Download Audio');
    expect(downloadLink).toHaveAttribute('href', 'http://localhost/audio/history-1.wav');
    expect(downloadLink).toHaveAttribute('download', 'tts-history-1.wav');
  });

  test('disables buttons when isProcessing is true', () => {
    (useTTS as jest.Mock).mockReturnValue({
      ...mockTTS,
      isProcessing: true,
    });
    render(<FileHistory />);
    const loadButtons = screen.getAllByText('Load Configuration');
    const deleteButtons = screen.getAllByText('Delete');
    loadButtons.forEach((button) => expect(button).toBeDisabled());
    deleteButtons.forEach((button) => expect(button).toBeDisabled());
  });
});