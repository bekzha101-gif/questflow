// Наблюдение за timer_state: сколько прошло и истёк ли отрезок.
// Константы цикла 120/20 × 3 совпадают с interfaces.md §1 (shared/timer.ts).
// Когда таск 03 выставит shared/timer.ts, эту функцию стоит заменить на computeTimer.
import type { TimerState } from '../../shared/types';

export const WORK_MIN = 120;
export const BREAK_MIN = 20;
export const BLOCKS_PER_DAY = 3;

export interface TimerProgress {
  elapsedSec: number;
  targetSec: number;
  expired: boolean;
}

/** null — таймер не идёт (пауза, idle или нет времени старта) */
export function timerProgress(t: TimerState, nowMs: number): TimerProgress | null {
  if (!t.running || t.phase === 'idle' || !t.startedAt) return null;
  const started = Date.parse(t.startedAt);
  if (Number.isNaN(started)) return null;
  const elapsedSec = Math.max(0, Number(t.accumulatedSec ?? 0) + (nowMs - started) / 1000);
  const targetMin = Number(t.targetMin) > 0 ? Number(t.targetMin) : t.phase === 'work' ? WORK_MIN : BREAK_MIN;
  const targetSec = targetMin * 60;
  return { elapsedSec, targetSec, expired: elapsedSec >= targetSec };
}
