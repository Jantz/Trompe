import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'trompe'; // defines every tr-* element
import '../../shared/example.css';
import { App } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
