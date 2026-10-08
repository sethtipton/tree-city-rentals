import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { normalizeProjectPath } from './lib/projectPaths.js'

// Preserve saved project-path URLs, including maintenance tokens and OAuth callbacks.
if (import.meta.env.BASE_URL === '/') {
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const canonicalPath = normalizeProjectPath(currentPath);
  if (canonicalPath !== currentPath) window.history.replaceState(null, '', canonicalPath);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
