import { describe, expect, it } from 'vitest';
import type { FocusSession } from '../../../shared/types';
import { createMemoryStore, emptyData } from './testing';
import { dayFactsFor } from './game';
import { dayFactsText } from './reports';
import { buildPayload } from './context';

// Полный блок для серии и наград — только от 120 мин отработанного (FULL_BLOCK_MIN),
// какую бы длительность (targetMinutes) ни выбрал пользователь, и для секундомера тоже.
const DATE = '2026-11-17';
const s = (id: string, minutes: number, extra: Record<string, unknown> = {}): FocusSession => ({
  id,
  date: DATE,
  startedAt: `${DATE}T03:00:00.000Z`,
  minutes,
  mode: 'work',
  ...extra,
});

const sessions = [
  s('a', 90, { targetMinutes: 90 }), // выбрал 90 и отработал 90 — не полный
  s('b', 45, { targetMinutes: 45 }), // 45 из 45 — не полный
  s('c', 120, { targetMinutes: 120 }), // полный
  s('d', 150, { targetMinutes: 150, timerType: 'stopwatch' }), // секундомер набрал 2,5 ч — полный
  s('e', 130, { targetMinutes: 360 }), // выбрал 6 ч, остановил на 130 — полный
  s('f', 30, { mode: 'break' }), // отдых не считается
];

describe('полный блок на сервере — от 120 мин, не от targetMinutes', () => {
  it('итог дня (game.dayFactsFor)', async () => {
    const store = createMemoryStore(emptyData({ sessions }));
    const f = await dayFactsFor(store, DATE);
    expect(f.blocks).toBe(3);
    expect(f.focusMin).toBe(90 + 45 + 120 + 150 + 130);
  });

  it('текст итога дня (reports.dayFactsText)', async () => {
    const store = createMemoryStore(emptyData({ sessions }));
    const text = await dayFactsText({ store, ai: { analyze: async () => null }, send: async () => true, now: new Date() }, DATE);
    expect(text).toContain('блоков 3 из 3');
  });

  it('данные для AI-анализа (context.buildPayload)', async () => {
    const store = createMemoryStore(emptyData({ sessions }));
    const p = await buildPayload(store, 'day', DATE);
    expect(p.focusByDay[DATE].blocks).toBe(3);
  });
});
