import { describe, it, expect } from 'vitest';
import type { BigDataDay } from '@shared/types';
import { applySleepImport, parseSleepCycleCsv, planSleepImport, sleepCycleDate } from './sleepCycleParser';

// Новый экспорт Sleep Cycle: секунды
const CSV_NEW = [
  'Start;End;Sleep quality;Regularity;Awake (seconds);Asleep (seconds);Asleep after (seconds);Time in bed (seconds);Time asleep (seconds)',
  '2026-11-14 23:40:12;2026-11-15 07:15:03;84%;90%;300;25200;600;27291;25200',
  '2026-11-15 23:55:00;2026-11-16 06:40:00;71%;85%;0;0;0;24300;0',
].join('\n');

// Старый экспорт: «Time in bed» как ч:мм
const CSV_OLD = [
  'Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes;Heart rate;Activity (steps)',
  '"2026-10-01 23:10:00";"2026-10-02 06:45:00";"88%";"7:35";":)";"";"54";"9000"',
  '2026-10-02 14:00:00;2026-10-02 14:30:00;40%;0:30;;;;',
].join('\r\n');

describe('парсер CSV Sleep Cycle', () => {
  it('новый формат: сон из Asleep (seconds), иначе Time in bed; дата — день пробуждения', () => {
    const n = parseSleepCycleCsv(CSV_NEW);
    expect(n).toEqual([
      { date: '2026-11-15', start: '2026-11-14 23:40:12', end: '2026-11-15 07:15:03', sleepMin: 420, sleepQuality: 84 },
      { date: '2026-11-16', start: '2026-11-15 23:55:00', end: '2026-11-16 06:40:00', sleepMin: 405, sleepQuality: 71 },
    ]);
  });

  it('старый формат в кавычках; дневной сон складывается, качество — от самой длинной записи', () => {
    const n = parseSleepCycleCsv(CSV_OLD);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ date: '2026-10-02', sleepMin: 455 + 30, sleepQuality: 88 });
  });

  it('без длительности считает по Start/End; без качества — качество не выдумывается', () => {
    const n = parseSleepCycleCsv('Start;End\n2026-11-01 23:00:00;2026-11-02 06:30:00');
    expect(n).toEqual([{ date: '2026-11-02', start: '2026-11-01 23:00:00', end: '2026-11-02 06:30:00', sleepMin: 450 }]);
  });

  it('мусор, пустой файл и строки без даты пропускаются', () => {
    expect(parseSleepCycleCsv('')).toEqual([]);
    expect(parseSleepCycleCsv('a;b\n1;2')).toEqual([]);
    expect(parseSleepCycleCsv('Start;End;Sleep quality\nnope;nope;80%')).toEqual([]);
  });

  it('дата с часовым поясом считается по Бишкеку (UTC+6)', () => {
    expect(sleepCycleDate('2026-11-15T20:30:00Z')).toBe('2026-11-16');
    expect(sleepCycleDate('2026-11-15 20:30:00')).toBe('2026-11-15');
  });
});

describe('слияние с днями Big Data', () => {
  const nights = parseSleepCycleCsv(CSV_NEW);

  it('пустые дни — сразу, заполненные вручную — только с подтверждением, совпадающие — пропуск', () => {
    const days: BigDataDay[] = [
      { date: '2026-11-15', sleepMin: 420, sleepQuality: 84, score: 7 } as BigDataDay,
      { date: '2026-11-16', sleepMin: 480, why: 'вручную' } as BigDataDay,
    ];
    const plan = planSleepImport(nights, days);
    expect(plan.fresh).toEqual([]);
    expect(plan.same).toEqual(['2026-11-15']);
    expect(plan.conflicts).toMatchObject([{ date: '2026-11-16', sleepMin: 405, currentMin: 480 }]);

    const keep = applySleepImport(plan, false);
    expect(keep).toEqual({ writes: [], added: 0, skipped: 2 });

    const over = applySleepImport(plan, true);
    expect(over.added).toBe(1);
    expect(over.skipped).toBe(1);
    expect(over.writes).toEqual([{ date: '2026-11-16', patch: { sleepMin: 405, sleepQuality: 71 } }]);
  });

  it('день без сна (только оценка) заполняется без вопросов', () => {
    const plan = planSleepImport(nights, [{ date: '2026-11-15', score: 6 } as BigDataDay]);
    expect(plan.fresh.map((f) => f.date)).toEqual(['2026-11-15', '2026-11-16']);
    expect(applySleepImport(plan, false)).toMatchObject({ added: 2, skipped: 0 });
  });
});
