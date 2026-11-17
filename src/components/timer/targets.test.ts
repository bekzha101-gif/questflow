import { describe, it, expect } from 'vitest';
import type { TaskItem } from '../../types';
import type { Goal, GoalStep } from '@shared/types';
import { buildTargetGroups, targetRef, parseTargetRef, resultUpdates } from './targets';

const TODAY = '2026-11-17';
const task = (over: Record<string, unknown>): TaskItem =>
  ({ id: 'x', title: 'x', type: 'todo', priority: 'p3', projectId: 'p', tags: [], difficulty: 'easy',
     expReward: 1, goldReward: 1, completed: false, subtasks: [], ...over }) as TaskItem;
const goal = (over: Partial<Goal>): Goal =>
  ({ id: 'g1', month: '2026-11', title: '40 каналов', kind: 'numeric', target: 40, status: 'active', ...over }) as Goal;
const step = (over: Partial<GoalStep>): GoalStep =>
  ({ id: 's1', goalId: 'g1', weekIndex: 3, title: 'Шаг', ...over }) as GoalStep;

describe('выбор задачи перед блоком', () => {
  it('три группы по порядку: шаги недели, задачи дня, цели месяца', () => {
    const groups = buildTargetGroups({
      tasks: [task({ id: 't1', title: 'Монтаж' })],
      steps: [step({ id: 's1', title: 'Снять 2 видео' })],
      goals: [goal({ id: 'g1' })],
      today: TODAY,
    });
    expect(groups.map((g) => g.label)).toEqual(['Шаги недели', 'Задачи дня', 'Цели месяца']);
    expect(groups[0].items[0]).toMatchObject({ ref: 'step:s1', title: 'Снять 2 видео', hint: '40 каналов' });
    expect(groups[1].items[0]).toMatchObject({ ref: 't1', title: 'Монтаж' });
    expect(groups[2].items[0]).toMatchObject({ ref: 'goal:g1', title: '40 каналов' });
  });

  it('покупок, привычек, выполненного и задач на будущее нет', () => {
    const groups = buildTargetGroups({
      tasks: [
        task({ id: 'buy', kind: 'shopping' }),
        task({ id: 'buy-old', tags: ['покупки'] }),
        task({ id: 'habit', type: 'habit' }),
        task({ id: 'done', completed: true }),
        task({ id: 'later', dueDate: '2026-11-25' }),
        task({ id: 'p1', priority: 'p1' }),
        task({ id: 'due', priority: 'p4', dueDate: TODAY }),
        task({ id: 'daily', type: 'daily' }),
      ],
      steps: [step({ id: 'old-week', weekIndex: 1 }), step({ id: 'done-step', done: true })],
      goals: [goal({ id: 'g1' }), goal({ id: 'oct', month: '2026-10' }), goal({ id: 'arch', status: 'archived' })],
      today: TODAY,
    });
    expect(groups[1].items.map((i) => i.ref)).toEqual(['due', 'p1', 'daily']);
    expect(groups[0].items).toEqual([]);
    expect(groups[2].items.map((i) => i.ref)).toEqual(['goal:g1']);
  });

  it('ссылка на цель кодируется в task_id и читается обратно', () => {
    expect(parseTargetRef(targetRef('step', 'a'))).toEqual({ kind: 'step', id: 'a' });
    expect(parseTargetRef(targetRef('goal', 'b'))).toEqual({ kind: 'goal', id: 'b' });
    expect(parseTargetRef('t1')).toEqual({ kind: 'task', id: 't1' });
    expect(parseTargetRef(null)).toBeNull();
  });
});

describe('отметка после блока пишется в прогресс', () => {
  it('задача: готово — выполнить; процент и «бросил» — в поля задачи', () => {
    expect(resultUpdates('task', { result: 'done' })).toEqual({ complete: true, patch: { progressPct: 100 } });
    expect(resultUpdates('task', { result: 'partial', progressPct: 60 })).toEqual({ complete: false, patch: { progressPct: 60 } });
    expect(resultUpdates('task', { result: 'dropped', dropReason: 'устал' })).toEqual({
      complete: false,
      patch: { dropReason: 'устал' },
    });
  });

  it('шаг недели: готово — done, процент — progressPct', () => {
    expect(resultUpdates('step', { result: 'done' }).patch).toEqual({ done: true, progressPct: 100 });
    expect(resultUpdates('step', { result: 'partial', progressPct: 30 }).patch).toEqual({ progressPct: 30 });
  });

  it('цель месяца в процентах: процент — текущее значение цели; числовая цель не меняется', () => {
    expect(resultUpdates('goal', { result: 'partial', progressPct: 45 }, goal({ kind: 'percent', target: 100 })).patch).toEqual({
      current: 45,
    });
    expect(resultUpdates('goal', { result: 'partial', progressPct: 45 }, goal({ kind: 'numeric' })).patch).toEqual({});
  });
});
