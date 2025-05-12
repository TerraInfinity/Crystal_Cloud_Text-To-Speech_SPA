/**
 * @fileoverview Theme Toggle component for the Text-to-Speech application.
 * Provides functionality to cycle through different UI themes.
 * 
 * @requires ../context/TTSContext
 * @requires @heroicons/react/24/outline
 * @requires react-icons/ti
 */

import {useTTSContext} from '../context/TTSContext'; // Adjust path as needed
import {
  SunIcon,
  MoonIcon,
  SparklesIcon,
  BoltIcon,
  StarIcon,
  HeartIcon,
  BeakerIcon,
  CubeTransparentIcon,
  RectangleGroupIcon,
  PuzzlePieceIcon,
  Square2StackIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { TiTree } from 'react-icons/ti';

/**
 * Wrapper component to normalize TiTree attributes.
 * Ensures consistent props and styling for the tree icon.
 * 
 * @component
 * @param {Object} props - Component props passed to TiTree
 * @returns {JSX.Element} The normalized TiTree icon
 */
function NormalizedTiTree(props) {
  return (
    <TiTree
      {...props}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      version="1.2"
      baseProfile="tiny"
      height="1em"
      width="1em"
      aria-hidden={undefined}
      data-slot={undefined}
      path="M20.781 17.375l-2.7-3.375h.919c.373 0 .715-.207.887-.538.172-.331.146-.729-.068-1.035..."
    />
  );
}

/**
 * Available themes for the application
 * @type {string[]}
 */
const themes = [
  'light',
  'dark',
  'minimalist',
  'retro',
  'cyberpunk',
  'nature',
  'artdeco',
  'pastel',
  'holographic',
  'steampunk',
  'glitch',
  'bauhaus',
  'neon',
  'cosmic',
];

/**
 * Mapping of theme names to their corresponding icons
 * @type {Object.<string, Function>}
 */
const themeIcons = {
  light: SunIcon,
  dark: MoonIcon,
  minimalist: Square2StackIcon,
  retro: SparklesIcon,
  cyberpunk: BoltIcon,
  nature: NormalizedTiTree,
  artdeco: RectangleGroupIcon,
  pastel: HeartIcon,
  holographic: CubeTransparentIcon,
  steampunk: BeakerIcon,
  glitch: PuzzlePieceIcon,
  bauhaus: RectangleStackIcon,
  neon: BoltIcon,
  cosmic: StarIcon,
};

/**
 * ThemeToggle component for changing the application's visual theme.
 * Provides a button that cycles through available themes when clicked.
 * 
 * @component
 * @returns {JSX.Element} The rendered ThemeToggle button
 */
export default function ThemeToggle() {
  const { state, actions } = useTTSContext();
  const { theme } = state;

  /**
   * Cycles to the next theme in the themes array.
   * Updates the theme in the TTS context.
   */
  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    actions.setTheme(themes[nextIndex]);
  };

  // Get the icon component for the current theme, fallback to SunIcon if undefined
  const Icon = themeIcons[theme] || SunIcon;

  return (
    <button
      id="theme-toggle-button"
      onClick={cycleTheme}
      className="p-2 rounded-md hover:opacity-80 transition-colors flex items-center justify-center"
      style={{
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-color)',
        border: '1px solid var(--card-border)',
      }}
      aria-label="Toggle theme"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}