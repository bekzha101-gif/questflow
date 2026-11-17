import { describe, it, expect } from 'vitest';
import type { TimerState } from './types';
import {
  WORK_MIN,
  BREAK_MIN,
  BLOCKS_PER_DAY,
  IDLE_TIMER,
  computeTimer,
  startBlock,
  pauseTimer,
  resumeTimer,
  nextAfterExpire,
  settleTimer,
  blockRecord,
  blockSessionId,
  nextBlockNumber,
  canStartBlock,
  dayNormDone,
  cancelBlock,
  formatWorked,
  blockReward,
} from './timer';

const MIN = 60_000;
// 2026-11-17 09:00 по Бишкеку (UTC+6) — вторник
const T0 = Date.parse('2026-11-17T03:00:00.000Z');
const TODAY = '2026-11-17';
const FRIDAY = '2026-11-20';

const started = (taskId: string | null = 't1') => startBlock(IDLE_TIMER, T0, { today: TODAY, taskId });

describe('константы цикла', () => {
  it('120 / 20 / 3 — как в брифе и в server/src/timerWatch.ts', () => {
    expect([WORK_MIN, BREAK_MIN, BLOCKS_PER_DAY]).toEqual([120, 20, 3]);
  });
});

describe('пауза и перезагрузка не сбрасывают время', () => {
  it('пауза → старт продолжает счёт с того же места', () => {
    const s = started();
    const paused = pauseTimer(s, T0 + 30 * MIN);
    // на паузе час — время стоит
    expect(computeTimer(paused, T0 + 90 * MIN).elapsedSec).toBe(30 * 60);
    const resumed = resumeTimer(paused, T0 + 90 * MIN);
    const v = computeTimer(resumed, T0 + 100 * MIN);
    expect(v.elapsedSec).toBe(40 * 60);
    expect(v.remainingSec).toBe(80 * 60);
    expect(v.expired).toBe(false);
  });

  it('состояние после JSON (перезагрузка, другое устройство) даёт тот же отсчёт — в работе и в паузе', () => {
    const running = started();
    const paused = pauseTimer(running, T0 + 45 * MIN);
    for (const st of [running, paused]) {
      const restored = JSON.parse(JSON.stringify(st)) as TimerState;
      expect(computeTimer(restored, T0 + 50 * MIN)).toEqual(computeTimer(st, T0 + 50 * MIN));
    }
    expect(computeTimer(JSON.parse(JSON.stringify(paused)), T0 + 300 * MIN).elapsedSec).toBe(45 * 60);
  });
});

describe('цикл блоков', () => {
  it('первый блок дня — блок 1, работа 120 мин, задача и дата сохраняются', () => {
    const s = started('task-a');
    expect(s).toMatchObject({ phase: 'work', running: true, blockIndex: 1, targetMin: 120, taskId: 'task-a', date: TODAY });
    expect(computeTimer(s, T0).remainingSec).toBe(120 * 60);
  });

  it('после 120 минут сам начинается отдых 20 минут — с момента окончания работы', () => {
    const s = started();
    const now = T0 + 130 * MIN;
    expect(computeTimer(s, now).expired).toBe(true);
    const br = nextAfterExpire(s, now);
    expect(br).toMatchObject({ phase: 'break', running: true, targetMin: 20, blockIndex: 1 });
    expect(Date.parse(br.startedAt!)).toBe(T0 + 120 * MIN);
    expect(computeTimer(br, now)).toMatchObject({ phase: 'break', elapsedSec: 600, remainingSec: 600, expired: false });
  });

  it('после отдыха работа сама не стартует: предлагается блок 2 из 3 (номер = blockIndex+1, как у сервера)', () => {
    const br = nextAfterExpire(started(), T0 + 120 * MIN);
    // отдых истёк — состояние не меняется само, сервер видит истёкший отдых
    expect(settleTimer(br, T0 + 200 * MIN)).toEqual(br);
    expect(nextBlockNumber(br, TODAY)).toBe(2);
    expect(nextBlockNumber(br, TODAY)).toBe(br.blockIndex + 1);
    const idle = nextAfterExpire(br, T0 + 140 * MIN);
    expect(idle).toMatchObject({ phase: 'idle', running: false, blockIndex: 1 });
  });

  it('после 3-го блока — норма дня выполнена', () => {
    let s: TimerState = IDLE_TIMER;
    let t = T0;
    for (let i = 1; i <= 3; i++) {
      expect(dayNormDone(s, TODAY)).toBe(false);
      s = startBlock(s, t, { today: TODAY, taskId: null });
      expect(s.blockIndex).toBe(i);
      t += 120 * MIN;
      s = nextAfterExpire(s, t);
      t += 20 * MIN;
    }
    expect(dayNormDone(s, TODAY)).toBe(true);
    // 6 ч работы + 1 ч отдыха
    expect(t - T0).toBe(7 * 60 * MIN);
  });

  it('новый день начинается с блока 1', () => {
    const br = nextAfterExpire(started(), T0 + 120 * MIN);
    expect(nextBlockNumber(br, '2026-11-18')).toBe(1);
    expect(dayNormDone({ ...br, blockIndex: 3 }, '2026-11-18')).toBe(false);
  });

  it('отмена блока в первую минуту возвращает к тому же номеру', () => {
    const c = cancelBlock(started());
    expect(c.phase).toBe('idle');
    expect(nextBlockNumber(c, TODAY)).toBe(1);
  });
});

