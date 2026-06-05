import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept browser logs and errors
const originalLog = console.log;
const originalError = console.error;
const sendLog = (type: string, ...args: any[]) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  originalLog(`[Browser ${type}]`, msg);
  fetch('http://localhost:9999/log', {
    method: 'POST',
    mode: 'cors',
    body: JSON.stringify({ type, msg })
  }).catch(() => {});
};
console.log = (...args) => sendLog('log', ...args);
console.error = (...args) => sendLog('error', ...args);
window.onerror = (message, source, lineno, colno, error) => {
  sendLog('crash', { message, source, lineno, colno, stack: error?.stack });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
