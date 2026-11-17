import { useEffect, useState } from 'react';
import {
  FoodLogEntry,
  SleepCycleEntry,
  HealthDailyProtocol,
  RecoveryLogEntry,
  DamageIncident,
  HealthAlarmConfig,
  HealthAiReport,
  MealType,
  FoodFeeling,
} from '../types/health';
import { bishkekHM, todayStr } from '@shared/time';
import { store as defaultStore, useCollectionState, type Store } from '../store';
import { sendDesktopNotification } from './recoveryCycle';

// Здоровье: все данные — в хранилище (src/store), а не в отдельных ключах браузера.
// Еда — таблица health_food, будильники — health_alarms (их читает и сервер для Telegram),
// остальное (протокол дня, сон, урон, восстановление, AI-отчёт) — kv. Старые ключи questflow_*
// после переноса лежат в kv как legacy:<ключ> и читаются как запасной вариант.
// Время — только по Бишкеку (shared/time).

const KV = {
  DAILY_PREFIX: 'health_daily:',
  SLEEP: 'health_sleep',
  DAMAGE: 'health_damage',
  RECOVERY: 'health_recovery',
  AI_REPORT: 'health_ai_report',
  FIRED: 'health_alarms_fired',
};
const LEGACY = {
  DAILY_PREFIX: 'legacy:questflow_health_daily_',
  SLEEP: 'legacy:questflow_health_sleep_v1',
  DAMAGE: 'legacy:questflow_health_damage_v1',
  RECOVERY: 'legacy:questflow_health_recovery_v1',
  AI_REPORT: 'legacy:questflow_health_ai_report_v1',
};

interface KvRow<T> {
  key: string;
  value: T;
}

function kvGet<T>(key: string, legacyKey: string | null, s: Store = defaultStore): T | null {
  const row = s.get<KvRow<T>>('kv', key);
  if (row && row.value !== undefined && row.value !== null) return row.value;
  if (legacyKey) {
    const old = s.get<KvRow<T>>('kv', legacyKey);
    if (old && old.value !== undefined && old.value !== null) return old.value;
  }
  return null;
}

function kvSet<T>(key: string, value: T, s: Store = defaultStore) {
  s.upsert('kv', { key, value });
}

/** Сегодня по Бишкеку */
export function getTodayDateString(now: Date = new Date()): string {
  return todayStr(now);
}

