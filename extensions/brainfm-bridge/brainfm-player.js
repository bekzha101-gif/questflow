// Работает на my.brain.fm в мире страницы: нажимает Play / Pause в плеере Brain.fm.
// Музыку включает сам сайт Brain.fm под аккаунтом пользователя; скрипт только нажимает кнопки.

(() => {
  // Запоминаем аудио-элементы плеера, даже если они не вставлены в страницу
  const mediaElements = new Set();
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    mediaElements.add(this);
    return originalPlay.apply(this, args);
  };

  const allMedia = () => {
    document.querySelectorAll('audio, video').forEach((el) => mediaElements.add(el));
    return [...mediaElements];
  };
  const isPlaying = () => allMedia().some((el) => !el.paused && !el.ended);

  // Кнопка плеера по подписи: data-testid, aria-label или title содержат нужное слово
  // TODO: уточнить селекторы по реальной вёрстке плеера (нужен вход в Brain.fm)
  const findButton = (word) => {
    const candidates = document.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      const label = [el.getAttribute('data-testid'), el.getAttribute('aria-label'), el.getAttribute('title')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (label.includes(word)) return el;
    }
    return null;
  };

  let desired = null; // 'play' | 'pause' — последняя команда
  let retryTimer = null;

  function tryApply(attemptsLeft) {
    clearTimeout(retryTimer);
    if (desired === 'pause') {
      if (!isPlaying()) return;
      const pauseButton = findButton('pause');
      if (pauseButton) pauseButton.click();
      else allMedia().forEach((el) => el.pause());
    } else if (desired === 'play') {
      if (isPlaying()) return;
      const playButton = findButton('play');
      if (playButton) playButton.click();
      else allMedia().forEach((el) => el.play().catch(() => {}));
    }
    // Страница могла ещё не загрузиться — проверяем и повторяем
    if (attemptsLeft > 0) retryTimer = setTimeout(() => tryApply(attemptsLeft - 1), 1500);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'questflow-brainfm') return;
    desired = event.data.cmd;
    tryApply(20);
  });
})();
