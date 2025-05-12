import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../ThemeToggle';
import {useTTSContext} from '../../context/TTSContext';

// Mock context hook
jest.mock('../../context/TTSContext');

// Mock heroicons and react-icons
jest.mock('@heroicons/react/24/outline', () => ({
  SunIcon: (props) => <svg id="sun-icon" data-testid="sun-icon" {...props} />,
  MoonIcon: (props) => <svg id="moon-icon" data-testid="moon-icon" {...props} />,
  SparklesIcon: (props) => <svg id="sparkles-icon" data-testid="sparkles-icon" {...props} />,
  BoltIcon: (props) => <svg id="bolt-icon" data-testid="bolt-icon" {...props} />,
  StarIcon: (props) => <svg id="star-icon" data-testid="star-icon" {...props} />,
  HeartIcon: (props) => <svg id="heart-icon" data-testid="heart-icon" {...props} />,
  BeakerIcon: (props) => <svg id="beaker-icon" data-testid="beaker-icon" {...props} />,
  CubeTransparentIcon: (props) => <svg id="cube-transparent-icon" data-testid="cube-transparent-icon" {...props} />,
  RectangleGroupIcon: (props) => <svg id="rectangle-group-icon" data-testid="rectangle-group-icon" {...props} />,
  PuzzlePieceIcon: (props) => <svg id="puzzle-piece-icon" data-testid="puzzle-piece-icon" {...props} />,
  Square2StackIcon: (props) => <svg id="square-2-stack-icon" data-testid="square-2-stack-icon" {...props} />,
  RectangleStackIcon: (props) => <svg id="rectangle-stack-icon" data-testid="rectangle-stack-icon" {...props} />,
}));
jest.mock('react-icons/ti', () => ({
  TiTree: (props) => <svg id="ti-tree-icon" data-testid="ti-tree-icon" {...props} />,
}));

describe('ThemeToggle', () => {
  const mockTTSState = {
    theme: 'light',
  };

  const mockTTSActions = {
    setTheme: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTSContext as jest.Mock).mockReturnValue({
      state: mockTTSState,
      actions: mockTTSActions,
    });
  });

  test('renders theme toggle button with light theme icon', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    expect(button).toHaveAttribute('id', 'theme-toggle-button');
  });

  test('cycles to next theme on click', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(button);

    expect(mockTTSActions.setTheme).toHaveBeenCalledWith('dark');
  });

  test('renders correct icon for light theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'light' },
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('renders correct icon for dark theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'dark' },
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
  });

  test('renders correct icon for nature theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'nature' },
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    expect(screen.getByTestId('ti-tree-icon')).toBeInTheDocument();
  });

  test('renders correct icon for minimalist theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'minimalist' },
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    expect(screen.getByTestId('square-2-stack-icon')).toBeInTheDocument();
  });

  test('renders correct icon for cosmic theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'cosmic' },
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    expect(screen.getByTestId('star-icon')).toBeInTheDocument();
  });

  test('cycles through all themes', () => {
    // Start with light theme
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'light' },
      actions: mockTTSActions,
    });
    
    const { unmount } = render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Toggle theme' });
    
    // Click once - should go from light to dark
    fireEvent.click(button);
    expect(mockTTSActions.setTheme).toHaveBeenCalledWith('dark');
    
    // Unmount and clear mocks before testing the next transition
    unmount();
    mockTTSActions.setTheme.mockClear();
    
    // Test dark to minimalist transition
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'dark' },
      actions: mockTTSActions,
    });
    const { unmount: unmount2 } = render(<ThemeToggle />);
    const button2 = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(button2);
    expect(mockTTSActions.setTheme).toHaveBeenCalledWith('minimalist');
    
    // Unmount and clear mocks again
    unmount2();
    mockTTSActions.setTheme.mockClear();
    
    // Test cosmic (last theme) back to light (first theme)
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'cosmic' }, // Last theme
      actions: mockTTSActions,
    });
    render(<ThemeToggle />);
    const button3 = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(button3);
    expect(mockTTSActions.setTheme).toHaveBeenCalledWith('light'); // Should cycle back to first theme
  });

  test('falls back to SunIcon for undefined theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: undefined },
      actions: mockTTSActions,
    });

    render(<ThemeToggle />);
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });

  test('falls back to SunIcon for invalid theme', () => {
    (useTTSContext as jest.Mock).mockReturnValue({
      state: { theme: 'invalid-theme' },
      actions: mockTTSActions,
    });

    render(<ThemeToggle />);
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
  });
});