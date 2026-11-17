// Геймификация QuestFlow 2.0: одна таблица правил и одна функция применения события.
// Модуль чистый: без React, DOM и сети; время приходит аргументом (ctx.now) — общий для сайта и бота.
// Каждое событие даёт строку журнала game_events с id `${kind}:${ref}`: повтор того же ref ничего не начисляет.
// Числа, которых нет в брифе, — стартовые значения (правятся здесь, в одной таблице).
import type { GameEvent, GameStats } from './types';
import { addDays, bishkekHM, isRecoveryDay, monthKey, todayStr } from './time';

// ─── Таблица правил ──────────────────────────────────────────────────────────
export const RULES = {
  /** Золото — в основном за часы фокуса (как blockReward в shared/timer) */
  focus: { expPerMin: 1.5, goldPerMin: 0.8, fullBlockExp: 50, fullBlockGold: 25 },
  habit: { exp: 20, gold: 10 },
  daily: { exp: 25, gold: 15 },
  task: { exp: 35, gold: 20 },
  /** Вредная привычка (минус на привычке) */
  badHabit: { hp: -15 },
  videoPublished: { exp: 75, gold: 50 },
  goalWeek: { exp: 150, gold: 100 },
  goalMonth: { exp: 500, gold: 300 },
  /** Одна активность пятницы (баня, прогулка, медитация, растяжка) */
  recoveryActivity: { exp: 40, gold: 15, hp: 25 },
  /** Пятница соблюдена (CLAUDE.md п.6: +100 HP, +150 EXP, +50 золота) */
  recoveryDay: { exp: 150, gold: 50, hp: 100, minActivities: 2 },
  bigdataFill: { exp: 20, gold: 15 },
  healthPenalty: { hp: -10 },
  healthRecoveryMaxHp: 30,
  /** Каждые полные $100 дохода */
  incomeExpPer100: 100,
  achievement: { exp: 200, gold: 100 },
  levelUp: { gold: 50, maxExpGrowth: 1.3 },
  /** Норма дня: 3 блока по 120 мин (6 ч) */
  norm: { blocks: 3, focusMin: 360 },
  /** Норма не выполнена (кроме пятницы) */
  missedNorm: { hp: -30, gold: -50 },
  /** Вечерний разговор пропущен после напоминания */
  eveningMissed: { hp: -15 },
  eveningReminder: { h: 22, m: 0 },
  /** HP 0: сгорает доля золота, прогресс уровня в 0, HP восстанавливается до доли максимума */
  hpZero: { goldBurnPct: 0.5, hpRestorePct: 0.5 },
  /** Сколько пропущенных дней максимум закрывается задним числом */
  maxCatchUpDays: 14,
} as const;

// ─── Ачивки ──────────────────────────────────────────────────────────────────
export type AchievementId =
  | 'first_6h_day'
  | 'streak_7'
  | 'streak_30'
  | 'videos_100'
  | 'channels_40'
  | 'income_1000'
  | 'friday_month';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_6h_day', title: 'Первый день 6 часов', description: '6 часов фокуса за один день' },
  { id: 'streak_7', title: '7 дней подряд', description: 'Серия 7 полных дней' },
  { id: 'streak_30', title: '30 дней подряд', description: 'Серия 30 полных дней' },
  { id: 'videos_100', title: '100 видео', description: 'Опубликовано 100 видео' },
  { id: 'channels_40', title: '40 каналов', description: '40 работающих каналов' },
  { id: 'income_1000', title: 'Первые $1000', description: 'Доход с каналов достиг $1000' },
  { id: 'friday_month', title: 'Месяц без пропуска пятницы', description: 'Все пятницы месяца — восстановление' },
];

