// Offline-First Persistent Timer Storage & Multi-tab BroadcastChannel

export type TimerMode = 'work' | 'break';
// Встроенный звук убран (музыку включает расширение Brain.fm); поле осталось для совместимости сохранённых сессий
export type AmbientSound = 'none' | 'brown' | 'gamma' | 'alpha';

export interface PersistentTimerSession {
  mode: TimerMode;
  isRunning: boolean;
  startTime: number | null; // Timestamp (Date.now()) when the current running segment began
  accumulatedSeconds: number; // Total seconds tracked prior to the current segment
  targetMinutes: number; // Configured minutes (e.g. 120 for work, 20 for break)
  title: string;
  selectedTaskId: string | null;
  ambientSound: AmbientSound;
  timerType: 'countdown' | 'stopwatch';
  lastUpdated: number;
}

const STORAGE_KEY = 'questflow_timer_session_v1';
const CHANNEL_NAME = 'questflow_timer_channel_v1';

let broadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      broadcastChannel = null;
    }
  }
  return broadcastChannel;
}

export function loadPersistentTimerSession(): PersistentTimerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistentTimerSession;
  } catch (e) {
    console.warn('Failed to load persistent timer session:', e);
    return null;
  }
}

export function savePersistentTimerSession(session: PersistentTimerSession): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = { ...session, lastUpdated: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    broadcastTimerSession(updated);
  } catch (e) {
    console.warn('Failed to save persistent timer session:', e);
  }
}

export function clearPersistentTimerSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    broadcastTimerSession(null);
  } catch (e) {
    console.warn('Failed to clear persistent timer session:', e);
  }
}

export function broadcastTimerSession(session: PersistentTimerSession | null): void {
  const ch = getBroadcastChannel();
  if (ch) {
    try {
      ch.postMessage({ type: 'TIMER_SESSION_SYNC', session });
    } catch {
      // Ignored
    }
  }
}

export function subscribeTimerChannel(
  callback: (session: PersistentTimerSession | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'TIMER_SESSION_SYNC') {
      callback(event.data.session);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      if (event.newValue) {
        try {
          callback(JSON.parse(event.newValue));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  };

  const ch = getBroadcastChannel();
  if (ch) {
    ch.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (ch) {
      ch.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

export function calculateCurrentTimerState(session: PersistentTimerSession): {
  elapsedSeconds: number;
  timeLeft: number;
  isExpired: boolean;
  expiredMinutes: number;
} {
  const now = Date.now();
  let currentSegmentSeconds = 0;
  if (session.isRunning && session.startTime) {
    currentSegmentSeconds = Math.max(0, Math.floor((now - session.startTime) / 1000));
  }
  const elapsedSeconds = session.accumulatedSeconds + currentSegmentSeconds;
  const targetSeconds = session.targetMinutes * 60;
  const isCountdown = session.timerType === 'countdown';
  const timeLeft = Math.max(0, targetSeconds - elapsedSeconds);
  const isExpired = session.isRunning && isCountdown && elapsedSeconds >= targetSeconds;
  const expiredMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

  return {
    elapsedSeconds,
    timeLeft,
    isExpired,
    expiredMinutes,
  };
}
