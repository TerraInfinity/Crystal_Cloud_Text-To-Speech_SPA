import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SectionsList from '../SectionsList';
import {useTTSContext} from '../../context/TTSContext';
import { useTTSSessionContext  } from '../../context/TTSSessionContext';
import SectionCard from '../SectionCard';
import { devLog } from '../../utils/logUtils';

// Mock context hooks, components, and utilities
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');
jest.mock('../SectionCard');
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

describe('SectionsList', () => {
  const mockTTSState = {
    settings: {},
  };

  const mockTTSActions = {
    // Add TTS actions if needed
  };

  const mockSessionState = {
    sections: [
      {
        id: 'section-1',
        title: 'Section 1',
        type: 'text-to-speech',
        text: 'Sample text',
        voice: { engine: 'gtts', id: 'en-US-Standard-A', name: 'English (US) Standard A', language: 'en-US' },
        voiceSettings: { volume: 1, rate: 1, pitch: 1 },
      },
      {
        id: 'section-2',
        title: 'Section 2',
        type: 'audio-only',
      },
    ],
  };

  const mockSessionActions = {
    addSection: jest.fn(),
    reorderSections: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue({
      state: mockTTSState,
      actions: mockTTSActions,
    });
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: mockSessionState,
      actions: mockSessionActions,
    });
    (SectionCard as jest.Mock).mockImplementation(({ section, index, moveUp, moveDown }) => (
      <div id={`section-card-${section.id}`} data-testid={`section-card-${section.id}`}>
        {section.title}
        <button id={`move-up-${section.id}`} data-testid={`move-up-${section.id}`} onClick={moveUp}>Move Up</button>
        <button id={`move-down-${section.id}`} data-testid={`move-down-${section.id}`} onClick={moveDown}>Move Down</button>
      </div>
    ));
  });

  test('renders empty state with create button when no sections exist', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: { sections: [] },
      actions: mockSessionActions,
    });

    render(<SectionsList />);
    expect(screen.getByText('No sections created yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create New Section' })).toBeInTheDocument();
    expect(screen.queryByTestId('section-card-section-1')).not.toBeInTheDocument();
  });

  test('creates a new section', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: { sections: [] },
      actions: mockSessionActions,
    });

    render(<SectionsList />);
    const createButton = screen.getByRole('button', { name: 'Create New Section' });
    fireEvent.click(createButton);

    expect(mockSessionActions.addSection).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^section-\d+$/),
      title: 'Section 1',
      type: 'text-to-speech',
      text: '',
      voice: expect.objectContaining({ id: 'en-US-Standard-A' }),
      voiceSettings: { volume: 1, rate: 1, pitch: 1 },
    }));
    expect(devLog).toHaveBeenCalledWith('Creating new section:', expect.any(Object));
  });

  test('renders list of sections', () => {
    render(<SectionsList />);
    expect(screen.getByTestId('section-card-section-1')).toBeInTheDocument();
    expect(screen.getByTestId('section-card-section-2')).toBeInTheDocument();
  });

  test('moves section up', () => {
    render(<SectionsList />);
    const moveUpButton = screen.getByTestId('move-up-section-2');
    fireEvent.click(moveUpButton);

    expect(mockSessionActions.reorderSections).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'section-2' }),
      expect.objectContaining({ id: 'section-1' }),
    ]);
  });

  test('does not move first section up', () => {
    render(<SectionsList />);
    const moveUpButton = screen.getByTestId('move-up-section-1');
    fireEvent.click(moveUpButton);

    expect(mockSessionActions.reorderSections).not.toHaveBeenCalled();
  });

  test('moves section down', () => {
    render(<SectionsList />);
    const moveDownButton = screen.getByTestId('move-down-section-1');
    fireEvent.click(moveDownButton);

    expect(mockSessionActions.reorderSections).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'section-2' }),
      expect.objectContaining({ id: 'section-1' }),
    ]);
  });

  test('does not move last section down', () => {
    render(<SectionsList />);
    const moveDownButton = screen.getByTestId('move-down-section-2');
    fireEvent.click(moveDownButton);

    expect(mockSessionActions.reorderSections).not.toHaveBeenCalled();
  });
});