// ─── Входные события ─────────────────────────────────────────────────────────
/** Факты закрытого дня: что было сделано */
export interface DayFacts {
  date: string;
  /** Минуты фокуса за день */
  focusMin: number;
  /** Полных блоков (по 120 мин) */
  blocks: number;
  /** Привычки и ежедневные: выполнено / всего */
  habitsDone: number;
  habitsTotal: number;
  /** Активностей восстановления (для пятницы) */
  recoveryDone?: number;
}

export type GameEventInput =
  | { kind: 'focus_block'; ref: string; minutes: number; full: boolean }
  | { kind: 'habit' | 'daily' | 'task' | 'bad_habit'; ref: string }
  | { kind: 'video_published' | 'goal_week' | 'goal_month'; ref: string }
  | { kind: 'recovery_activity' | 'bigdata_fill' | 'health_penalty'; ref: string }
  | { kind: 'health_recovery'; ref: string; hp: number }
  | { kind: 'income'; ref: string; amountUsd: number }
  | { kind: 'day_close'; day: DayFacts }
  | { kind: 'evening_missed'; ref: string }
  | { kind: 'purchase'; ref: string; cost: number }
  /** Старые места с готовыми числами (вне модуля); пишется в журнал как есть */
  | { kind: 'bonus'; ref: string; exp?: number; gold?: number; hp?: number; note?: string }
  /** Только проверка ачивок по фактам (каналы и т.п.), без строки журнала */
  | { kind: 'check' };

export type GameEventKind = GameEventInput['kind'];

export interface AchievementFacts {
  publishedVideos?: number;
  activeChannels?: number;
}

export interface ApplyContext {
  now: Date;
  /** Журнал game_events (для защиты от повтора и ачивок) */
  journal?: readonly GameEvent[];
  /** Уже открытые ачивки */
  unlocked?: readonly string[];
  facts?: AchievementFacts;
}

export type DayOutcome = 'norm' | 'missed' | 'recovery';

export interface ApplyResult {
  stats: GameStats;
  /** Новые строки журнала (основная + повышение уровня, HP 0, ачивки) */
  events: GameEvent[];
  unlocked: AchievementId[];
  applied: boolean;
  rejected?: 'duplicate' | 'shop_locked' | 'not_enough_gold';
  leveledUp: number;
  hpZero: boolean;
}

// ─── Простые правила ─────────────────────────────────────────────────────────
/** Награда за блок фокуса */
export function focusReward(minutes: number, full: boolean): { exp: number; gold: number } {
  const m = Math.max(0, minutes);
  return {
    exp: Math.round(m * RULES.focus.expPerMin) + (full ? RULES.focus.fullBlockExp : 0),
    gold: Math.round(m * RULES.focus.goldPerMin) + (full ? RULES.focus.fullBlockGold : 0),
  };
}

/** Итог дня: пятница — восстановление; 3 блока или 6 ч — норма; иначе пропуск */
export function dayOutcome(day: DayFacts): DayOutcome {
  if (isRecoveryDay(day.date)) return 'recovery';
  if (day.blocks >= RULES.norm.blocks || day.focusMin >= RULES.norm.focusMin) return 'norm';
  return 'missed';
}

/** Полный день: норма и все привычки */
export function isFullDay(day: DayFacts): boolean {
  return dayOutcome(day) === 'norm' && day.habitsDone >= day.habitsTotal;
}

/** Магазин закрыт после HP 0 — до первого полного дня */
export function shopLocked(stats: GameStats): boolean {
  return stats.shopLocked === true;
}

/** Прогресс уровня в процентах */
export function levelProgress(stats: GameStats): number {
  if (!(stats.maxExp > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((stats.exp / stats.maxExp) * 100)));
}

/** Начало действия правил: до этой даты дни не закрываются (не штрафуем прошлое) */
export function withRulesStart(stats: GameStats, today: string): GameStats {
  return typeof stats.rulesSince === 'string' ? stats : { ...stats, rulesSince: today };
}

