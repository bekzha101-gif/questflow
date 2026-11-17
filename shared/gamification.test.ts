import { describe, expect, it } from 'vitest';
import type { GameEvent, GameStats } from './types';
import {
  ACHIEVEMENTS,
  RULES,
  applyEvent,
  dayOutcome,
  eveningMissedEvent,
  eveningReminderDue,
  focusReward,
  pendingDayCloses,
  shopLocked,
  type ApplyContext,
  type DayFacts,
} from './gamification';

// Время в тестах — фиксированное: 2026-11-17 (вторник) 12:00 по Бишкеку = 06:00 UTC
const NOW = new Date('2026-11-17T06:00:00Z');

const base = (patch: Partial<GameStats> = {}): GameStats => ({
  level: 1,
  exp: 0,
  maxExp: 100,
  hp: 100,
  maxHp: 100,
  gold: 0,
  streak: 0,
  ...patch,
});

const ctx = (patch: Partial<ApplyContext> = {}): ApplyContext => ({ now: NOW, ...patch });

const day = (patch: Partial<DayFacts> & { date: string }): DayFacts => ({
  focusMin: 0,
  blocks: 0,
  habitsDone: 0,
  habitsTotal: 0,
  ...patch,
});

describe('RULES и награды', () => {
  it('золото в основном за фокус: полный блок дороже привычки, публикации и задачи', () => {
    const block = focusReward(120, true);
    expect(block.gold).toBeGreaterThan(RULES.habit.gold);
    expect(block.gold).toBeGreaterThan(RULES.videoPublished.gold);
    expect(block.gold).toBeGreaterThan(RULES.task.gold);
  });

  it('фокус: блок 120 мин даёт EXP и золото по таблице правил', () => {
    const r = applyEvent(base(), { kind: 'focus_block', ref: 'focus-2026-11-17-b1', minutes: 120, full: true }, ctx());
    // 120 × 1.5 + 50 = 230 EXP → уровень 2 (100), уровень 3 (130), остаток 0
    expect(r.applied).toBe(true);
    expect(r.stats.gold).toBe(Math.round(120 * 0.8) + 25 + RULES.levelUp.gold * 2);
    expect(r.stats.level).toBe(3);
    expect(r.events[0]).toMatchObject({ id: 'focus_block:focus-2026-11-17-b1', kind: 'focus_block', deltaExp: 230, at: NOW.toISOString() });
  });

  it('привычка даёт награду привычки', () => {
    const r = applyEvent(base(), { kind: 'habit', ref: '2026-11-17:h1' }, ctx());
    expect(r.stats.exp).toBe(RULES.habit.exp);
    expect(r.stats.gold).toBe(RULES.habit.gold);
  });

  it('публикация видео даёт награду публикации', () => {
    const r = applyEvent(base(), { kind: 'video_published', ref: 'video-1' }, ctx());
    expect(r.stats.exp).toBe(RULES.videoPublished.exp);
    expect(r.stats.gold).toBe(RULES.videoPublished.gold);
  });

  it('цель недели и цель месяца дают свои награды', () => {
    const w = applyEvent(base({ maxExp: 10_000 }), { kind: 'goal_week', ref: 'g1-w1' }, ctx());
    expect(w.stats.gold).toBe(RULES.goalWeek.gold);
    const m = applyEvent(base({ maxExp: 10_000 }), { kind: 'goal_month', ref: 'g1' }, ctx());
    expect(m.stats.gold).toBe(RULES.goalMonth.gold);
    expect(m.stats.exp).toBe(RULES.goalMonth.exp);
  });

  it('повтор события с тем же ref не начисляет награду дважды', () => {
    const first = applyEvent(base(), { kind: 'video_published', ref: 'video-1' }, ctx());
    const again = applyEvent(first.stats, { kind: 'video_published', ref: 'video-1' }, ctx({ journal: first.events }));
    expect(again.applied).toBe(false);
    expect(again.rejected).toBe('duplicate');
    expect(again.stats).toEqual(first.stats);
    expect(again.events).toEqual([]);
  });

  it('уровень растёт: остаток EXP переносится, следующий порог ×1.3', () => {
    const r = applyEvent(base({ exp: 90 }), { kind: 'video_published', ref: 'v' }, ctx());
    expect(r.stats.level).toBe(2);
    expect(r.stats.exp).toBe(90 + RULES.videoPublished.exp - 100);
    expect(r.stats.maxExp).toBe(130);
    expect(r.leveledUp).toBe(1);
  });
});

