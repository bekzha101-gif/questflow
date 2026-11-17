// Цели: месяц -> 4 недели -> шаги. Чистые правила без React и сети (общие для сайта и сервера).
// Время — только через shared/time; «сегодня» передаётся параметром.
import type { Goal, GoalStep, GoalWeek } from './types';
import { todayStr } from './time';

export const WEEKS_PER_GOAL = 4;
const DAYS_PER_WEEK = 7;

/** Шаг недели; `proposed` — предложен Claude (таск 09), ждёт принятия. Поле лежит в extra строки goal_steps. */
export interface GoalStepEx extends GoalStep {
  proposed?: boolean;
}

export interface GoalProgress {
  /** Выполнение цели месяца, 0..100 */
  pct: number;
  /** «В графике» — факт не ниже ожидаемого на начало сегодняшнего дня */
  onTrack: boolean;
  /** Ожидаемое значение цели (в её единицах) на начало сегодняшнего дня */
  expected: number;
  /** Текущая неделя месяца: 1..4; 0 — месяц ещё не начался */
  week: { index: number; target: number; pct: number; stepsDone: number; stepsTotal: number };
  /** Сколько прибавить сегодня, чтобы дойти до контрольной точки недели (округление вверх) */
  dayNeed: number;
}

/** Контрольные точки недель: k·target/(weeks+1), вверх. 50 -> 10/20/30/40; к концу месяца — сама цель. */
export function splitTarget(target: number, weeks = WEEKS_PER_GOAL): number[] {
  const out: number[] = [];
  for (let k = 1; k <= weeks; k++) out.push(Math.ceil((k * target) / (weeks + 1)));
  return out;
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function daysInMonth(month: string): number {
  const { y, m } = parseYmd(`${month}-01`);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Неделя месяца на дату: 1..4 (дни 22-31 — четвёртая); 0 до начала месяца; 4 после конца. */
export function currentWeekIndex(month: string, today: string): number {
  const tm = today.slice(0, 7);
  if (tm < month) return 0;
  if (tm > month) return WEEKS_PER_GOAL;
  return Math.min(WEEKS_PER_GOAL, Math.floor((parseYmd(today).d - 1) / DAYS_PER_WEEK) + 1);
}

/** 4 недели цели: сохранённые строки перекрывают значения по умолчанию (правка пользователя побеждает). Ничего не пишет. */
export function weeksFor(goal: Goal, saved: GoalWeek[]): GoalWeek[] {
  const defaults = splitTarget(goal.target);
  const mine = saved.filter((w) => w.goalId === goal.id);
  return defaults.map((target, i) => {
    const found = mine.find((w) => w.weekIndex === i + 1);
    return found ?? { id: `${goal.id}-w${i + 1}`, goalId: goal.id, weekIndex: i + 1, target };
  });
}

/** Факт цели в её единицах: current, иначе наибольший факт по неделям */
function actualOf(goal: Goal, weeks: GoalWeek[]): number {
  if (goal.current !== undefined) return goal.current;
  return weeks.reduce((max, w) => Math.max(max, w.actual ?? 0), 0);
}

export function goalPct(goal: Goal, weeks: GoalWeek[] = []): number {
  if (goal.status === 'done') return 100;
  if (!(goal.target > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((actualOf(goal, weeks) / goal.target) * 100)));
}

export function goalProgress(
  goal: Goal,
  savedWeeks: GoalWeek[],
  steps: GoalStep[],
  today: string = todayStr(),
): GoalProgress {
  const weeks = weeksFor(goal, savedWeeks);
  const actual = actualOf(goal, savedWeeks);
  const w = currentWeekIndex(goal.month, today);

  // Ожидание: линейно от контрольной точки прошлой недели к текущей (у 4-й недели конец — сама цель)
  const checkpoint = (i: number) => (i <= 0 ? 0 : i >= WEEKS_PER_GOAL ? goal.target : weeks[i - 1].target);
  let expected: number;
  if (w === 0) expected = 0;
  else if (goal.month < today.slice(0, 7)) expected = goal.target;
  else {
    const start = (w - 1) * DAYS_PER_WEEK + 1;
    const frac = Math.min(1, Math.max(0, (parseYmd(today).d - start) / DAYS_PER_WEEK));
    const prev = w === 1 ? 0 : weeks[w - 2].target;
    expected = prev + (checkpoint(w) - prev) * frac;
  }

  const wk = w >= 1 ? weeks[w - 1] : weeks[0];
  const weekSteps = steps.filter((s) => s.goalId === goal.id && s.weekIndex === (w || 1));
  const weekGoal = w >= 1 ? checkpoint(w) : wk.target;
  const lastDay = w === WEEKS_PER_GOAL ? daysInMonth(goal.month) : w * DAYS_PER_WEEK;
  const daysLeft = w >= 1 && goal.month === today.slice(0, 7) ? Math.max(1, lastDay - parseYmd(today).d + 1) : 1;

  return {
    pct: goalPct(goal, savedWeeks),
    onTrack: actual >= expected,
    expected,
    week: {
      index: w,
      target: wk.target,
      pct: weekGoal > 0 ? Math.min(100, Math.round((actual / weekGoal) * 100)) : 0,
      stepsDone: weekSteps.filter((s) => s.done).length,
      stepsTotal: weekSteps.length,
    },
    dayNeed: Math.ceil(Math.max(0, weekGoal - actual) / daysLeft),
  };
}

/** Шаги для выбора задачи таймером: активные цели, текущая неделя, не сделанные, принятые */
export function stepsForTimer(goals: Goal[], steps: GoalStepEx[], today: string = todayStr()): GoalStepEx[] {
  const active = new Map(goals.filter((g) => g.status === 'active').map((g) => [g.id, g]));
  return steps.filter((s) => {
    const g = active.get(s.goalId);
    return !!g && !s.done && !s.proposed && s.weekIndex === currentWeekIndex(g.month, today);
  });
}

/** Принять предложенный шаг */
export function acceptStep(step: GoalStepEx): GoalStepEx {
  return { ...step, proposed: false };
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
/** '2026-11' -> 'Ноябрь 2026' */
export function monthLabel(month: string): string {
  const { y, m } = parseYmd(`${month}-01`);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Итог месяца для архива: средний % по целям, число завершённых */
export function monthSummary(goals: Goal[], weeks: GoalWeek[] = []): { pct: number; done: number; total: number } {
  const list = goals;
  if (list.length === 0) return { pct: 0, done: 0, total: 0 };
  const sum = list.reduce((a, g) => a + goalPct(g, weeks.filter((w) => w.goalId === g.id)), 0);
  return { pct: Math.round(sum / list.length), done: list.filter((g) => g.status === 'done').length, total: list.length };
}
