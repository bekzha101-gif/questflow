// Отчёты дня, недели и месяца. Цифры считаются без AI и уходят всегда; раздел Claude добавляется,
// если анализ удался. Не удался — отчёт уходит без него, а повтор ставится в очередь (pendingAi).
import type { AiResult } from '../ai';
import { goalProgress, monthLabel, weeksFor, currentWeekIndex } from '../../../shared/goals';
import { addDays, monthKey, weekStart } from '../../../shared/time';
import type { Goal, GoalWeek } from '../../../shared/types';
import { buildPayload, dateLabel, formatMin } from './context';
import type { StepRow } from './store';
import type { ConversationDeps, Keyboard } from './types';

export const AI_LATER = 'Анализ Claude сейчас недоступен — пришлю его позже отдельным сообщением.';

export function formatAi(r: AiResult): string {
  const block = (title: string, items: string[]) => (items.length ? `${title}\n${items.map((s) => `- ${s}`).join('\n')}` : '');
  return [
    r.summary ? `Claude: ${r.summary}` : 'Claude:',
    block('Что хорошо:', r.good),
    block('Что можно лучше:', r.better),
    block('Как поднять продуктивность:', r.boost),
  ]
    .filter(Boolean)
    .join('\n\n');
}

type Ctx = Pick<ConversationDeps, 'store' | 'ai' | 'send'> & { now: Date };

async function remember(ctx: Ctx, period: 'day' | 'week' | 'month', key: string, r: AiResult) {
  await ctx.store.saveAiMemory({ id: `${period}:${key}`, period, periodKey: key, summary: r.summary || r.good.concat(r.better).join('; '), facts: r.facts });
}

// ─── День ────────────────────────────────────────────────────────────────────
export async function dayFactsText(ctx: Ctx, date: string): Promise<string> {
  const { store } = ctx;
  const [day, sessions, tasks] = await Promise.all([store.getDay(date), store.listFocusSessions(date, date), store.listTasks()]);
  const work = sessions.filter((s) => s.mode !== 'break');
  const focus = work.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  const blocks = work.filter((x) => (Number(x.minutes) || 0) >= (Number(x.targetMinutes) || 120)).length;
  const done = tasks.filter((t) => t.completed && (t.completedAt ?? '').slice(0, 10) === date && t.kind !== 'shopping' && t.type === 'todo');
  const lines = [`Итог дня ${dateLabel(date)}`];
  lines.push(`Фокус: ${formatMin(focus)}, блоков ${blocks} из 3.`);
  if (typeof day?.habitsTotal === 'number') lines.push(`Привычки: ${day.habitsDone ?? 0} из ${day.habitsTotal}.`);
  if (typeof day?.score === 'number') lines.push(`Оценка: ${day.score}/10${day.why ? ` — ${day.why}` : ''}.`);
  if (typeof day?.sleepMin === 'number') lines.push(`Сон: ${formatMin(day.sleepMin)}${typeof day.sleepQuality === 'number' ? `, качество ${day.sleepQuality}%` : ''}.`);
  if (done.length) lines.push(`Задачи сделаны: ${done.map((t) => t.title).join(', ')}.`);
  return lines.join('\n');
}

/** Анализ дня; true — Claude ответил */
export async function dayAnalysis(ctx: Ctx, date: string, header: string): Promise<boolean> {
  const r = await ctx.ai.analyze('day', await buildPayload(ctx.store, 'day', date));
  if (!r) return false;
  await remember(ctx, 'day', date, r);
  await ctx.send(`${header}\n\n${formatAi(r)}`);
  return true;
}

// ─── Неделя ──────────────────────────────────────────────────────────────────
function goalLine(g: Goal, weeks: GoalWeek[], steps: StepRow[], date: string): string {
  const p = goalProgress(g, weeksFor(g, weeks), steps, date);
  const val = g.kind === 'numeric' ? `${g.current ?? 0} из ${g.target}${g.unit ? ` ${g.unit}` : ''}` : `${g.current ?? 0}%`;
  return `- ${g.title}: ${val} (${p.pct}%)${p.onTrack ? '' : ' — отстаёшь от графика'}`;
}

export async function weekPlainText(ctx: Ctx, date: string): Promise<string> {
  const [goals, weeks, steps, sessions] = await Promise.all([
    ctx.store.listGoals(),
    ctx.store.listGoalWeeks(),
    ctx.store.listGoalSteps(),
    ctx.store.listFocusSessions(addDays(date, -6), date),
  ]);
  const active = goals.filter((g) => g.month === monthKey(date) && g.status === 'active');
  const focus = sessions.filter((s) => s.mode !== 'break').reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  const lines = [`Отчёт недели (${dateLabel(weekStart(date))} – ${dateLabel(date)})`, `Фокус за неделю: ${formatMin(focus)} (норма 30ч: 5 рабочих дней по 6ч).`];
  if (active.length) lines.push('Цели месяца:', ...active.map((g) => goalLine(g, weeks, steps, date)));
  return lines.join('\n');
}

