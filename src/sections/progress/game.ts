// Геймификация на сайте: единственное место, где события превращаются в статы, журнал и ачивки.
// Правила — shared/gamification (их же зовёт бот). Здесь только чтение/запись через src/store.
// Статы читаются из хранилища в момент события (не из замыкания React), поэтому две награды подряд не теряются.
import { store as defaultStore, type Store } from '../../store';
import {
  applyEvent,
  dayCloseEvent,
  pendingDayCloses,
  withRulesStart,
  type AchievementFacts,
  type ApplyResult,
  type DayFacts,
  type GameEventInput,
} from '@shared/gamification';
import type { AchievementRow, BigDataDay, Channel, FocusSession, GameEvent, GameStats, Goal, GoalWeek, Video } from '@shared/types';
import { isRecoveryDay, monthKey, todayStr } from '@shared/time';
import { WORK_MIN } from '@shared/timer';
import { currentWeekIndex, goalPct, weeksFor } from '@shared/goals';
import { initialStats } from '../../data/initialData';
import { isWorkSessionOf } from '../today/daySummary';

/** Событие окна после применённого события: detail — ApplyResult (уровень, HP 0, ачивки) */
export const GAME_EVENT = 'questflow:game';

const FALLBACK = initialStats as unknown as GameStats;

export interface GameOptions {
  store?: Store;
  now?: Date;
  facts?: AchievementFacts;
  /** Автозапись (итоги дней и т.п.), а не действие пользователя: см. Store.writeRecord */
  auto?: boolean;
}

function readStats(s: Store): GameStats {
  return s.get<GameStats>('game_stats', 'me') ?? FALLBACK;
}

function writeStats(s: Store, next: GameStats, auto: boolean) {
  // Автозапись: пока облако не прочитано и записи нет, строка получает старую метку и не перебьёт облако.
  // Действие пользователя пишется с обычной меткой.
  s.writeRecord<GameStats>('game_stats', FALLBACK, () => next, 'me', (v) => v, { auto });
}

/** Применить событие по правилам и записать результат: статы, строки game_events, achievements */
export function applyGame(input: GameEventInput, opts: GameOptions = {}): ApplyResult {
  const s = opts.store ?? defaultStore;
  const now = opts.now ?? new Date();
  const r = applyEvent(readStats(s), input, {
    now,
    journal: s.items<GameEvent>('game_events'),
    unlocked: s.items<AchievementRow>('achievements').map((a) => a.id),
    facts: opts.facts ?? factsOf(s),
  });
  if (!r.applied) return r;
  writeStats(s, r.stats, opts.auto === true);
  for (const e of r.events) s.upsert('game_events', e);
  for (const id of r.unlocked) s.upsert('achievements', { id, unlockedAt: now.toISOString() });
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GAME_EVENT, { detail: r }));
  }
  return r;
}

/**
 * «Сбросить прогресс»: только статы (уровень, EXP, золото, HP) — как обещает окно подтверждения.
 * Задачи, награды, журнал и прочие таблицы не трогаются (они в облаке и у бота).
 */
export function resetGameStats(fresh: object, opts: GameOptions = {}) {
  const s = opts.store ?? defaultStore;
  s.writeRecord<object>('game_stats', FALLBACK, () => ({ ...fresh }), 'me', (v) => v);
}

/** Заполненный день Big Data — награда по правилам; ref — дата дня, повтор того же дня — 'duplicate' */
export function rewardBigDataFill(date: string, opts: GameOptions = {}): ApplyResult {
  return applyGame({ kind: 'bigdata_fill', ref: date }, opts);
}

/**
 * Активность пятницы — награда по правилам, только для сегодняшней пятницы (по Бишкеку).
 * ref = `${date}:${activityId}`: одна активность — одна награда за день. null — не сегодня или не пятница.
 */
export function rewardRecoveryActivity(date: string, activityId: string, opts: GameOptions = {}): ApplyResult | null {
  const today = todayStr(opts.now ?? new Date());
  if (date !== today || !isRecoveryDay(date)) return null;
  return applyGame({ kind: 'recovery_activity', ref: `${date}:${activityId}` }, opts);
}