describe('блок, истёкший при закрытом сайте', () => {
  it('засчитывается по факту: 120 минут, даже если сайт открыт через 5 часов', () => {
    const s = started('task-b');
    const rec = blockRecord(s, T0 + 300 * MIN)!;
    expect(rec).toMatchObject({ id: blockSessionId(s), minutes: 120, blockIndex: 1, taskId: 'task-b', date: TODAY, full: true });
    expect(Date.parse(rec.endedAt)).toBe(T0 + 120 * MIN);
    expect(Date.parse(rec.startedAt)).toBe(T0);
  });

  it('досрочное завершение — по фактическим минутам с учётом паузы', () => {
    const s = resumeTimer(pauseTimer(started(), T0 + 20 * MIN), T0 + 50 * MIN);
    const rec = blockRecord(s, T0 + 80 * MIN)!;
    expect(rec.minutes).toBe(50);
    expect(rec.full).toBe(false);
  });

  it('settleTimer переводит истёкшую работу в отдых; давно истёкший отдых помечен notifiedEnd (сервер не шлёт запоздалое)', () => {
    const s = started();
    const fresh = settleTimer(s, T0 + 125 * MIN);
    expect(fresh).toMatchObject({ phase: 'break', notifiedEnd: false });
    const stale = settleTimer(s, T0 + 300 * MIN);
    expect(stale).toMatchObject({ phase: 'break', notifiedEnd: true });
    expect(computeTimer(stale, T0 + 300 * MIN).expired).toBe(true);
  });

  it('id сессии стабилен: две вкладки пишут одну строку focus_sessions', () => {
    expect(blockSessionId(started())).toBe(`focus-${TODAY}-b1`);
  });
});

describe('пятница — день восстановления', () => {
  it('старт блока недоступен', () => {
    expect(canStartBlock(IDLE_TIMER, FRIDAY)).toBe(false);
    expect(startBlock(IDLE_TIMER, T0, { today: FRIDAY, taskId: null })).toEqual(IDLE_TIMER);
    expect(canStartBlock(IDLE_TIMER, TODAY)).toBe(true);
  });

  it('во время работы второй блок не стартует', () => {
    expect(canStartBlock(started(), TODAY)).toBe(false);
  });
});

describe('подписи и награда', () => {
  it('«ты проработал 2ч 00м»', () => {
    expect(formatWorked(120 * 60)).toBe('2ч 00м');
    expect(formatWorked(95 * 60 + 40)).toBe('1ч 35м');
    expect(formatWorked(7 * 60)).toBe('0ч 07м');
  });

  it('EXP/золото блока — прежние формулы: 1,5 и 0,8 за минуту, +50/+25 за полный блок', () => {
    expect(blockReward(120, true)).toEqual({ exp: 230, gold: 121 });
    expect(blockReward(30, false)).toEqual({ exp: 45, gold: 24 });
  });
});
