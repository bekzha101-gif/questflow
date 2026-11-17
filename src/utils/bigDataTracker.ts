// Big Data: данные дня — строки bigdata_days (по одной на дату), настройки — bigdata_config.
// Здесь — правила сайта поверх хранилища; аналитика (дельта, причины, факторы) — в shared/bigdata.ts.
import { useCallback, useMemo } from 'react';
import { dayOfWeek, isRecoveryDay, todayStr } from '@shared/time';
import { monthDates, type BigDataCriterion, type CriterionType } from '@shared/bigdata';
import type { BigDataDay, Sphere, Supplement } from '@shared/types';
import { store, useCollection, useRecord } from '../store';

/** Сфера дня — любая метка (сферы настраиваются; старые метки в старых днях остаются текстом) */
export type ActivityTag = string;

export interface DailyLogEntry {
  day: number;
  dayOfWeek: string;
  sleep: string; // e.g. "7ч 40м"
  sleepMinutes: number; // e.g. 460
  sleepQualityPercent?: number; // e.g. 88% from Sleep Cycle
  supplements: string; // e.g. "Кофеин 100 мг, Элеутерококк"
  score: number | null; // e.g. 6.8
  why: string; // e.g. "Хорошо поработал, закрыл все задачи"
  tags: ActivityTag[];
  dateStr: string;
  isAutoSynced?: boolean;
}

export interface BiometricsData {
  weightKg: number;
  waistCm: number;
  armsCm: number;
  calvesCm: number;
  thighsCm: number;
  bodyFatPercent?: number;
}

export interface HormoneData {
  testosteroneNmol: number;
  estradiolNgL: number;
  shbgNmol: number;
  lh: number;
  hematocrit: number;
  lastTestDate: string;
}

export interface SleepCycleSyncConfig {
  enabled: boolean;
  syncSource: 'apple_health' | 'google_health' | 'google_calendar' | 'webhook';
  lastSyncedAt?: string;
  webhookToken: string;
  autoCalculateScore: boolean;
}

export interface MonthlyBigDataState {
  monthName: string;
  year: number;
  days: DailyLogEntry[];
  biometrics: BiometricsData;
  hormones: HormoneData;
  observations: string;
  monthlySummary: string;
  sleepSync: SleepCycleSyncConfig;
}

const RUSSIAN_DAY_OF_WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Пустой месяц старой модели (для старых модулей: Sleep Cycle CSV, AI-советник). Месяц не зашит. */
export function createEmptyBigDataMonth(monthName: string = '', year: number = 2026, month: number = 8): MonthlyBigDataState {
  const mk = `${year}-${String(month).padStart(2, '0')}`;
  const days: DailyLogEntry[] = monthDates(mk).map((dateStr, i) => ({
    day: i + 1,
    dayOfWeek: RUSSIAN_DAY_OF_WEEK[dayOfWeek(dateStr)],
    sleep: '',
    sleepMinutes: 0,
    sleepQualityPercent: undefined,
    supplements: '',
    score: null,
    why: '',
    tags: [],
    dateStr,
    isAutoSynced: false,
  }));

  return {
    monthName,
    year,
    sleepSync: {
      enabled: false,
      syncSource: 'apple_health',
      lastSyncedAt: '—',
      webhookToken: '',
      autoCalculateScore: true,
    },
    biometrics: { weightKg: 0, waistCm: 0, armsCm: 0, calvesCm: 0, thighsCm: 0, bodyFatPercent: 0 },
    hormones: { testosteroneNmol: 0, estradiolNgL: 0, shbgNmol: 0, lh: 0, hematocrit: 0, lastTestDate: '—' },
    observations: '',
    monthlySummary: '',
    days,
  };
}

export const initialBigDataMonth: MonthlyBigDataState = createEmptyBigDataMonth('Август', 2026, 8);