/** Факты для ачивок «100 видео» и «40 каналов» */
export function factsOf(s: Store): AchievementFacts {
  return {
    publishedVideos: s.items<Video>('videos2').filter((v) => v.stage === 'published').length,
    activeChannels: s.items<Channel>('channels2').filter((c) => c.status === 'active').length,
  };
}

interface TaskLike {
  type?: string;
  kind?: string;
}

/** Факты дня из хранилища: фокус (focus_sessions), привычки (день Big Data), пятница (kv recovery:<дата>) */
export function dayFactsFor(date: string, s: Store = defaultStore): DayFacts {
  const work = s.items<FocusSession>('focus_sessions').filter((x) => isWorkSessionOf(x, date));
  const focusMin = work.reduce((sum, x) => sum + (Number(x.minutes) || 0), 0);
  const blocks = work.filter((x) => (Number(x.minutes) || 0) >= (Number(x.targetMinutes) || WORK_MIN)).length;
  const bd = s.get<BigDataDay>('bigdata_days', date);
  const habitsFallback = s
    .items<TaskLike>('tasks2')
    .filter((t) => (t.type === 'habit' || t.type === 'daily') && t.kind !== 'shopping').length;
  const habitsTotal = typeof bd?.habitsTotal === 'number' ? bd.habitsTotal : habitsFallback;
  const habitsDone = typeof bd?.habitsDone === 'number' ? bd.habitsDone : 0;
  const rec = s.get<{ key: string; value?: { done?: unknown } }>('kv', `recovery:${date}`);
  const recoveryDone = Array.isArray(rec?.value?.done) ? rec.value.done.length : 0;
  return { date, focusMin, blocks, habitsDone, habitsTotal, recoveryDone };
}

/**
 * Свести факты к наградам (идемпотентно, журнал не даёт повторов):
 * итоги прошедших дней, недели и месяцы целей, опубликованные видео, ачивки по фактам.
 * Первый запуск ставит начало правил на сегодня — прошлое не штрафуется и не награждается.
 */
export function syncGameFacts(opts: GameOptions = {}) {
  const s = opts.store ?? defaultStore;
  // Облако подключено, но не прочитано (или не прочиталось): кеш может быть старым — ничего не пишем
  if (!s.autoWritesAllowed()) return;
  const now = opts.now ?? new Date();
  const today = todayStr(now);
  const o = { store: s, now, auto: true };

  const cur = readStats(s);
  const started = withRulesStart(cur, today);
  if (started !== cur) writeStats(s, started, true);
  const since = String(started.rulesSince);

  for (const date of pendingDayCloses(started, today)) applyGame(dayCloseEvent(dayFactsFor(date, s)), o);

  // Цели: неделя — факт дошёл до плана недели; месяц — 100%
  const savedWeeks = s.items<GoalWeek>('goal_weeks');
  for (const goal of s.items<Goal>('goals')) {
    if (goal.month < monthKey(since) || goal.status === 'archived' || goal.status === 'failed') continue;
    const weeks = weeksFor(goal, savedWeeks);
    const nowWeek = currentWeekIndex(goal.month, today);
    for (const w of weeks) {
      const actual = typeof w.actual === 'number' ? w.actual : goal.kind === 'numeric' && w.weekIndex <= nowWeek ? goal.current : undefined;
      if (w.target > 0 && typeof actual === 'number' && actual >= w.target) applyGame({ kind: 'goal_week', ref: w.id }, o);
    }
    if (goalPct(goal, weeks) >= 100) applyGame({ kind: 'goal_month', ref: goal.id }, o);
  }

  // Публикации (в том числе отмеченные не с этого экрана)
  for (const v of s.items<Video>('videos2')) {
    if (v.stage === 'published' && typeof v.publishedAt === 'string' && v.publishedAt.slice(0, 10) >= since) {
      applyGame({ kind: 'video_published', ref: v.id }, o);
    }
  }

  applyGame({ kind: 'check' }, o);
}

/** Запись таймера: существующий id заменяется на месте, новый — сверху (без дублей) */
export function logSessionOnce<T extends { id: string }>(prev: T[], entry: T): T[] {
  if (prev.some((x) => x.id === entry.id)) return prev.map((x) => (x.id === entry.id ? { ...x, ...entry } : x));
  return [entry, ...prev];
}
