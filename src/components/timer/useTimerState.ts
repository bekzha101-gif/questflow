import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimerSettings, TimerState } from '@shared/types';
import { IDLE_TIMER, normalizeTimerSettings } from '@shared/timer';
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

/** Ключ настроек таймера в kv: синхронизируется между устройствами, как и timer_state */
export const TIMER_SETTINGS_KEY = 'timer_settings';

/** Настройки таймера (длительность фокуса и отдыха, отсчёт или секундомер) из kv `timer_settings` */
export function useTimerSettings(): [TimerSettings, (next: TimerSettings) => void] {
  const { value, save } = useRecord<{ key: string; value?: Partial<TimerSettings> }>('kv', TIMER_SETTINGS_KEY);
  const raw = value?.value;
  const settings = useMemo(() => normalizeTimerSettings(raw), [raw]);
  const update = useCallback(
    (next: TimerSettings) => save({ key: TIMER_SETTINGS_KEY, value: normalizeTimerSettings(next) }),
    [save],
  );
  return [settings, update];
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
