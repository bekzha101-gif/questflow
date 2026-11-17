import { describe, it, expect } from 'vitest';
import {
  dayDelta,
  explainDrop,
  influenceFactors,
  isDropDay,
  monthDates,
  shiftMonth,
  type BigDataDayInput,
} from './bigdata';

// Ряд «10 дней по 7–8 баллов, на 11-й упало» — пример из брифа
function stableRun(): BigDataDayInput[] {
  const days: BigDataDayInput[] = [];
  for (let i = 1; i <= 10; i++) {
    days.push({
      date: `2026-11-${String(i).padStart(2, '0')}`,
      score: i % 2 ? 7 : 8,
      sleepMin: 450,
      sleepQuality: 85,
      supplements: ['Erinamax', 'Tiger Milk'],
      waterOk: true,
      focusMin: 360,
      habitsMissed: [],
    });
  }
  return days;
}

describe('dayDelta', () => {
  it('считает разницу с средним предыдущих дней', () => {
    const days = stableRun();
    days.push({ date: '2026-11-11', score: 4 });
    // предыдущие 7 дней с оценкой: 4..10 → 8,7,8,7,8,7,8 → среднее 53/7
    expect(dayDelta(days, '2026-11-11')).toBeCloseTo(4 - 53 / 7, 5);
  });

  it('null для первого дня и для дня без оценки', () => {
    expect(dayDelta([{ date: '2026-11-01', score: 7 }], '2026-11-01')).toBeNull();
    expect(dayDelta([], '2026-11-01')).toBeNull();
    expect(dayDelta([{ date: '2026-11-01', score: 7 }, { date: '2026-11-02' }], '2026-11-02')).toBeNull();
  });

  it('спадом считается падение на 1.5 балла и больше', () => {
    const days = stableRun();
    days.push({ date: '2026-11-11', score: 4 });
    expect(isDropDay(days, '2026-11-11')).toBe(true);
    expect(isDropDay(days, '2026-11-10')).toBe(false);
  });
});

describe('explainDrop', () => {
  it('называет причины: сон ниже среднего, новый БАД, пропущенная привычка, мало фокуса', () => {
    const days = stableRun();
    days.push({
      date: '2026-11-11',
      score: 4,
      sleepMin: 320,
      supplements: ['Erinamax', 'Tiger Milk', 'Мелатонин'],
      habitsMissed: ['Медитация'],
      focusMin: 90,
      waterOk: true,
    });
    const kinds = explainDrop(days, '2026-11-11', {}).map((r) => r.kind);
    expect(kinds).toContain('sleep_low');
    expect(kinds).toContain('new_supplement');
    expect(kinds).toContain('habit_missed');
    expect(kinds).toContain('focus_low');
    expect(kinds).not.toContain('water_missed');
    const newSupp = explainDrop(days, '2026-11-11', {}).find((r) => r.kind === 'new_supplement');
    expect(newSupp?.label).toContain('Мелатонин');
  });

  it('пропущенный обычный БАД и вода', () => {
    const days = stableRun();
    days.push({ date: '2026-11-11', score: 4, sleepMin: 450, supplements: ['Erinamax'], waterOk: false, focusMin: 360 });
    const kinds = explainDrop(days, '2026-11-11', {}).map((r) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(['supplement_skipped', 'water_missed']));
    expect(kinds).not.toContain('sleep_low');
  });

  it('без истории и без дня — пусто, без выдумок', () => {
    expect(explainDrop([], '2026-11-11', {})).toEqual([]);
    expect(explainDrop([{ date: '2026-11-11', score: 3 }], '2026-11-11', {})).toEqual([]);
  });
});

describe('influenceFactors', () => {
  it('меньше 14 дней с оценкой — мало данных', () => {
    expect(influenceFactors(stableRun(), {})).toBe('not_enough_data');
    expect(influenceFactors([], {})).toBe('not_enough_data');
  });

  it('находит, что сон 7+ ч поднимает оценку, с силой влияния', () => {
    const days: BigDataDayInput[] = [];
    for (let i = 1; i <= 20; i++) {
      const good = i % 2 === 0;
      days.push({
        date: `2026-10-${String(i).padStart(2, '0')}`,
        score: good ? 8 : 5,
        sleepMin: good ? 480 : 330,
      });
    }
    const res = influenceFactors(days, {});
    expect(res).not.toBe('not_enough_data');
    if (res === 'not_enough_data') return;
    const sleep = res.find((f) => f.id === 'sleep_7h');
    expect(sleep).toBeDefined();
    expect(sleep!.effect).toBeCloseTo(3, 5);
    expect(sleep!.strength).toBe('strong');
    expect(res[0].id).toBe('sleep_7h');
  });

  it('не выдумывает фактор, если в группе мало дней', () => {
    const days: BigDataDayInput[] = [];
    for (let i = 1; i <= 15; i++) {
      days.push({ date: `2026-10-${String(i).padStart(2, '0')}`, score: 7, sleepMin: 480, waterOk: i !== 1 });
    }
    const res = influenceFactors(days, {});
    if (res === 'not_enough_data') throw new Error('должно хватить данных');
    expect(res.find((f) => f.id === 'water')).toBeUndefined();
    expect(res.find((f) => f.id === 'sleep_7h')).toBeUndefined();
  });
});

describe('месяцы', () => {
  it('monthDates даёт все дни месяца, не только август', () => {
    expect(monthDates('2026-11')).toHaveLength(30);
    expect(monthDates('2026-11')[0]).toBe('2026-11-01');
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-08').at(-1)).toBe('2026-08-31');
  });

  it('shiftMonth листает через год', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
