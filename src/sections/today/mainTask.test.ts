import { describe, it, expect } from 'vitest';
import type { TaskItem, TimeLogEntry } from '../../types';
import { pickMainTask, focusHoursToday } from './mainTask';

const t = (over: Record<string, unknown>): TaskItem =>
  ({ id: 'x', title: 'x', type: 'todo', priority: 'p3', projectId: 'p', tags: [], difficulty: 'easy',
     expReward: 1, goldReward: 1, completed: false, subtasks: [], ...over }) as TaskItem;

describe('главная задача дня', () => {
  const today = '2026-11-17';

  it('берёт срочнее: на сегодня, затем приоритет p1..p4', () => {
    const list = [t({ id: 'a', priority: 'p1' }), t({ id: 'b', priority: 'p3', dueDate: today }), t({ id: 'c', priority: 'p2', dueDate: today })];
    expect(pickMainTask(list, today)?.id).toBe('c');
  });

  it('без срока берёт самый высокий приоритет', () => {
    expect(pickMainTask([t({ id: 'a', priority: 'p3' }), t({ id: 'b', priority: 'p1' })], today)?.id).toBe('b');
  });

  it('пропускает выполненные, привычки, ежедневные и покупки; пусто → null', () => {
    const list = [t({ completed: true }), t({ type: 'habit' }), t({ type: 'daily' }), t({ kind: 'shopping' })];
    expect(pickMainTask(list, today)).toBeNull();
  });
});

describe('часы фокуса сегодня', () => {
  const log = (over: Partial<TimeLogEntry>): TimeLogEntry => ({
    id: 'l', title: '', mode: 'work', targetMinutes: 120, actualMinutes: 60,
    startedAt: '2026-11-17T05:00:00.000Z', completedAt: '2026-11-17T06:00:00.000Z', ...over,
  });

  it('складывает минуты работы за сегодня по Бишкеку, отдых и чужие дни не считает', () => {
    const logs = [
      log({ actualMinutes: 120 }),
      log({ actualMinutes: 30, startedAt: '2026-11-17T09:00:00.000Z' }),
      log({ mode: 'break', actualMinutes: 20 }),
      log({ actualMinutes: 90, startedAt: '2026-11-16T05:00:00.000Z' }),
    ];
    expect(focusHoursToday(logs, '2026-11-17')).toBe(2.5);
  });

  it('сессия, начатая в 23:30 UTC, относится к следующему дню по Бишкеку', () => {
    expect(focusHoursToday([log({ actualMinutes: 60, startedAt: '2026-11-16T23:30:00.000Z' })], '2026-11-17')).toBe(1);
  });
});
