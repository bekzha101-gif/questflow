// Аналитика Big Data: дельта оценки дня, причины спада, факторы влияния.
// Чистый модуль без React, DOM и сети: общий для сайта и сервера (собирается сервером в strict CommonJS).
// Даты — строки YYYY-MM-DD по Бишкеку (см. shared/time.ts).
import { addDays } from './time';

/** Тип настраиваемого критерия дня: число, да/нет, шкала 1–10, текст */
export type CriterionType = 'number' | 'boolean' | 'scale' | 'text';

/** Свой критерий дня (bigdata_config.criteria). Значение дня — в BigDataDay.criteria[id] */
export interface BigDataCriterion {
  id: string;
  label: string;
  type: CriterionType;
  unit?: string;
}

/** День Big Data так, как его читает аналитика (подмножество строки bigdata_days) */
export interface BigDataDayInput {
  date: string;
  score?: number | null;
  sleepMin?: number | null;
  sleepQuality?: number | null;
  /** Названия выпитых БАДов (null/undefined — не отмечались) */
  supplements?: string[] | null;
  /** Сферы дня (метки как текст: старые метки в старых днях остаются как есть) */
  tags?: string[] | null;
  waterOk?: boolean | null;
  focusMin?: number | null;
  /** Привычки, не отмеченные в этот день (подставляются сами со «Сегодня») */
  habitsMissed?: string[] | null;
  habitsDone?: number | null;
  habitsTotal?: number | null;
  criteria?: Record<string, unknown> | null;
  [extra: string]: unknown;
}

export interface BigDataAnalysisConfig {
  supplements?: { name: string }[];
  spheres?: { label: string }[];
  criteria?: BigDataCriterion[];
  /** Норма фокуса за день, мин (по умолчанию 6 ч) */
  focusNormMin?: number;
}

export type ReasonKind =
  | 'sleep_low'
  | 'sleep_quality_low'
  | 'new_supplement'
  | 'supplement_skipped'
  | 'habit_missed'
  | 'focus_low'
  | 'water_missed';

export interface Reason {
  kind: ReasonKind;
  /** Готовая подпись по-русски */
  label: string;
}

export type FactorStrength = 'weak' | 'medium' | 'strong';

export interface Factor {
  id: string;
  label: string;
  kind: 'sleep' | 'supplement' | 'water' | 'focus' | 'habits' | 'sphere' | 'criterion';
  /** Насколько выше средняя оценка дня с фактором, чем без него (баллы, может быть < 0) */
  effect: number;
  strength: FactorStrength;
  withAvg: number;
  withoutAvg: number;
  nWith: number;
  nWithout: number;
  /** Объяснение по-русски */
  text: string;
}

