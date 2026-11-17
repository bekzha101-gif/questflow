// Таймер: связь вкладок и перенос старой сессии.
// Само состояние таймера живёт в store (`timer_state`, Supabase + локальный кеш) — см. shared/timer.ts.
// Здесь: BroadcastChannel, чтобы соседняя вкладка видела переход сразу (store не синхронизирует
// вкладки между собой), «захват» события, чтобы блок записала и уведомила только одна вкладка,
// и перевод старой сессии questflow_timer_session_v1 в TimerState.
import type { TimerState } from '@shared/types';
import { BREAK_MIN, WORK_MIN } from '@shared/timer';

export type TimerMode = 'work' | 'break';
// Встроенный звук убран (музыку включает расширение Brain.fm); поле осталось для совместимости сохранённых сессий
export type AmbientSound = 'none' | 'brown' | 'gamma' | 'alpha';

/** Старый формат (до QuestFlow 2.0): только для переноса */
export interface PersistentTimerSession {
  mode: TimerMode;
  isRunning: boolean;
  startTime: number | null;
  accumulatedSeconds: number;
  targetMinutes: number;
  title: string;
  selectedTaskId: string | null;
  ambientSound: AmbientSound;
  timerType: 'countdown' | 'stopwatch';
  lastUpdated: number;
}

const LEGACY_KEY = 'questflow_timer_session_v1';
const CHANNEL_NAME = 'questflow_timer_channel_v2';
const CLAIMS_KEY = 'questflow_timer_claims_v1';
/** Старая подстановка по умолчанию — не задача пользователя */
const LEGACY_DEFAULT_TASK_ID = 'task-notebook-ideas';

const hasWindow = () => typeof window !== 'undefined';

export function loadPersistentTimerSession(): PersistentTimerSession | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as PersistentTimerSession) : null;
  } catch {
    return null;
  }
}

export function clearPersistentTimerSession(): void {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/** Старая сессия → TimerState. null — переносить нечего (работа не начата). */
export function legacyToTimerState(s: PersistentTimerSession, today: string): TimerState | null {
  const acc = Math.max(0, Number(s.accumulatedSeconds) || 0);
  const running = Boolean(s.isRunning && s.startTime);
  if (!running && acc === 0) return null;
  const phase = s.mode === 'break' ? 'break' : 'work';
  const taskId = s.selectedTaskId && s.selectedTaskId !== LEGACY_DEFAULT_TASK_ID ? s.selectedTaskId : null;
  return {
    phase,
    running,
    startedAt: running ? new Date(Number(s.startTime)).toISOString() : null,
    accumulatedSec: acc,
    targetMin: Number(s.targetMinutes) > 0 ? Number(s.targetMinutes) : phase === 'work' ? WORK_MIN : BREAK_MIN,
    blockIndex: 1,
    taskId,
    date: today,
    notifiedEnd: false,
  };
}

// ─── Вкладки ────────────────────────────────────────────────────────────────
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (!hasWindow() || !('BroadcastChannel' in window)) return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

export function broadcastTimerState(state: TimerState): void {
  try {
    getChannel()?.postMessage({ type: 'TIMER_STATE', state });
  } catch {
    // ignore
  }
}

export function subscribeTimerState(cb: (state: TimerState) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (e: MessageEvent) => {
    if (e.data && e.data.type === 'TIMER_STATE' && e.data.state) cb(e.data.state as TimerState);
  };
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

/**
 * Захватить событие таймера (конец блока, конец отдыха): true — только у первой вкладки.
 * Помнит последние 30 событий.
 */
export function claimTimerEvent(key: string): boolean {
  if (!hasWindow()) return true;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '[]');
    if (list.includes(key)) return false;
    localStorage.setItem(CLAIMS_KEY, JSON.stringify([...list, key].slice(-30)));
    return true;
  } catch {
    return true;
  }
}
