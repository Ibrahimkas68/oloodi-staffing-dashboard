import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Routing (/ manager, /worker) and the real views are added in Phase 2 (T039).
function App() {
  return <main className="p-6 font-sans">Shiftboard</main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