export function calculateMonthlyStats(state: MonthlyBigDataState) {
  const scoredDays = state.days.filter((d) => d.score !== null);
  const avgScore = scoredDays.length > 0 
    ? (scoredDays.reduce((acc, d) => acc + (d.score || 0), 0) / scoredDays.length).toFixed(2)
    : '0.00';

  const daysWithSleep = state.days.filter((d) => d.sleepMinutes > 0);
  const avgSleepMinutes = daysWithSleep.length > 0
    ? Math.round(daysWithSleep.reduce((acc, d) => acc + d.sleepMinutes, 0) / daysWithSleep.length)
    : 0;

  const avgSleepHoursStr = `${Math.floor(avgSleepMinutes / 60)}ч ${avgSleepMinutes % 60}м`;

  // Tag counts
  const tagCounts: Record<string, number> = {};
  state.days.forEach((d) => {
    d.tags.forEach((t) => {
      const baseTag = t.replace('+', '');
      tagCounts[baseTag] = (tagCounts[baseTag] || 0) + 1;
    });
  });

  // Correlation: Sleep >= 7h20m (440m) vs Score
  const highSleepHours = state.days.filter((d) => d.sleepMinutes >= 440 && d.score !== null);
  const lowSleepHours = state.days.filter((d) => d.sleepMinutes < 440 && d.score !== null && d.sleepMinutes > 0);

  const avgHighSleepScore = highSleepHours.length > 0
    ? (highSleepHours.reduce((acc, d) => acc + (d.score || 0), 0) / highSleepHours.length).toFixed(2)
    : '0.00';

  const avgLowSleepScore = lowSleepHours.length > 0
    ? (lowSleepHours.reduce((acc, d) => acc + (d.score || 0), 0) / lowSleepHours.length).toFixed(2)
    : '0.00';

  // Dopamine Detox Consistency (NC + NP)
  const ncDays = state.days.filter((d) => d.tags.includes('NC')).length;
  const npDays = state.days.filter((d) => d.tags.includes('NP')).length;

  return {
    avgScore,
    avgSleepHoursStr,
    workDays: tagCounts['Work'] || 0,
    trainingDays: tagCounts['Tr'] || 0,
    driveDays: tagCounts['Dr'] || 0,
    socialDays: tagCounts['Soc'] || 0,
    ncDays,
    npDays,
    avgHighSleepScore,
    avgLowSleepScore,
    scoredDaysCount: scoredDays.length,
    totalDays: state.days.length,
  };
}

// ─── Big Data 2.0: настройки ─────────────────────────────────────────────────

export type { BigDataCriterion, CriterionType };

/** Настройки Big Data: сферы, свои критерии, шаблон БАДов (bigdata_config) */
export interface BigDataSettings {
  spheres: Sphere[];
  criteria: BigDataCriterion[];
  supplements: Supplement[];
}

const CRITERION_TYPES: CriterionType[] = ['number', 'boolean', 'scale', 'text'];

/** Привести запись из хранилища к рабочему виду (без выдуманных значений) */
export function normalizeConfig(raw: Partial<BigDataSettings> | null | undefined): BigDataSettings {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    spheres: arr<Sphere>(raw?.spheres).filter((s) => s && typeof s.id === 'string' && typeof s.label === 'string'),
    criteria: arr<BigDataCriterion>(raw?.criteria)
      .filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string')
      .map((c) => ({ ...c, type: CRITERION_TYPES.includes(c.type) ? c.type : 'text' })),
    supplements: arr<Supplement>(raw?.supplements).filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string'),
  };
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function addSphere(cfg: BigDataSettings, label: string, description?: string): BigDataSettings {
  const l = label.trim();
  if (!l || cfg.spheres.some((s) => s.label === l)) return cfg;
  return { ...cfg, spheres: [...cfg.spheres, { id: newId('sphere'), label: l, ...(description ? { description } : {}) }] };
}

/** Переименовать сферу. Старые дни хранят прежнюю метку как текст — их не трогаем. */
export function renameSphere(cfg: BigDataSettings, id: string, label: string, description?: string): BigDataSettings {
  const l = label.trim();
  if (!l) return cfg;
  return {
    ...cfg,
    spheres: cfg.spheres.map((s) => (s.id === id ? { ...s, label: l, ...(description !== undefined ? { description } : {}) } : s)),
  };
}

export function removeSphere(cfg: BigDataSettings, id: string): BigDataSettings {
  return { ...cfg, spheres: cfg.spheres.filter((s) => s.id !== id) };
}

