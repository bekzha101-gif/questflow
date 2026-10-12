// Работает на странице QuestFlow: сообщает расширению, идёт ли сейчас фокус.
// QuestFlow выставляет <html data-questflow-focus="on|off"> и шлёт событие questflow:focus.

let lastReported = null;

function report() {
  const value = document.documentElement.dataset.questflowFocus;
  if (value === undefined) return; // таймер ещё не отрисован
  const playing = value === 'on';
  if (playing === lastReported) return;
  lastReported = playing;
  chrome.runtime.sendMessage({ type: 'questflow-focus', playing }).catch(() => {});
}

window.addEventListener('questflow:focus', report);
new MutationObserver(report).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-questflow-focus'],
});
report();
