import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Desktop renderer root element was not found.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

