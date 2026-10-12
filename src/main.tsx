import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cleanupMediaDemoData } from './utils/mediaDemoCleanup'
import { startAppUpdateWatcher } from './utils/appUpdate'

// До первого рендера: убрать старые демо-данные «Медиа» из localStorage (один раз)
cleanupMediaDemoData()

// Если на сервере вышла новая сборка — сбросить кеш и перезагрузиться на неё.
// Раньше service worker удалялся при каждом запуске: это ломало офлайн-режим
// и всё равно показывало старую версию при первом открытии после обновления.
startAppUpdateWatcher()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
