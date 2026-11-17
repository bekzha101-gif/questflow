// Над чем работать в блоке: шаги недели, задачи дня, цели месяца (покупок нет).
// Выбор хранится одной строкой в timer_state.task_id и focus_sessions.task_id:
// задача — её id, шаг — `step:<id>`, цель — `goal:<id>`.
import type { TaskItem } from '../../types';
import type { FocusResult, Goal, GoalStep } from '@shared/types';
import { monthKey } from '@shared/time';
import { stepsForTimer } from '@shared/goals';
import { isShoppingTask } from '../../utils/taskFilters';

export type TargetKind = 'step' | 'task' | 'goal';

export interface TimerTarget {
  ref: string;
  kind: TargetKind;
  id: string;
  title: string;
  hint?: string;
}

export interface TargetGroup {
  key: TargetKind;
  label: string;
  items: TimerTarget[];
}

export function targetRef(kind: TargetKind, id: string): string {
  return kind === 'task' ? id : `${kind}:${id}`;
}

export function parseTargetRef(ref: string | null | undefined): { kind: TargetKind; id: string } | null {
  if (!ref) return null;
  if (ref.startsWith('step:')) return { kind: 'step', id: ref.slice(5) };
  if (ref.startsWith('goal:')) return { kind: 'goal', id: ref.slice(5) };
  return { kind: 'task', id: ref };
}

const PRIORITY_RANK: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };

export function buildTargetGroups(input: {
  tasks: TaskItem[];
  steps: GoalStep[];
  goals: Goal[];
  today: string;
}): TargetGroup[] {
  const { tasks, steps, goals, today } = input;
  const month = monthKey(today);
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));

  const stepItems: TimerTarget[] = stepsForTimer(goals, steps, today).map((s) => ({
    ref: targetRef('step', s.id),
    kind: 'step',
    id: s.id,
    title: s.title,
    hint: goalTitle.get(s.goalId),
  }));

  // Задачи дня: невыполненные задачи со сроком «сегодня или раньше» или без срока, затем ежедневные
  const rank = (t: TaskItem) => (t.type === 'daily' ? 2 : t.dueDate ? 0 : 1);
  const taskItems: TimerTarget[] = tasks
    .filter((t) => !t.completed && !isShoppingTask(t))
    .filter((t) => (t.type === 'todo' && (!t.dueDate || t.dueDate <= today)) || t.type === 'daily')
    .sort((a, b) => rank(a) - rank(b) || (PRIORITY_RANK[a.priority] ?? 5) - (PRIORITY_RANK[b.priority] ?? 5))
    .map((t) => ({ ref: targetRef('task', t.id), kind: 'task', id: t.id, title: t.title }));

  const goalItems: TimerTarget[] = goals
    .filter((g) => g.month === month && g.status === 'active')
    .map((g) => ({ ref: targetRef('goal', g.id), kind: 'goal', id: g.id, title: g.title }));

  return [
    { key: 'step', label: 'Шаги недели', items: stepItems },
    { key: 'task', label: 'Задачи дня', items: taskItems },
    { key: 'goal', label: 'Цели месяца', items: goalItems },
  ];
}

export interface BlockResultInput {
  result: FocusResult;
  progressPct?: number;
  dropReason?: string;
}

/**
 * Что записать в задачу, шаг или цель по отметке блока.
 * complete — задачу нужно отметить выполненной (через обычное выполнение задачи, с наградой).
 */
export function resultUpdates(
  kind: TargetKind,
  input: BlockResultInput,
  goal?: Goal,
): { complete: boolean; patch: Record<string, unknown> } {
  const pct = clampPct(input.progressPct);
  if (kind === 'goal') {
    // Блок по цели месяца: процентная цель получает введённый процент; числовую двигают её шаги
    if (input.result === 'partial' && pct !== undefined && goal?.kind === 'percent') return { complete: false, patch: { current: pct } };
    return { complete: false, patch: {} };
  }
  if (input.result === 'done') {
    return kind === 'task'
      ? { complete: true, patch: { progressPct: 100 } }
      : { complete: false, patch: { done: true, progressPct: 100 } };
  }
  if (input.result === 'partial') return { complete: false, patch: pct === undefined ? {} : { progressPct: pct } };
  const reason = (input.dropReason ?? '').trim();
  return { complete: false, patch: reason ? { dropReason: reason } : {} };
}

function clampPct(v: number | undefined): number | undefined {
  if (v === undefined || Number.isNaN(Number(v))) return undefined;
  return Math.max(0, Math.min(100, Math.round(Number(v))));
}
