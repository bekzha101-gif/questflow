// Таймер 120/20 × 3: чистые правила без React, DOM и сети — общие для сайта и сервера.
// Состояние (TimerState) лежит в Supabase timer_state; отсчёт всегда считается от времени,
// поэтому пауза, перезагрузка и другое устройство не сбрасывают его.
//
// Нумерация: blockIndex — номер текущего или последнего законченного блока за день `date` (1..),
// 0 — блоков сегодня ещё не было. В отдыхе после блока N следующий — N+1
// (так же считает server/src/timerWatch.ts: «Отдых закончился. Можно начинать блок blockIndex+1»).
import type { TimerState, TimerPhase } from './types';
import { isRecoveryDay } from './time';

export const WORK_MIN = 120;
export const BREAK_MIN = 20;
export const BLOCKS_PER_DAY = 3;

export const IDLE_TIMER: TimerState = {
  phase: 'idle',
  running: false,
  startedAt: null,
  accumulatedSec: 0,
  targetMin: WORK_MIN,
  blockIndex: 0,
  taskId: null,
  notifiedEnd: false,
};

export interface TimerView {
  phase: TimerPhase;
  elapsedSec: number;
  remainingSec: number;
  expired: boolean;
}

/** Законченный блок работы — строка для focus_sessions */
export interface BlockRecord {
  id: string;
  date: string;
  blockIndex: number;
  startedAt: string;
  endedAt: string;
  minutes: number;
  taskId: string | null;
  /** Блок отработан целиком (120 мин) */
  full: boolean;
}

function targetSec(s: TimerState): number {
  const min = Number(s.targetMin) > 0 ? Number(s.targetMin) : s.phase === 'break' ? BREAK_MIN : WORK_MIN;
  return min * 60;
}

function startedMs(s: TimerState): number | null {
  if (!s.running || !s.startedAt) return null;
  const ms = Date.parse(s.startedAt);
  return Number.isNaN(ms) ? null : ms;
}

/** Точное число секунд отрезка (без округления) */
function elapsedExact(s: TimerState, now: number): number {
  const acc = Math.max(0, Number(s.accumulatedSec) || 0);
  const st = startedMs(s);
  return st === null ? acc : acc + Math.max(0, (now - st) / 1000);
}

/** Сколько прошло и осталось в текущем отрезке (работа или отдых) */
export function computeTimer(state: TimerState, now: number): TimerView {
  if (state.phase === 'idle') return { phase: 'idle', elapsedSec: 0, remainingSec: 0, expired: false };
  const target = targetSec(state);
  const elapsedSec = Math.floor(elapsedExact(state, now));
  return {
    phase: state.phase,
    elapsedSec,
    remainingSec: Math.max(0, target - elapsedSec),
    expired: elapsedSec >= target,
  };
}

/** Момент окончания отрезка: истёк — когда истёк, иначе сейчас (досрочно) */
function segmentEnd(state: TimerState, now: number): number {
  const target = targetSec(state);
  const exact = elapsedExact(state, now);
  const st = startedMs(state);
  if (exact >= target && st !== null) {
    const acc = Math.max(0, Number(state.accumulatedSec) || 0);
    return st + Math.max(0, target - acc) * 1000;
  }
  return now;
}

/** Номер следующего блока: в новый день — 1 */
export function nextBlockNumber(state: TimerState, today: string): number {
  return state.date === today ? Math.max(0, state.blockIndex || 0) + 1 : 1;
}

/** Можно ли начать блок: не пятница и работа сейчас не идёт */
export function canStartBlock(state: TimerState, today: string): boolean {
  return !isRecoveryDay(today) && state.phase !== 'work';
}

/** Начать блок работы (из ожидания или досрочно из отдыха). В пятницу — без изменений. */
export function startBlock(
  state: TimerState,
  now: number,
  opts: { today: string; taskId: string | null },
): TimerState {
  if (!canStartBlock(state, opts.today)) return state;
  return {
    phase: 'work',
    running: true,
    startedAt: new Date(now).toISOString(),
    accumulatedSec: 0,
    targetMin: WORK_MIN,
    blockIndex: nextBlockNumber(state, opts.today),
    taskId: opts.taskId,
    date: opts.today,
    notifiedEnd: false,
  };
}