describe('доход', () => {
  it('каждые полные $100 дохода — EXP по таблице', () => {
    const r = applyEvent(base({ maxExp: 100_000 }), { kind: 'income', ref: 'inc-1', amountUsd: 250 }, ctx());
    expect(r.stats.incomeUsdTotal).toBe(250);
    expect(r.stats.exp).toBe(2 * RULES.incomeExpPer100);
    // ещё $50 → всего $300: добавляется одна сотня
    const r2 = applyEvent(r.stats, { kind: 'income', ref: 'inc-2', amountUsd: 50 }, ctx({ journal: r.events }));
    expect(r2.stats.incomeUsdTotal).toBe(300);
    expect(r2.stats.exp).toBe(3 * RULES.incomeExpPer100);
  });

  it('первые $1000 открывают ачивку', () => {
    const r = applyEvent(base({ maxExp: 100_000 }), { kind: 'income', ref: 'inc-1', amountUsd: 1000 }, ctx());
    expect(r.unlocked).toContain('income_1000');
  });
});

describe('итог дня, серия и штрафы', () => {
  it('dayOutcome: пятница — восстановление; 3 блока — норма; иначе пропуск', () => {
    expect(dayOutcome(day({ date: '2026-11-20' }))).toBe('recovery');
    expect(dayOutcome(day({ date: '2026-11-17', blocks: 3, focusMin: 360 }))).toBe('norm');
    expect(dayOutcome(day({ date: '2026-11-17', blocks: 2, focusMin: 240 }))).toBe('missed');
  });

  it('серия +1 за день с 3 блоками и всеми привычками', () => {
    const r = applyEvent(base({ streak: 4 }), { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 3, focusMin: 360, habitsDone: 5, habitsTotal: 5 }) }, ctx());
    expect(r.stats.streak).toBe(5);
    expect(r.stats.bestStreak).toBe(5);
    expect(r.stats.lastClosedDate).toBe('2026-11-16');
  });

  it('пропущенная привычка обнуляет серию, но не штрафует HP', () => {
    const r = applyEvent(base({ streak: 4 }), { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 3, focusMin: 360, habitsDone: 4, habitsTotal: 5 }) }, ctx());
    expect(r.stats.streak).toBe(0);
    expect(r.stats.hp).toBe(100);
  });

  it('пятница не рвёт серию и не штрафует', () => {
    const r = applyEvent(base({ streak: 6, gold: 100 }), { kind: 'day_close', day: day({ date: '2026-11-20' }) }, ctx());
    expect(r.stats.streak).toBe(6);
    expect(r.stats.hp).toBe(100);
    expect(r.stats.gold).toBe(100);
  });

  it('пятница с восстановлением даёт награду дня восстановления', () => {
    const r = applyEvent(base({ hp: 20, maxExp: 10_000 }), { kind: 'day_close', day: day({ date: '2026-11-20', recoveryDone: RULES.recoveryDay.minActivities }) }, ctx());
    expect(r.stats.hp).toBe(Math.min(100, 20 + RULES.recoveryDay.hp));
    expect(r.stats.gold).toBe(RULES.recoveryDay.gold);
  });

  it('норма не выполнена (не пятница) → −HP, −золото, серия 0', () => {
    const r = applyEvent(base({ streak: 9, gold: 200 }), { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 1, focusMin: 120, habitsDone: 3, habitsTotal: 3 }) }, ctx());
    expect(r.stats.hp).toBe(100 + RULES.missedNorm.hp);
    expect(r.stats.gold).toBe(200 + RULES.missedNorm.gold);
    expect(r.stats.streak).toBe(0);
  });

  it('один день закрывается только один раз', () => {
    const ev = { kind: 'day_close' as const, day: day({ date: '2026-11-16' }) };
    const r1 = applyEvent(base({ gold: 200 }), ev, ctx());
    const r2 = applyEvent(r1.stats, ev, ctx({ journal: r1.events }));
    expect(r2.applied).toBe(false);
    expect(r2.stats.gold).toBe(r1.stats.gold);
  });

  it('HP 0 → сгорает часть золота, прогресс уровня откатывается (не уровень), магазин закрыт', () => {
    const r = applyEvent(
      base({ hp: 20, gold: 400, level: 5, exp: 70, maxExp: 300, streak: 3 }),
      { kind: 'day_close', day: day({ date: '2026-11-16' }) },
      ctx(),
    );
    expect(r.hpZero).toBe(true);
    // 400 − 50 (штраф) = 350, сгорает половина → 175
    expect(r.stats.gold).toBe(Math.round((400 + RULES.missedNorm.gold) * (1 - RULES.hpZero.goldBurnPct)));
    expect(r.stats.level).toBe(5);
    expect(r.stats.exp).toBe(0);
    expect(r.stats.streak).toBe(0);
    expect(r.stats.hp).toBeGreaterThan(0);
    expect(shopLocked(r.stats)).toBe(true);
    expect(r.events.map((e) => e.kind)).toContain('hp_zero');
  });

  it('магазин закрыт до полного дня: покупка отклоняется, полный день открывает', () => {
    const locked = base({ gold: 500, shopLocked: true });
    const buy = applyEvent(locked, { kind: 'purchase', ref: 'rew-1:1', cost: 60 }, ctx());
    expect(buy.applied).toBe(false);
    expect(buy.rejected).toBe('shop_locked');
    expect(buy.stats.gold).toBe(500);

    const half = applyEvent(locked, { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 3, focusMin: 360, habitsDone: 1, habitsTotal: 2 }) }, ctx());
    expect(shopLocked(half.stats)).toBe(true);
    const full = applyEvent(locked, { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 3, focusMin: 360, habitsDone: 2, habitsTotal: 2 }) }, ctx());
    expect(shopLocked(full.stats)).toBe(false);
  });

  it('покупка списывает золото; без золота — отказ', () => {
    const ok = applyEvent(base({ gold: 100 }), { kind: 'purchase', ref: 'r:1', cost: 60 }, ctx());
    expect(ok.stats.gold).toBe(40);
    const no = applyEvent(base({ gold: 10 }), { kind: 'purchase', ref: 'r:2', cost: 60 }, ctx());
    expect(no.rejected).toBe('not_enough_gold');
  });
});

