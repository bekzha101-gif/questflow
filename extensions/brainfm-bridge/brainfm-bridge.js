// Работает на my.brain.fm в изолированном мире: передаёт команды расширения скрипту плеера.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'brainfm-command') return;
  window.postMessage({ source: 'questflow-brainfm', cmd: message.cmd }, location.origin);
  sendResponse({ ok: true });
});
