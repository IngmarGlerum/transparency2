import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@rijkshuisstijl-community/font/dist/index.css';
import '@rijkshuisstijl-community/design-tokens/dist/index.css';
import '@rijkshuisstijl-community/components-css/dist/index.css';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
