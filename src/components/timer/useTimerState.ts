import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimerState } from '@shared/types';
import { IDLE_TIMER } from '@shared/timer';
import { todayStr } from '@shared/time';
import { useRecord } from '../../store';
import {
  broadcastTimerState,
  clearPersistentTimerSession,
  legacyToTimerState,
  loadPersistentTimerSession,
  subscribeTimerState,
} from '../../utils/timerStorage';

/**
 * Состояние таймера из timer_state (Supabase + локальный кеш): одно на все устройства.
 * Соседняя вкладка получает переход сразу через BroadcastChannel, пока облако не прислало строку.
 */
export function useTimerState(): [TimerState, (next: TimerState) => void] {
  const { value, save } = useRecord<TimerState>('timer_state');
  const [fromTab, setFromTab] = useState<{ state: TimerState; base: TimerState | null } | null>(null);

  useEffect(() => subscribeTimerState((state) => setFromTab({ state, base: value })), [value]);

  // Перенос старой сессии (questflow_timer_session_v1) один раз, если в облаке таймера ещё нет
  useEffect(() => {
    if (value) return;
    const legacy = loadPersistentTimerSession();
    if (!legacy) return;
    const migrated = legacyToTimerState(legacy, todayStr());
    if (migrated) save(migrated);
    clearPersistentTimerSession();
  }, [value, save]);

  const state = useMemo<TimerState>(() => {
    // Сообщение соседней вкладки действует, пока store не обновился после него
    if (fromTab && fromTab.base === value) return fromTab.state;
    return { ...IDLE_TIMER, ...(value ?? {}) };
  }, [fromTab, value]);

  const commit = useCallback(
    (next: TimerState) => {
      save(next);
      broadcastTimerState(next);
    },
    [save],
  );

  return [state, commit];
}

/** Текущее время, обновляется раз в секунду */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
