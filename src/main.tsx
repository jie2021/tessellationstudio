// main.tsx
// App bootstrap: mounts the `App` component into the DOM root.
// Keeps initialization intentionally minimal; all app logic lives in `App.tsx`.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
