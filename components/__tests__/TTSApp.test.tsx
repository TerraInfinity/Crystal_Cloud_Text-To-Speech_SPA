import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TTSApp } from '../TTSApp';
import { useTTSContext } from '../../context/TTSContext';
import { useTTSSessionContext  } from '../../context/TTSSessionContext';
import TextInput from '../TextInput';
import TemplateSelector from '../TemplateSelector';
import SectionsList from '../SectionsList';
import ToolsTab from '../ToolsTab';
import SettingsTab from '../SettingsTab';
import AudioLibrary from '../AudioLibrary';
import TemplatesTab from '../TemplatesTab';
import AudioPlayer from '../AudioPlayer';
import FileHistory from '../FileHistory';

// Mock context hooks
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');

// Mock sub-components
jest.mock('../TextInput', () => () => <div id="text-input" data-testid="text-input">TextInput</div>);
jest.mock('../TemplateSelector', () => () => <div id="template-selector" data-testid="template-selector">TemplateSelector</div>);
jest.mock('../SectionsList', () => () => <div id="sections-list" data-testid="sections-list">SectionsList</div>);
jest.mock('../ToolsTab', () => () => <div id="tools-tab" data-testid="tools-tab">ToolsTab</div>);
jest.mock('../SettingsTab', () => () => <div id="settings-tab" data-testid="settings-tab">SettingsTab</div>);
jest.mock('../AudioLibrary', () => () => <div id="audio-library" data-testid="audio-library">AudioLibrary</div>);
jest.mock('../TemplatesTab', () => () => <div id="templates-tab" data-testid="templates-tab">TemplatesTab</div>);
jest.mock('../AudioPlayer', () => () => <div id="audio-player" data-testid="audio-player">AudioPlayer</div>);
jest.mock('../FileHistory', () => ({ fileHistory, actions }) => (
  <div id="file-history" data-testid="file-history">FileHistory</div>
));

describe('TTSApp', () => {
  const mockTTSState = {
    fileHistory: ['file1', 'file2'],
  };

  const mockTTSActions = {
    // Add actions if needed
  };

  const mockSessionState = {
    activeTab: 'main',
    notification: null,
    errorMessage: null,
    isProcessing: false,
  };

  const mockSessionActions = {
    setInputText: jest.fn(),
    setTemplate: jest.fn(),
    setActiveTab: jest.fn(),
    setNotification: jest.fn(),
    setError: jest.fn(),
    setProcessing: jest.fn(),
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
    // Mock global sessionActions for ToolsTab (due to ToolsTab.jsx bug)
    (global as any).sessionActions = mockSessionActions;
  });

  afterEach(() => {
    // Clean up global mock
    delete (global as any).sessionActions;
  });

  test('renders TTSApp with default props', () => {
    render(<TTSApp />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('File History')).toBeInTheDocument();
    expect(screen.getByText('Audio Files')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('template-selector')).toBeInTheDocument();
    expect(screen.getByTestId('text-input')).toBeInTheDocument();
    expect(screen.getByTestId('sections-list')).toBeInTheDocument();
    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
  });

  test('displays notification when present', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        notification: { type: 'success', message: 'Success message' },
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
  });

  test('closes notification when close button is clicked', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        notification: { type: 'success', message: 'Success message' },
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    const closeButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeButton);
    expect(mockSessionActions.setNotification).toHaveBeenCalledWith(null);
  });

  test('displays error message when present', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        errorMessage: 'Error occurred',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
  });

  test('closes error message when close button is clicked', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        errorMessage: 'Error occurred',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    const closeButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeButton);
    expect(mockSessionActions.setError).toHaveBeenCalledWith(null);
  });

  test('displays processing indicator when isProcessing is true', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        isProcessing: true,
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    const spinner = screen.getByTestId('processing-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  test('sets initial text and template on mount', () => {
    render(<TTSApp initialText="Hello" initialTemplate="custom" />);
    expect(mockSessionActions.setInputText).toHaveBeenCalledWith('Hello');
    expect(mockSessionActions.setTemplate).toHaveBeenCalledWith('custom');
  });

  test('switches tabs when tab buttons are clicked', () => {
    render(<TTSApp />);
    const templatesTab = screen.getByText('Templates');
    fireEvent.click(templatesTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('templates');

    const fileHistoryTab = screen.getByText('File History');
    fireEvent.click(fileHistoryTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('fileHistory');

    const audioTab = screen.getByText('Audio Files');
    fireEvent.click(audioTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('audio');

    const toolsTab = screen.getByText('Tools');
    fireEvent.click(toolsTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('tools');

    const settingsTab = screen.getByText('Settings');
    fireEvent.click(settingsTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('settings');
  });

  test('renders TemplatesTab when templates tab is active', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        activeTab: 'templates',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByTestId('templates-tab')).toBeInTheDocument();
  });

  test('renders FileHistory when fileHistory tab is active', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        activeTab: 'fileHistory',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByTestId('file-history')).toBeInTheDocument();
  });

  test('renders AudioLibrary when audio tab is active', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        activeTab: 'audio',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByTestId('audio-library')).toBeInTheDocument();
  });

  test('renders ToolsTab when tools tab is active', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        activeTab: 'tools',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByTestId('tools-tab')).toBeInTheDocument();
  });

  test('renders SettingsTab when settings tab is active', () => {
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        activeTab: 'settings',
      },
      actions: mockSessionActions,
    });

    render(<TTSApp />);
    expect(screen.getByTestId('settings-tab')).toBeInTheDocument();
  });

  test('applies active tab styling correctly', () => {
    render(<TTSApp />);
    const mainTab = screen.getByText('Main');
    expect(mainTab).toHaveClass('tab-active');

    const templatesTab = screen.getByText('Templates');
    expect(templatesTab).toHaveClass('tab-inactive');

    fireEvent.click(templatesTab);
    expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('templates');
  });
});