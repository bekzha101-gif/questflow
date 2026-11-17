// День восстановления: каждая пятница (вместо прежнего цикла 7+1).
// Правило дня — shared/time.isRecoveryDay. Отметки активностей — в хранилище (kv `recovery:<дата>`),
// награда за активность выдаётся один раз за день, даже если галочку снять и поставить снова.
import { useCallback, useMemo } from 'react';
import { addDays, isRecoveryDay, todayStr } from '@shared/time';
import { useRecord } from '../store';

export interface RecoveryActivity {
  id: string;
  title: string;
  description: string;
  /** Ключ иконки (без эмодзи): sauna | walk | meditation | massage */
  icon: string;
  expReward: number;
  goldReward: number;
  hpReward: number;
}

/** Совместимость со старым кодом (таймер, App): параметров у пятницы нет */
export interface RecoveryCycleConfig {
  activities: RecoveryActivity[];
  notification24hEnabled: boolean;
  desktopPushEnabled: boolean;
}

export interface DayCycleInfo {
  dateStr: string;
  isWorkDay: boolean;
  isRecoveryDay: boolean;
  isTomorrowRecovery: boolean;
  isTodayRecovery: boolean;
}

export const RECOVERY_BLOCK_MESSAGE = 'Сегодня пятница — день восстановления. Рабочие задачи и таймер отдыхают.';

export const DEFAULT_RECOVERY_ACTIVITIES: RecoveryActivity[] = [
  {
    id: 'sauna_pool',
    title: 'Баня или бассейн',
    description: 'Прогрев в бане или плавание — снять зажимы после недели',
    icon: 'sauna',
    expReward: 40,
    goldReward: 15,
    hpReward: 30,
  },
  {
    id: 'nature_walk',
    title: 'Прогулка',
    description: 'На свежем воздухе, без телефона и наушников',
    icon: 'walk',
    expReward: 40,
    goldReward: 15,
    hpReward: 25,
  },
  {
    id: 'meditation',
    title: 'Медитация',
    description: '20–30 минут тишины и дыхания',
    icon: 'meditation',
    expReward: 35,
    goldReward: 10,
    hpReward: 25,
  },
  {
    id: 'massage_stretching',
    title: 'Массаж или растяжка',
    description: 'Массаж, МФР или мягкая растяжка',
    icon: 'massage',
    expReward: 35,
    goldReward: 10,
    hpReward: 20,
  },
];

/** Сегодня по Бишкеку */
export function getTodayStr(): string {
  return todayStr();
}

export function loadRecoveryCycleConfig(): RecoveryCycleConfig {
  return { activities: DEFAULT_RECOVERY_ACTIVITIES, notification24hEnabled: true, desktopPushEnabled: true };
}

/** Статус дня: пятница — восстановление. Второй параметр оставлен для старых вызовов. */
export function getDayCycleInfo(dateStr: string, _config?: RecoveryCycleConfig): DayCycleInfo {
  const rec = isRecoveryDay(dateStr);
  return {
    dateStr,
    isWorkDay: !rec,
    isRecoveryDay: rec,
    isTomorrowRecovery: isRecoveryDay(addDays(dateStr, 1)),
    isTodayRecovery: rec && dateStr === todayStr(),
  };
}

/** В пятницу рабочие задачи не добавляются */
export function canAddWorkTask(dateStr: string): boolean {
  return !isRecoveryDay(dateStr);
}

// ─── Активности дня восстановления ───────────────────────────────────────────

export interface RecoveryDayState {
  /** Отмеченные сейчас активности */
  done: string[];
  /** Активности, за которые награда уже выдана в этот день */
  rewarded: string[];
}

export function emptyRecoveryDay(): RecoveryDayState {
  return { done: [], rewarded: [] };
}

/** Переключить галочку. Награда — только при первой отметке активности за день. */
export function toggleRecoveryActivity(
  state: RecoveryDayState,
  activityId: string,
  activities: RecoveryActivity[] = DEFAULT_RECOVERY_ACTIVITIES,
): { state: RecoveryDayState; reward: RecoveryActivity | null } {
  const act = activities.find((a) => a.id === activityId);
  if (!act) return { state, reward: null };
  if (state.done.includes(activityId)) {
    return { state: { ...state, done: state.done.filter((x) => x !== activityId) }, reward: null };
  }
  const already = state.rewarded.includes(activityId);
  return {
    state: { done: [...state.done, activityId], rewarded: already ? state.rewarded : [...state.rewarded, activityId] },
    reward: already ? null : act,
  };
}

export const recoveryKvKey = (dateStr: string) => `recovery:${dateStr}`;
const LEGACY_KEY = 'legacy:questflow_recovery_completed_activities';

interface KvRow<T> {
  key: string;
  value: T;
}

/**
 * Отметки активностей за день (хранилище). toggle возвращает активность, если за неё положена награда.
 * Старые отметки (перенесённые из браузера) читаются как уже награждённые.
 */
export function useRecoveryDay(dateStr: string) {
  const key = recoveryKvKey(dateStr);
  const { value, save } = useRecord<KvRow<RecoveryDayState>>('kv', key);
  const { value: legacy } = useRecord<KvRow<Record<string, string[]>>>('kv', LEGACY_KEY);

  const state = useMemo<RecoveryDayState>(() => {
    if (value?.value && Array.isArray(value.value.done)) {
      return { done: value.value.done, rewarded: Array.isArray(value.value.rewarded) ? value.value.rewarded : value.value.done };
    }
    const old = legacy?.value?.[dateStr];
    return Array.isArray(old) ? { done: old, rewarded: old } : emptyRecoveryDay();
  }, [value, legacy, dateStr]);

  const toggle = useCallback(
    (activityId: string): RecoveryActivity | null => {
      const r = toggleRecoveryActivity(state, activityId);
      save({ key, value: r.state });
      return r.reward;
    },
    [state, save, key],
  );

  return { done: state.done, toggle };
}

// ─── Системные уведомления ───────────────────────────────────────────────────

export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

/** Иконка относительно base сборки (сайт может жить в подпапке GitHub Pages) */
function iconUrl(): string {
  try {
    return `${import.meta.env.BASE_URL ?? './'}favicon.svg`;
  } catch {
    return './favicon.svg';
  }
}

/** Системное уведомление: через service worker, если он есть (Android/PWA), иначе Notification */
export function sendDesktopNotification(title: string, body: string, tag: string = 'questflow-alert'): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { body, icon: iconUrl(), tag };
  const fallback = () => {
    try {
      new Notification(title, opts);
    } catch (e) {
      console.warn('Не удалось показать уведомление:', e);
    }
  };
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(fallback);
  } else {
    fallback();
  }
}
