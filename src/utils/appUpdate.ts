// Автообновление приложения после деплоя.
// Service worker отдаёт index.html из кеша, поэтому без этой проверки первое открытие
// после обновления показывало старую версию. Здесь мы спрашиваем у сервера свежий
// index.html (мимо кеша) и, если имя сборки изменилось, сбрасываем кеш и перезагружаемся.
// Данные пользователя (localStorage) при этом не трогаются; таймер переживает перезагрузку.

const RELOAD_GUARD_KEY = 'questflow_update_reloaded_for';
const BUNDLE_PATTERN = /assets\/(index-[\w-]+\.js)/;
const MIN_CHECK_INTERVAL_MS = 60_000;

let lastCheckAt = 0;
let isChecking = false;

function isUserTyping(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

async function resetServiceWorkerAndCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}

async function checkForUpdate(): Promise<void> {
  const currentBundle = import.meta.url.match(BUNDLE_PATTERN)?.[1];
  if (!currentBundle || isChecking) return;
  if (Date.now() - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;

  isChecking = true;
  lastCheckAt = Date.now();
  try {
    // Параметр ?v= и no-store обходят и service worker, и HTTP-кеш
    const response = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;

    const latestBundle = (await response.text()).match(BUNDLE_PATTERN)?.[1];
    if (!latestBundle || latestBundle === currentBundle) return;

    // Защита от цикла перезагрузок: на одну версию пробуем только один раз за сессию
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === latestBundle) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, latestBundle);

    await resetServiceWorkerAndCaches();
    window.location.reload();
  } catch {
    // Нет сети — остаёмся на текущей версии (офлайн-режим)
  } finally {
    isChecking = false;
  }
}

export function startAppUpdateWatcher(): void {
  if (import.meta.env.DEV) return;

  void checkForUpdate();

  // Вкладка или PWA могли быть открыты несколько дней: проверяем при возвращении,
  // но не перезагружаемся, пока пользователь что-то печатает
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isUserTyping()) {
      void checkForUpdate();
    }
  });
}
