import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { readPublicListingSnapshot } from './lib/publicSeo.js'

import { normalizeProjectPath } from './lib/projectPaths.js'

// Preserve saved project-path URLs, including maintenance tokens and OAuth callbacks.
if (import.meta.env.BASE_URL === '/') {
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const canonicalPath = normalizeProjectPath(currentPath);
  if (canonicalPath !== currentPath) window.history.replaceState(null, '', canonicalPath);
}

const container = document.getElementById('root');
const initialListings = readPublicListingSnapshot(document);
const app = <StrictMode><App initialListings={initialListings} /></StrictMode>;
if (initialListings !== null && container.hasAttribute('data-prerendered-public')) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
