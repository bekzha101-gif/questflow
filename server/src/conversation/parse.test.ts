import { describe, expect, it } from 'vitest';
import { isNo, matchNames, parseMoney, parsePercent, parseScore, parseSleep } from './parse';

const habits = [
  { id: 'h-water', title: 'Вода 2 л' },
  { id: 'h-med', title: 'Медитация 20 мин' },
  { id: 'h-rec', title: 'Восстановление' },
  { id: 'h-read', title: 'Чтение' },
];

describe('разбор ответов', () => {
  it('«воду выпил, медитировал» — отмечает воду и медитацию, остальное нет', () => {
    expect(matchNames('воду выпил, медитировал', habits).map((h) => h.id)).toEqual(['h-water', 'h-med']);
  });

  it('отрицание «не медитировал» не отмечает привычку', () => {
    expect(matchNames('выпил воду, но не медитировал', habits).map((h) => h.id)).toEqual(['h-water']);
  });

  it('БАДы по названию без учёта регистра', () => {
    const sups = [
      { id: 's1', title: 'Erinamax' },
      { id: 's2', title: 'Tiger Milk' },
      { id: 's3', title: 'Омега-3' },
    ];
    expect(matchNames('пил эринамакс? нет, только tiger milk и омегу', sups).map((s) => s.id)).toEqual(['s2', 's3']);
  });

  it('оценка дня и почему', () => {
    expect(parseScore('7, потому что сделал два блока')).toEqual({ score: 7, why: 'потому что сделал два блока' });
    expect(parseScore('10')).toEqual({ score: 10, why: '' });
    expect(parseScore('оценка восемь')).toBeNull();
    expect(parseScore('15 из 10')).toBeNull();
  });

  it('сон текстом: «7ч 30м 85%», «6:45», «7.5 часов»', () => {
    expect(parseSleep('7ч 30м 85%')).toEqual({ sleepMin: 450, quality: 85 });
    expect(parseSleep('6:45')).toEqual({ sleepMin: 405, quality: undefined });
    expect(parseSleep('спал 7.5 часов, качество 70')).toEqual({ sleepMin: 450, quality: 70 });
    expect(parseSleep('плохо')).toBeNull();
  });

  it('проценты и деньги', () => {
    expect(parsePercent('сделал процентов 60')).toBe(60);
    expect(parsePercent('120%')).toBe(100);
    expect(parsePercent('много')).toBeNull();
    expect(parseMoney('$12,5')).toBe(12.5);
    expect(parseMoney('0')).toBe(0);
    expect(parseMoney('не знаю')).toBeNull();
  });

  it('«нет», «ничего», «пропустить»', () => {
    expect(isNo('нет')).toBe(true);
    expect(isNo('Ничего.')).toBe(true);
    expect(isNo('пропусти')).toBe(true);
    expect(isNo('нет воды')).toBe(false);
  });
});