/** Пауза: прошедшее время копится в accumulatedSec */
export function pauseTimer(state: TimerState, now: number): TimerState {
  if (!state.running || state.phase === 'idle') return state;
  return { ...state, running: false, startedAt: null, accumulatedSec: elapsedExact(state, now) };
}

/** Продолжить с того же места */
export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.running || state.phase === 'idle') return state;
  return { ...state, running: true, startedAt: new Date(now).toISOString(), notifiedEnd: false };
}

/** Отмена блока, только что начатого по ошибке: номер блока не тратится */
export function cancelBlock(state: TimerState): TimerState {
  if (state.phase !== 'work') return state;
  return { ...IDLE_TIMER, blockIndex: Math.max(0, (state.blockIndex || 0) - 1), date: state.date };
}

/**
 * Переход после отрезка. Работа → отдых 20 мин с момента окончания работы (истёкшей или
 * законченной досрочно). Отдых → ожидание следующего блока (работа сама не стартует).
 * Отдых, который к `now` уже истёк, помечается notifiedEnd: сообщать о нём поздно.
 */
export function nextAfterExpire(state: TimerState, now: number): TimerState {
  if (state.phase === 'work') {
    const end = segmentEnd(state, now);
    const brk: TimerState = {
      phase: 'break',
      running: true,
      startedAt: new Date(end).toISOString(),
      accumulatedSec: 0,
      targetMin: BREAK_MIN,
      blockIndex: state.blockIndex,
      taskId: state.taskId ?? null,
      date: state.date,
      notifiedEnd: false,
    };
    return { ...brk, notifiedEnd: computeTimer(brk, now).expired };
  }
  if (state.phase === 'break') {
    return { ...IDLE_TIMER, blockIndex: state.blockIndex, date: state.date };
  }
  return state;
}

/**
 * Привести состояние к `now`: истёкшая работа становится отдыхом.
 * Истёкший отдых остаётся как есть — сайт предлагает следующий блок, сервер шлёт «отдых закончился».
 */
export function settleTimer(state: TimerState, now: number): TimerState {
  if (state.phase === 'work' && computeTimer(state, now).expired) return nextAfterExpire(state, now);
  return state;
}

/** Стабильный id строки focus_sessions для блока: одна строка, сколько бы вкладок её ни писали */
export function blockSessionId(state: TimerState): string {
  return `focus-${state.date ?? 'none'}-b${state.blockIndex}`;
}

/** Итог блока работы по фактическому времени (не больше 120 мин) */
export function blockRecord(state: TimerState, now: number): BlockRecord | null {
  if (state.phase !== 'work') return null;
  const target = targetSec(state);
  const worked = Math.min(target, elapsedExact(state, now));
  const end = segmentEnd(state, now);
  return {
    id: blockSessionId(state),
    date: state.date ?? '',
    blockIndex: state.blockIndex,
    startedAt: new Date(end - worked * 1000).toISOString(),
    endedAt: new Date(end).toISOString(),
    minutes: Math.round(worked / 60),
    taskId: state.taskId ?? null,
    full: worked >= target,
  };
}

/** Норма дня (3 блока) выполнена и работа сейчас не идёт */
export function dayNormDone(state: TimerState, today: string): boolean {
  return state.date === today && state.phase !== 'work' && (state.blockIndex || 0) >= BLOCKS_PER_DAY;
}

/** «2ч 00м» */
export function formatWorked(sec: number): string {
  const total = Math.max(0, Math.floor(sec / 60));
  return `${Math.floor(total / 60)}ч ${String(total % 60).padStart(2, '0')}м`;
}

/** EXP и золото за блок (прежние формулы таймера): 1,5 и 0,8 за минуту, +50/+25 за полный блок */
export function blockReward(minutes: number, full: boolean): { exp: number; gold: number } {
  return { exp: Math.round(minutes * 1.5) + (full ? 50 : 0), gold: Math.round(minutes * 0.8) + (full ? 25 : 0) };
}
