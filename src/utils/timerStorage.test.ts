import { describe, it, expect } from 'vitest';
import { computeTimer } from '@shared/timer';
import { legacyToTimerState, type PersistentTimerSession } from './timerStorage';

const T0 = Date.parse('2026-11-17T03:00:00.000Z');
const legacy = (over: Partial<PersistentTimerSession>): PersistentTimerSession => ({
  mode: 'work', isRunning: true, startTime: T0, accumulatedSeconds: 600, targetMinutes: 120, title: 'Монтаж',
  selectedTaskId: 't1', ambientSound: 'none', timerType: 'countdown', lastUpdated: T0, ...over,
});

describe('перенос старой сессии таймера (questflow_timer_session_v1) в timer_state', () => {
  it('идущий блок продолжает отсчёт без потери времени', () => {
    const st = legacyToTimerState(legacy({}), '2026-11-17')!;
    expect(st).toMatchObject({ phase: 'work', running: true, blockIndex: 1, taskId: 't1', date: '2026-11-17' });
    expect(computeTimer(st, T0 + 20 * 60_000).elapsedSec).toBe(30 * 60);
  });

  it('пауза сохраняет накопленное; старый id-заглушка task-notebook-ideas не переносится', () => {
    const st = legacyToTimerState(legacy({ isRunning: false, startTime: null, selectedTaskId: 'task-notebook-ideas' }), '2026-11-17')!;
    expect(st).toMatchObject({ running: false, accumulatedSec: 600, taskId: null });
  });

  it('ожидание (работа не начата) — переносить нечего', () => {
    expect(legacyToTimerState(legacy({ isRunning: false, startTime: null, accumulatedSeconds: 0 }), '2026-11-17')).toBeNull();
  });
});