describe('ачивки', () => {
  it('всего 7 ачивок', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual(
      ['channels_40', 'first_6h_day', 'friday_month', 'income_1000', 'streak_30', 'streak_7', 'videos_100'].sort(),
    );
  });

  it('первый день 6 ч и 7 дней подряд открываются по фактам, второй раз не открываются', () => {
    const r = applyEvent(base({ streak: 6, maxExp: 100_000 }), { kind: 'day_close', day: day({ date: '2026-11-16', blocks: 3, focusMin: 360 }) }, ctx());
    expect(r.unlocked).toEqual(expect.arrayContaining(['first_6h_day', 'streak_7']));
    expect(r.events.filter((e) => e.kind === 'achievement').length).toBe(r.unlocked.length);
    const again = applyEvent(r.stats, { kind: 'day_close', day: day({ date: '2026-11-17', blocks: 3, focusMin: 360 }) }, ctx({ journal: r.events, unlocked: r.unlocked }));
    expect(again.unlocked).toEqual([]);
  });

  it('100 видео — по журналу публикаций', () => {
    const journal: GameEvent[] = Array.from({ length: 99 }, (_, i) => ({ id: `video_published:v${i}`, at: NOW.toISOString(), kind: 'video_published', ref: `v${i}` }));
    const r = applyEvent(base({ maxExp: 100_000 }), { kind: 'video_published', ref: 'v99' }, ctx({ journal }));
    expect(r.unlocked).toContain('videos_100');
  });

  it('40 каналов — по фактам', () => {
    const r = applyEvent(base({ maxExp: 100_000 }), { kind: 'check' }, ctx({ facts: { activeChannels: 40 } }));
    expect(r.unlocked).toEqual(['channels_40']);
    expect(r.events.map((e) => e.kind)).toEqual(['achievement']);
  });

  it('месяц без пропуска пятницы: все пятницы месяца — восстановление', () => {
    // Пятницы ноября 2026: 6, 13, 20, 27
    const fri = (d: string): GameEvent => ({ id: `day_close:${d}`, at: NOW.toISOString(), kind: 'day_close', ref: d, note: 'recovery_done' });
    const journal = [fri('2026-11-06'), fri('2026-11-13'), fri('2026-11-20')];
    const done = RULES.recoveryDay.minActivities;
    const r = applyEvent(base({ maxExp: 100_000 }), { kind: 'day_close', day: day({ date: '2026-11-27', recoveryDone: done }) }, ctx({ journal }));
    expect(r.unlocked).toContain('friday_month');
    const gap = applyEvent(base({ maxExp: 100_000 }), { kind: 'day_close', day: day({ date: '2026-11-27', recoveryDone: done }) }, ctx({ journal: journal.slice(1) }));
    expect(gap.unlocked).not.toContain('friday_month');
  });
});