/** Даты, которые пора закрыть (итог дня), от первой незакрытой до вчера, не больше maxCatchUpDays */
export function pendingDayCloses(stats: GameStats, today: string): string[] {
  const since = typeof stats.rulesSince === 'string' ? stats.rulesSince : null;
  const last = typeof stats.lastClosedDate === 'string' ? stats.lastClosedDate : null;
  let start = last ? addDays(last, 1) : since;
  if (!start) return [];
  if (since && start < since) start = since;
  const out: string[] = [];
  for (let d = start; d < today; d = addDays(d, 1)) out.push(d);
  return out.slice(-RULES.maxCatchUpDays);
}

/** Вечернее напоминание (22:00) пора слать: не пятница, ответа нет, напоминания не было */
export function eveningReminderDue(now: Date, s: { answered: boolean; reminded: boolean }, date?: string): boolean {
  const { h, m } = bishkekHM(now);
  const day = date ?? todayStr(now);
  if (isRecoveryDay(day) || s.answered || s.reminded) return false;
  return h * 60 + m >= RULES.eveningReminder.h * 60 + RULES.eveningReminder.m;
}

/** Событие «вечерний разговор пропущен» за дату; в пятницу штрафа нет */
export function eveningMissedEvent(date: string): GameEventInput | null {
  return isRecoveryDay(date) ? null : { kind: 'evening_missed', ref: date };
}

/** Событие итога дня */
export function dayCloseEvent(day: DayFacts): GameEventInput {
  return { kind: 'day_close', day };
}

// ─── Применение события ──────────────────────────────────────────────────────
function normalize(s: GameStats): GameStats {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    ...s,
    level: Math.max(1, num(s.level, 1)),
    exp: Math.max(0, num(s.exp, 0)),
    maxExp: Math.max(1, num(s.maxExp, 100)),
    hp: num(s.hp, 100),
    maxHp: Math.max(1, num(s.maxHp, 100)),
    gold: Math.max(0, num(s.gold, 0)),
    streak: Math.max(0, num(s.streak, 0)),
  };
}

function eventRef(ev: GameEventInput): string | null {
  if (ev.kind === 'check') return null;
  if (ev.kind === 'day_close') return ev.day.date;
  return ev.ref;
}

/** Все пятницы месяца */
function fridaysOf(month: string): string[] {
  const out: string[] = [];
  for (let d = `${month}-01`; monthKey(d) === month; d = addDays(d, 1)) if (isRecoveryDay(d)) out.push(d);
  return out;
}

interface Delta {
  exp: number;
  gold: number;
  hp: number;
  note?: string;
}

/**
 * Применить событие к статам. Чистая функция: ничего не пишет, возвращает новые статы и строки журнала.
 * Повтор (тот же kind и ref уже в журнале) — applied=false, статы без изменений.
 */
