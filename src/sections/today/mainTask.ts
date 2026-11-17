import type { TaskItem, TimeLogEntry } from '../../types';
import { todayStr } from '@shared/time';
import { isShoppingTask } from '../../utils/taskFilters';

/** Норма фокуса в день: 3 блока по 2 часа */
export const FOCUS_HOURS_NORM = 6;

const PRIORITY_RANK: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };

/**
 * Главная задача дня: невыполненная обычная задача. Сначала со сроком «сегодня» или раньше,
 * затем по приоритету p1..p4. Привычки, ежедневные и покупки не берутся.
 */
export function pickMainTask(tasks: TaskItem[], today: string): TaskItem | null {
  const candidates = tasks.filter((t) => t.type === 'todo' && !t.completed && !isShoppingTask(t));
  const rank = (t: TaskItem) => PRIORITY_RANK[t.priority] ?? 5;
  const due = (t: TaskItem) => (t.dueDate && t.dueDate <= today ? 0 : 1);
  const sorted = [...candidates].sort((a, b) => due(a) - due(b) || rank(a) - rank(b));
  return sorted[0] ?? null;
}

/** Сколько часов фокуса набрано за день (по Бишкеку); отдых не считается */
export function focusHoursToday(logs: TimeLogEntry[], today: string): number {
  const minutes = logs
    .filter((l) => l.mode === 'work')
    .filter((l) => {
      const at = Date.parse(l.startedAt || l.completedAt);
      return !Number.isNaN(at) && todayStr(new Date(at)) === today;
    })
    .reduce((sum, l) => sum + (Number(l.actualMinutes) || 0), 0);
  return Math.round((minutes / 60) * 100) / 100;
}
