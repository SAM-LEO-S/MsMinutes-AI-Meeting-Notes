import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';

import './index.css';

// Configure API base URL for development and production
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
setBaseUrl(apiBaseUrl);

if (import.meta.env.DEV) {
  console.log('API Base URL set to:', apiBaseUrl);
}

// Service worker disabled for development
// if (import.meta.env.PROD && 'serviceWorker' in navigator) {
//   const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
//   void navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined);
// }

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
