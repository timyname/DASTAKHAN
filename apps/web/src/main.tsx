// Global styles first so component styles can build on (and override) them.
import './styles/theme.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformApp } from './platform/PlatformApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformApp />
  </StrictMode>,
);
