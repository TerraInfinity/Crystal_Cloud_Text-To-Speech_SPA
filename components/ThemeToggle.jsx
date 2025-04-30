import { useTTS } from '../context/TTSContext'; // Adjust path as needed
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

// Wrapper component to normalize TiTree attributes
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

export default function ThemeToggle() {
  const { state, actions } = useTTS();
  const { theme } = state;

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    actions.setTheme(themes[nextIndex]);
  };

  const Icon = themeIcons[theme] || SunIcon; // Fallback to SunIcon if theme is undefined

  return (
    <button
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