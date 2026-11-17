import { describe, it, expect } from 'vitest';
import type { FocusSession } from '@shared/types';
import { daySummary } from './daySummary';

const TODAY = '2026-11-17';
const s = (over: Partial<FocusSession> & Record<string, unknown>): FocusSession =>
  ({ id: 'x', date: TODAY, startedAt: '2026-11-17T03:00:00.000Z', minutes: 120, mode: 'work', ...over }) as FocusSession;

describe('итог дня', () => {
  it('часы фокуса и задачи по блокам, по порядку; отдых и другие дни не считаются', () => {
    const sum = daySummary(
      [
        s({ id: 'b2', blockIndex: 2, startedAt: '2026-11-17T05:20:00.000Z', minutes: 90, title: 'Монтаж', result: 'partial', progressPct: 60 }),
        s({ id: 'b1', blockIndex: 1, title: 'Сценарий', result: 'done' }),
        s({ id: 'br', mode: 'break', minutes: 20 }),
        s({ id: 'old', date: '2026-11-16', minutes: 120 }),
        s({ id: 'del', deleted: true, minutes: 120 }),
      ],
      TODAY,
    );
    expect(sum.totalMin).toBe(210);
    expect(sum.hoursLabel).toBe('3ч 30м');
    expect(sum.blocks.map((b) => [b.blockIndex, b.title, b.minutes, b.resultLabel])).toEqual([
      [1, 'Сценарий', 120, 'готово'],
      [2, 'Монтаж', 90, '60%'],
    ]);
  });

  it('бросил — с причиной; без задачи и без отметки — понятные подписи', () => {
    const sum = daySummary(
      [
        s({ id: 'a', blockIndex: 1, title: 'Превью', result: 'dropped', dropReason: 'нет идей' }),
        s({ id: 'b', blockIndex: 2, startedAt: '2026-11-17T06:00:00.000Z' }),
      ],
      TODAY,
    );
    expect(sum.blocks.map((b) => [b.title, b.resultLabel])).toEqual([
      ['Превью', 'бросил: нет идей'],
      ['Без задачи', 'без отметки'],
    ]);
  });

  it('пустой день', () => {
    expect(daySummary([], TODAY)).toEqual({ totalMin: 0, hoursLabel: '0ч 00м', blocks: [] });
  });
});
