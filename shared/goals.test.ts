import { describe, it, expect } from 'vitest';
import { splitTarget, goalProgress, weeksFor, currentWeekIndex, stepsForTimer } from './goals';
import type { Goal, GoalStep, GoalWeek } from './types';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', month: '2026-11', title: '50 каналов', kind: 'numeric', target: 50, current: 0, status: 'active', ...over,
});

describe('splitTarget — образец брифа', () => {
  it('50 -> 10/20/30/40 (к концу месяца 50)', () => {
    expect(splitTarget(50)).toEqual([10, 20, 30, 40]);
  });
  it('округляет вверх: 40 -> 8/16/24/32, 7 -> 2/3/5/6', () => {
    expect(splitTarget(40)).toEqual([8, 16, 24, 32]);
    expect(splitTarget(7)).toEqual([2, 3, 5, 6]);
  });
  it('другое число недель и пустая цель', () => {
    expect(splitTarget(30, 5)).toEqual([5, 10, 15, 20, 25]);
    expect(splitTarget(0)).toEqual([0, 0, 0, 0]);
  });
});

describe('currentWeekIndex', () => {
  it('дни 1-7 -> 1, 8-14 -> 2, 22-30 -> 4; прошлый месяц 4, будущий 0', () => {
    expect(currentWeekIndex('2026-11', '2026-11-01')).toBe(1);
    expect(currentWeekIndex('2026-11', '2026-11-08')).toBe(2);
    expect(currentWeekIndex('2026-11', '2026-11-30')).toBe(4);
    expect(currentWeekIndex('2026-11', '2026-12-02')).toBe(4);
    expect(currentWeekIndex('2026-11', '2026-10-31')).toBe(0);
  });
});

describe('weeksFor — недели по умолчанию, правка сохраняется', () => {
  it('нет строк — берёт splitTarget', () => {
    expect(weeksFor(goal(), []).map((w) => w.target)).toEqual([10, 20, 30, 40]);
  });
  it('поправленная неделя сохраняется, остальные по умолчанию', () => {
    const saved: GoalWeek[] = [{ id: 'g1-w2', goalId: 'g1', weekIndex: 2, target: 22 }];
    expect(weeksFor(goal(), saved).map((w) => w.target)).toEqual([10, 22, 30, 40]);
  });
});

describe('goalProgress', () => {
  it('числовая: 20 из 50 = 40%, в графике на 3-й неделе (контроль недели 2 = 20)', () => {
    const p = goalProgress(goal({ current: 20 }), [], [], '2026-11-15');
    expect(p.pct).toBe(40);
    expect(p.onTrack).toBe(true);
  });
  it('отстаёшь: 5 из 50 на 15 ноября', () => {
    expect(goalProgress(goal({ current: 5 }), [], [], '2026-11-15').onTrack).toBe(false);
  });
  it('первый день месяца с нулём — в графике', () => {
    expect(goalProgress(goal(), [], [], '2026-11-01').onTrack).toBe(true);
  });
  it('нечисловая ведётся процентом', () => {
    const g = goal({ kind: 'percent', target: 100, current: 35 });
    expect(goalProgress(g, [], [], '2026-11-12').pct).toBe(35);
  });
  it('процент не выше 100', () => {
    expect(goalProgress(goal({ current: 80 }), [], [], '2026-11-30').pct).toBe(100);
  });
  it('без current процент по фактам недель', () => {
    const weeks: GoalWeek[] = [{ id: 'a', goalId: 'g1', weekIndex: 1, target: 10, actual: 12 }];
    expect(goalProgress(goal({ current: undefined }), weeks, [], '2026-11-10').pct).toBe(24);
  });
  it('неделя: шаги и сколько нужно сегодня', () => {
    const steps: GoalStep[] = [
      { id: 's1', goalId: 'g1', weekIndex: 3, title: 'a', done: true },
      { id: 's2', goalId: 'g1', weekIndex: 3, title: 'b' },
      { id: 's3', goalId: 'g1', weekIndex: 2, title: 'c' },
    ];
    const p = goalProgress(goal({ current: 20 }), [], steps, '2026-11-15');
    expect(p.week).toMatchObject({ index: 3, target: 30, stepsDone: 1, stepsTotal: 2 });
    // осталось 10 до 30, дней недели 15..21 = 7 (15-го сегодня включительно) -> ceil(10/7)=2
    expect(p.dayNeed).toBe(2);
  });
});

describe('stepsForTimer — шаги недели для выбора задачи', () => {
  it('только активные цели, текущая неделя, не сделанные и принятые', () => {
    const goals = [goal(), goal({ id: 'g2', status: 'done' })];
    const steps = [
      { id: 'a', goalId: 'g1', weekIndex: 3, title: 'ок' },
      { id: 'b', goalId: 'g1', weekIndex: 3, title: 'сделан', done: true },
      { id: 'c', goalId: 'g1', weekIndex: 3, title: 'предложен', proposed: true },
      { id: 'd', goalId: 'g1', weekIndex: 2, title: 'не та неделя' },
      { id: 'e', goalId: 'g2', weekIndex: 3, title: 'цель закрыта' },
    ];
    expect(stepsForTimer(goals, steps, '2026-11-15').map((s) => s.id)).toEqual(['a']);
  });
});