/** Текущее время ЧЧ:ММ по Бишкеку */
export function getCurrentTimeString(now: Date = new Date()): string {
  const { h, m } = bishkekHM(now);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** «Сегодня», которое само переходит на новый день в полночь по Бишкеку */
export function useTodayStr(): string {
  const [day, setDay] = useState(() => todayStr());
  useEffect(() => {
    const t = setInterval(() => setDay(todayStr()), 30_000);
    return () => clearInterval(t);
  }, []);
  return day;
}

export const DEFAULT_HEALTH_ALARMS: HealthAlarmConfig[] = [
  { id: 'alarm-meditation', title: 'Медитация', time: '17:15', enabled: true, type: 'meditation', soundEnabled: true, repeatDaily: true },
  { id: 'alarm-walk', title: 'Прогулка на свежем воздухе', time: '21:00', enabled: true, type: 'walk', soundEnabled: true, repeatDaily: true },
  { id: 'alarm-gadgets', title: 'Убрать телефон и гаджеты (за час до сна)', time: '22:00', enabled: true, type: 'gadgets_off', soundEnabled: true, repeatDaily: true },
  { id: 'alarm-sleep', title: 'Отбой', time: '23:00', enabled: true, type: 'sleep', soundEnabled: true, repeatDaily: true },
];

export function getDefaultDailyProtocol(date = getTodayDateString()): HealthDailyProtocol {
  return {
    date,
    waterGlasses: 0,
    waterTargetReached: false,
    phoneOff1Hour: false,
    gadgetsFullOff: false,
    walkBeforeSleep: false,
    meditationAlarmTime: '17:15',
    meditationDone: false,
    meditationMissed: false,
    sleepHours: 8,
    penaltiesApplied: {},
  };
}

// ─── Чтение и запись ─────────────────────────────────────────────────────────

export function loadDailyProtocol(date = getTodayDateString()): HealthDailyProtocol {
  const v = kvGet<HealthDailyProtocol>(KV.DAILY_PREFIX + date, LEGACY.DAILY_PREFIX + date);
  return v ? { ...getDefaultDailyProtocol(date), ...v, date } : getDefaultDailyProtocol(date);
}

export function saveDailyProtocol(protocol: HealthDailyProtocol) {
  kvSet(KV.DAILY_PREFIX + protocol.date, protocol);
}

/** Новая запись еды: дата и время — по Бишкеку в момент записи */
export function addFoodEntry(
  input: { mealType: MealType; food: string; feeling: FoodFeeling; notes?: string; time?: string },
  now: Date = new Date(),
  s: Store = defaultStore,
): FoodLogEntry {
  const entry: FoodLogEntry = {
    id: `food-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toISOString(),
    date: todayStr(now),
    time: input.time || getCurrentTimeString(now),
    mealType: input.mealType,
    food: input.food,
    feeling: input.feeling,
    ...(input.notes ? { notes: input.notes } : {}),
  };
  s.upsert('health_food', entry);
  return entry;
}

/** Записи еды за день, по времени */
export function foodForDay(entries: FoodLogEntry[], date: string): FoodLogEntry[] {
  return entries.filter((f) => f.date === date).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

export function loadFoodLogs(s: Store = defaultStore): FoodLogEntry[] {
  return s.items<FoodLogEntry>('health_food');
}

/** Дневник питания как useState поверх хранилища (переживает перезагрузку, синкается) */
export function useFoodLogs() {
  return useCollectionState<FoodLogEntry>('health_food');
}

export function loadSleepLogs(): SleepCycleEntry[] {
  return kvGet<SleepCycleEntry[]>(KV.SLEEP, LEGACY.SLEEP) ?? [];
}

export function saveSleepLogs(logs: SleepCycleEntry[]) {
  kvSet(KV.SLEEP, logs);
}

export function loadDamageIncidents(): DamageIncident[] {
  return kvGet<DamageIncident[]>(KV.DAMAGE, LEGACY.DAMAGE) ?? [];
}

export function saveDamageIncidents(incidents: DamageIncident[]) {
  kvSet(KV.DAMAGE, incidents);
}

export function loadRecoveryLogs(): RecoveryLogEntry[] {
  return kvGet<RecoveryLogEntry[]>(KV.RECOVERY, LEGACY.RECOVERY) ?? [];
}

export function saveRecoveryLogs(logs: RecoveryLogEntry[]) {
  kvSet(KV.RECOVERY, logs);
}

/** Будильники из хранилища; пока таблица пуста — будильники по умолчанию */
export function loadHealthAlarms(s: Store = defaultStore): HealthAlarmConfig[] {
  return s.hasAnyRow('health_alarms') ? s.items<HealthAlarmConfig>('health_alarms') : DEFAULT_HEALTH_ALARMS;
}

/** Будильники как useState: первая правка записывает их в health_alarms (сервер шлёт их в Telegram) */
export function useHealthAlarms(): {
  alarms: HealthAlarmConfig[];
  saved: boolean;
  setAlarms: (next: HealthAlarmConfig[]) => void;
} {
  const [items, setItems] = useCollectionState<HealthAlarmConfig>('health_alarms');
  const saved = items.length > 0 || defaultStore.hasAnyRow('health_alarms');
  return { alarms: saved ? items : DEFAULT_HEALTH_ALARMS, saved, setAlarms: (next) => setItems(next) };
}

export function saveHealthAlarms(alarms: HealthAlarmConfig[], s: Store = defaultStore) {
  for (const a of alarms) s.upsert('health_alarms', a);
}

export function loadSavedAiReport(): HealthAiReport | null {
  return kvGet<HealthAiReport>(KV.AI_REPORT, LEGACY.AI_REPORT);
}

export function saveAiReport(report: HealthAiReport) {
  kvSet(KV.AI_REPORT, report);
}

// ─── Звук: один AudioContext на всё приложение ───────────────────────────────

type AudioCtor = typeof AudioContext;
let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedCtx) return sharedCtx;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor();
  } catch {
    return null;
  }
  return sharedCtx;
}

/** Разбудить звук после жеста пользователя (политика автоплея браузера) */
export function unlockHealthAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function playHealthAlarmSound(type: 'meditation' | 'alert' | 'heal') {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;

    if (type === 'meditation') {
      // Поющая чаша
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, now);
      osc.frequency.exponentialRampToValueAtTime(216, now + 3.0);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 3.0);
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(240, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      [528, 660, 792].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.2);
      });
    }
  } catch (err) {
    console.warn('Не удалось проиграть звук', err);
  }
}

// ─── Будильники: сканер выше разделов ────────────────────────────────────────

/** Сколько минут после времени будильника он ещё может сработать (вкладка открылась позже) */
export const ALARM_WINDOW_MIN = 10;

const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Будильники, которые должны прозвенеть сейчас (по Бишкеку) и ещё не звенели сегодня */
export function dueHealthAlarms(alarms: HealthAlarmConfig[], now: Date, firedToday: string[]): HealthAlarmConfig[] {
  const { h, m } = bishkekHM(now);
  const cur = h * 60 + m;
  return alarms.filter((a) => {
    if (!a || !a.enabled || !a.time || firedToday.includes(a.id)) return false;
    const t = toMin(a.time);
    return cur >= t && cur <= t + ALARM_WINDOW_MIN;
  });
}

export const HEALTH_ALARM_EVENT = 'questflow:health-alarm';

export interface HealthAlarmDeps {
  store?: Store;
  now?: () => Date;
  play?: (type: 'meditation' | 'alert') => void;
  notify?: (title: string, body: string) => void;
}

/** Один шаг сканера: звук и уведомление для наступивших будильников, отметка «прозвенел сегодня» */
export function tickHealthAlarms(deps: HealthAlarmDeps = {}): HealthAlarmConfig[] {
  const s = deps.store ?? defaultStore;
  const now = (deps.now ?? (() => new Date()))();
  const date = todayStr(now);
  const firedRow = kvGet<{ date: string; ids: string[] }>(KV.FIRED, null, s);
  const fired = firedRow && firedRow.date === date ? firedRow.ids : [];
  const due = dueHealthAlarms(loadHealthAlarms(s), now, fired);
  if (!due.length) return [];

  kvSet(KV.FIRED, { date, ids: [...fired, ...due.map((a) => a.id)] }, s);
  const play = deps.play ?? playHealthAlarmSound;
  const notify = deps.notify ?? defaultNotify;
  const withSound = due.find((a) => a.soundEnabled !== false);
  if (withSound) play(withSound.type === 'meditation' ? 'meditation' : 'alert');
  for (const a of due) {
    notify(a.title, `Будильник ${a.time}`);
    // Разовый будильник после срабатывания выключается
    if (a.repeatDaily === false && s.hasKey('health_alarms', a.id)) s.upsert('health_alarms', { ...a, enabled: false });
  }
  return due;
}

function defaultNotify(title: string, body: string) {
  sendDesktopNotification(title, body, `health-${title}`);
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HEALTH_ALARM_EVENT, { detail: { title, body } }));
  showInPageAlarm(title, body);
}

/** Плашка поверх любого раздела: видна, даже если системные уведомления запрещены */
function showInPageAlarm(title: string, body: string) {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;background:#16161f;' +
    'border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 16px;color:#f4f4f5;' +
    'font:500 13.5px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;gap:14px;align-items:center';
  const text = document.createElement('div');
  const t = document.createElement('div');
  t.textContent = title;
  const b = document.createElement('div');
  b.textContent = body;
  b.style.cssText = 'color:#a1a1aa;font-size:12px;font-weight:400';
  text.append(t, b);
  const close = document.createElement('button');
  close.textContent = 'OK';
  close.style.cssText = 'background:#f4f4f5;color:#09090c;border:0;border-radius:8px;padding:5px 10px;font-weight:600;cursor:pointer';
  close.onclick = () => box.remove();
  box.append(text, close);
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 5 * 60_000);
}

let scannerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Запустить сканер будильников один раз на всё приложение (не внутри раздела):
 * работает, какой бы раздел ни был открыт. Повторный вызов ничего не делает.
 */
export function startHealthAlarmScanner(deps: HealthAlarmDeps = {}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (!scannerTimer) {
    const unlock = () => unlockHealthAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    tickHealthAlarms(deps);
    scannerTimer = setInterval(() => tickHealthAlarms(deps), 20_000);
  }
  return () => {
    if (scannerTimer) clearInterval(scannerTimer);
    scannerTimer = null;
  };
}

// ─── Флаги для баннера раздела «Здоровье» ─ ─────────────────────────────────────────────────

export interface AlarmScanResult {
  isMeditationTime: boolean;
  isMeditationMissed: boolean;
  isBedtimeSoon: boolean;
  isGadgetsOffTime: boolean;
  activeAlarmText?: string;
}

export function scanHealthAlarms(
  protocol: HealthDailyProtocol,
  alarms = DEFAULT_HEALTH_ALARMS
): AlarmScanResult {
  const currentTime = getCurrentTimeString();
  const [currH, currM] = currentTime.split(':').map(Number);
  const currentMinutes = currH * 60 + currM;

  let isMeditationTime = false;
  let isMeditationMissed = false;
  let isBedtimeSoon = false;
  let isGadgetsOffTime = false;
  let activeAlarmText: string | undefined;

  const medAlarm = alarms.find((a) => a.type === 'meditation' && a.enabled) || { time: '17:15' };
  const [medH, medM] = medAlarm.time.split(':').map(Number);
  const medMinutes = medH * 60 + medM;

  // Between med time and med time + 15 mins
  if (!protocol.meditationDone && currentMinutes >= medMinutes && currentMinutes <= medMinutes + 15) {
    isMeditationTime = true;
    activeAlarmText = `Время медитации (${medAlarm.time})! Сделайте 10-15 минутную практику`;
  }

  // If passed med time + 20 mins and not done, mark as missed!
  if (!protocol.meditationDone && currentMinutes > medMinutes + 20) {
    isMeditationMissed = true;
  }

  // Gadgets off alarm
  const gadgetAlarm = alarms.find((a) => a.type === 'gadgets_off' && a.enabled) || { time: '22:00' };
  const [gH, gM] = gadgetAlarm.time.split(':').map(Number);
  const gadgetMinutes = gH * 60 + gM;
  if (!protocol.gadgetsFullOff && currentMinutes >= gadgetMinutes && currentMinutes <= gadgetMinutes + 60) {
    isGadgetsOffTime = true;
    if (!activeAlarmText) activeAlarmText = 'Пора отключить телефон и гаджеты за 1 час до сна!';
  }

  // Bedtime alarm
  const sleepAlarm = alarms.find((a) => a.type === 'sleep' && a.enabled) || { time: '23:00' };
  const [sH, sM] = sleepAlarm.time.split(':').map(Number);
  const sleepMinutes = sH * 60 + sM;
  if (currentMinutes >= sleepMinutes - 30 && currentMinutes <= sleepMinutes) {
    isBedtimeSoon = true;
    if (!activeAlarmText) activeAlarmText = 'Готовьтесь ко сну. Идеал для здоровья — 8-9 часов глубокого сна';
  }

  return {
    isMeditationTime,
    isMeditationMissed,
    isBedtimeSoon,
    isGadgetsOffTime,
    activeAlarmText,
  };
}

// ─── AI Health Correlations & Long-Term Advisor ──────────────────────────────

export function generateHealthAiReport(
  protocol: HealthDailyProtocol,
  foodLogs: FoodLogEntry[],
  sleepLogs: SleepCycleEntry[],
  damages: DamageIncident[],
  recoveries: RecoveryLogEntry[]
): HealthAiReport {
  // 1. Calculate health score
  const totalHpLost = damages.reduce((acc, d) => acc + d.hpLost, 0);
  const totalHpRecovered = recoveries.reduce((acc, r) => acc + r.hpGained, 0);

  // Avg sleep
  const avgSleep = sleepLogs.length > 0 
    ? sleepLogs.reduce((acc, s) => acc + s.totalHours, 0) / sleepLogs.length 
    : 7.8;

  // Water compliance
  const waterRate = protocol.waterGlasses >= 8 ? 100 : Math.round((protocol.waterGlasses / 8) * 100);

  // Base score
  let score = 85;
  if (avgSleep < 7) score -= 15;
  if (waterRate < 70) score -= 10;
  if (protocol.meditationMissed) score -= 10;
  if (!protocol.gadgetsFullOff) score -= 10;
  score = Math.max(20, Math.min(100, score));

  // 2. Discover Correlations
  const correlations = [];

  // Correlation: Late eating vs Sleep
  const lateMeals = foodLogs.filter((f) => {
    const h = Number(f.time.split(':')[0]);
    return h >= 21;
  });

  if (lateMeals.length > 0) {
    correlations.push({
      title: 'Ужин после 21:00 и глубина сна',
      description: `Зафиксировано ${lateMeals.length} поздних приёмов пищи. Поздний ужин смещает фазу глубокого сна (REM) на 45 минут, повышая утреннюю утомляемость и риск пропуска медитации 17:15.`,
      impact: 'negative' as const,
    });
  } else {
    correlations.push({
      title: 'Чистое окно перед сном (без тяжелой еды)',
      description: 'Отсутствие поздних приемов пищи стабилизирует выработку соматотропина и мелатонина ночью, ускоряя регенерацию клеток.',
      impact: 'positive' as const,
    });
  }

  // Correlation: Phone 1h before sleep
  if (!protocol.phoneOff1Hour) {
    correlations.push({
      title: 'Синий спектр экранов за 1 час до сна',
      description: 'Использование телефона перед сном блокирует естественный синтез мелатонина, сокращая общее время восстановительного сна на 1.2–1.8 часа.',
      impact: 'negative' as const,
    });
  } else {
    correlations.push({
      title: 'Цифровой детокс за 1 час до сна',
      description: 'Выключение смартфона нормализует циркадные ритмы и защищает нервную систему от кортизоловых скачков.',
      impact: 'positive' as const,
    });
  }

  // Correlation: 2 Liters Water
  if (protocol.waterGlasses >= 8) {
    correlations.push({
      title: 'Гидратация 2.0+ литра в день',
      description: 'Полноценный питьевой режим поддерживает вязкость крови в норме, снижая нагрузку на сердечно-сосудистую систему при умственном труде.',
      impact: 'positive' as const,
    });
  } else {
    correlations.push({
      title: 'Дефицит жидкости (< 2 л)',
      description: `Выпито ${protocol.waterGlasses * 250} мл из 2000 мл. Дегидратация даже на 2% снижает когнитивные способности мозга на 15% и провоцирует головную боль.`,
      impact: 'negative' as const,
    });
  }

  // Critical Risks
  const criticalRisks: string[] = [];
  if (totalHpLost > totalHpRecovered + 20) {
    criticalRisks.push('Общий баланс здоровья отрицательный: урон превышает активное восстановление. Требуется день детокса или сауна.');
  }
  if (avgSleep < 7) {
    criticalRisks.push('Хронический недосып (< 7 часов): снижает нейропластичность и истощает запасы дофамина.');
  }
  if (protocol.meditationMissed) {
    criticalRisks.push('Пропущен будильник осознанности (17:15): стресс накапливается без вечерней разгрузки.');
  }

  // Future Advice (Weeks, Months, Years)
  const futureAdvice = [
    {
      period: 'Ближайшие недели' as const,
      recommendation: 'Закрепить правило «21:30 без экранов» и 8 стаканов чистой воды. Выделить 1 день на неделе под активное восстановление (баня / выезд за город без телефона).',
    },
    {
      period: '3-6 месяцев' as const,
      recommendation: 'Сформировать устойчивый биоритм: 8.5 часов сна с отбоем до 23:00. При постоянной гидратации и медитации в 17:15 ваш персональный HP удержится на отметке 95+ единиц.',
    },
    {
      period: '1-3 года' as const,
      recommendation: 'Накопительный эффект: регулярные 3-дневные цифровые детоксы раз в квартал и нулевое использование гаджетов перед сном сохранят высокий митохондриальный потенциал, четкую память и замедлят биологическое старение организма на 3–5 лет.',
    },
  ];

  const report: HealthAiReport = {
    generatedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    overallHealthScore: score,
    resourceArchiveSummary: `Зафиксировано ${damages.length} инцидентов урона (-${totalHpLost} HP) и ${recoveries.length} сессий активного восстановления (+${totalHpRecovered} HP). Средний сон: ${avgSleep.toFixed(1)} ч.`,
    correlations,
    criticalRisks,
    futureAdvice,
  };

  saveAiReport(report);
  return report;
}