export function applyEvent(statsIn: GameStats, ev: GameEventInput, ctx: ApplyContext): ApplyResult {
  const stats = normalize(statsIn);
  const at = ctx.now.toISOString();
  const journal = ctx.journal ?? [];
  const ref = eventRef(ev);
  const mainId = ref === null ? null : `${ev.kind}:${ref}`;
  const reject = (why: ApplyResult['rejected']): ApplyResult => ({
    stats: statsIn,
    events: [],
    unlocked: [],
    applied: false,
    rejected: why,
    leveledUp: 0,
    hpZero: false,
  });

  if (mainId && journal.some((e) => e.id === mainId)) return reject('duplicate');

  const next: GameStats = { ...stats };
  const delta: Delta = { exp: 0, gold: 0, hp: 0 };
  const add = (r: { exp?: number; gold?: number; hp?: number }) => {
    delta.exp += r.exp ?? 0;
    delta.gold += r.gold ?? 0;
    delta.hp += r.hp ?? 0;
  };
  let first6h = false;

  switch (ev.kind) {
    case 'focus_block':
      add(focusReward(ev.minutes, ev.full));
      break;
    case 'habit':
      add(RULES.habit);
      break;
    case 'daily':
      add(RULES.daily);
      break;
    case 'task':
      add(RULES.task);
      break;
    case 'bad_habit':
      add(RULES.badHabit);
      break;
    case 'video_published':
      add(RULES.videoPublished);
      break;
    case 'goal_week':
      add(RULES.goalWeek);
      break;
    case 'goal_month':
      add(RULES.goalMonth);
      break;
    case 'recovery_activity':
      add(RULES.recoveryActivity);
      break;
    case 'bigdata_fill':
      add(RULES.bigdataFill);
      break;
    case 'health_penalty':
      add(RULES.healthPenalty);
      break;
    case 'health_recovery':
      add({ hp: Math.min(RULES.healthRecoveryMaxHp, Math.max(0, Math.round(ev.hp))) });
      break;
    case 'evening_missed':
      add(RULES.eveningMissed);
      break;
    case 'bonus':
      add({ exp: Math.max(0, ev.exp ?? 0), gold: Math.max(0, ev.gold ?? 0), hp: ev.hp ?? 0 });
      delta.note = ev.note;
      break;
    case 'income': {
      const prevTotal = typeof stats.incomeUsdTotal === 'number' ? stats.incomeUsdTotal : 0;
      const total = Math.round((prevTotal + ev.amountUsd) * 100) / 100;
      const paid = typeof stats.incomeHundredsPaid === 'number' ? stats.incomeHundredsPaid : Math.floor(prevTotal / 100);
      const hundreds = Math.max(paid, Math.floor(total / 100));
      next.incomeUsdTotal = total;
      next.incomeHundredsPaid = hundreds;
      add({ exp: (hundreds - paid) * RULES.incomeExpPer100 });
      break;
    }
    case 'purchase':
      if (shopLocked(stats)) return reject('shop_locked');
      if (stats.gold < ev.cost) return reject('not_enough_gold');
      add({ gold: -Math.max(0, ev.cost) });
      break;
    case 'day_close': {
      const day = ev.day;
      const outcome = dayOutcome(day);
      if (outcome === 'recovery') {
        const done = (day.recoveryDone ?? 0) >= RULES.recoveryDay.minActivities;
        if (done) add(RULES.recoveryDay);
        delta.note = done ? 'recovery_done' : 'recovery';
      } else if (outcome === 'norm') {
        if (isFullDay(day)) {
          next.streak = stats.streak + 1;
          next.shopLocked = false;
          delta.note = 'full';
        } else {
          next.streak = 0;
          delta.note = 'norm';
        }
      } else {
        add(RULES.missedNorm);
        next.streak = 0;
        delta.note = 'missed';
      }
      next.bestStreak = Math.max(typeof stats.bestStreak === 'number' ? stats.bestStreak : 0, next.streak);
      const last = typeof stats.lastClosedDate === 'string' ? stats.lastClosedDate : '';
      next.lastClosedDate = day.date > last ? day.date : last;
      first6h = day.focusMin >= RULES.norm.focusMin;
      break;
    }
    case 'check':
      break;
  }

  const events: GameEvent[] = [];
  const mainEvent: GameEvent | null = mainId
    ? { id: mainId, at, kind: ev.kind, ref: ref ?? undefined, deltaExp: 0, deltaGold: 0, deltaHp: 0, ...(delta.note ? { note: delta.note } : {}) }
    : null;
  if (mainEvent) events.push(mainEvent);

  // Применение чисел с учётом границ; итоговые изменения пишутся в строку журнала
  const applyDelta = (d: { exp: number; gold: number; hp: number }, row: GameEvent | null, tag: string) => {
    const goldBefore = next.gold;
    const hpBefore = next.hp;
    next.gold = Math.max(0, next.gold + d.gold);
    next.hp = Math.min(next.maxHp, Math.max(0, next.hp + d.hp));
    next.exp = Math.max(0, next.exp + d.exp);
    if (row) {
      row.deltaExp = (row.deltaExp ?? 0) + d.exp;
      row.deltaGold = (row.deltaGold ?? 0) + (next.gold - goldBefore);
      row.deltaHp = (row.deltaHp ?? 0) + (next.hp - hpBefore);
    }
    return levelUps(tag);
  };

  let leveledUp = 0;
  const levelUps = (tag: string): void => {
    while (next.exp >= next.maxExp) {
      next.exp -= next.maxExp;
      next.level += 1;
      next.maxExp = Math.round(next.maxExp * RULES.levelUp.maxExpGrowth);
      leveledUp += 1;
      const hpBefore = next.hp;
      next.hp = next.maxHp;
      next.gold += RULES.levelUp.gold;
      events.push({ id: `level_up:${next.level}:${tag}`, at, kind: 'level_up', ref: String(next.level), deltaGold: RULES.levelUp.gold, deltaHp: next.hp - hpBefore, deltaExp: 0 });
    }
  };

  applyDelta(delta, mainEvent, mainId ?? 'check');

  // HP 0: сгорает часть золота, прогресс уровня (не уровень) в 0, серия 0, магазин закрыт
  let hpZero = false;
  if (next.hp <= 0) {
    hpZero = true;
    const burned = Math.round(next.gold * RULES.hpZero.goldBurnPct);
    const expLost = next.exp;
    next.gold -= burned;
    next.exp = 0;
    next.streak = 0;
    next.shopLocked = true;
    next.hp = Math.max(1, Math.round(next.maxHp * RULES.hpZero.hpRestorePct));
    events.push({ id: `hp_zero:${mainId ?? at}`, at, kind: 'hp_zero', ref: mainId ?? undefined, deltaGold: -burned, deltaExp: -expLost, deltaHp: next.hp, note: 'HP 0' });
  }

  // Ачивки по фактам
  const have = new Set(ctx.unlocked ?? []);
  const unlocked: AchievementId[] = [];
  const unlock = (id: AchievementId, cond: boolean) => {
    if (cond && !have.has(id) && !unlocked.includes(id)) unlocked.push(id);
  };
  const journalVideos = journal.filter((e) => e.kind === 'video_published').length + (ev.kind === 'video_published' ? 1 : 0);
  unlock('first_6h_day', first6h);
  unlock('streak_7', next.streak >= 7);
  unlock('streak_30', next.streak >= 30);
  unlock('videos_100', Math.max(journalVideos, ctx.facts?.publishedVideos ?? 0) >= 100);
  unlock('channels_40', (ctx.facts?.activeChannels ?? 0) >= 40);
  unlock('income_1000', (typeof next.incomeUsdTotal === 'number' ? next.incomeUsdTotal : 0) >= 1000);
  if (ev.kind === 'day_close' && delta.note === 'recovery_done') {
    const month = monthKey(ev.day.date);
    const fridays = fridaysOf(month);
    const isLast = fridays[fridays.length - 1] === ev.day.date;
    const okDates = new Set(journal.filter((e) => e.kind === 'day_close' && e.note === 'recovery_done').map((e) => e.ref));
    okDates.add(ev.day.date);
    unlock('friday_month', isLast && fridays.every((d) => okDates.has(d)));
  }
  for (const id of unlocked) {
    const row: GameEvent = { id: `achievement:${id}`, at, kind: 'achievement', ref: id, deltaExp: 0, deltaGold: 0, deltaHp: 0 };
    events.push(row);
    applyDelta({ exp: RULES.achievement.exp, gold: RULES.achievement.gold, hp: 0 }, row, `achievement:${id}`);
  }

  if (!mainEvent && events.length === 0) {
    return { stats: statsIn, events: [], unlocked: [], applied: false, leveledUp: 0, hpZero: false };
  }
  return { stats: next, events, unlocked, applied: true, leveledUp, hpZero };
}
