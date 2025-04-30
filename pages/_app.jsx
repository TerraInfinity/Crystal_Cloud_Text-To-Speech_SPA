import '../styles/globals.css';
import '../styles/themes.css'; // Add this line

import { TTSProvider } from '../context/TTSContext';

function MyApp({ Component, pageProps }) {
  return (
    <TTSProvider>
      <Component {...pageProps} />
    </TTSProvider>
  );
}

export default MyApp;
