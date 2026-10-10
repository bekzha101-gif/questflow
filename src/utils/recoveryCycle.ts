export interface RecoveryActivity {
  id: string;
  title: string;
  description: string;
  icon: string;
  expReward: number;
  goldReward: number;
  hpReward: number;
}

export interface RecoveryCycleConfig {
  workDaysCount: number; // 7
  recoveryDaysCount: number; // 1
  cycleStartDate: string; // YYYY-MM-DD
  notification24hEnabled: boolean;
  desktopPushEnabled: boolean;
  activities: RecoveryActivity[];
}

export interface DayCycleInfo {
  dateStr: string;
  isWorkDay: boolean;
  isRecoveryDay: boolean;
  dayIndexInCycle: number; // 0..6 work, 7 recovery
  dayNumberInCycle: number; // 1..7 work, 8 recovery
  isTomorrowRecovery: boolean;
  isTodayRecovery: boolean;
}

export const DEFAULT_RECOVERY_ACTIVITIES: RecoveryActivity[] = [
  {
    id: 'sauna_pool',
    title: 'Бассейн и сауна',
    description: 'Глубокий прогрев в сауне и плавание для снятия мышечных зажимов',
    icon: '🧖‍♂️',
    expReward: 40,
    goldReward: 15,
    hpReward: 30,
  },
  {
    id: 'nature_walk',
    title: 'Прогулка на природе (10 000+ шагов)',
    description: 'Пешая прогулка на свежем воздухе без смартфона и наушников',
    icon: '🌲',
    expReward: 40,
    goldReward: 15,
    hpReward: 25,
  },
  {
    id: 'meditation',
    title: 'Медитация (20-30 минут)',
    description: 'Полная ментальная разгрузка, наблюдение за дыханием и тишина',
    icon: '🧘‍♂️',
    expReward: 35,
    goldReward: 10,
    hpReward: 25,
  },
  {
    id: 'massage_stretching',
    title: 'Массаж / МФР / растяжка',
    description: 'Снятие триггерных точек, миофасциальный релиз и мягкая растяжка',
    icon: '💆‍♂️',
    expReward: 35,
    goldReward: 10,
    hpReward: 20,
  },
];

export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultCycleStartDate(): string {
  // По умолчанию старт цикла - текущая дата
  return getTodayStr();
}

export function loadRecoveryCycleConfig(): RecoveryCycleConfig {
  try {
    const raw = localStorage.getItem('questflow_recovery_cycle_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workDaysCount: 7,
        recoveryDaysCount: 1,
        cycleStartDate: parsed.cycleStartDate || getDefaultCycleStartDate(),
        notification24hEnabled: parsed.notification24hEnabled ?? true,
        desktopPushEnabled: parsed.desktopPushEnabled ?? true,
        activities: DEFAULT_RECOVERY_ACTIVITIES,
      };
    }
  } catch (e) {
    console.error('Failed to load recovery cycle config:', e);
  }

  return {
    workDaysCount: 7,
    recoveryDaysCount: 1,
    cycleStartDate: getDefaultCycleStartDate(),
    notification24hEnabled: true,
    desktopPushEnabled: true,
    activities: DEFAULT_RECOVERY_ACTIVITIES,
  };
}

export function saveRecoveryCycleConfig(config: RecoveryCycleConfig): void {
  try {
    localStorage.setItem('questflow_recovery_cycle_config', JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save recovery cycle config:', e);
  }
}

// Загрузка отмеченных активностей детокса по датам
export function loadCompletedRecoveryActivities(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('questflow_recovery_completed_activities');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCompletedRecoveryActivities(data: Record<string, string[]>): void {
  try {
    localStorage.setItem('questflow_recovery_completed_activities', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save completed recovery activities:', e);
  }
}

// Проверка и расчет статуса любого дня в цикле 7+1
export function getDayCycleInfo(targetDateStr: string, config: RecoveryCycleConfig): DayCycleInfo {
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(tY, tM - 1, tD, 12, 0, 0);

  const [sY, sM, sD] = config.cycleStartDate.split('-').map(Number);
  const startDate = new Date(sY, sM - 1, sD, 12, 0, 0);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((targetDate.getTime() - startDate.getTime()) / msPerDay);

  const totalCycleDays = 8; // 7 рабочих + 1 восстановление
  const dayIndexInCycle = ((diffDays % totalCycleDays) + totalCycleDays) % totalCycleDays;
  const dayNumberInCycle = dayIndexInCycle + 1;

  const isRecoveryDay = dayIndexInCycle === 7;
  const isWorkDay = !isRecoveryDay;

  // Проверка завтрашнего дня
  const tomorrow = new Date(targetDate.getTime() + msPerDay);
  const tomY = tomorrow.getFullYear();
  const tomM = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
  const tomD = tomorrow.getDate().toString().padStart(2, '0');
  const tomStr = `${tomY}-${tomM}-${tomD}`;
  const tomDiffDays = Math.round((tomorrow.getTime() - startDate.getTime()) / msPerDay);
  const tomIndex = ((tomDiffDays % totalCycleDays) + totalCycleDays) % totalCycleDays;
  const isTomorrowRecovery = tomIndex === 7;

  const todayStr = getTodayStr();
  const isTodayRecovery = targetDateStr === todayStr && isRecoveryDay;

  return {
    dateStr: targetDateStr,
    isWorkDay,
    isRecoveryDay,
    dayIndexInCycle,
    dayNumberInCycle,
    isTomorrowRecovery,
    isTodayRecovery,
  };
}

// Запрос разрешения на Web Push уведомления в macOS
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

// Отправка системного Web Push уведомления
export function sendDesktopNotification(title: string, body: string, tag: string = 'questflow-alert'): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag,
      });
    } catch (e) {
      console.warn('Desktop notification dispatch failed:', e);
    }
  }
}
