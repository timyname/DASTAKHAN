/**
 * Dev-only level editor entry (prompt 06): http://localhost:5173/editor.html on the Vite
 * dev server. editor.html is not a production build input, and this entry refuses to
 * render outside development as a second guard.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorApp } from './EditorApp.tsx';
import './editor.css';

const root = document.getElementById('root')!;

if (import.meta.env.DEV) {
  createRoot(root).render(
    <StrictMode>
      <EditorApp />
    </StrictMode>,
  );
} else {
  root.textContent = 'The DASTAKHAN level editor is available only on the development server.';
}