/** Спад — оценка ниже среднего прошлых дней на столько баллов и больше */
export const DROP_THRESHOLD = 1.5;
/** Сколько прошлых дней с оценкой берём за «обычный уровень» */
export const BASELINE_DAYS = 7;
/** Минимум дней с оценкой для блока «Что на тебя влияет» */
export const MIN_INFLUENCE_DAYS = 14;
/** Минимум дней в каждой группе (с фактором и без), чтобы говорить о влиянии */
const MIN_GROUP = 3;
const SLEEP_GOOD_MIN = 420;
const FOCUS_NORM_MIN = 360;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Часы и минуты для подписи: 320 → «5ч 20м» */
export function formatSleep(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}ч ${String(m % 60).padStart(2, '0')}м`;
}

function sorted(days: BigDataDayInput[]): BigDataDayInput[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function scoreOf(d: BigDataDayInput | undefined): number | null {
  return d && isNum(d.score) ? d.score : null;
}

/** Последние BASELINE_DAYS дней до даты, в которых есть оценка */
function baselineScored(days: BigDataDayInput[], date: string): BigDataDayInput[] {
  return sorted(days)
    .filter((d) => d.date < date && scoreOf(d) !== null)
    .slice(-BASELINE_DAYS);
}

/** Дни до даты за последние 14 календарных дней (с любыми данными) — «обычная жизнь» */
function recentBefore(days: BigDataDayInput[], date: string, span = 14): BigDataDayInput[] {
  const from = addDays(date, -span);
  return sorted(days).filter((d) => d.date < date && d.date >= from);
}

/**
 * Дельта оценки дня: оценка минус среднее последних 7 прошлых дней с оценкой.
 * null — у дня нет оценки или нет прошлых дней для сравнения.
 */
export function dayDelta(days: BigDataDayInput[], date: string): number | null {
  const day = days.find((d) => d.date === date);
  const score = scoreOf(day);
  if (score === null) return null;
  const base = baselineScored(days, date);
  if (!base.length) return null;
  return score - avg(base.map((d) => d.score as number));
}

/** День-спад: оценка упала на DROP_THRESHOLD и больше относительно обычного уровня */
export function isDropDay(days: BigDataDayInput[], date: string): boolean {
  const d = dayDelta(days, date);
  return d !== null && d <= -DROP_THRESHOLD;
}

/**
 * Почему день такой: сравнение дня с прошлыми днями. Только то, что видно в данных,
 * без выдумок: нет истории — нет сравнительных причин.
 */
export function explainDrop(days: BigDataDayInput[], date: string, cfg: BigDataAnalysisConfig): Reason[] {
  const day = days.find((d) => d.date === date);
  if (!day) return [];
  const prev = recentBefore(days, date);
  const reasons: Reason[] = [];

  // Сон ниже среднего
  const prevSleep = prev.map((d) => d.sleepMin).filter(isNum).filter((x) => x > 0);
  if (isNum(day.sleepMin) && day.sleepMin > 0 && prevSleep.length) {
    const base = avg(prevSleep);
    if (day.sleepMin <= base - 30) {
      reasons.push({ kind: 'sleep_low', label: `Сон ${formatSleep(day.sleepMin)} — ниже среднего (${formatSleep(base)})` });
    }
  }
  const prevQ = prev.map((d) => d.sleepQuality).filter(isNum);
  if (isNum(day.sleepQuality) && prevQ.length) {
    const base = avg(prevQ);
    if (day.sleepQuality <= base - 10) {
      reasons.push({ kind: 'sleep_quality_low', label: `Качество сна ${Math.round(day.sleepQuality)}% (обычно ${Math.round(base)}%)` });
    }
  }

  // БАДы: новый и пропущенный обычный
  const prevSupp = recentBefore(days, date, 30).filter((d) => Array.isArray(d.supplements));
  if (Array.isArray(day.supplements) && prevSupp.length) {
    const seen = new Set(prevSupp.flatMap((d) => d.supplements as string[]));
    for (const s of day.supplements) {
      if (!seen.has(s)) reasons.push({ kind: 'new_supplement', label: `Новый БАД: ${s}` });
    }
    const recent = prev.filter((d) => Array.isArray(d.supplements));
    if (recent.length >= 3) {
      const counts = new Map<string, number>();
      for (const d of recent) for (const s of new Set(d.supplements as string[])) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (const [s, n] of counts) {
        if (n / recent.length >= 0.7 && !day.supplements.includes(s)) {
          reasons.push({ kind: 'supplement_skipped', label: `Пропущен БАД: ${s}` });
        }
      }
    }
  }

  // Пропущенные привычки — факт дня
  for (const h of day.habitsMissed ?? []) reasons.push({ kind: 'habit_missed', label: `Пропущена привычка: ${h}` });

  // Мало фокуса
  if (isNum(day.focusMin)) {
    const prevFocus = prev.map((d) => d.focusMin).filter(isNum);
    const norm = cfg.focusNormMin ?? FOCUS_NORM_MIN;
    if (prevFocus.length) {
      const base = avg(prevFocus);
      if (day.focusMin <= base - 60) {
        reasons.push({ kind: 'focus_low', label: `Мало фокуса: ${formatSleep(day.focusMin)} (обычно ${formatSleep(base)})` });
      }
    } else if (day.focusMin < norm / 2) {
      reasons.push({ kind: 'focus_low', label: `Мало фокуса: ${formatSleep(day.focusMin)} при норме ${formatSleep(norm)}` });
    }
  }

  // Вода: обычно пьёт 2 л, а в этот день нет
  if (day.waterOk === false) {
    const w = prev.filter((d) => typeof d.waterOk === 'boolean');
    if (w.length && w.filter((d) => d.waterOk).length / w.length >= 0.5) {
      reasons.push({ kind: 'water_missed', label: 'Не выпил 2 л воды' });
    }
  }

  return reasons;
}

function strengthOf(effect: number): FactorStrength | null {
  const a = Math.abs(effect);
  if (a >= 1.5) return 'strong';
  if (a >= 0.75) return 'medium';
  if (a >= 0.3) return 'weak';
  return null;
}

type Split = (d: BigDataDayInput) => boolean | null;

/**
 * Что влияет на оценку дня: для каждого фактора сравниваются дни «с ним» и «без него».
 * Меньше minDays дней с оценкой — 'not_enough_data' (честно, без выводов).
 */
export function influenceFactors(
  days: BigDataDayInput[],
  cfg: BigDataAnalysisConfig,
  minDays = MIN_INFLUENCE_DAYS,
): Factor[] | 'not_enough_data' {
  const scored = days.filter((d) => scoreOf(d) !== null);
  if (scored.length < minDays) return 'not_enough_data';

  const candidates: { id: string; label: string; kind: Factor['kind']; split: Split; phrase: string }[] = [
    { id: 'sleep_7h', label: 'Сон 7+ ч', kind: 'sleep', phrase: 'сон 7+ ч', split: (d) => (isNum(d.sleepMin) && d.sleepMin > 0 ? d.sleepMin >= SLEEP_GOOD_MIN : null) },
    { id: 'sleep_quality', label: 'Качество сна 80%+', kind: 'sleep', phrase: 'качество сна 80%+', split: (d) => (isNum(d.sleepQuality) ? d.sleepQuality >= 80 : null) },
    { id: 'water', label: 'Вода 2 л', kind: 'water', phrase: 'выпиты 2 л воды', split: (d) => (typeof d.waterOk === 'boolean' ? d.waterOk : null) },
    { id: 'focus', label: 'Фокус 4+ ч', kind: 'focus', phrase: 'фокус 4+ ч', split: (d) => (isNum(d.focusMin) ? d.focusMin >= 240 : null) },
    {
      id: 'habits_all',
      label: 'Все привычки отмечены',
      kind: 'habits',
      phrase: 'все привычки отмечены',
      split: (d) => (Array.isArray(d.habitsMissed) && (isNum(d.habitsTotal) ? d.habitsTotal > 0 : true) ? d.habitsMissed.length === 0 : null),
    },
  ];

  const suppNames = new Set<string>((cfg.supplements ?? []).map((s) => s.name));
  for (const d of scored) for (const s of d.supplements ?? []) suppNames.add(s);
  for (const name of suppNames) {
    candidates.push({
      id: `supplement:${name}`,
      label: name,
      kind: 'supplement',
      phrase: `пил ${name}`,
      split: (d) => (Array.isArray(d.supplements) ? d.supplements.includes(name) : null),
    });
  }

  const sphereLabels = new Set<string>((cfg.spheres ?? []).map((s) => s.label));
  for (const label of sphereLabels) {
    candidates.push({
      id: `sphere:${label}`,
      label,
      kind: 'sphere',
      phrase: `в дне есть ${label}`,
      split: (d) => (Array.isArray(d.tags) ? d.tags.includes(label) : null),
    });
  }

  for (const c of cfg.criteria ?? []) {
    if (c.type === 'boolean') {
      candidates.push({
        id: `criterion:${c.id}`,
        label: c.label,
        kind: 'criterion',
        phrase: `«${c.label}» — да`,
        split: (d) => {
          const v = d.criteria?.[c.id];
          return typeof v === 'boolean' ? v : null;
        },
      });
    } else if (c.type === 'number' || c.type === 'scale') {
      const vals = scored.map((d) => d.criteria?.[c.id]).filter(isNum).sort((a, b) => a - b);
      if (!vals.length) continue;
      const median = vals[Math.floor(vals.length / 2)];
      candidates.push({
        id: `criterion:${c.id}`,
        label: `${c.label} ≥ ${median}${c.unit ? ` ${c.unit}` : ''}`,
        kind: 'criterion',
        phrase: `«${c.label}» ≥ ${median}`,
        split: (d) => {
          const v = d.criteria?.[c.id];
          return isNum(v) ? v >= median : null;
        },
      });
    }
  }

  const factors: Factor[] = [];
  for (const c of candidates) {
    const yes: number[] = [];
    const no: number[] = [];
    for (const d of scored) {
      const s = c.split(d);
      if (s === true) yes.push(d.score as number);
      else if (s === false) no.push(d.score as number);
    }
    if (yes.length < MIN_GROUP || no.length < MIN_GROUP) continue;
    const withAvg = avg(yes);
    const withoutAvg = avg(no);
    const effect = withAvg - withoutAvg;
    const strength = strengthOf(effect);
    if (!strength) continue;
    const dir = effect > 0 ? 'выше' : 'ниже';
    factors.push({
      id: c.id,
      label: c.label,
      kind: c.kind,
      effect,
      strength,
      withAvg,
      withoutAvg,
      nWith: yes.length,
      nWithout: no.length,
      text: `Когда ${c.phrase}, оценка дня в среднем ${dir} на ${round1(Math.abs(effect))} (${round1(withAvg)} против ${round1(withoutAvg)}; дней ${yes.length} и ${no.length})`,
    });
  }
  return factors.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

// ─── Месяцы ──────────────────────────────────────────────────────────────────

/** Все даты месяца 'YYYY-MM' по порядку */
export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= count; d++) out.push(`${month}-${String(d).padStart(2, '0')}`);
  return out;
}

/** Сдвиг месяца 'YYYY-MM' на n */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
