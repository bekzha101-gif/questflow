import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNaturalLanguageTask } from './naturalLanguageParser';

afterEach(() => {
  vi.useRealTimers();
});

describe('parseNaturalLanguageTask: «сегодня» и «завтра» по Бишкеку', () => {
  // 19:30 UTC 17 ноября = 01:30 18 ноября по Бишкеку (UTC+6)
  const LATE = new Date('2026-11-17T19:30:00Z');

  it('«сегодня» ночью по Бишкеку — уже следующая дата, а не дата по UTC', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(LATE);
    expect(parseNaturalLanguageTask('Купить хлеб сегодня').dueDate).toBe('2026-11-18');
  });

  it('«завтра» и «послезавтра» считаются от сегодня по Бишкеку', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(LATE);
    expect(parseNaturalLanguageTask('Монтаж завтра').dueDate).toBe('2026-11-19');
    expect(parseNaturalLanguageTask('Монтаж послезавтра').dueDate).toBe('2026-11-20');
    expect(parseNaturalLanguageTask('Edit video tomorrow').dueDate).toBe('2026-11-19');
  });
});

describe('«сегодня» по UTC в src не осталось', () => {
  it("нет toISOString().split('T')[0] ни в одном файле src", () => {
    // Исходники как текст (без node:fs — тайпчек сайта идёт без типов node)
    const files = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(50);
    const bad = Object.entries(files)
      .filter(([, text]) => text.includes(".toISOString().split('T')[0]"))
      .map(([path]) => path);
    expect(bad).toEqual([]);
  });
});
