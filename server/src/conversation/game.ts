// Награды и штрафы от бота — только по правилам shared/gamification с теми же id событий, что у сайта.
// Дедуп через game_events (только вставка): сначала вставить основное событие, статы — только если
// вставка прошла. Иначе бот и сайт применили бы один и тот же день дважды.
import { applyEvent, dayCloseEvent, pendingDayCloses, withRulesStart, type ApplyResult, type DayFacts, type GameEventInput } from '../../../shared/gamification';
import type { GameStats } from '../../../shared/types';
import type { ConversationStore } from './store';

const WORK_MIN = 120;

/** Стартовые статы, если сайт ещё ни разу не писал game_stats */
export const START_STATS: GameStats = { level: 1, exp: 0, maxExp: 100, hp: 100, maxHp: 100, gold: 0, streak: 0 };

const NOT_APPLIED: ApplyResult = { stats: START_STATS, events: [], unlocked: [], applied: false, rejected: 'duplicate', leveledUp: 0, hpZero: false };

export async function applyGame(store: ConversationStore, input: GameEventInput, now: Date): Promise<ApplyResult> {
  const [stats, journal, achievements, videos, channels] = await Promise.all([
    store.getGameStats(),
    store.listGameEvents(),
    store.listAchievements(),
    store.listVideos(),
    store.listChannels(),
  ]);
  const r = applyEvent(stats ?? START_STATS, input, {
    now,
    journal,
    unlocked: achievements.map((a) => a.id),
    facts: {
      publishedVideos: videos.filter((v) => v.stage === 'published').length,
      activeChannels: channels.filter((c) => c.status === 'active').length,
    },
  });
  if (!r.applied || r.events.length === 0) return r;
  // Основное событие (или первое производное, если основного нет) — ключ дедупа
  const [main, ...rest] = r.events;
  if (!(await store.insertGameEvent(main))) return { ...NOT_APPLIED, stats: stats ?? START_STATS };
  for (const e of rest) await store.insertGameEvent(e);
  await store.saveGameStats(r.stats);
  for (const id of r.unlocked) await store.insertAchievement({ id, unlockedAt: now.toISOString() });
  return r;
}

/** Факты дня для итога: фокус (focus_sessions), привычки (день Big Data), пятница (kv recovery:<дата>) */
export async function dayFactsFor(store: ConversationStore, date: string): Promise<DayFacts> {
  const work = (await store.listFocusSessions(date, date)).filter((s) => s.mode !== 'break');
  const focusMin = work.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const blocks = work.filter((s) => (Number(s.minutes) || 0) >= (Number(s.targetMinutes) || WORK_MIN)).length;
  const day = await store.getDay(date);
  let habitsTotal = typeof day?.habitsTotal === 'number' ? day.habitsTotal : NaN;
  if (Number.isNaN(habitsTotal)) {
    habitsTotal = (await store.listTasks()).filter((t) => (t.type === 'habit' || t.type === 'daily') && t.kind !== 'shopping').length;
  }
  const habitsDone = typeof day?.habitsDone === 'number' ? day.habitsDone : 0;
  const rec = await store.getKv<{ done?: unknown }>(`recovery:${date}`);
  const recoveryDone = Array.isArray(rec?.done) ? rec.done.length : 0;
  return { date, focusMin, blocks, habitsDone, habitsTotal, recoveryDone };
}

/** Закрыть прошедшие дни (итог дня) — так же, как сайт; повторы отсекает журнал */
export async function closePendingDays(store: ConversationStore, today: string, now: Date): Promise<string[]> {
  const cur = await store.getGameStats();
  if (!cur) return []; // правила ещё не запущены сайтом — прошлое не штрафуем
  const started = withRulesStart(cur, today);
  if (started !== cur) await store.saveGameStats(started);
  const closed: string[] = [];
  for (const date of pendingDayCloses(started, today)) {
    const r = await applyGame(store, dayCloseEvent(await dayFactsFor(store, date)), now);
    if (r.applied) closed.push(date);
  }
  return closed;
}
