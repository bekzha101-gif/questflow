// Фоновая часть: решает, должна ли играть музыка, и управляет вкладкой Brain.fm.

const BRAINFM_URL = 'https://my.brain.fm/';
const BRAINFM_MATCH = 'https://my.brain.fm/*';
const STATE_KEY = 'focusTabs'; // { [tabId]: true } — вкладки QuestFlow, где сейчас идёт фокус

async function getFocusTabs() {
  const data = await chrome.storage.session.get(STATE_KEY);
  return data[STATE_KEY] || {};
}

async function setTabFocus(tabId, playing) {
  const tabs = await getFocusTabs();
  if (playing) tabs[tabId] = true;
  else delete tabs[tabId];
  await chrome.storage.session.set({ [STATE_KEY]: tabs });
  return Object.keys(tabs).length > 0;
}

// Отправить команду во вкладку Brain.fm; пока страница грузится, повторяем
async function sendCommand(tabId, cmd, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const reply = await chrome.tabs.sendMessage(tabId, { type: 'brainfm-command', cmd });
      if (reply && reply.ok) return true;
    } catch {
      // контент-скрипт ещё не загрузился
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function applyDesiredState(shouldPlay) {
  const tabs = await chrome.tabs.query({ url: BRAINFM_MATCH });
  let tab = tabs[0];

  if (!tab) {
    if (!shouldPlay) return; // нечего ставить на паузу
    // Фоновая закреплённая вкладка: окно и активная вкладка не меняются
    tab = await chrome.tabs.create({ url: BRAINFM_URL, active: false, pinned: true });
  }

  await sendCommand(tab.id, shouldPlay ? 'play' : 'pause');
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'questflow-focus' || !sender.tab) return;
  setTabFocus(sender.tab.id, Boolean(message.playing)).then(applyDesiredState);
});

// Вкладку QuestFlow закрыли во время фокуса — музыку останавливаем
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await getFocusTabs();
  if (!tabs[tabId]) return;
  const stillPlaying = await setTabFocus(tabId, false);
  if (!stillPlaying) applyDesiredState(false);
});
