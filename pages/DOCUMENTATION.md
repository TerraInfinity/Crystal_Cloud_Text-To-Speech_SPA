# Crystal Cloud Text-To-Speech Pages Documentation

This document provides detailed information about the pages available in the Crystal Cloud Text-To-Speech SPA.

## Table of Contents

1. [Application Structure](#application-structure)
2. [Home Page](#home-page)
3. [Audio Library Page](#audio-library-page)
4. [API Routes](#api-routes)

---

## Application Structure

The application uses Next.js for server-side rendering and routing. The `_app.jsx` file serves as the application wrapper, providing application-wide context and styling.

### _app.jsx

**File:** `pages/_app.jsx`

This is the custom Next.js App component that wraps the entire application. It:

- Imports global styles (`globals.css` and `themes.css`)
- Wraps all pages with the `TTSProvider` to make TTS functionality available globally
- Passes page-specific props to each page component

```jsx
function MyApp({ Component, pageProps }) {
  return (
    <TTSProvider>
      <Component {...pageProps} />
    </TTSProvider>
  );
}
```

The TTSProvider is a context provider that manages the Text-to-Speech state and functionality across the application.

---

## Home Page

**File:** `pages/index.jsx`

The Home page is the main landing page of the application, providing access to the core Text-to-Speech functionality.

### Features

- Text-to-Speech conversion interface (via `TTSApp` component)
- Theme toggling capability (light/dark mode)
- Navigation to Audio Library page
- Responsive design with Tailwind CSS

### Layout Structure

- **Header**: Contains the application title and navigation controls
- **Main Content**: Houses the `TTSApp` component which manages text input, voice selection, and playback
- **Footer**: Displays copyright information

### Key Components

- `TTSApp`: Core component handling text processing and TTS functionality
- `ThemeToggle`: Component for switching between light and dark themes
- `Link` to Audio Library page

### Screenshot
*(Screenshot would be placed here)*

---

## Audio Library Page

**File:** `pages/audio.jsx`

The Audio Library page allows users to manage audio files for use in the TTS application.

### Features

- Audio file upload and management
- Organization of audio files for use in TTS sections
- Navigation back to the main application

### Layout Structure

- **Header**: Contains navigation, page title, and description
- **Main Content**: Houses the `AudioLibrary` component that manages audio files
- **Footer**: Displays copyright information

### Key Components

- `AudioLibrary`: Core component handling audio file management
- Navigation link back to the main page

### Screenshot
*(Screenshot would be placed here)*

---

## API Routes

The application includes several API routes for handling various Text-to-Speech related operations. These are documented in detail in the [API Documentation](./api/DOCUMENTATION.md).

### Available API Routes

- `/api/aiTransform`: Transforms text using AI services (OpenAI, Anthropic)
- `/api/awsPolly`: Converts text to speech using AWS Polly
- `/api/mergeAudio`: Merges multiple audio files into a single file
- `/api/extractTextFromUrl`: Extracts text content from a provided URL

---

## Page Loading and Navigation

The application uses Next.js's built-in routing system:

- `Link` components are used for client-side navigation between pages
- Pages are automatically code-split by Next.js for optimized loading
- The application maintains state between page navigations via the TTSProvider context

---

## Styling

The application uses a combination of:

- Tailwind CSS for utility-based styling
- Custom CSS variables for theming (light/dark mode)
- Component-specific styles where needed

Theme variables are defined in `styles/themes.css` and applied via CSS variables, allowing for dynamic theme switching without page reloads.

---

## Development Guidelines

When adding new pages to the application:

1. Create a new file in the `pages` directory (this automatically becomes a route in Next.js)
2. Wrap page content with appropriate layout elements for consistency
3. Include the necessary imports for components and hooks
4. Add JSDoc comments to document the page's purpose and functionality
5. Update this documentation to reflect the new page

---

## Environment Configuration

The pages interact with API routes that may require environment variables. Ensure the appropriate environment variables are set as documented in the API Documentation. 