// Срез данных для AI-аналитика: 30 дней (фокус, задачи, цели, сон, БАДы, привычки, оценки, заметки,
// каналы, доход) + прошлые выводы из ai_memory + факторы влияния из shared/bigdata.
import { influenceFactors } from '../../../shared/bigdata';
import { goalProgress, weeksFor, currentWeekIndex } from '../../../shared/goals';
import { effectiveStatus, lastPublishedOf } from '../../../shared/channels';
import { addDays, dayOfWeek, monthKey, weekStart } from '../../../shared/time';
import type { FocusSession, Goal } from '../../../shared/types';
import type { ConversationStore } from './store';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «вт 17.11» */
export function dateLabel(date: string): string {
  return `${WD[dayOfWeek(date)]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

export function formatMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}ч ${String(m % 60).padStart(2, '0')}м`;
}

const isWork = (s: FocusSession) => s.mode !== 'break';

export interface AnalysisPayload {
  kind: 'day' | 'week' | 'month';
  date: string;
  [key: string]: unknown;
}

export async function buildPayload(store: ConversationStore, kind: 'day' | 'week' | 'month', date: string): Promise<AnalysisPayload> {
  const from = addDays(date, -29);
  const [days, sessions, tasks, goals, weeks, steps, channels, videos, income, memory, config, stats] = await Promise.all([
    store.listDays(from, date),
    store.listFocusSessions(from, date),
    store.listTasks(),
    store.listGoals(),
    store.listGoalWeeks(),
    store.listGoalSteps(),
    store.listChannels(),
    store.listVideos(),
    store.listIncome(),
    store.listAiMemory(),
    store.getBigDataConfig(),
    store.getGameStats(),
  ]);

  const focusByDay: Record<string, { min: number; blocks: number }> = {};
  for (const s of sessions.filter(isWork)) {
    const f = (focusByDay[s.date] ??= { min: 0, blocks: 0 });
    f.min += Number(s.minutes) || 0;
    if ((Number(s.minutes) || 0) >= (Number(s.targetMinutes) || 120)) f.blocks += 1;
  }

  const month = monthKey(date);
  const relevantGoals = goals.filter((g) => g.month === month || g.month === monthKey(addDays(`${month}-01`, -1)) || g.month === monthKey(addDays(date, 1)));
  const goalView = (g: Goal) => {
    const w = weeksFor(g, weeks);
    const p = goalProgress(g, w, steps, date);
    return {
      id: g.id,
      month: g.month,
      title: g.title,
      kind: g.kind,
      target: g.target,
      current: g.current ?? 0,
      unit: g.unit,
      status: g.status,
      pct: p.pct,
      onTrack: p.onTrack,
      weeks: w.map((x) => ({ week: x.weekIndex, target: x.target, actual: x.actual, review: x.review })),
      steps: steps.filter((s) => s.goalId === g.id).map((s) => ({ week: s.weekIndex, title: s.title, done: !!s.done, pct: s.progressPct, proposed: !!s.proposed })),
    };
  };

  const recentTasks = tasks
    .filter((t) => t.kind !== 'shopping' && t.type === 'todo')
    .filter((t) => !t.completed || (t.completedAt ?? '').slice(0, 10) >= from)
    .slice(0, 80)
    .map((t) => ({ title: t.title, done: !!t.completed, completedAt: t.completedAt?.slice(0, 10), due: t.dueDate, pct: t.progressPct, dropReason: t.dropReason, priority: t.priority }));

  const payload: AnalysisPayload = {
    kind,
    date,
    weekday: WD[dayOfWeek(date)],
    days: days
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        score: d.score,
        why: d.why,
        sleepMin: d.sleepMin,
        sleepQuality: d.sleepQuality,
        supplements: d.supplements,
        waterOk: d.waterOk,
        habitsDone: d.habitsDone,
        habitsTotal: d.habitsTotal,
        habitsMissed: d.habitsMissed,
        note: d.note,
        goodBetter: d.goodBetter,
        tags: d.tags,
        focusMin: focusByDay[d.date]?.min ?? d.focusMin ?? 0,
        blocks: focusByDay[d.date]?.blocks ?? 0,
        reportStatus: d.reportStatus,
      })),
    focusByDay,
    tasks: recentTasks,
    goals: relevantGoals.map(goalView),
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      niche: c.niche,
      status: effectiveStatus(c, date),
      cadencePerDay: c.cadencePerDay,
      planned: c.planned === true,
      plan: c.plan,
      lastPublished: lastPublishedOf(c.id, videos),
      published30d: videos.filter((v) => v.channelId === c.id && v.stage === 'published' && (v.publishedAt ?? '').slice(0, 10) >= from).length,
      abandonReason: c.abandonReason,
    })),
    income: income.filter((i) => i.date >= addDays(date, -89)).map((i) => ({ date: i.date, channelId: i.channelId, usd: i.amountUsd })),
    stats: stats ? { level: stats.level, hp: stats.hp, gold: stats.gold, streak: stats.streak, incomeUsdTotal: stats.incomeUsdTotal } : null,
    influence: influenceFactors(days, { supplements: config?.supplements ?? [], spheres: config?.spheres ?? [] }),
    memory: {
      months: memory.filter((m) => m.period === 'month').sort((a, b) => b.periodKey.localeCompare(a.periodKey)).slice(0, 6),
      weeks: memory.filter((m) => m.period === 'week').sort((a, b) => b.periodKey.localeCompare(a.periodKey)).slice(0, 4),
      days: memory.filter((m) => m.period === 'day').sort((a, b) => b.periodKey.localeCompare(a.periodKey)).slice(0, 7),
    },
  };

  if (kind === 'week') {
    const next = addDays(date, 1);
    payload.nextWeek = { start: weekStart(next), month: monthKey(next) };
    payload.nextWeekGoals = goals
      .filter((g) => g.month === monthKey(next) && g.status === 'active')
      .map((g) => ({ id: g.id, title: g.title, week: currentWeekIndex(g.month, next), target: g.target, current: g.current ?? 0, unit: g.unit }));
  }
  return payload;
}
