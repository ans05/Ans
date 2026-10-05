import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Canvas text does not trigger web-font loading on its own, so request the
// bundled faces up front. Rendering proceeds with fallbacks until they land.
if ('fonts' in document) {
  void Promise.allSettled([
    document.fonts.load('400 32px "Archivo Black"'),
    document.fonts.load('400 16px "Space Mono"'),
    document.fonts.load('700 16px "Space Mono"'),
    document.fonts.load('italic 400 32px "Instrument Serif"'),
  ]);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