export function addCriterion(cfg: BigDataSettings, label: string, type: CriterionType, unit?: string): BigDataSettings {
  const l = label.trim();
  if (!l) return cfg;
  return { ...cfg, criteria: [...cfg.criteria, { id: newId('crit'), label: l, type, ...(unit ? { unit } : {}) }] };
}

export function updateCriterion(cfg: BigDataSettings, id: string, patch: Partial<Omit<BigDataCriterion, 'id'>>): BigDataSettings {
  return { ...cfg, criteria: cfg.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function removeCriterion(cfg: BigDataSettings, id: string): BigDataSettings {
  return { ...cfg, criteria: cfg.criteria.filter((c) => c.id !== id) };
}

export function addSupplement(cfg: BigDataSettings, name: string, dose?: string): BigDataSettings {
  const n = name.trim();
  if (!n || cfg.supplements.some((s) => s.name === n)) return cfg;
  return { ...cfg, supplements: [...cfg.supplements, { id: newId('supp'), name: n, ...(dose ? { dose } : {}) }] };
}

export function updateSupplement(cfg: BigDataSettings, id: string, patch: Partial<Omit<Supplement, 'id'>>): BigDataSettings {
  return { ...cfg, supplements: cfg.supplements.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function removeSupplement(cfg: BigDataSettings, id: string): BigDataSettings {
  return { ...cfg, supplements: cfg.supplements.filter((s) => s.id !== id) };
}

/** Галочка БАДа в дне: в день пишется название (как текст) */
export function toggleSupplement(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
}

// ─── Месяц ───────────────────────────────────────────────────────────────────

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAY_SHORT = RUSSIAN_DAY_OF_WEEK;

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export interface MonthCell {
  date: string;
  dayNum: number;
  weekday: string;
  /** Пятница — день восстановления */
  isRecovery: boolean;
  day: BigDataDay | null;
}

/** Все дни месяца с записями из bigdata_days (записи других месяцев не трогаются) */
export function buildMonth(month: string, days: BigDataDay[]): MonthCell[] {
  const byDate = new Map(days.filter((d) => d && typeof d.date === 'string').map((d) => [d.date, d]));
  return monthDates(month).map((date, i) => ({
    date,
    dayNum: i + 1,
    weekday: RUSSIAN_DAY_OF_WEEK[dayOfWeek(date)],
    isRecovery: isRecoveryDay(date),
    day: byDate.get(date) ?? null,
  }));
}

/** «7ч 40м», «7:40», «7.5» → минуты */
export function sleepFromText(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const hm = t.match(/^(\d+)\s*(?:ч|h|:)\s*(\d+)?/i);
  if (hm) return Number(hm[1]) * 60 + (Number(hm[2]) || 0);
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : undefined;
}

/** Есть ли в дне хоть что-то, кроме авто-полей */
export function isDayFilled(d: BigDataDay | null | undefined): boolean {
  if (!d) return false;
  return (
    (d.score ?? null) !== null ||
    (d.sleepMin ?? 0) > 0 ||
    !!d.why?.trim() ||
    !!d.note?.trim() ||
    (d.tags?.length ?? 0) > 0 ||
    (d.supplements?.length ?? 0) > 0 ||
    typeof d.waterOk === 'boolean'
  );
}

// ─── Привычки одним касанием (и авто-подстановка в день) ─────────────────────

export interface HabitDayState {
  doneIds: string[];
  /** За какие привычки награда за этот день уже выдана */
  rewardedIds: string[];
}

/** Касание привычки: отметить/снять. Награда — только при первой отметке за день. */
export function tapHabit(state: HabitDayState, id: string): { state: HabitDayState; reward: boolean } {
  if (state.doneIds.includes(id)) return { state: { ...state, doneIds: state.doneIds.filter((x) => x !== id) }, reward: false };
  const reward = !state.rewardedIds.includes(id);
  return {
    state: { doneIds: [...state.doneIds, id], rewardedIds: reward ? [...state.rewardedIds, id] : state.rewardedIds },
    reward,
  };
}

interface HabitLike {
  id: string;
  title: string;
  type: string;
  completed?: boolean;
}

/** Снимок привычек дня для Big Data: привычки (по касаниям) и ежедневные (по галочке) */
export function habitSnapshot(doneIds: string[], tasks: HabitLike[]): { habitsDone: number; habitsTotal: number; habitsMissed: string[] } {
  const list = tasks.filter((t) => t.type === 'habit' || t.type === 'daily');
  const done = (t: HabitLike) => (t.type === 'habit' ? doneIds.includes(t.id) : !!t.completed);
  return {
    habitsDone: list.filter(done).length,
    habitsTotal: list.length,
    habitsMissed: list.filter((t) => !done(t)).map((t) => t.title),
  };
}

// ─── Хранилище ───────────────────────────────────────────────────────────────

/** Дописать поля в день (остальные поля дня сохраняются) */
export function patchDay(date: string, patch: Partial<BigDataDay>) {
  const cur = store.get<BigDataDay>('bigdata_days', date);
  const next = { ...(cur ?? {}), ...patch, date } as BigDataDay;
  if (cur && JSON.stringify(cur) === JSON.stringify(next)) return;
  store.upsert('bigdata_days', next);
}

export function useBigDataDays(): BigDataDay[] {
  return useCollection<BigDataDay>('bigdata_days').items;
}

export function useBigDataSettings(): { settings: BigDataSettings; save: (next: BigDataSettings) => void } {
  const { value, save } = useRecord<BigDataSettings & { seed?: boolean }>('bigdata_config');
  const settings = useMemo(() => normalizeConfig(value), [value]);
  const saveAll = useCallback((next: BigDataSettings) => save({ ...next, seed: false }), [save]);
  return { settings, save: saveAll };
}

/** Привычки сегодня одним касанием; отметки и снимок пишутся в день Big Data */
export function useHabitDay(tasks: HabitLike[], date: string = todayStr()) {
  const { value } = useRecord<BigDataDay>('bigdata_days', date);
  const state: HabitDayState = useMemo(
    () => ({
      doneIds: Array.isArray(value?.habitsDoneIds) ? (value?.habitsDoneIds as string[]) : [],
      rewardedIds: Array.isArray(value?.habitsRewardedIds) ? (value?.habitsRewardedIds as string[]) : [],
    }),
    [value],
  );

  const tap = useCallback(
    (id: string): boolean => {
      const r = tapHabit(state, id);
      patchDay(date, { habitsDoneIds: r.state.doneIds, habitsRewardedIds: r.state.rewardedIds, ...habitSnapshot(r.state.doneIds, tasks) });
      return r.reward;
    },
    [state, tasks, date],
  );

  /** Обновить снимок (ежедневные отметили/сняли, привычку добавили) — только если день уже начат */
  const syncSnapshot = useCallback(() => {
    if (!value) return;
    const snap = habitSnapshot(state.doneIds, tasks);
    if (
      value.habitsDone !== snap.habitsDone ||
      value.habitsTotal !== snap.habitsTotal ||
      JSON.stringify(value.habitsMissed ?? []) !== JSON.stringify(snap.habitsMissed)
    ) {
      patchDay(date, snap);
    }
  }, [value, state, tasks, date]);

  return { doneIds: state.doneIds, tap, syncSnapshot };
}

/** Часы фокуса дня из сессий таймера (focus_sessions), мин */
export function focusMinutesByDate(sessions: { date?: string; minutes?: number; mode?: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    if (!s?.date || s.mode === 'break') continue;
    m.set(s.date, (m.get(s.date) ?? 0) + (Number(s.minutes) || 0));
  }
  return m;
}

/** Старый формат дня (для Sleep Cycle CSV) */
export function toLegacyEntries(cells: MonthCell[]): DailyLogEntry[] {
  return cells.map((c) => ({
    day: c.dayNum,
    dayOfWeek: c.weekday,
    sleep: c.day?.sleepMin ? `${Math.floor(c.day.sleepMin / 60)}ч ${c.day.sleepMin % 60}м` : '',
    sleepMinutes: c.day?.sleepMin ?? 0,
    sleepQualityPercent: c.day?.sleepQuality,
    supplements: (c.day?.supplements ?? []).join(', '),
    score: c.day?.score ?? null,
    why: c.day?.why ?? '',
    tags: c.day?.tags ?? [],
    dateStr: c.date,
    isAutoSynced: false,
  }));
}