/** Анализ недели: отзыв недели в goal_weeks.review, предложенные шаги (proposed) с кнопками «Принять» */
export async function weekAnalysis(ctx: Ctx, date: string, header: string): Promise<boolean> {
  const r = await ctx.ai.analyze('week', await buildPayload(ctx.store, 'week', date));
  if (!r) return false;
  await remember(ctx, 'week', weekStart(date), r);

  const [goals, weeks] = await Promise.all([ctx.store.listGoals(), ctx.store.listGoalWeeks()]);
  for (const g of goals.filter((x) => x.month === monthKey(date) && x.status === 'active')) {
    const idx = currentWeekIndex(g.month, date);
    const w = weeksFor(g, weeks).find((x) => x.weekIndex === idx);
    if (w && r.summary) await ctx.store.saveGoalWeek({ ...w, review: r.summary });
  }

  const next = addDays(date, 1);
  const weekKey = weekStart(next);
  const nextGoals = goals.filter((g) => g.month === monthKey(next) && g.status === 'active');
  const proposed: StepRow[] = [];
  r.steps.forEach((s, i) => {
    const goal = nextGoals.find((g) => g.id === s.goalId);
    if (!goal) return;
    proposed.push({ id: `st-${weekKey}-${i + 1}`, goalId: goal.id, weekIndex: currentWeekIndex(goal.month, next), title: s.title, done: false, progressPct: 0, proposed: true, proposedFor: weekKey });
  });
  for (const s of proposed) await ctx.store.saveGoalStep(s);

  let text = `${header}\n\n${formatAi(r)}`;
  let kb: Keyboard | undefined;
  if (proposed.length) {
    text += `\n\nШаги на следующую неделю (предлагает Claude):\n${proposed.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}\nПрими те, что подходят.`;
    kb = proposed.map((s, i) => [{ text: `Принять ${i + 1}`, data: `qa:${s.id}` }]);
    kb.push([{ text: 'Принять все', data: `qA:${weekKey}` }]);
  }
  await ctx.send(text, kb);
  return true;
}

// ─── Месяц ───────────────────────────────────────────────────────────────────
/** Итог месяца без AI: проценты целей; цели месяца уходят в архив с итогом (goal.summary) */
export async function monthPlainText(ctx: Ctx, date: string): Promise<string> {
  const month = monthKey(date);
  const [goals, weeks, steps, rewards] = await Promise.all([ctx.store.listGoals(), ctx.store.listGoalWeeks(), ctx.store.listGoalSteps(), ctx.store.listRewards()]);
  const mine = goals.filter((g) => g.month === month && g.status !== 'archived');
  const lines = [`Отчёт месяца: ${monthLabel(month)}`];
  for (const g of mine) {
    const p = goalProgress(g, weeksFor(g, weeks), steps, date);
    const val = g.kind === 'numeric' ? `${g.current ?? 0} из ${g.target}${g.unit ? ` ${g.unit}` : ''}` : `${g.current ?? 0}%`;
    const done = p.pct >= 100;
    lines.push(`- ${g.title}: ${val} (${p.pct}%) — ${done ? 'выполнена' : 'не выполнена'}`);
    if (g.status === 'active') {
      await ctx.store.saveGoal({ ...g, status: done ? 'done' : 'failed', summary: `Итог ${monthLabel(month)}: ${val} (${p.pct}%).` });
    }
  }
  if (!mine.length) lines.push('Целей на этот месяц не было.');
  const names = rewards.map((r) => r.title).slice(0, 12);
  lines.push('', `Не поменялись ли желания? Сейчас награды: ${names.length ? names.join(', ') : 'пока нет'}. Поменять их можно в магазине на сайте.`);
  return lines.join('\n');
}

export async function monthAnalysis(ctx: Ctx, date: string, header: string): Promise<boolean> {
  const month = monthKey(date);
  const r = await ctx.ai.analyze('month', await buildPayload(ctx.store, 'month', date));
  if (!r) return false;
  await remember(ctx, 'month', month, r);
  if (r.summary) {
    const goals = await ctx.store.listGoals();
    for (const g of goals.filter((x) => x.month === month && x.status !== 'archived')) {
      const base = (g.summary ?? '').split('\nClaude:')[0];
      await ctx.store.saveGoal({ ...g, summary: `${base}\nClaude: ${r.summary}`.trim() });
    }
  }
  await ctx.send(`${header}\n\n${formatAi(r)}`);
  return true;
}
