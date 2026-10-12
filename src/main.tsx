import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cleanupMediaDemoData } from './utils/mediaDemoCleanup'

// До первого рендера: убрать старые демо-данные «Медиа» из localStorage (один раз)
cleanupMediaDemoData()

// Force clear stale Service Workers so the latest build always loads
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().then(() => {
        console.log('[SW] Unregistered stale service worker');
      });
    }
  });
  // Also clear caches
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
