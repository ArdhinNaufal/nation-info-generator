import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Bundled fonts (SPEC §2 font selection). Each maps to a FONT_OPTIONS family.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/600.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/jetbrains-mono/400.css';

import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