describe('правила для бота', () => {
  it('pendingDayCloses: дни после последнего закрытого до вчера; без начала правил — ничего', () => {
    expect(pendingDayCloses(base(), '2026-11-17')).toEqual([]);
    expect(pendingDayCloses(base({ rulesSince: '2026-11-17' }), '2026-11-17')).toEqual([]);
    expect(pendingDayCloses(base({ rulesSince: '2026-11-14' }), '2026-11-17')).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(pendingDayCloses(base({ rulesSince: '2026-11-01', lastClosedDate: '2026-11-15' }), '2026-11-17')).toEqual(['2026-11-16']);
  });

  it('напоминание в 22:00 один раз, не в пятницу и не после ответа', () => {
    const at22 = new Date('2026-11-17T16:00:00Z'); // 22:00 Бишкек, вторник
    const at21 = new Date('2026-11-17T15:30:00Z');
    expect(eveningReminderDue(at22, { answered: false, reminded: false })).toBe(true);
    expect(eveningReminderDue(at21, { answered: false, reminded: false })).toBe(false);
    expect(eveningReminderDue(at22, { answered: true, reminded: false })).toBe(false);
    expect(eveningReminderDue(at22, { answered: false, reminded: true })).toBe(false);
    expect(eveningReminderDue(new Date('2026-11-20T16:00:00Z'), { answered: false, reminded: false })).toBe(false);
  });

  it('пропуск вечернего разговора → −HP один раз за дату, в пятницу — без штрафа', () => {
    const ev = eveningMissedEvent('2026-11-17');
    expect(ev).not.toBeNull();
    const r = applyEvent(base(), ev!, ctx());
    expect(r.stats.hp).toBe(100 + RULES.eveningMissed.hp);
    const again = applyEvent(r.stats, ev!, ctx({ journal: r.events }));
    expect(again.applied).toBe(false);
    expect(eveningMissedEvent('2026-11-20')).toBeNull();
  });
});
