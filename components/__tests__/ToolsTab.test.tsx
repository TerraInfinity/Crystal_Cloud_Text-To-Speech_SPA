import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ToolsTab from '../ToolsTab.jsx';
import {useTTSContext} from '../../context/TTSContext';
import { useTTSSessionContext  } from '../../context/TTSSessionContext';
import { parseTextFromHtml } from '../../utils/textUtils';

// Mock context hooks and utility
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');
jest.mock('../../utils/textUtils', () => ({
  parseTextFromHtml: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn() as jest.Mock;

describe('ToolsTab', () => {
  const mockTTSState = {
    // Add state if needed
  };

  const mockTTSActions = {
    // Add actions if needed
  };

  const mockSessionState = {
    // Add session state if needed
  };

  const mockSessionActions = {
    setError: jest.fn(),
    setNotification: jest.fn(),
    setProcessing: jest.fn(),
    setInputText: jest.fn(),
    setActiveTab: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue({
      state: mockTTSState,
      actions: mockTTSActions,
      isProcessing: false,
    });
    (useTTSSessionContext  as jest.Mock).mockReturnValue({
      state: mockSessionState,
      actions: mockSessionActions,
    });
    (parseTextFromHtml as jest.Mock).mockReturnValue('Parsed HTML text');
    (global.fetch as jest.Mock).mockReset();
  });

  test('renders HTML/URL parsing and AI transformation sections', () => {
    render(<ToolsTab />);
    expect(screen.getByText('HTML/URL Parsing')).toBeInTheDocument();
    expect(screen.getByText('AI Transformation')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /enter a url or paste html/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /text to process/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extract Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process with AI' })).toBeInTheDocument();
  });

  test('parses HTML input', async () => {
    render(<ToolsTab />);
    const htmlInput = screen.getByRole('textbox', { name: /enter a url or paste html/i });
    fireEvent.change(htmlInput, { target: { value: '<p>Hello</p>' } });

    const extractButton = screen.getByRole('button', { name: 'Extract Text' });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(parseTextFromHtml).toHaveBeenCalledWith('<p>Hello</p>');
      expect(screen.getByRole('textbox', { name: /extracted text/i })).toHaveValue('Parsed HTML text');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Text extracted successfully',
      });
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('parses URL input', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'URL extracted text' }),
    });

    render(<ToolsTab />);
    const htmlInput = screen.getByRole('textbox', { name: /enter a url or paste html/i });
    fireEvent.change(htmlInput, { target: { value: 'https://example.com' } });

    const extractButton = screen.getByRole('button', { name: 'Extract Text' });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/extractTextFromUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      expect(screen.getByRole('textbox', { name: /extracted text/i })).toHaveValue('URL extracted text');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Text extracted successfully',
      });
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('handles empty HTML/URL input', () => {
    // Mock implementation to directly call the validation
    jest.spyOn(mockSessionActions, 'setError');
    
    render(<ToolsTab />);
    // Call the parseHtmlOrUrl function directly by clicking the button
    const extractButton = screen.getByRole('button', { name: 'Extract Text' });
    
    // The button should be disabled initially
    expect(extractButton).toBeDisabled();
    
    // Verify error was not set since button is disabled
    expect(mockSessionActions.setError).not.toHaveBeenCalled();
    expect(mockSessionActions.setProcessing).not.toHaveBeenCalled();
  });

  test('handles URL parsing error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Invalid URL' }),
    });

    render(<ToolsTab />);
    const htmlInput = screen.getByRole('textbox', { name: /enter a url or paste html/i });
    fireEvent.change(htmlInput, { target: { value: 'https://invalid.com' } });

    const extractButton = screen.getByRole('button', { name: 'Extract Text' });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(mockSessionActions.setError).toHaveBeenCalledWith('Error parsing content: Invalid URL');
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('applies parsed result to main input', async () => {
    render(<ToolsTab />);
    const htmlInput = screen.getByRole('textbox', { name: /enter a url or paste html/i });
    fireEvent.change(htmlInput, { target: { value: '<p>Hello</p>' } });

    const extractButton = screen.getByRole('button', { name: 'Extract Text' });
    fireEvent.click(extractButton);

    await waitFor(() => {
      const applyButton = screen.getByRole('button', { name: 'Use This Text' });
      fireEvent.click(applyButton);

      expect(mockSessionActions.setInputText).toHaveBeenCalledWith('Parsed HTML text');
      expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('main');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Text applied to input area',
      });
    });
  });

  test('selects preset prompt', () => {
    render(<ToolsTab />);
    const presetSelect = screen.getByRole('combobox', { name: /preset prompts/i });
    fireEvent.change(presetSelect, { target: { value: 'simplify' } });

    const promptTextarea = screen.getByRole('textbox', { name: /prompt/i });
    expect(promptTextarea).toHaveValue(
      'Simplify the following text to make it easier to understand while preserving all important information and instructions.'
    );
  });

  test('processes text with AI', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'AI processed text' }),
    });

    render(<ToolsTab />);
    const textInput = screen.getByRole('textbox', { name: /text to process/i });
    fireEvent.change(textInput, { target: { value: 'Sample text' } });

    const promptInput = screen.getByRole('textbox', { name: /prompt/i });
    fireEvent.change(promptInput, { target: { value: 'Simplify this text' } });

    const processButton = screen.getByRole('button', { name: 'Process with AI' });
    fireEvent.click(processButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/aiTransform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Sample text',
          prompt: 'Simplify this text',
          provider: 'openai',
        }),
      });
      expect(screen.getByRole('textbox', { name: /ai result/i })).toHaveValue('AI processed text');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'AI processing completed',
      });
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('handles empty AI input', () => {
    // Mock implementation to directly call the validation
    jest.spyOn(mockSessionActions, 'setError');
    
    render(<ToolsTab />);
    const processButton = screen.getByRole('button', { name: 'Process with AI' });
    
    // Button should be disabled when input is empty
    expect(processButton).toBeDisabled();
    
    // Verify that the error was not called because button is disabled
    expect(mockSessionActions.setError).not.toHaveBeenCalled();
    expect(mockSessionActions.setProcessing).not.toHaveBeenCalled();
  });

  test('handles empty AI prompt', () => {
    // Mock implementation to directly call the validation
    jest.spyOn(mockSessionActions, 'setError');
    
    render(<ToolsTab />);
    const textInput = screen.getByRole('textbox', { name: /text to process/i });
    fireEvent.change(textInput, { target: { value: 'Sample text' } });

    const processButton = screen.getByRole('button', { name: 'Process with AI' });
    
    // Button should be disabled when prompt is empty
    expect(processButton).toBeDisabled();
    
    // Verify that the error was not called because button is disabled
    expect(mockSessionActions.setError).not.toHaveBeenCalled();
    expect(mockSessionActions.setProcessing).not.toHaveBeenCalled();
  });

  test('handles AI processing error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'AI error' }),
    });

    render(<ToolsTab />);
    const textInput = screen.getByRole('textbox', { name: /text to process/i });
    fireEvent.change(textInput, { target: { value: 'Sample text' } });

    const promptInput = screen.getByRole('textbox', { name: /prompt/i });
    fireEvent.change(promptInput, { target: { value: 'Simplify this text' } });

    const processButton = screen.getByRole('button', { name: 'Process with AI' });
    fireEvent.click(processButton);

    await waitFor(() => {
      expect(mockSessionActions.setError).toHaveBeenCalledWith('Error processing with AI: AI error');
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(true);
      expect(mockSessionActions.setProcessing).toHaveBeenCalledWith(false);
    });
  });

  test('applies AI result to main input', async () => {
    // Mock the AI processing API
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'AI processed text' }),
    });

    // Render component
    const { container } = render(<ToolsTab />);
    
    // Enter text input
    const textInput = screen.getByRole('textbox', { name: /text to process/i });
    fireEvent.change(textInput, { target: { value: 'Sample text' } });

    // Enter prompt
    const promptInput = screen.getByRole('textbox', { name: /prompt/i });
    fireEvent.change(promptInput, { target: { value: 'Simplify this text' } });

    // Process with AI
    const processButton = screen.getByRole('button', { name: 'Process with AI' });
    fireEvent.click(processButton);

    // Check that "Use This Text" button works
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /ai result/i })).toHaveValue('AI processed text');
      
      // Find the use button directly by its ID
      const useButton = container.querySelector('#use-ai-result-btn');
      expect(useButton).toBeInTheDocument();
      
      // Fire click event directly on the button
      if (useButton) {
        fireEvent.click(useButton);
      }
      
      // Verify the actions were called
      expect(mockSessionActions.setInputText).toHaveBeenCalledWith('AI processed text');
      expect(mockSessionActions.setActiveTab).toHaveBeenCalledWith('main');
      expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'AI processed text applied to input area',
      });
    });
  });

  test('selects AI provider', () => {
    render(<ToolsTab />);
    const providerSelect = screen.getByRole('combobox', { name: /ai provider/i });
    fireEvent.change(providerSelect, { target: { value: 'anthropic' } });

    expect(providerSelect).toHaveValue('anthropic');
  });
});